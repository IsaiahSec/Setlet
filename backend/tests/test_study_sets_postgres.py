import psycopg2
import pytest
from datetime import datetime

from src.db import get_connection


def create_set(client, headers, title="Biology", description=""):
    return client.post(
        "/sets",
        headers=headers,
        json={"title": title, "description": description},
    )


def make_set_public(client, headers, study_set):
    response = client.patch(
        f"/sets/{study_set['id']}", headers=headers, json={"visibility": "public"}
    )
    assert response.status_code == 200
    return study_set


def assert_iso8601_utc(value):
    assert datetime.fromisoformat(value).tzinfo is not None
    assert value.endswith("+00:00")


def test_postgres_set_crud(pg_client, make_user):
    user_id, headers = make_user("set-owner@example.com", "correct horse")

    created = create_set(pg_client, headers, "  Biology  ", "Cell structure")

    assert created.status_code == 201
    assert created.json["title"] == "Biology"
    assert created.json["description"] == "Cell structure"
    assert created.json["visibility"] == "private"
    assert set(created.json) == {
        "id",
        "title",
        "description",
        "visibility",
        "created_at",
        "updated_at",
    }

    set_id = created.json["id"]
    listed = pg_client.get("/sets", headers=headers)
    assert listed.status_code == 200
    assert listed.json == {"sets": [{**created.json, "card_count": 0}]}

    read = pg_client.get(f"/sets/{set_id}", headers=headers)
    assert read.status_code == 200
    assert read.json["owner_id"] == user_id
    assert read.json["owner_name"] == "set-owner"
    assert read.json["is_owner"] is True
    assert {key: read.json[key] for key in created.json} == created.json
    assert read.json["cards"] == []

    updated = pg_client.patch(
        f"/sets/{set_id}",
        headers=headers,
        json={"title": "  Biology  101 ", "description": "Cells", "id": 999},
    )
    assert updated.status_code == 200
    assert updated.json["title"] == "Biology  101"
    assert updated.json["description"] == "Cells"
    assert updated.json["id"] == set_id
    assert updated.json["owner_id"] == user_id

    deleted = pg_client.delete(f"/sets/{set_id}", headers=headers)
    assert deleted.status_code == 204
    assert deleted.get_data() == b""
    assert pg_client.get(f"/sets/{set_id}", headers=headers).status_code == 404


def test_postgres_list_only_returns_owners_sets_most_recent_first(pg_client, make_user):
    _, owner_headers = make_user("list-owner@example.com", "correct horse")
    _, other_headers = make_user("list-other@example.com", "correct horse")
    first = create_set(pg_client, owner_headers, "First").json
    second = create_set(pg_client, owner_headers, "Second").json
    other_set = create_set(pg_client, other_headers, "Other").json
    pg_client.patch(
        f"/sets/{other_set['id']}", headers=other_headers, json={"visibility": "public"}
    )

    updated = pg_client.patch(
        f"/sets/{first['id']}", headers=owner_headers, json={"description": "updated"}
    )
    assert updated.status_code == 200

    response = pg_client.get("/sets", headers=owner_headers)

    assert response.status_code == 200
    assert [item["id"] for item in response.json["sets"]] == [
        first["id"],
        second["id"],
    ]


def test_postgres_non_owner_cannot_read_update_or_delete_set(pg_client, make_user):
    owner_id, owner_headers = make_user("private-owner@example.com", "correct horse")
    _, other_headers = make_user("private-other@example.com", "correct horse")
    created = create_set(pg_client, owner_headers, "Private set").json
    set_id = created["id"]

    read = pg_client.get(f"/sets/{set_id}", headers=other_headers)
    updated = pg_client.patch(
        f"/sets/{set_id}", headers=other_headers, json={"title": "Hijacked"}
    )
    deleted = pg_client.delete(f"/sets/{set_id}", headers=other_headers)

    for response in (read, updated, deleted):
        assert response.status_code == 404
        assert response.json == {"error": "Set not found"}

    unchanged = pg_client.get(f"/sets/{set_id}", headers=owner_headers)
    assert unchanged.status_code == 200
    assert unchanged.json["title"] == "Private set"
    assert unchanged.json["owner_id"] == owner_id
    assert unchanged.json["visibility"] == "private"


@pytest.mark.parametrize(
    ("visibility", "viewer", "expected_status"),
    [
        ("private", "owner", 200),
        ("private", "other", 404),
        ("public", "owner", 200),
        ("public", "other", 200),
    ],
)
def test_postgres_set_visibility_read_matrix(
    pg_client, make_user, visibility, viewer, expected_status
):
    owner_id, owner_headers = make_user("matrix-owner@example.com", "correct horse")
    _, other_headers = make_user("matrix-other@example.com", "correct horse")
    study_set = create_set(pg_client, owner_headers, "Visibility matrix").json
    if visibility == "public":
        changed = pg_client.patch(
            f"/sets/{study_set['id']}",
            headers=owner_headers,
            json={"visibility": "public"},
        )
        assert changed.status_code == 200

    headers = owner_headers if viewer == "owner" else other_headers
    response = pg_client.get(f"/sets/{study_set['id']}", headers=headers)

    assert response.status_code == expected_status
    if expected_status == 404:
        assert response.json == {"error": "Set not found"}
    else:
        assert response.json["owner_id"] == owner_id
        assert response.json["owner_name"] == "matrix-owner"
        assert response.json["is_owner"] is (viewer == "owner")


def test_postgres_owner_can_switch_visibility_and_other_user_access_changes(
    pg_client, make_user
):
    _, owner_headers = make_user("switch-owner@example.com", "correct horse")
    _, other_headers = make_user("switch-other@example.com", "correct horse")
    study_set = create_set(pg_client, owner_headers, "Switch visibility").json
    set_url = f"/sets/{study_set['id']}"

    assert pg_client.get(set_url, headers=other_headers).status_code == 404
    made_public = pg_client.patch(
        set_url, headers=owner_headers, json={"visibility": "public"}
    )
    assert made_public.status_code == 200
    assert made_public.json["visibility"] == "public"
    assert pg_client.get(set_url, headers=other_headers).status_code == 200
    owner_list = pg_client.get("/sets", headers=owner_headers)
    assert owner_list.json["sets"][0]["visibility"] == "public"

    made_private = pg_client.patch(
        set_url, headers=owner_headers, json={"visibility": "private"}
    )
    assert made_private.status_code == 200
    assert made_private.json["visibility"] == "private"
    owner_list = pg_client.get("/sets", headers=owner_headers)
    assert owner_list.json["sets"][0]["visibility"] == "private"
    hidden = pg_client.get(set_url, headers=other_headers)
    assert hidden.status_code == 404
    assert hidden.json == {"error": "Set not found"}


@pytest.mark.parametrize("visibility", ["PUBLIC", None, 1, "", False])
def test_postgres_invalid_visibility_is_rejected_without_changing_set(
    pg_client, make_user, visibility
):
    _, headers = make_user("invalid-visibility@example.com", "correct horse")
    study_set = create_set(pg_client, headers, "Invalid visibility").json

    response = pg_client.patch(
        f"/sets/{study_set['id']}",
        headers=headers,
        json={"visibility": visibility},
    )

    assert response.status_code == 400
    unchanged = pg_client.get(f"/sets/{study_set['id']}", headers=headers)
    assert unchanged.status_code == 200
    assert unchanged.json["visibility"] == "private"


def test_postgres_visibility_check_rejects_direct_invalid_insert(pg_client, make_user):
    owner_id, _ = make_user("check-visibility@example.com", "correct horse")
    conn = get_connection()
    try:
        with pytest.raises(psycopg2.errors.CheckViolation):
            with conn, conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO study_sets "
                    "(owner_id, title, description, visibility) "
                    "VALUES (%s, %s, %s, %s)",
                    (owner_id, "Invalid direct insert", "", "friends"),
                )
    finally:
        conn.close()


@pytest.mark.parametrize(
    "title",
    ["", " " * 4, "x" * 201, 123],
)
def test_postgres_invalid_set_titles_return_400(pg_client, make_user, title):
    _, headers = make_user("invalid-title@example.com", "correct horse")

    response = create_set(pg_client, headers, title)

    assert response.status_code == 400
    assert "error" in response.json


def test_postgres_set_requires_title(pg_client, make_user):
    _, headers = make_user("missing-title@example.com", "correct horse")

    response = pg_client.post("/sets", headers=headers, json={})

    assert response.status_code == 400
    assert response.json == {"error": "Title is required"}


def test_postgres_set_description_is_optional(pg_client, make_user):
    _, headers = make_user("optional-description@example.com", "correct horse")

    response = pg_client.post("/sets", headers=headers, json={"title": "No description"})

    assert response.status_code == 201
    assert response.json["description"] == ""


@pytest.mark.parametrize(("field", "bad_value"), [("title", "bad\x00title"), ("description", "bad\x00description")])
def test_postgres_set_rejects_nul_text_without_writing(
    pg_client, make_user, field, bad_value
):
    _, headers = make_user("set-nul@example.com", "correct horse")
    baseline = create_set(pg_client, headers, "Original title", "Original description").json

    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM study_sets")
            initial_count = cursor.fetchone()[0]
    finally:
        conn.close()

    create_payload = {"title": "Another title", "description": "Another description"}
    create_payload[field] = bad_value
    create_response = pg_client.post("/sets", headers=headers, json=create_payload)
    assert create_response.status_code == 400
    assert "NUL" in create_response.json["error"]

    update_response = pg_client.patch(
        f"/sets/{baseline['id']}", headers=headers, json={field: bad_value}
    )
    assert update_response.status_code == 400
    assert "NUL" in update_response.json["error"]

    read = pg_client.get(f"/sets/{baseline['id']}", headers=headers)
    assert read.status_code == 200
    assert read.json["title"] == "Original title"
    assert read.json["description"] == "Original description"

    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM study_sets")
            assert cursor.fetchone()[0] == initial_count
    finally:
        conn.close()


@pytest.mark.parametrize(
    "description",
    [123, "x" * 1001],
)
def test_postgres_invalid_descriptions_return_400(pg_client, make_user, description):
    _, headers = make_user("invalid-description@example.com", "correct horse")

    response = create_set(pg_client, headers, description=description)

    assert response.status_code == 400
    assert "error" in response.json


def test_postgres_patch_ignores_owner_id_and_accepts_visibility(pg_client, make_user):
    owner_id, owner_headers = make_user("allowlist-owner@example.com", "correct horse")
    other_id, _ = make_user("allowlist-other@example.com", "correct horse")
    created = create_set(pg_client, owner_headers).json

    response = pg_client.patch(
        f"/sets/{created['id']}",
        headers=owner_headers,
        json={"title": "Renamed", "owner_id": other_id, "visibility": "public"},
    )

    assert response.status_code == 200
    assert response.json["title"] == "Renamed"
    assert response.json["owner_id"] == owner_id
    assert response.json["visibility"] == "public"


def test_postgres_set_validation_rejects_non_object_body(pg_client, make_user):
    _, headers = make_user("invalid-body@example.com", "correct horse")

    created = pg_client.post(
        "/sets", headers=headers, data="not json", content_type="text/plain"
    )
    updated = pg_client.patch(
        "/sets/1", headers=headers, data="not json", content_type="text/plain"
    )

    assert created.status_code == 400
    assert created.json == {"error": "Request body must be a JSON object"}
    assert updated.status_code == 400
    assert updated.json == {"error": "Request body must be a JSON object"}


def test_postgres_set_endpoints_require_authentication(pg_client):
    assert pg_client.post("/sets", json={"title": "No token"}).status_code == 401
    assert pg_client.get("/sets").status_code == 401
    assert pg_client.get("/sets/1").status_code == 401
    assert pg_client.patch("/sets/1", json={"title": "No token"}).status_code == 401
    assert pg_client.delete("/sets/1").status_code == 401


def test_postgres_card_crud_and_card_counts(pg_client, make_user):
    _, headers = make_user("card-crud@example.com", "correct horse")
    study_set = create_set(pg_client, headers, "Cards").json
    set_id = study_set["id"]

    first = pg_client.post(
        f"/sets/{set_id}/cards",
        headers=headers,
        json={"front": "  Question one ", "back": " Answer one  "},
    )
    second = pg_client.post(
        f"/sets/{set_id}/cards",
        headers=headers,
        json={"front": "Question two", "back": "Answer two"},
    )

    assert first.status_code == 201
    assert first.json == {
        "id": first.json["id"],
        "set_id": set_id,
        "front": "Question one",
        "back": "Answer one",
    }
    assert second.status_code == 201

    listed = pg_client.get("/sets", headers=headers)
    assert listed.json["sets"][0]["card_count"] == 2
    read = pg_client.get(f"/sets/{set_id}", headers=headers)
    assert read.json["cards"] == [
        {"id": first.json["id"], "front": "Question one", "back": "Answer one"},
        {"id": second.json["id"], "front": "Question two", "back": "Answer two"},
    ]

    updated = pg_client.patch(
        f"/sets/{set_id}/cards/{first.json['id']}",
        headers=headers,
        json={"front": "  Updated question ", "set_id": 999, "id": 999},
    )
    assert updated.status_code == 200
    assert updated.json == {
        "id": first.json["id"],
        "set_id": set_id,
        "front": "Updated question",
        "back": "Answer one",
    }

    deleted = pg_client.delete(
        f"/sets/{set_id}/cards/{second.json['id']}", headers=headers
    )
    assert deleted.status_code == 204
    assert deleted.get_data() == b""
    listed_after_delete = pg_client.get("/sets", headers=headers)
    assert listed_after_delete.json["sets"][0]["card_count"] == 1


def test_postgres_non_owner_cannot_manipulate_cards(pg_client, make_user):
    _, owner_headers = make_user("card-owner@example.com", "correct horse")
    _, other_headers = make_user("card-other@example.com", "correct horse")
    study_set = create_set(pg_client, owner_headers, "Private cards").json
    set_id = study_set["id"]
    card = pg_client.post(
        f"/sets/{set_id}/cards",
        headers=owner_headers,
        json={"front": "Original front", "back": "Original back"},
    ).json

    create = pg_client.post(
        f"/sets/{set_id}/cards",
        headers=other_headers,
        json={"front": "Intruder", "back": "Intruder"},
    )
    update = pg_client.patch(
        f"/sets/{set_id}/cards/{card['id']}",
        headers=other_headers,
        json={"front": "Changed"},
    )
    delete = pg_client.delete(
        f"/sets/{set_id}/cards/{card['id']}", headers=other_headers
    )

    for response in (create, update, delete):
        assert response.status_code == 404
        assert response.json == {"error": "Not found"}

    unchanged = pg_client.get(f"/sets/{set_id}", headers=owner_headers)
    assert unchanged.json["title"] == "Private cards"
    assert unchanged.json["cards"] == [
        {"id": card["id"], "front": "Original front", "back": "Original back"}
    ]


def test_postgres_non_owner_cannot_mutate_public_set_or_cards(pg_client, make_user):
    _, owner_headers = make_user("public-card-owner@example.com", "correct horse")
    _, other_headers = make_user("public-card-other@example.com", "correct horse")
    study_set = create_set(pg_client, owner_headers, "Public cards").json
    set_id = study_set["id"]
    card = pg_client.post(
        f"/sets/{set_id}/cards",
        headers=owner_headers,
        json={"front": "Original front", "back": "Original back"},
    ).json
    made_public = pg_client.patch(
        f"/sets/{set_id}", headers=owner_headers, json={"visibility": "public"}
    )
    assert made_public.status_code == 200

    update_set = pg_client.patch(
        f"/sets/{set_id}",
        headers=other_headers,
        json={"title": "Hijacked", "visibility": "private"},
    )
    delete_set = pg_client.delete(f"/sets/{set_id}", headers=other_headers)
    create_card = pg_client.post(
        f"/sets/{set_id}/cards",
        headers=other_headers,
        json={"front": "Intruder", "back": "Intruder"},
    )
    update_card = pg_client.patch(
        f"/sets/{set_id}/cards/{card['id']}",
        headers=other_headers,
        json={"front": "Changed"},
    )
    delete_card = pg_client.delete(
        f"/sets/{set_id}/cards/{card['id']}", headers=other_headers
    )

    for response in (update_set, delete_set):
        assert response.status_code == 404
        assert response.json == {"error": "Set not found"}
    for response in (create_card, update_card, delete_card):
        assert response.status_code == 404
        assert response.json == {"error": "Not found"}

    unchanged = pg_client.get(f"/sets/{set_id}", headers=owner_headers)
    assert unchanged.status_code == 200
    assert unchanged.json["title"] == "Public cards"
    assert unchanged.json["visibility"] == "public"
    assert unchanged.json["cards"] == [
        {"id": card["id"], "front": "Original front", "back": "Original back"}
    ]


def test_postgres_card_id_from_another_set_is_not_found(pg_client, make_user):
    _, headers = make_user("wrong-card-set@example.com", "correct horse")
    first_set = create_set(pg_client, headers, "First").json
    second_set = create_set(pg_client, headers, "Second").json
    card = pg_client.post(
        f"/sets/{first_set['id']}/cards",
        headers=headers,
        json={"front": "Front", "back": "Back"},
    ).json

    update = pg_client.patch(
        f"/sets/{second_set['id']}/cards/{card['id']}",
        headers=headers,
        json={"front": "Changed"},
    )
    delete = pg_client.delete(
        f"/sets/{second_set['id']}/cards/{card['id']}", headers=headers
    )

    for response in (update, delete):
        assert response.status_code == 404
        assert response.json == {"error": "Not found"}
    assert pg_client.get(f"/sets/{first_set['id']}", headers=headers).json["cards"] == [
        {"id": card["id"], "front": "Front", "back": "Back"}
    ]


def test_postgres_deleting_set_cascades_to_cards(pg_client, make_user):
    _, headers = make_user("card-cascade@example.com", "correct horse")
    study_set = create_set(pg_client, headers, "Cascade").json
    card = pg_client.post(
        f"/sets/{study_set['id']}/cards",
        headers=headers,
        json={"front": "Front", "back": "Back"},
    ).json

    response = pg_client.delete(f"/sets/{study_set['id']}", headers=headers)

    assert response.status_code == 204
    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute("SELECT id FROM cards WHERE id = %s", (card["id"],))
            assert cursor.fetchone() is None
    finally:
        conn.close()


@pytest.mark.parametrize(
    ("payload", "method"),
    [
        ({"back": "Back"}, "post"),
        ({"front": "Front"}, "post"),
        ({"front": " ", "back": "Back"}, "post"),
        ({"front": "Front", "back": " "}, "post"),
        ({"front": "x" * 2001, "back": "Back"}, "post"),
        ({"front": "Front", "back": "x" * 2001}, "post"),
        ({"front": 123, "back": "Back"}, "post"),
        ({"front": "Front", "back": 123}, "post"),
        ({"back": " "}, "patch"),
        ({"front": None}, "patch"),
    ],
)
def test_postgres_invalid_card_fields_return_400(pg_client, make_user, payload, method):
    _, headers = make_user("invalid-card@example.com", "correct horse")
    study_set = create_set(pg_client, headers, "Validation").json
    url = f"/sets/{study_set['id']}/cards"
    if method == "patch":
        card = pg_client.post(
            url, headers=headers, json={"front": "Front", "back": "Back"}
        ).json
        url += f"/{card['id']}"

    response = getattr(pg_client, method)(url, headers=headers, json=payload)

    assert response.status_code == 400
    assert "error" in response.json


def test_postgres_card_endpoints_require_authentication(pg_client):
    assert (
        pg_client.post("/sets/1/cards", json={"front": "Q", "back": "A"}).status_code
        == 401
    )
    assert (
        pg_client.patch("/sets/1/cards/1", json={"front": "Q"}).status_code == 401
    )
    assert pg_client.delete("/sets/1/cards/1").status_code == 401


def test_postgres_card_endpoints_reject_non_object_bodies(pg_client, make_user):
    _, headers = make_user("card-body@example.com", "correct horse")
    study_set = create_set(pg_client, headers, "Body validation").json

    create = pg_client.post(
        f"/sets/{study_set['id']}/cards",
        headers=headers,
        data="not json",
        content_type="text/plain",
    )
    update = pg_client.patch(
        f"/sets/{study_set['id']}/cards/1",
        headers=headers,
        data="not json",
        content_type="text/plain",
    )

    assert create.status_code == 400
    assert create.json == {"error": "Request body must be a JSON object"}
    assert update.status_code == 400
    assert update.json == {"error": "Request body must be a JSON object"}


@pytest.mark.parametrize(("field", "bad_value"), [("front", "bad\x00front"), ("back", "bad\x00back")])
def test_postgres_card_rejects_nul_text_without_writing(
    pg_client, make_user, field, bad_value
):
    _, headers = make_user("card-nul@example.com", "correct horse")
    study_set = create_set(pg_client, headers, "Card NUL").json
    baseline_card = pg_client.post(
        f"/sets/{study_set['id']}/cards",
        headers=headers,
        json={"front": "Original front", "back": "Original back"},
    ).json

    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM cards WHERE set_id = %s", (study_set["id"],))
            initial_count = cursor.fetchone()[0]
    finally:
        conn.close()

    create_payload = {"front": "Second front", "back": "Second back"}
    create_payload[field] = bad_value
    create_response = pg_client.post(
        f"/sets/{study_set['id']}/cards", headers=headers, json=create_payload
    )
    assert create_response.status_code == 400
    assert "NUL" in create_response.json["error"]

    update_response = pg_client.patch(
        f"/sets/{study_set['id']}/cards/{baseline_card['id']}",
        headers=headers,
        json={field: bad_value},
    )
    assert update_response.status_code == 400
    assert "NUL" in update_response.json["error"]

    read = pg_client.get(f"/sets/{study_set['id']}", headers=headers)
    assert read.status_code == 200
    assert read.json["cards"] == [
        {
            "id": baseline_card["id"],
            "front": "Original front",
            "back": "Original back",
        }
    ]

    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM cards WHERE set_id = %s", (study_set["id"],))
            assert cursor.fetchone()[0] == initial_count
    finally:
        conn.close()


def test_postgres_public_sets_exclude_private_and_owned_sets(pg_client, make_user):
    owner_id, owner_headers = make_user("public-owner@example.com", "correct horse")
    _, viewer_headers = make_user("public-viewer@example.com", "correct horse")
    private_set = create_set(
        pg_client, owner_headers, "Needle private", "needle description"
    ).json
    public_set = make_set_public(
        pg_client,
        owner_headers,
        create_set(pg_client, owner_headers, "Needle public").json,
    )
    own_private_set = create_set(
        pg_client, viewer_headers, "Needle my private"
    ).json
    own_public_set = make_set_public(
        pg_client,
        viewer_headers,
        create_set(pg_client, viewer_headers, "Needle my public").json,
    )

    for query in ("", "?q=needle"):
        response = pg_client.get(f"/sets/public{query}", headers=viewer_headers)
        assert response.status_code == 200
        result_ids = {item["id"] for item in response.json["sets"]}
        assert result_ids == {public_set["id"]}
        assert private_set["id"] not in result_ids
        assert own_private_set["id"] not in result_ids
        assert own_public_set["id"] not in result_ids

    item = pg_client.get("/sets/public", headers=viewer_headers).json["sets"][0]
    assert item["owner_id"] == owner_id


def test_postgres_public_search_matches_title_description_and_all_terms(
    pg_client, make_user
):
    _, owner_headers = make_user("search-owner@example.com", "correct horse")
    _, viewer_headers = make_user("search-viewer@example.com", "correct horse")
    matching = make_set_public(
        pg_client,
        owner_headers,
        create_set(
            pg_client, owner_headers, "CrImSoN sky", "quiet COmet"
        ).json,
    )
    title_only = make_set_public(
        pg_client,
        owner_headers,
        create_set(pg_client, owner_headers, "Crimson", "unrelated").json,
    )
    description_only = make_set_public(
        pg_client,
        owner_headers,
        create_set(pg_client, owner_headers, "Comet", "unrelated").json,
    )

    response = pg_client.get(
        "/sets/public?q=CRIMSON%20comet", headers=viewer_headers
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json["sets"]] == [matching["id"]]
    trimmed = pg_client.get(
        "/sets/public?q=%20%20crimson%20%20", headers=viewer_headers
    ).json
    assert {item["id"] for item in trimmed["sets"]} == {
        matching["id"],
        title_only["id"],
    }
    for query, expected_ids in (
        ("crimson", {matching["id"], title_only["id"]}),
        ("quiet", {matching["id"]}),
        ("comet", {matching["id"], description_only["id"]}),
        ("unrelated", {title_only["id"], description_only["id"]}),
    ):
        result = pg_client.get(
            f"/sets/public?q={query}", headers=viewer_headers
        ).json
        assert {item["id"] for item in result["sets"]} == expected_ids
    assert description_only["id"] not in [
        item["id"] for item in response.json["sets"]
    ]


def test_postgres_public_search_treats_like_characters_literally(
    pg_client, make_user
):
    _, owner_headers = make_user("special-owner@example.com", "correct horse")
    _, viewer_headers = make_user("special-viewer@example.com", "correct horse")
    literal = make_set_public(
        pg_client,
        owner_headers,
        create_set(pg_client, owner_headers, "100%_safe\\path").json,
    )
    description_literal = make_set_public(
        pg_client,
        owner_headers,
        create_set(
            pg_client, owner_headers, "Description match", "prefix 100%_safe\\path"
        ).json,
    )
    wildcard_decoy = make_set_public(
        pg_client,
        owner_headers,
        create_set(pg_client, owner_headers, "100xx_safe\\path").json,
    )
    underscore_decoy = make_set_public(
        pg_client,
        owner_headers,
        create_set(pg_client, owner_headers, "100%xsafe\\path").json,
    )

    response = pg_client.get(
        "/sets/public?q=100%25_safe%5Cpath", headers=viewer_headers
    )
    assert response.status_code == 200
    assert response.status_code == 200
    result_ids = {item["id"] for item in response.json["sets"]}
    assert result_ids == {literal["id"], description_literal["id"]}
    assert wildcard_decoy["id"] not in result_ids
    assert underscore_decoy["id"] not in result_ids


def test_postgres_public_search_uses_at_most_five_terms(pg_client, make_user):
    _, owner_headers = make_user("five-terms-owner@example.com", "correct horse")
    _, viewer_headers = make_user("five-terms-viewer@example.com", "correct horse")
    study_set = make_set_public(
        pg_client,
        owner_headers,
        create_set(pg_client, owner_headers, "one two three four five").json,
    )

    response = pg_client.get(
        "/sets/public?q=one%20two%20three%20four%20five%20missing",
        headers=viewer_headers,
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json["sets"]] == [study_set["id"]]


def test_postgres_public_search_paginates_and_orders_results(pg_client, make_user):
    _, owner_headers = make_user("pagination-owner@example.com", "correct horse")
    _, viewer_headers = make_user("pagination-viewer@example.com", "correct horse")
    sets = [
        make_set_public(
            pg_client,
            owner_headers,
            create_set(pg_client, owner_headers, f"Page result {index}").json,
        )
        for index in range(3)
    ]
    connection = get_connection()
    try:
        with connection, connection.cursor() as cursor:
            cursor.execute(
                "UPDATE study_sets SET updated_at = CASE id "
                "WHEN %s THEN TIMESTAMP '2025-01-01 00:00:00' "
                "WHEN %s THEN TIMESTAMP '2025-01-03 00:00:00' "
                "WHEN %s THEN TIMESTAMP '2025-01-02 00:00:00' END "
                "WHERE id IN (%s, %s, %s)",
                (
                    sets[0]["id"],
                    sets[1]["id"],
                    sets[2]["id"],
                    *(study_set["id"] for study_set in sets),
                ),
            )
    finally:
        connection.close()

    first_page = pg_client.get(
        "/sets/public?page=1&page_size=1", headers=viewer_headers
    ).json
    second_page = pg_client.get(
        "/sets/public?page=2&page_size=1", headers=viewer_headers
    ).json
    last_page = pg_client.get(
        "/sets/public?page=3&page_size=1", headers=viewer_headers
    ).json
    past_last_page = pg_client.get(
        "/sets/public?page=4&page_size=1", headers=viewer_headers
    ).json
    largest_page = pg_client.get(
        "/sets/public?page=1&page_size=50", headers=viewer_headers
    ).json
    default_page = pg_client.get("/sets/public", headers=viewer_headers).json

    assert first_page["page"] == 1
    assert first_page["page_size"] == 1
    assert first_page["total"] == 3
    assert [item["id"] for item in first_page["sets"]] == [sets[1]["id"]]
    assert [item["id"] for item in second_page["sets"]] == [sets[2]["id"]]
    assert [item["id"] for item in last_page["sets"]] == [sets[0]["id"]]
    assert past_last_page["sets"] == []
    assert past_last_page["total"] == 3
    assert largest_page["page_size"] == 50
    assert len(largest_page["sets"]) == 3
    assert default_page["page"] == 1
    assert default_page["page_size"] == 20


def test_postgres_datetime_fields_are_iso8601_utc(pg_client, make_user):
    _, owner_headers = make_user("iso-owner@example.com", "correct horse")
    _, viewer_headers = make_user("iso-viewer@example.com", "correct horse")
    created = create_set(pg_client, owner_headers, "ISO Set").json
    make_set_public(pg_client, owner_headers, created)

    owned_list = pg_client.get("/sets", headers=owner_headers)
    read = pg_client.get(f"/sets/{created['id']}", headers=owner_headers)
    public_list = pg_client.get("/sets/public", headers=viewer_headers)

    for value in (
        created["created_at"],
        created["updated_at"],
        owned_list.json["sets"][0]["created_at"],
        owned_list.json["sets"][0]["updated_at"],
        read.json["created_at"],
        read.json["updated_at"],
        public_list.json["sets"][0]["updated_at"],
    ):
        assert_iso8601_utc(value)


def test_postgres_public_search_enforces_page_bounds(pg_client, make_user):
    _, headers = make_user("page-bounds@example.com", "correct horse")

    page_one = pg_client.get("/sets/public?page=1", headers=headers)
    page_ten_thousand = pg_client.get("/sets/public?page=10000", headers=headers)
    too_large = pg_client.get("/sets/public?page=10001", headers=headers)
    extreme = pg_client.get("/sets/public?page=99999999999999999999", headers=headers)

    assert page_one.status_code == 200
    assert page_ten_thousand.status_code == 200
    assert too_large.status_code == 400
    assert extreme.status_code == 400


def test_postgres_public_search_rejects_nul_query(pg_client, make_user):
    _, headers = make_user("nul-query@example.com", "correct horse")

    response = pg_client.get("/sets/public?q=%00", headers=headers)

    assert response.status_code == 400
    assert "NUL" in response.json["error"]


@pytest.mark.parametrize(
    "query",
    [
        "?q=" + "x" * 101,
        "?page=0",
        "?page=-1",
        "?page=invalid",
        "?page=10001",
        "?page=99999999999999999999",
        "?page_size=0",
        "?page_size=51",
        "?page_size=invalid",
    ],
)
def test_postgres_public_search_rejects_invalid_parameters(
    pg_client, make_user, query
):
    _, headers = make_user("invalid-search@example.com", "correct horse")

    response = pg_client.get(f"/sets/public{query}", headers=headers)

    assert response.status_code == 400
    assert "error" in response.json


def test_postgres_public_search_includes_card_count_and_limited_owner_name(
    pg_client, make_user
):
    _, owner_headers = make_user("owner-name@example.com", "correct horse")
    _, viewer_headers = make_user("owner-name-viewer@example.com", "correct horse")
    study_set = make_set_public(
        pg_client,
        owner_headers,
        create_set(pg_client, owner_headers, "No card contents").json,
    )
    pg_client.post(
        f"/sets/{study_set['id']}/cards",
        headers=owner_headers,
        json={"front": "Secret front", "back": "Secret back"},
    )

    response = pg_client.get("/sets/public", headers=viewer_headers)

    assert response.status_code == 200
    item = response.json["sets"][0]
    assert item["card_count"] == 1
    assert item["owner_name"] == "owner-name"
    assert set(item) == {
        "id",
        "title",
        "description",
        "card_count",
        "owner_id",
        "owner_name",
        "updated_at",
    }
    assert "owner-name@example.com" not in response.get_data(as_text=True)
    assert "Secret front" not in response.get_data(as_text=True)
    assert "Secret back" not in response.get_data(as_text=True)


def test_postgres_public_set_disappears_after_becoming_private(pg_client, make_user):
    _, owner_headers = make_user("flip-owner@example.com", "correct horse")
    _, viewer_headers = make_user("flip-viewer@example.com", "correct horse")
    study_set = make_set_public(
        pg_client,
        owner_headers,
        create_set(pg_client, owner_headers, "Visibility needle").json,
    )

    visible = pg_client.get(
        "/sets/public?q=needle", headers=viewer_headers
    ).json["sets"]
    made_private = pg_client.patch(
        f"/sets/{study_set['id']}",
        headers=owner_headers,
        json={"visibility": "private"},
    )
    hidden = pg_client.get(
        "/sets/public?q=needle", headers=viewer_headers
    ).json["sets"]

    assert [item["id"] for item in visible] == [study_set["id"]]
    assert made_private.status_code == 200
    assert hidden == []


def test_postgres_public_search_requires_authentication(pg_client):
    response = pg_client.get("/sets/public")
    assert response.status_code == 401

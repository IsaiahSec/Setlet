import psycopg2
import pytest

from src.db import get_connection


def create_set(client, headers, title="Biology", description=""):
    return client.post(
        "/sets",
        headers=headers,
        json={"title": title, "description": description},
    )


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

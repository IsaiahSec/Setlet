import pytest


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
    assert listed.json == {"sets": [created.json]}

    read = pg_client.get(f"/sets/{set_id}", headers=headers)
    assert read.status_code == 200
    assert read.json["owner_id"] == user_id
    assert {key: read.json[key] for key in created.json} == created.json

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
    create_set(pg_client, other_headers, "Other")

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


def test_postgres_patch_ignores_owner_and_visibility(pg_client, make_user):
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
    assert response.json["visibility"] == "private"


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

import pytest

from src.db import get_connection


def create_note(client, headers, title="Note", body="Body"):
    return client.post("/notes", headers=headers, json={"title": title, "body": body})


def test_postgres_notes_crud_happy_path(pg_client, make_user):
    _, headers = make_user("notes-owner@example.com", "correct horse")

    created = create_note(pg_client, headers, "  My note  ", "Study this")

    assert created.status_code == 201
    assert created.json["title"] == "My note"
    assert created.json["body"] == "Study this"
    assert set(created.json) == {"id", "title", "body", "created_at"}

    note_id = created.json["id"]

    listed = pg_client.get("/notes", headers=headers)
    assert listed.status_code == 200
    assert listed.json == {
        "notes": [
            {
                "id": note_id,
                "title": "My note",
                "created_at": created.json["created_at"],
            }
        ]
    }

    read = pg_client.get(f"/notes/{note_id}", headers=headers)
    assert read.status_code == 200
    assert read.json == created.json

    updated = pg_client.patch(
        f"/notes/{note_id}",
        headers=headers,
        json={"title": "Renamed", "body": "Updated body"},
    )
    assert updated.status_code == 200
    assert updated.json["id"] == note_id
    assert updated.json["title"] == "Renamed"
    assert updated.json["body"] == "Updated body"
    assert updated.json["created_at"] == created.json["created_at"]

    deleted = pg_client.delete(f"/notes/{note_id}", headers=headers)
    assert deleted.status_code == 204
    assert deleted.get_data() == b""

    missing = pg_client.get(f"/notes/{note_id}", headers=headers)
    assert missing.status_code == 404
    assert missing.json == {"error": "Note not found"}


def test_postgres_notes_list_only_returns_callers_notes_newest_first(pg_client, make_user):
    _, owner_headers = make_user("notes-list-owner@example.com", "correct horse")
    _, other_headers = make_user("notes-list-other@example.com", "correct horse")

    first = create_note(pg_client, owner_headers, "First", "Body A").json
    second = create_note(pg_client, owner_headers, "Second", "Body B").json
    create_note(pg_client, other_headers, "Other", "Body C")

    response = pg_client.get("/notes", headers=owner_headers)

    assert response.status_code == 200
    assert [note["id"] for note in response.json["notes"]] == [
        second["id"],
        first["id"],
    ]
    assert all("body" not in note for note in response.json["notes"])


def test_postgres_notes_missing_or_non_owner_return_404_and_note_unchanged(
    pg_client, make_user
):
    _, owner_headers = make_user("notes-private-owner@example.com", "correct horse")
    _, other_headers = make_user("notes-private-other@example.com", "correct horse")

    created = create_note(pg_client, owner_headers, "Private", "Owner body").json
    note_id = created["id"]

    read = pg_client.get(f"/notes/{note_id}", headers=other_headers)
    patched = pg_client.patch(
        f"/notes/{note_id}", headers=other_headers, json={"title": "Hijacked"}
    )
    deleted = pg_client.delete(f"/notes/{note_id}", headers=other_headers)

    for response in (read, patched, deleted):
        assert response.status_code == 404
        assert response.json == {"error": "Note not found"}

    unchanged = pg_client.get(f"/notes/{note_id}", headers=owner_headers)
    assert unchanged.status_code == 200
    assert unchanged.json == created


@pytest.mark.parametrize(
    "payload",
    [
        {"title": "", "body": "ok"},
        {"title": "   ", "body": "ok"},
        {"title": "x" * 201, "body": "ok"},
        {"title": 123, "body": "ok"},
        {"title": "ok", "body": ""},
        {"title": "ok", "body": "x" * 50001},
        {"title": "ok", "body": 123},
    ],
)
def test_postgres_note_create_validation_returns_400(pg_client, make_user, payload):
    _, headers = make_user("notes-validation-create@example.com", "correct horse")

    response = pg_client.post("/notes", headers=headers, json=payload)

    assert response.status_code == 400
    assert "error" in response.json


@pytest.mark.parametrize(
    "payload",
    [
        {"title": ""},
        {"title": " " * 3},
        {"title": "x" * 201},
        {"title": False},
        {"body": ""},
        {"body": "x" * 50001},
        {"body": []},
    ],
)
def test_postgres_note_patch_validation_returns_400_and_does_not_write(
    pg_client, make_user, payload
):
    _, headers = make_user("notes-validation-update@example.com", "correct horse")
    created = create_note(pg_client, headers, "Original", "Original body").json

    response = pg_client.patch(f"/notes/{created['id']}", headers=headers, json=payload)

    assert response.status_code == 400

    unchanged = pg_client.get(f"/notes/{created['id']}", headers=headers)
    assert unchanged.status_code == 200
    assert unchanged.json == created


def test_postgres_note_rejects_nul_text_without_writing(pg_client, make_user):
    _, headers = make_user("notes-nul@example.com", "correct horse")

    created = pg_client.post(
        "/notes",
        headers=headers,
        json={"title": "bad\x00title", "body": "ok"},
    )
    assert created.status_code == 400
    assert "NUL" in created.json["error"]

    valid = create_note(pg_client, headers, "Clean", "body").json
    updated = pg_client.patch(
        f"/notes/{valid['id']}",
        headers=headers,
        json={"body": "bad\x00body"},
    )
    assert updated.status_code == 400
    assert "NUL" in updated.json["error"]

    unchanged = pg_client.get(f"/notes/{valid['id']}", headers=headers)
    assert unchanged.status_code == 200
    assert unchanged.json == valid


def test_postgres_note_patch_ignores_user_id_and_id(pg_client, make_user):
    _, headers = make_user("notes-allowlist@example.com", "correct horse")
    created = create_note(pg_client, headers, "Original", "Body").json

    response = pg_client.patch(
        f"/notes/{created['id']}",
        headers=headers,
        json={"user_id": 999, "id": 1000},
    )

    assert response.status_code == 200
    assert response.json == created


def test_postgres_deleting_user_cascades_notes(pg_client, make_user):
    user_id, headers = make_user("notes-cascade@example.com", "correct horse")
    create_note(pg_client, headers, "A", "Body")
    create_note(pg_client, headers, "B", "Body")

    connection = get_connection()
    try:
        with connection, connection.cursor() as cursor:
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
            cursor.execute("SELECT COUNT(*) FROM notes WHERE user_id = %s", (user_id,))
            assert cursor.fetchone()[0] == 0
    finally:
        connection.close()


def test_postgres_note_endpoints_require_authentication(pg_client, make_user):
    _, headers = make_user("notes-auth@example.com", "correct horse")
    note_id = create_note(pg_client, headers).json["id"]

    assert pg_client.post("/notes", json={"title": "No token", "body": "Body"}).status_code == 401
    assert pg_client.get("/notes").status_code == 401
    assert pg_client.get(f"/notes/{note_id}").status_code == 401
    assert pg_client.patch(f"/notes/{note_id}", json={"title": "No token"}).status_code == 401
    assert pg_client.delete(f"/notes/{note_id}").status_code == 401

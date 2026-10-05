from src.app import create_app


def test_health_endpoint_returns_ok():
    client = create_app().test_client()

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json == {"status": "ok"}


def test_health_endpoint_allows_default_frontend_origin(monkeypatch):
    monkeypatch.delenv("FRONTEND_ORIGIN", raising=False)
    client = create_app().test_client()

    response = client.get("/health", headers={"Origin": "http://localhost:5173"})

    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"


def test_cors_preflight_allows_configured_origin_and_headers(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://setlet.vercel.app")
    client = create_app().test_client()

    response = client.options(
        "/auth/login",
        headers={
            "Origin": "https://setlet.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
    )

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == "https://setlet.vercel.app"
    assert "authorization" in response.headers["Access-Control-Allow-Headers"].lower()
    assert "content-type" in response.headers["Access-Control-Allow-Headers"].lower()


def test_cors_rejects_disallowed_origin(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://setlet.vercel.app")
    client = create_app().test_client()

    response = client.get("/health", headers={"Origin": "https://untrusted.example"})

    assert "Access-Control-Allow-Origin" not in response.headers

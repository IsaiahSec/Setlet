
import { beforeEach, afterEach, describe, test, expect, vi } from "vitest";
import { login, signup, getToken, setToken, request } from "./api";

// reset before each test
beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
});

// clean up after each test
afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
});

describe("API authentication", () => {

    // login errors should not clear an existing token
    test("login 401 does not automatically log out", async () => {
        setToken("old-token");

        fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: "Invalid credentials" }),
        });

        await expect(
            login("test@example.com", "wrong-password")
        ).rejects.toThrow("Invalid credentials");

        expect(getToken()).toBe("old-token");
    });

    // signup errors should not clear an existing token
    test("signup 401 does not automatically log out", async () => {
        setToken("old-token");

        fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: "Signup failed" }),
        });

        await expect(
            signup("test@example.com", "password123")
        ).rejects.toThrow("Signup failed");

        expect(getToken()).toBe("old-token");
    });

    // login should not send a stale token
    test("login request does not include authorization header", async () => {
        setToken("old-token");

        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ token: "new-token" }),
        });

        await login("test@example.com", "password123");

        const options = fetch.mock.calls[0][1];

        expect(options.headers.Authorization).toBeUndefined();
    });

    // protected requests should clear the token on 401
    test("clears token on protected API 401", async () => {
        setToken("fake-token");

        fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: "Unauthorized" }),
        });

        await expect(
            request("/sets", { method: "GET" })
        ).rejects.toThrow("Unauthorized");

        // token should be removed
        expect(getToken()).toBeNull();

        // protected requests must send the token
        const options = fetch.mock.calls[0][1];

        expect(options.headers.Authorization).toBe(
            "Bearer fake-token"
        );
    });

});

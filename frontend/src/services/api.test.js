
import { beforeEach, afterEach, describe, test, expect, vi } from "vitest";
import {
    login,
    signup,
    getToken,
    setToken,
    request,
    reorderCards,
    listSets,
    deriveCards,
    listNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote,
    listRecentSets,
    listPublicSets,
} from "./api";

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

        expect(getToken()).toBeNull();

        const options = fetch.mock.calls[0][1];

        expect(options.headers.Authorization).toBe(
            "Bearer fake-token"
        );
    });
});

describe("card reordering API", () => {
    test("sends the complete card order with PUT", async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ cards: [] }),
        });

        await reorderCards(2, [3, 1, 2]);

        expect(fetch).toHaveBeenCalledWith(
            expect.stringMatching(/\/sets\/2\/cards\/order$/),
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({ card_ids: [3, 1, 2] }),
            })
        );
    });
});

describe("study set listing API", () => {
    test("passes search and public filter query parameters", async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({}),
        });

        await listSets("Biology chapter");
        await listPublicSets("Biology", 2, 10, {
            ownerId: 7,
            sharedFrom: "2025-01-01",
            sharedTo: "2025-02-01",
        });

        expect(fetch.mock.calls[0][0]).toMatch(
            /\/sets\?q=Biology\+chapter$/
        );

        expect(fetch.mock.calls[1][0]).toMatch(
            /\/sets\/public\?q=Biology&page=2&page_size=10&owner_id=7&shared_from=2025-01-01&shared_to=2025-02-01$/
        );
    });

    test("requests the current user's recent study sets", async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ sets: [] }),
        });

        await listRecentSets();

        expect(fetch).toHaveBeenCalledWith(
            expect.stringMatching(/\/sets\/recent$/),
            expect.objectContaining({ method: "GET" })
        );
    });
});

describe("notes API", () => {
    test("uses the supported list, get, create, update, and delete contracts", async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ notes: [] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ id: 8, title: "Study", body: "Notes" }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({ id: 8, title: "Study", body: "Notes" }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ id: 8, title: "Updated", body: "Notes" }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 204,
                json: async () => {
                    throw new Error("No response body");
                },
            });

        await listNotes();
        await getNote(8);
        await createNote("Study", "Notes");
        await updateNote(8, { title: "Updated", body: "Notes" });
        await deleteNote(8);

        expect(fetch.mock.calls[0][0]).toMatch(/\/notes$/);
        expect(fetch.mock.calls[0][1].method).toBe("GET");
        expect(fetch.mock.calls[1][0]).toMatch(/\/notes\/8$/);
        expect(fetch.mock.calls[1][1].method).toBe("GET");
        expect(fetch.mock.calls[2][1]).toMatchObject({
            method: "POST",
            body: JSON.stringify({ title: "Study", body: "Notes" }),
        });
        expect(fetch.mock.calls[3][1]).toMatchObject({
            method: "PATCH",
            body: JSON.stringify({ title: "Updated", body: "Notes" }),
        });
        expect(fetch.mock.calls[4][0]).toMatch(/\/notes\/8$/);
        expect(fetch.mock.calls[4][1].method).toBe("DELETE");
    });
});

describe("note card derivation API", () => {
    test("posts to the documented note derive endpoint without a request body", async () => {
        setToken("notes-token");
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                cards: [{ front: "Term", back: "Definition" }],
            }),
        });

        await deriveCards(12);

        expect(fetch).toHaveBeenCalledWith(
            expect.stringMatching(/\/notes\/12\/derive$/),
            expect.objectContaining({ method: "POST" })
        );
        expect(fetch.mock.calls[0][1].body).toBeUndefined();
        expect(fetch.mock.calls[0][1].headers.Authorization).toBe(
            "Bearer notes-token"
        );
    });
});

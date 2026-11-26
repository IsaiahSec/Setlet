
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import {
    afterEach,
    beforeEach,
    describe,
    test,
    expect,
    vi,
} from "vitest";
import App from "./App";

// clean up after each test
afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
});

// reset before each test
beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
});

describe("App routing", () => {

    // user without a token goes to login
    test("redirects to login when not logged in", async () => {
        render(<App />);

        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Login" })
            ).toBeTruthy();
        });

        expect(window.location.pathname).toBe("/login");
    });

    // user with a token goes to mysets
    test("redirects to mysets when logged in", async () => {
        localStorage.setItem("token", "fake-token");

        render(<App />);

        await waitFor(() => {
            expect(window.location.pathname).toBe("/mysets");
        });
    });

    // unknown paths redirect to login without token
    test("redirects unknown routes to login", async () => {
        window.history.replaceState({}, "", "/unknown");

        render(<App />);

        await waitFor(() => {
            expect(window.location.pathname).toBe("/login");
        });
    });

    test("protects the feedback route from signed-out users", async () => {
        window.history.replaceState({}, "", "/feedback");

        render(<App />);

        await waitFor(() => {
            expect(window.location.pathname).toBe("/login");
        });
        expect(screen.queryByRole("link", { name: "Feedback" })).toBeNull();
    });

    test("protects the history route from signed-out users", async () => {
        window.history.replaceState({}, "", "/history");

        render(<App />);

        await waitFor(() => {
            expect(window.location.pathname).toBe("/login");
        });
    });

    test("shows the feedback page and navigation link for signed-in users", async () => {
        localStorage.setItem("token", "feedback-token");
        window.history.replaceState({}, "", "/feedback");

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 201,
                json: async () => ({ message: "Thanks for your feedback" }),
            })
        );

        render(<App />);

        expect(
            await screen.findByRole("heading", { name: "Send Feedback" })
        ).toBeTruthy();
        expect(
            screen.getByRole("link", { name: "Feedback" }).getAttribute("href")
        ).toBe("/feedback");
    });

    test("shows the history page and navigation link for signed-in users", async () => {
        localStorage.setItem("token", "history-token");
        window.history.replaceState({}, "", "/history");

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    totals: {
                        reviews: 0,
                        cards_reviewed: 0,
                        sets_studied: 0,
                    },
                    last_30_days: [],
                    upcoming: { overdue: 0, days: [] },
                }),
            })
        );

        render(<App />);

        expect(
            await screen.findByRole("heading", { name: "Your History" })
        ).toBeTruthy();
        expect(
            screen.getByRole("link", { name: "History" }).getAttribute("href")
        ).toBe("/history");
    });

    // logout clears token and hides navigation
    test("logs out and redirects to login", async () => {
        localStorage.setItem("token", "fake-token");
        window.history.replaceState({}, "", "/mysets");

        render(<App />);

        // navigation is visible while logged in
        expect(
            screen.getByRole("link", { name: "My Sets" })
        ).toBeTruthy();

        // click logout
        fireEvent.click(
            screen.getByRole("button", { name: "Log out" })
        );

        // token should be removed
        expect(localStorage.getItem("token")).toBeNull();

        // user should return to login
        await waitFor(() => {
            expect(window.location.pathname).toBe("/login");
        });

        // navigation should disappear
        expect(
            screen.queryByRole("link", { name: "My Sets" })
        ).toBeNull();
    });

});

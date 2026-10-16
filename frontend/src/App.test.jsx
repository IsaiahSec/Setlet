
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, test, expect } from "vitest";
import App from "./App";

// clean up after each test
afterEach(() => {
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

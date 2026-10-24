
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, test, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Login from "./Login";
import { login, setToken } from "../services/api";

// fake api
vi.mock("../services/api", () => ({
    login: vi.fn().mockResolvedValue({ token: "fake-token" }),
    setToken: vi.fn(),
}));

// render login inside a router
function renderLogin(onLogin = vi.fn()) {
    return render(
        <MemoryRouter>
            <Login onLogin={onLogin} />
        </MemoryRouter>
    );
}

// clean up after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("Login page", () => {
    // check heading
    test("shows the heading", () => {
        renderLogin();

        const heading = screen.getByRole("heading", { name: "Login" });
        expect(heading).toBeTruthy();
    });

    // check button
    test("shows the login button", () => {
        renderLogin();

        const button = screen.getByRole("button", { name: "Login" });
        expect(button).toBeTruthy();
    });

    // check labels
    test("shows email and password labels", () => {
        renderLogin();

        const emailLabel = screen.getByText("Email");
        const passwordLabel = screen.getByText("Password");

        expect(emailLabel).toBeTruthy();
        expect(passwordLabel).toBeTruthy();
    });

    // check the inputs are there
    test("shows the input fields", () => {
        renderLogin();

        const inputs = document.querySelectorAll("input");
        expect(inputs.length).toBe(2);
    });

    // check login submission
    test("submits login credentials", async () => {
        const onLogin = vi.fn();
        renderLogin(onLogin);

        const inputs = document.querySelectorAll("input");

        fireEvent.change(inputs[0], {
            target: { value: "test@example.com" },
        });

        fireEvent.change(inputs[1], {
            target: { value: "password123" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Login" }));

        await waitFor(() => {
            expect(login).toHaveBeenCalledWith(
                "test@example.com",
                "password123"
            );
            expect(setToken).toHaveBeenCalledWith("fake-token");
            expect(onLogin).toHaveBeenCalledOnce();
        });
    });
});


import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, test, expect, vi } from "vitest";
import Signup from "./Signup";
import { signup } from "../services/api";

// fake api
vi.mock("../services/api", () => ({
    signup: vi.fn().mockResolvedValue({}),
}));

// render Signup with router
function renderSignup() {
    return render(
        <MemoryRouter>
            <Signup />
        </MemoryRouter>
    );
}

// clean up after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("Signup page", () => {
    // check heading
    test("shows the heading", () => {
        renderSignup();

        const heading = screen.getByRole("heading", { name: "Sign Up" });
        expect(heading).toBeTruthy();
    });

    // check button
    test("shows the create account button", () => {
        renderSignup();

        const button = screen.getByRole("button", {
            name: "Create Account",
        });
        expect(button).toBeTruthy();
    });

    // check labels
    test("shows all the labels", () => {
        renderSignup();

        expect(screen.getByText("Email")).toBeTruthy();
        expect(screen.getByText("Password")).toBeTruthy();
        expect(screen.getByText("Confirm Password")).toBeTruthy();
    });

    // check the inputs are there
    test("shows the input fields", () => {
        renderSignup();

        const inputs = document.querySelectorAll("input");
        expect(inputs.length).toBe(3);
    });

    // check signup credentials
    test("submits signup credentials", async () => {
        renderSignup();

        const inputs = document.querySelectorAll("input");

        fireEvent.change(inputs[0], {
            target: { value: "test@example.com" },
        });

        fireEvent.change(inputs[1], {
            target: { value: "password123" },
        });

        fireEvent.change(inputs[2], {
            target: { value: "password123" },
        });

        fireEvent.click(
            screen.getByRole("button", {
                name: "Create Account",
            })
        );

        await waitFor(() => {
            expect(signup).toHaveBeenCalledWith(
                "test@example.com",
                "password123"
            );
        });
    });
});

import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, test, expect, vi } from "vitest";
import Signup from "./Signup";

// fake api
vi.mock("../services/api", () => ({
    signup: vi.fn(),
}));

// clean up after each test
afterEach(() => {
    cleanup();
});

describe("Signup page", () => {
    // check heading
    test("shows the heading", () => {
        render(<Signup />);

        const heading = screen.getByRole("heading", { name: "Sign Up" });
        expect(heading).toBeTruthy();
    });

    // check button
    test("shows the create account button", () => {
        render(<Signup />);

        const button = screen.getByRole("button", { name: "Create Account" });
        expect(button).toBeTruthy();
    });

    // check labels
    test("shows all the labels", () => {
        render(<Signup />);

        const emailLabel = screen.getByText("Email");
        const passwordLabel = screen.getByText("Password");
        const confirmLabel = screen.getByText("Confirm Password");

        expect(emailLabel).toBeTruthy();
        expect(passwordLabel).toBeTruthy();
        expect(confirmLabel).toBeTruthy();
    });

    // check the inputs are there
    test("shows the input fields", () => {
        render(<Signup />);

        const inputs = document.querySelectorAll("input");
        expect(inputs.length).toBe(3);
    });
});
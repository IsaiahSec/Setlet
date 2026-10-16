
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, afterEach, describe, test, expect } from "vitest";
import ProtectedRoute from "./ProtectedRoute";

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("ProtectedRoute", () => {
    test("redirects to login when there is no token", () => {
        render(
            <MemoryRouter initialEntries={["/mysets"]}>
                <Routes>
                    <Route path="/login" element={<h1>Login</h1>} />
                    <Route element={<ProtectedRoute />}>
                        <Route path="/mysets" element={<h1>My Sets</h1>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByRole("heading", { name: "Login" })).toBeTruthy();
        expect(screen.queryByRole("heading", { name: "My Sets" })).toBeNull();
    });

    test("allows access when token exists", () => {
        localStorage.setItem("token", "fake-token");

        render(
            <MemoryRouter initialEntries={["/mysets"]}>
                <Routes>
                    <Route path="/login" element={<h1>Login</h1>} />
                    <Route element={<ProtectedRoute />}>
                        <Route path="/mysets" element={<h1>My Sets</h1>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByRole("heading", { name: "My Sets" })).toBeTruthy();
    });
});

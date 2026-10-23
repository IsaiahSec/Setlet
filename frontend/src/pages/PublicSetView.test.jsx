
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublicSetView from "./PublicSetView";
import { getSet } from "../services/api";

const mockNavigate = vi.fn();

vi.mock("../services/api", () => ({
  getSet: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useParams: () => ({ setId: "5" }),
    useNavigate: () => mockNavigate,
  };
});

function renderPublicSetView() {
  return render(
    <MemoryRouter>
      <PublicSetView />
    </MemoryRouter>
  );
}

const exampleSet = {
  id: 5,
  title: "Biology",
  description: "Chapter 1",
  owner_name: "Alex",
  is_owner: false,
  cards: [
    {
      id: 1,
      front: "What is DNA?",
      back: "Genetic material",
    },
  ],
};

describe("PublicSetView page", () => {
  beforeEach(() => {
    cleanup();
    vi.resetAllMocks();
    getSet.mockResolvedValue(exampleSet);
  });

  test("displays set information and flashcards", async () => {
    renderPublicSetView();

    expect(await screen.findByText("Biology")).toBeTruthy();
    expect(screen.getByText("Chapter 1")).toBeTruthy();
    expect(screen.getByText("by Alex")).toBeTruthy();
    expect(screen.getByText("What is DNA?")).toBeTruthy();
    expect(screen.getByText("Genetic material")).toBeTruthy();

    expect(getSet).toHaveBeenCalledWith("5");
  });

  test("provides a link to study the set", async () => {
    renderPublicSetView();

    const link = await screen.findByRole("link", {
      name: "Study This Set",
    });

    expect(link.getAttribute("href")).toBe("/study/5");
  });

  test("does not show editing or deletion controls", async () => {
    renderPublicSetView();

    expect(await screen.findByText("Biology")).toBeTruthy();

    expect(
      screen.queryByRole("button", { name: /edit/i })
    ).toBeNull();

    expect(
      screen.queryByRole("button", { name: /delete/i })
    ).toBeNull();
  });

  test("redirects the owner to their set editor", async () => {
    getSet.mockResolvedValue({
      ...exampleSet,
      is_owner: true,
    });

    renderPublicSetView();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/mysets/5",
        { replace: true }
      );
    });
  });

  test("shows Set not found for a 404 response", async () => {
    const error = new Error("Not found");
    error.status = 404;
    getSet.mockRejectedValue(error);

    renderPublicSetView();

    expect(
      await screen.findByText("Set not found")
    ).toBeTruthy();

    expect(
      screen.getByRole("link", {
        name: "Back to Browse",
      }).getAttribute("href")
    ).toBe("/public");
  });

  test("shows an empty message when there are no cards", async () => {
    getSet.mockResolvedValue({
      ...exampleSet,
      cards: [],
    });

    renderPublicSetView();

    expect(
      await screen.findByText(
        "No flashcards in this set yet."
      )
    ).toBeTruthy();
  });

  test("displays other API errors", async () => {
    getSet.mockRejectedValue(
      new Error("Unable to load set")
    );

    renderPublicSetView();

    expect(
      (await screen.findByRole("alert")).textContent
    ).toBe("Unable to load set");
  });
});

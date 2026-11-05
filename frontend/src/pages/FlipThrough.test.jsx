import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FlipThrough from "./FlipThrough";
import { getSet, getStudySession, reviewCard } from "../services/api";

vi.mock("../services/api", () => ({
  getSet: vi.fn(),
  getStudySession: vi.fn(),
  reviewCard: vi.fn(),
}));

const sampleCards = [
  { id: 1, front: "First front", back: "First back" },
  { id: 2, front: "Second front", back: "Second back" },
  { id: 3, front: "Third front", back: "Third back" },
];

function renderFlipThrough() {
  return render(
    <MemoryRouter initialEntries={["/flip/12"]}>
      <Routes>
        <Route path="/flip/:setId" element={<FlipThrough />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("FlipThrough page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSet.mockResolvedValue({
      id: 12,
      title: "Biology",
      cards: sampleCards,
    });
  });

  afterEach(() => cleanup());

  test("loads one flashcard and flips it by clicking", async () => {
    renderFlipThrough();

    expect(await screen.findByText("First front")).toBeTruthy();
    expect(screen.getByText("1 of 3")).toBeTruthy();
    expect(screen.getByText("Flip-through mode does not save study progress.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /flip flashcard/i }));

    expect(screen.getByText("First back")).toBeTruthy();
    expect(getSet).toHaveBeenCalledWith("12");
  });

  test("flips the card with Space", async () => {
    renderFlipThrough();
    await screen.findByText("First front");

    fireEvent.keyDown(window, { code: "Space", key: " " });

    expect(screen.getByText("First back")).toBeTruthy();
  });

  test("navigates with Previous and Next buttons", async () => {
    renderFlipThrough();
    await screen.findByText("First front");

    expect(screen.getByRole("button", { name: "Previous" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Second front")).toBeTruthy();
    expect(screen.getByText("2 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("First front")).toBeTruthy();
    expect(screen.getByText("1 of 3")).toBeTruthy();
  });

  test("navigates with Left and Right arrow keys", async () => {
    renderFlipThrough();
    await screen.findByText("First front");

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Second front")).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("First front")).toBeTruthy();
  });

  test("shuffle retains every card without duplication", async () => {
    renderFlipThrough();
    await screen.findByText("First front");

    fireEvent.click(screen.getByRole("checkbox", { name: "Shuffle" }));
    const observedCards = [];

    for (let index = 0; index < sampleCards.length; index += 1) {
      const visibleCard = sampleCards.find((item) =>
        screen.queryByText(item.front)
      );
      observedCards.push(visibleCard.front);

      if (index < sampleCards.length - 1) {
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
      }
    }

    expect(observedCards).toHaveLength(sampleCards.length);
    expect(new Set(observedCards)).toEqual(
      new Set(sampleCards.map((item) => item.front))
    );
  });

  test("shows completion summary and restarts the deck", async () => {
    renderFlipThrough();
    await screen.findByText("First front");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: "Flip-through complete" })).toBeTruthy();
    expect(screen.getByText("You viewed all 3 cards.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));

    expect(screen.getByText("First front")).toBeTruthy();
    expect(screen.getByText("1 of 3")).toBeTruthy();
  });

  test("handles an empty study set", async () => {
    getSet.mockResolvedValue({ id: 12, title: "Empty", cards: [] });
    renderFlipThrough();

    expect(await screen.findByText("No flashcards in this set yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  test.each([404, 403])("treats status %i as a missing or inaccessible set", async (status) => {
    const error = new Error("Unavailable");
    error.status = status;
    getSet.mockRejectedValue(error);
    renderFlipThrough();

    expect(await screen.findByRole("heading", { name: "Set not found" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to My Sets" }).getAttribute("href")).toBe("/mysets");
  });

  test("does not request study sessions or save reviews", async () => {
    renderFlipThrough();
    await screen.findByText("First front");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(getStudySession).not.toHaveBeenCalled();
    expect(reviewCard).not.toHaveBeenCalled();
  });
});
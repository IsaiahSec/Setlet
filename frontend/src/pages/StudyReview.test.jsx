
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StudyReview from "./StudyReview";
import * as api from "../services/api";

vi.mock("../services/api", () => ({
  getStudyQueue: vi.fn(),
  submitReview: vi.fn(),
}));

const sampleSession = {
  set: { id: 2, title: "Biology Chapter 1" },
  cards: [
    {
      id: 10,
      front: "What is DNA?",
      back: "Genetic material.",
      is_new: true,
    },
    {
      id: 11,
      front: "What is a cell?",
      back: "The basic unit of life.",
      is_new: true,
    },
  ],
  counts: {
    total: 2,
    new: 2,
    due: 0,
    upcoming: 0,
  },
};

function renderStudyReview() {
  return render(
    <MemoryRouter initialEntries={["/study/2"]}>
      <Routes>
        <Route path="/study/:setId" element={<StudyReview />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();

  api.getStudyQueue.mockResolvedValue({
    ...sampleSession,
    cards: sampleSession.cards.map((card) => ({ ...card })),
  });

  api.submitReview.mockResolvedValue({
    card_id: 10,
    due_at: "2026-10-23T12:00:00",
    interval_days: 1,
    ease_factor: 2.5,
  });
});

describe("Study Review", () => {
  it("loads the study session and shows the first card", async () => {
    renderStudyReview();

    expect(screen.getByText("Loading flashcards...")).toBeTruthy();

    expect(await screen.findByText("What is DNA?")).toBeTruthy();
    expect(screen.getByText("Biology Chapter 1")).toBeTruthy();
    expect(api.getStudyQueue).toHaveBeenCalledWith("2");
  });

  it("flips a flashcard when clicked", async () => {
    renderStudyReview();

    await screen.findByText("What is DNA?");

    fireEvent.click(
      screen.getByRole("button", { name: "Flip flashcard" })
    );

    expect(screen.getByText("Genetic material.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /3\. Good/ })).toBeTruthy();
  });

  it("flips a flashcard with the Space key", async () => {
    renderStudyReview();

    await screen.findByText("What is DNA?");

    fireEvent.keyDown(window, { code: "Space", key: " " });

    expect(screen.getByText("Genetic material.")).toBeTruthy();
  });

  it("sends the correct card ID and rating to the API", async () => {
    renderStudyReview();

    await screen.findByText("What is DNA?");

    fireEvent.click(
      screen.getByRole("button", { name: "Flip flashcard" })
    );

    fireEvent.click(
      screen.getByRole("button", { name: /3\. Good/ })
    );

    await waitFor(() => {
      expect(api.submitReview).toHaveBeenCalledWith(10, 3);
    });

    expect(await screen.findByText("What is a cell?")).toBeTruthy();
  });

  it("supports rating with keyboard keys 1 through 4", async () => {
    renderStudyReview();

    await screen.findByText("What is DNA?");

    fireEvent.keyDown(window, { code: "Space", key: " " });
    fireEvent.keyDown(window, { key: "4", code: "Digit4" });

    await waitFor(() => {
      expect(api.submitReview).toHaveBeenCalledWith(10, 4);
    });
  });

  it("puts an Again card at the back of the queue", async () => {
    renderStudyReview();

    await screen.findByText("What is DNA?");

    fireEvent.click(
      screen.getByRole("button", { name: "Flip flashcard" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /1\. Again/ })
    );

    expect(await screen.findByText("What is a cell?")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Flip flashcard" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /3\. Good/ })
    );

    expect(await screen.findByText("What is DNA?")).toBeTruthy();
  });

  it("keeps the same card when saving a review fails", async () => {
    api.submitReview.mockRejectedValueOnce(
      new Error("Unable to save review")
    );

    renderStudyReview();

    await screen.findByText("What is DNA?");

    fireEvent.click(
      screen.getByRole("button", { name: "Flip flashcard" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /3\. Good/ })
    );

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Unable to save review"
    );

    expect(screen.getByText("Genetic material.")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /3\. Good/ })
    );

    await waitFor(() => {
      expect(api.submitReview).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText("What is a cell?")).toBeTruthy();
  });

  it("shows the empty state with study counts", async () => {
    api.getStudyQueue.mockResolvedValue({
      set: { id: 2, title: "Biology Chapter 1" },
      cards: [],
      counts: {
        total: 5,
        new: 0,
        due: 0,
        upcoming: 5,
      },
    });

    renderStudyReview();

    expect(
      await screen.findByText("Nothing to study right now")
    ).toBeTruthy();

    expect(screen.getByText("New: 0")).toBeTruthy();
    expect(screen.getByText("Due: 0")).toBeTruthy();
    expect(screen.getByText("Upcoming: 5")).toBeTruthy();
  });

  it("shows the summary and reloads when Study again is clicked", async () => {
    renderStudyReview();

    await screen.findByText("What is DNA?");

    fireEvent.click(
      screen.getByRole("button", { name: "Flip flashcard" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /3\. Good/ })
    );

    await screen.findByText("What is a cell?");

    fireEvent.click(
      screen.getByRole("button", { name: "Flip flashcard" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /4\. Easy/ })
    );

    expect(await screen.findByText("Study Complete!")).toBeTruthy();
    expect(screen.getByText("Reviews completed: 2")).toBeTruthy();
    expect(screen.getByText("Rated Again: 0")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Study again" })
    );

    await waitFor(() => {
      expect(api.getStudyQueue).toHaveBeenCalledTimes(2);
    });
  });

  it("shows Set not found when the API returns 404", async () => {
    const error = new Error("Not found");
    error.status = 404;
    api.getStudyQueue.mockRejectedValue(error);

    renderStudyReview();

    expect(await screen.findByText("Set not found")).toBeTruthy();

    expect(
      screen.getByRole("link", { name: /Back to My Sets/i })
        .getAttribute("href")
    ).toBe("/mysets");
  });

  it("allows retrying when loading the session fails", async () => {
    api.getStudyQueue
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(sampleSession);

    renderStudyReview();

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Network error"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Try again" })
    );

    expect(await screen.findByText("What is DNA?")).toBeTruthy();
    expect(api.getStudyQueue).toHaveBeenCalledTimes(2);
  });
});

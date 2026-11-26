import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import History from "./History";
import { getHistory } from "../services/api";

vi.mock("../services/api", () => ({
  getHistory: vi.fn(),
}));

function makeHistory({
  totals = { reviews: 7, cards_reviewed: 4, sets_studied: 2 },
  hasReviews = true,
} = {}) {
  const last30Days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 9, 20 + index))
      .toISOString()
      .slice(0, 10);

    return {
      date,
      reviews: hasReviews && index === 29 ? 7 : 0,
    };
  });
  const upcomingDays = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 10, 19 + index))
      .toISOString()
      .slice(0, 10);

    return {
      date,
      due: index === 0 ? 2 : 0,
    };
  });

  return {
    totals,
    last_30_days: last30Days,
    upcoming: {
      overdue: hasReviews ? 3 : 0,
      days: upcomingDays,
    },
  };
}

function renderHistory() {
  return render(
    <MemoryRouter>
      <History />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.resetAllMocks();
  getHistory.mockResolvedValue(makeHistory());
});

describe("History page", () => {
  test("renders review totals, the 30-day chart, and upcoming reviews", async () => {
    renderHistory();

    expect(await screen.findByText("Sets studied")).toBeTruthy();
    expect(screen.getByText("Cards reviewed")).toBeTruthy();
    expect(screen.getByText("Total reviews")).toBeTruthy();
    expect(screen.getByText("2", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText("4", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText("7", { selector: "strong" })).toBeTruthy();

    expect(
      screen.getByRole("list", { name: "Daily reviews" }).children
    ).toHaveLength(30);
    expect(
      screen.getByRole("list", { name: "Upcoming reviews" }).children
    ).toHaveLength(14);
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getByText("Cards due over the next 14 days")).toBeTruthy();
    expect(screen.getByText("3", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText("2 cards")).toBeTruthy();
    expect(getHistory).toHaveBeenCalledTimes(1);
  });

  test("shows the no-reviews empty state and zero-filled schedule", async () => {
    getHistory.mockResolvedValue(
      makeHistory({
        totals: { reviews: 0, cards_reviewed: 0, sets_studied: 0 },
        hasReviews: false,
      })
    );

    renderHistory();

    expect(
      await screen.findByText(
        "No reviews yet. Review some cards to see your history here."
      )
    ).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "Daily reviews" }).children
    ).toHaveLength(30);
    expect(
      screen.getByRole("list", { name: "Upcoming reviews" }).children
    ).toHaveLength(14);
    expect(screen.getByText("Overdue")).toBeTruthy();
  });

  test("shows a loading state while the history request is pending", () => {
    getHistory.mockImplementation(() => new Promise(() => {}));

    renderHistory();

    expect(screen.getByRole("status").textContent).toBe(
      "Loading your history..."
    );
  });

  test("shows an API error and retries the request", async () => {
    getHistory
      .mockRejectedValueOnce(new Error("History is unavailable"))
      .mockResolvedValueOnce(makeHistory());

    renderHistory();

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "History is unavailable"
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(screen.getByText("Sets studied")).toBeTruthy();
    });
    expect(getHistory).toHaveBeenCalledTimes(2);
  });
});

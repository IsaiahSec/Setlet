
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublicSets from "./PublicSets";
import { listPublicSets } from "../services/api";

vi.mock("../services/api", () => ({
  listPublicSets: vi.fn(),
}));

function renderPublicSets() {
  return render(
    <MemoryRouter>
      <PublicSets />
    </MemoryRouter>
  );
}

const biologySet = {
  id: 1,
  title: "Biology",
  description: "Chapter 1",
  card_count: 5,
  owner_name: "Alex",
};

describe("PublicSets page", () => {
  beforeEach(() => {
    cleanup();
    vi.resetAllMocks();

    listPublicSets.mockResolvedValue({
      sets: [],
      page: 1,
      page_size: 10,
      total: 0,
    });
  });

  test("displays public sets with their information", async () => {
    listPublicSets.mockResolvedValue({
      sets: [biologySet],
      page: 1,
      page_size: 10,
      total: 1,
    });

    renderPublicSets();

    expect(await screen.findByText("Biology")).toBeTruthy();
    expect(screen.getByText("Chapter 1")).toBeTruthy();
    expect(screen.getByText("5 cards")).toBeTruthy();
    expect(screen.getByText("by Alex")).toBeTruthy();

    expect(
      screen.getByRole("link", { name: "Biology" })
        .getAttribute("href")
    ).toBe("/public/1");
  });

  test("shows an empty message when no public sets exist", async () => {
    renderPublicSets();

    expect(
      await screen.findByText(
        "No public study sets available yet."
      )
    ).toBeTruthy();
  });

  test("searches after a 300 ms debounce", async () => {
    listPublicSets.mockResolvedValue({
      sets: [biologySet],
      page: 1,
      page_size: 10,
      total: 1,
    });

    renderPublicSets();

    await waitFor(() => {
      expect(listPublicSets).toHaveBeenCalledWith("", 1, 10);
    });

    fireEvent.change(
      screen.getByLabelText("Search public sets"),
      { target: { value: "Biology" } }
    );

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(listPublicSets).not.toHaveBeenCalledWith(
      "Biology",
      1,
      10
    );

    await waitFor(() => {
      expect(listPublicSets).toHaveBeenCalledWith(
        "Biology",
        1,
        10
      );
    });
  });

  test("shows a message when a search has no matches", async () => {
    renderPublicSets();

    fireEvent.change(
      screen.getByLabelText("Search public sets"),
      { target: { value: "Unknown topic" } }
    );

    await waitFor(() => {
      expect(listPublicSets).toHaveBeenCalledWith(
        "Unknown topic",
        1,
        10
      );
    });

    expect(
      await screen.findByText(
        "No public sets match your search."
      )
    ).toBeTruthy();
  });

  test("moves to the next and previous pages", async () => {
    listPublicSets.mockImplementation(async (query, page) => ({
      sets: [
        {
          ...biologySet,
          id: page,
          title: `Set ${page}`,
        },
      ],
      page,
      page_size: 10,
      total: 15,
    }));

    renderPublicSets();

    expect(await screen.findByText("Set 1")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Next" })
    );

    await waitFor(() => {
      expect(listPublicSets).toHaveBeenCalledWith("", 2, 10);
    });

    expect(await screen.findByText("Set 2")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Previous" })
    );

    await waitFor(() => {
      expect(listPublicSets).toHaveBeenCalledWith("", 1, 10);
    });

    expect(await screen.findByText("Set 1")).toBeTruthy();
  });

  test("displays an API error", async () => {
    listPublicSets.mockRejectedValue(
      new Error("Unable to load public sets")
    );

    renderPublicSets();

    expect(
      (await screen.findByRole("alert")).textContent
    ).toBe("Unable to load public sets");
  });
});

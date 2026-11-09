
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
import { listPublicSets, listSets } from "../services/api";

vi.mock("../services/api", () => ({
  listPublicSets: vi.fn(),
  listSets: vi.fn(),
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
  owner_id: 7,
  shared_at: "2025-02-14T12:00:00+00:00",
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
    listSets.mockResolvedValue([]);
  });

  test("shows the signed-in user's public sets", async () => {
    listSets.mockResolvedValue([
      {
        id: 62,
        title: "Computer Science",
        description: "Algorithms and data structures",
        visibility: "public",
        card_count: 12,
      },
    ]);

    renderPublicSets();

    expect(await screen.findByText("Computer Science")).toBeTruthy();
    expect(screen.getByText("Your Public Sets")).toBeTruthy();
    expect(screen.getByText("Shared date unavailable")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Computer Science" }).getAttribute("href")
    ).toBe("/public/62");
    expect(listSets).toHaveBeenCalledWith("");
  });

  test("filters to the signed-in user's public sets and clears the filter", async () => {
    listSets.mockResolvedValue([
      {
        id: 62,
        title: "Computer Science",
        visibility: "public",
      },
    ]);
    listPublicSets.mockResolvedValue({
      sets: [{ ...biologySet, title: "Another owner's set" }],
      page: 1,
      page_size: 10,
      total: 1,
    });

    renderPublicSets();
    expect(await screen.findByText("Another owner's set")).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: "More from You" }));

    expect(await screen.findByText("Owner: You")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("Another owner's set")).toBeNull();
    });
    expect(screen.getByText("Computer Science")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear owner filter" }));

    expect(await screen.findByText("Another owner's set")).toBeTruthy();
    expect(screen.queryByText("Owner: You")).toBeNull();
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
    expect(screen.getByText("Shared Feb 14, 2025")).toBeTruthy();

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
      expect(listPublicSets).toHaveBeenCalledWith("", 1, 10, {
        ownerId: undefined,
        sharedFrom: "",
        sharedTo: "",
      });
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
        10,
        { ownerId: undefined, sharedFrom: "", sharedTo: "" }
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
        10,
        { ownerId: undefined, sharedFrom: "", sharedTo: "" }
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
      expect(listPublicSets).toHaveBeenCalledWith("", 2, 10, {
        ownerId: undefined,
        sharedFrom: "",
        sharedTo: "",
      });
    });

    expect(await screen.findByText("Set 2")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Previous" })
    );

    await waitFor(() => {
      expect(listPublicSets).toHaveBeenCalledWith("", 1, 10, {
        ownerId: undefined,
        sharedFrom: "",
        sharedTo: "",
      });
    });

    expect(await screen.findByText("Set 1")).toBeTruthy();
  });

  test("passes shared date filters and resets pagination", async () => {
    listPublicSets.mockImplementation(async (query, page, pageSize) => ({
      sets: [
        {
          ...biologySet,
          title: page === 2 ? "Page two" : "Page one",
        },
      ],
      page,
      page_size: pageSize,
      total: 15,
    }));

    renderPublicSets();
    await screen.findByText("Page one");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Page two");
    await waitFor(() => expect(listPublicSets).toHaveBeenCalledWith("", 2, 10, {
      ownerId: undefined,
      sharedFrom: "",
      sharedTo: "",
    }));

    fireEvent.change(screen.getByLabelText("Shared from"), {
      target: { value: "2025-01-01" },
    });

    await waitFor(() => expect(listPublicSets).toHaveBeenCalledWith("", 1, 10, {
      ownerId: undefined,
      sharedFrom: "2025-01-01",
      sharedTo: "",
    }));
  });

  test("filters by owner and clears the active owner filter", async () => {
    listPublicSets.mockResolvedValue({
      sets: [biologySet],
      page: 1,
      page_size: 10,
      total: 1,
    });

    renderPublicSets();
    fireEvent.click(await screen.findByRole("button", { name: "More from Alex" }));

    await waitFor(() => expect(listPublicSets).toHaveBeenLastCalledWith("", 1, 10, {
      ownerId: 7,
      sharedFrom: "",
      sharedTo: "",
    }));
    expect(screen.getByText("Owner: Alex")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear owner filter" }));

    await waitFor(() => expect(listPublicSets).toHaveBeenLastCalledWith("", 1, 10, {
      ownerId: undefined,
      sharedFrom: "",
      sharedTo: "",
    }));
    expect(screen.queryByText("Owner: Alex")).toBeNull();
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

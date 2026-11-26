
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MySets from "./MySets";
import {
  listSets,
  listRecentSets,
  createSet,
  deleteSet,
} from "../services/api";

const mockNavigate = vi.fn();

vi.mock("../services/api", () => ({
  listSets: vi.fn(),
  listRecentSets: vi.fn(),
  createSet: vi.fn(),
  deleteSet: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderMySets() {
  return render(
    <MemoryRouter>
      <MySets />
    </MemoryRouter>
  );
}

describe("MySets page", () => {
  beforeEach(() => {
    cleanup();
    vi.resetAllMocks();
    listSets.mockResolvedValue([]);
    listRecentSets.mockResolvedValue({ sets: [] });
  });

  test("displays the user's study sets", async () => {
    listSets.mockResolvedValue([
      {
        id: 1,
        title: "Biology",
        description: "Chapter 1",
        card_count: 5,
      },
    ]);

    renderMySets();

    expect(await screen.findByText("Biology")).toBeTruthy();
    expect(screen.getByText("Chapter 1")).toBeTruthy();
    expect(screen.getByText("5 cards")).toBeTruthy();

    expect(
      screen.getByRole("link", { name: "Biology" }).getAttribute("href")
    ).toBe("/mysets/1");
  });

  test("shows a message when there are no sets", async () => {
    renderMySets();

    expect(
      await screen.findByText(
        "No study sets yet. Create your first set above!"
      )
    ).toBeTruthy();
  });

  test("renders recent sets with owner-aware links and names", async () => {
    listRecentSets.mockResolvedValue({
      sets: [
        { id: 1, title: "My Biology", is_owner: true, owner_name: "Me" },
        { id: 2, title: "Shared Math", is_owner: false, owner_name: "Alex" },
        { id: 3, title: "Physics", is_owner: false, owner_name: "Sam" },
        { id: 4, title: "History", is_owner: true },
        { id: 5, title: "Extra set", is_owner: false, owner_name: "Jo" },
      ],
    });

    renderMySets();

    const recentPanel = await screen.findByRole("region", {
      name: "Recently viewed",
    });
    expect(recentPanel.querySelectorAll("article")).toHaveLength(4);
    expect(
      screen.getByRole("link", { name: "My Biology" }).getAttribute("href")
    ).toBe("/mysets/1");
    expect(
      screen.getByRole("link", { name: "Shared Math" }).getAttribute("href")
    ).toBe("/public/2");
    expect(recentPanel.textContent).toContain("By Alex");
    expect(recentPanel.textContent).not.toContain("By Me");
    expect(screen.queryByText("Extra set")).toBeNull();
  });

  test("hides the recent panel when there are no recent sets", async () => {
    renderMySets();

    await screen.findByText("Your Sets");

    expect(
      screen.queryByRole("region", { name: "Recently viewed" })
    ).toBeNull();
  });

  test("keeps My Sets usable when loading recent sets fails", async () => {
    listRecentSets.mockRejectedValue(new Error("Unable to load recents"));
    listSets.mockResolvedValue([
      {
        id: 8,
        title: "Current study set",
        description: "Still available",
        card_count: 2,
      },
    ]);

    renderMySets();

    expect(await screen.findByText("Your Sets")).toBeTruthy();
    const currentSetLink = screen.getByRole("link", {
      name: "Current study set",
    });
    expect(currentSetLink.getAttribute("href")).toBe("/mysets/8");
    expect(
      screen.queryByRole("region", { name: "Recently viewed" })
    ).toBeNull();
  });

  test("searches the user's sets after a 300 ms debounce", async () => {
    renderMySets();

    await waitFor(() => expect(listSets).toHaveBeenCalledWith(""));
    fireEvent.change(screen.getByLabelText("Search your sets"), {
      target: { value: "Biology" },
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(listSets).not.toHaveBeenCalledWith("Biology");

    await waitFor(() => expect(listSets).toHaveBeenCalledWith("Biology"));
  });

  test("shows a distinct empty state when search has no matches", async () => {
    renderMySets();

    fireEvent.change(screen.getByLabelText("Search your sets"), {
      target: { value: "Unknown topic" },
    });

    expect(
      await screen.findByText("No study sets match your search.")
    ).toBeTruthy();
  });

  test("creates a set and navigates to its editor", async () => {
    createSet.mockResolvedValue({
      id: 2,
      title: "Math",
    });

    renderMySets();

    fireEvent.change(screen.getByLabelText("Title *"), {
      target: { value: "Math" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Create Set" })
    );

    await waitFor(() => {
      expect(createSet).toHaveBeenCalledWith("Math", "");
      expect(mockNavigate).toHaveBeenCalledWith("/mysets/2");
    });
  });

  test("deletes a set after confirmation", async () => {
    listSets.mockResolvedValue([
      {
        id: 1,
        title: "Biology",
        description: "Chapter 1",
      },
    ]);

    deleteSet.mockResolvedValue({});

    renderMySets();

    expect(await screen.findByText("Biology")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Delete" })
    );

    expect(screen.getByText("Delete this set?")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Yes, delete" })
    );

    await waitFor(() => {
      expect(deleteSet).toHaveBeenCalledWith(1);
      expect(deleteSet).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole("link", { name: "Biology" })
      ).toBeNull();
    });
  });

  test("displays an API error message", async () => {
    listSets.mockRejectedValue(
      new Error("Unable to load sets")
    );

    renderMySets();

    expect(
      (await screen.findByRole("alert")).textContent
    ).toBe("Unable to load sets");
  });

  test("displays a Public badge for public study sets", async () => {
    listSets.mockResolvedValue([
      {
        id: 1,
        title: "Biology",
        description: "Chapter 1",
        card_count: 5,
        visibility: "public",
      },
    ]);

    renderMySets();

    expect(await screen.findByText("Biology")).toBeTruthy();
    expect(screen.getByText("Public")).toBeTruthy();
    expect(screen.queryByText("Private")).toBeNull();
  });

  test("displays a Private badge for private study sets", async () => {
    listSets.mockResolvedValue([
      {
        id: 2,
        title: "Math",
        description: "Chapter 2",
        card_count: 3,
        visibility: "private",
      },
    ]);

    renderMySets();

    expect(await screen.findByText("Math")).toBeTruthy();
    expect(screen.getByText("Private")).toBeTruthy();
    expect(screen.queryByText("Public")).toBeNull();
  });

  test("displays Study and Flip through links for each set", async () => {
    listSets.mockResolvedValue([
      {
        id: 1,
        title: "Biology",
        description: "Chapter 1",
      },
      {
        id: 2,
        title: "Math",
        description: "Chapter 2",
      },
    ]);

    renderMySets();

    expect(await screen.findByText("Biology")).toBeTruthy();

    const studyLinks = screen.getAllByRole("link", {
      name: "Study",
    });

    expect(studyLinks).toHaveLength(2);
    expect(studyLinks[0].getAttribute("href")).toBe("/study/1");
    expect(studyLinks[1].getAttribute("href")).toBe("/study/2");

    const flipLinks = screen.getAllByRole("link", {
      name: "Flip through",
    });

    expect(flipLinks).toHaveLength(2);
    expect(flipLinks[0].getAttribute("href")).toBe("/flip/1");
    expect(flipLinks[1].getAttribute("href")).toBe("/flip/2");
  });

});

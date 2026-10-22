
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
import { listSets, createSet, deleteSet } from "../services/api";

const mockNavigate = vi.fn();

vi.mock("../services/api", () => ({
  listSets: vi.fn(),
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

});

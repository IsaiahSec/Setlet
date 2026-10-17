
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SetEditor from "./SetEditor";
import * as api from "../services/api";

vi.mock("../services/api", () => ({
  getSet: vi.fn(),
  updateSet: vi.fn(),
  createCard: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
}));

const sampleSet = {
  id: 2,
  title: "Biology Chapter 1",
  description: "Cells",
  cards: [
    {
      id: 1,
      front: "What is a cell?",
      back: "The basic unit of life.",
    },
  ],
};

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={["/mysets/2"]}>
      <Routes>
        <Route path="/mysets/:setId" element={<SetEditor />} />
      </Routes>
    </MemoryRouter>
  );
}
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();

  api.getSet.mockResolvedValue({
    ...sampleSet,
    cards: sampleSet.cards.map((card) => ({ ...card })),
  });

  api.updateSet.mockResolvedValue({
    id: 2,
    title: "Biology Chapter 2",
    description: "Cells",
  });

  api.createCard.mockResolvedValue({
    id: 3,
    front: "What is DNA?",
    back: "Genetic material.",
  });

  api.updateCard.mockResolvedValue({
    id: 1,
    front: "What is a cell?",
    back: "The smallest unit of life.",
  });

  api.deleteCard.mockResolvedValue({});
});

describe("Set Editor", () => {
  it("loads the study set and its cards", async () => {
    renderEditor();

    expect(screen.getByText("Loading study set...")).toBeTruthy();

    expect(
      await screen.findByDisplayValue("Biology Chapter 1")
    ).toBeTruthy();

    expect(
      screen.getByDisplayValue("What is a cell?")
    ).toBeTruthy();

    expect(screen.getByText("Cards (1)")).toBeTruthy();

    expect(api.getSet).toHaveBeenCalledWith("2");
  });

  it("updates the study set title", async () => {
    renderEditor();

    const titleInput = await screen.findByDisplayValue(
      "Biology Chapter 1"
    );

    fireEvent.change(titleInput, {
      target: { value: "Biology Chapter 2" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Save Changes" })
    );

    await waitFor(() => {
      expect(api.updateSet).toHaveBeenCalledWith("2", {
        title: "Biology Chapter 2",
        description: "Cells",
      });
    });

    expect(
      await screen.findByText("Study set updated successfully.")
    ).toBeTruthy();
  });

  it("adds a new flashcard", async () => {
    renderEditor();

    await screen.findByText("Cards (1)");

    fireEvent.change(screen.getByLabelText("Front", {
      selector: "#new-front",
    }), {
      target: { value: "What is DNA?" },
    });

    fireEvent.change(screen.getByLabelText("Back", {
      selector: "#new-back",
    }), {
      target: { value: "Genetic material." },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Create Card" })
    );

    await waitFor(() => {
      expect(api.createCard).toHaveBeenCalledWith(
        "2",
        "What is DNA?",
        "Genetic material."
      );
    });

    expect(await screen.findByText("Cards (2)")).toBeTruthy();
  });

  it("updates an existing flashcard", async () => {
    renderEditor();

    const backInput = await screen.findByDisplayValue(
      "The basic unit of life."
    );

    fireEvent.change(backInput, {
      target: { value: "The smallest unit of life." },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Save Card" })
    );

    await waitFor(() => {
      expect(api.updateCard).toHaveBeenCalledWith(
        "2",
        1,
        {
          front: "What is a cell?",
          back: "The smallest unit of life.",
        }
      );
    });

    expect(
      await screen.findByText("Card updated successfully.")
    ).toBeTruthy();
  });

  it("deletes a flashcard", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));

    try {
      renderEditor();

      await screen.findByText("Cards (1)");

      fireEvent.click(
        screen.getByRole("button", { name: "Delete" })
      );

      await waitFor(() => {
        expect(api.deleteCard).toHaveBeenCalledWith("2", 1);
      });

      expect(await screen.findByText("Cards (0)")).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows an error when loading fails", async () => {
    api.getSet.mockRejectedValue(
      new Error("Unable to load study set")
    );

    renderEditor();

    expect(
      await screen.findByRole("alert")
    ).toHaveProperty(
      "textContent",
      "Unable to load study set"
    );
  });

  it("shows an error when the study set is not found (404)", async () => {
    api.getSet.mockRejectedValue(
      new Error("Study set not found")
    );

    renderEditor();

    expect(
      await screen.findByRole("alert")
    ).toHaveProperty(
      "textContent",
      "Study set not found"
    );
  });

  it("shows a validation error when updating a study set fails", async () => {
    api.updateSet.mockRejectedValue(
      new Error("Title is required")
    );

    renderEditor();

    await screen.findByDisplayValue("Biology Chapter 1");

    fireEvent.click(
      screen.getByRole("button", { name: "Save Changes" })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveProperty(
      "textContent",
      "Title is required"
    );
  });

});

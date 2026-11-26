import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NoteDetail from "./NoteDetail";
import Notes from "./Notes";
import {
  createCard,
  createSet,
  deleteNote,
  deriveCards,
  getNote,
  listNotes,
  listSets,
  updateNote,
} from "../services/api";

vi.mock("../services/api", () => ({
  createCard: vi.fn(),
  createSet: vi.fn(),
  createNote: vi.fn(),
  deleteNote: vi.fn(),
  deriveCards: vi.fn(),
  getNote: vi.fn(),
  listNotes: vi.fn(),
  listSets: vi.fn(),
  updateNote: vi.fn(),
}));

const existingNote = {
  id: 12,
  title: "Biology",
  body: "Cells and their structures.",
  created_at: "2026-11-18T12:00:00+00:00",
};

const derivedCandidates = [
  { front: "Mitosis", back: "Cell division" },
  { front: "Meiosis", back: "Cell division producing gametes" },
];

function renderNoteDetail() {
  return render(
    <MemoryRouter initialEntries={["/notes/12"]}>
      <Routes>
        <Route path="/notes" element={<Notes />} />
        <Route path="/notes/:noteId" element={<NoteDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.resetAllMocks();
  getNote.mockResolvedValue({ ...existingNote });
  listNotes.mockResolvedValue({ notes: [] });
  listSets.mockResolvedValue({
    sets: [{ id: 7, title: "Existing set" }],
  });
});

describe("Note detail page", () => {
  test("loads a note and saves edited title and body", async () => {
    updateNote.mockResolvedValue({
      ...existingNote,
      title: "Updated biology",
      body: "Updated note body",
    });

    renderNoteDetail();

    const titleInput = await screen.findByLabelText("Title *");
    expect(titleInput.value).toBe("Biology");
    expect(screen.getByLabelText("Body *").value).toBe(
      "Cells and their structures."
    );

    fireEvent.change(titleInput, {
      target: { value: "Updated biology" },
    });
    fireEvent.change(screen.getByLabelText("Body *"), {
      target: { value: "Updated note body" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateNote).toHaveBeenCalledWith("12", {
        title: "Updated biology",
        body: "Updated note body",
      });
    });
    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      "Note saved."
    );
    expect(titleInput.value).toBe("Updated biology");
  });

  test("deletes a note after inline confirmation and returns to the list", async () => {
    deleteNote.mockResolvedValue({});

    renderNoteDetail();

    await screen.findByLabelText("Title *");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Delete this note?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(
      await screen.findByText("No notes yet. Create your first note above!")
    ).toBeTruthy();
    expect(deleteNote).toHaveBeenCalledWith("12");
    expect(listNotes).toHaveBeenCalledTimes(1);
  });

  test("shows a not-found message and a link back to Notes for 404", async () => {
    const error = new Error("Note not found");
    error.status = 404;
    getNote.mockRejectedValue(error);

    renderNoteDetail();

    expect(
      await screen.findByRole("heading", { name: "Note not found" })
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Back to Notes" }).getAttribute("href")
    ).toBe("/notes");
  });

  test("displays the API's validation message when an edit is rejected", async () => {
    const error = new Error("Body must be between 1 and 50000 characters");
    error.status = 400;
    updateNote.mockRejectedValue(error);

    renderNoteDetail();

    const bodyInput = await screen.findByLabelText("Body *");
    fireEvent.change(bodyInput, { target: { value: "" } });
    fireEvent.submit(bodyInput.closest("form"));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Body must be between 1 and 50000 characters"
    );
  });

  test("loads derived candidates without saving any before confirmation", async () => {
    deriveCards.mockResolvedValue({ cards: derivedCandidates });

    renderNoteDetail();
    await screen.findByLabelText("Title *");
    fireEvent.click(
      screen.getByRole("button", { name: "Create cards from this note" })
    );

    expect(await screen.findByLabelText("Card 1 front")).toHaveProperty(
      "value",
      "Mitosis"
    );
    expect(screen.getByLabelText("Card 1 back").value).toBe("Cell division");
    expect(screen.getByLabelText("Card 2 front").value).toBe("Meiosis");
    expect(deriveCards).toHaveBeenCalledWith("12");
    expect(
      screen.getByRole("button", { name: "Save confirmed cards" }).disabled
    ).toBe(true);
    expect(screen.getByLabelText("New set title").value).toBe("Biology");
    expect(createSet).not.toHaveBeenCalled();
    expect(createCard).not.toHaveBeenCalled();
  });

  test("shows the loading state while deriving cards", async () => {
    let resolveDerive;
    deriveCards.mockReturnValue(
      new Promise((resolve) => {
        resolveDerive = resolve;
      })
    );

    renderNoteDetail();
    await screen.findByLabelText("Title *");
    fireEvent.click(
      screen.getByRole("button", { name: "Create cards from this note" })
    );

    expect(screen.getByRole("status").textContent).toBe(
      "Preparing candidate cards..."
    );

    resolveDerive({ cards: derivedCandidates });
    expect(await screen.findByLabelText("Card 1 front")).toBeTruthy();
  });

  test("reports derivation errors and allows retry", async () => {
    deriveCards
      .mockRejectedValueOnce(new Error("Derivation failed"))
      .mockResolvedValueOnce({ cards: derivedCandidates });

    renderNoteDetail();
    await screen.findByLabelText("Title *");
    fireEvent.click(
      screen.getByRole("button", { name: "Create cards from this note" })
    );

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Derivation failedTry again"
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Try again" })
    );
    expect(await screen.findByLabelText("Card 1 front")).toBeTruthy();
  });

  test("requires note edits to be saved before deriving cards", async () => {
    updateNote.mockResolvedValue({
      ...existingNote,
      body: "Updated note content",
    });
    deriveCards.mockResolvedValue({ cards: derivedCandidates });

    renderNoteDetail();
    await screen.findByLabelText("Body *");
    fireEvent.change(screen.getByLabelText("Body *"), {
      target: { value: "Updated note content" },
    });

    const deriveButton = screen.getByRole("button", {
      name: "Create cards from this note",
    });
    expect(deriveButton.disabled).toBe(true);
    expect(
      screen.getByText("Save your note changes before creating cards.")
    ).toBeTruthy();
    expect(deriveCards).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Note saved.");
    fireEvent.click(deriveButton);

    expect(await screen.findByLabelText("Card 1 front")).toBeTruthy();
    expect(deriveCards).toHaveBeenCalledWith("12");
  });

  test("saves edited confirmed cards to a new set named after the note", async () => {
    deriveCards.mockResolvedValue({ cards: derivedCandidates });
    createSet.mockResolvedValue({ id: 42, title: "Biology" });
    createCard.mockResolvedValue({ id: 88 });

    renderNoteDetail();
    await screen.findByLabelText("Title *");
    fireEvent.click(
      screen.getByRole("button", { name: "Create cards from this note" })
    );
    const front = await screen.findByLabelText("Card 1 front");
    fireEvent.change(front, { target: { value: "Edited front" } });
    fireEvent.change(screen.getByLabelText("Card 1 back"), {
      target: { value: "Edited back" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm card 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard card 2" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save confirmed cards" })
    );

    await waitFor(() => {
      expect(createCard).toHaveBeenCalledWith(
        "42",
        "Edited front",
        "Edited back"
      );
    });
    expect(createSet).toHaveBeenCalledWith("Biology", "");
    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      "Saved 1 card to Biology."
    );
  });

  test("requires a decision for each candidate and reconfirmation after edits", async () => {
    deriveCards.mockResolvedValue({ cards: derivedCandidates });

    renderNoteDetail();
    await screen.findByLabelText("Title *");
    fireEvent.click(
      screen.getByRole("button", { name: "Create cards from this note" })
    );
    const front = await screen.findByLabelText("Card 1 front");

    fireEvent.click(screen.getByRole("button", { name: "Confirm card 1" }));
    expect(
      screen.getByRole("button", { name: "Save confirmed cards" }).disabled
    ).toBe(true);

    fireEvent.change(front, { target: { value: "Updated after confirm" } });
    expect(
      screen.getByRole("button", { name: "Confirm card 1" }).getAttribute(
        "aria-pressed"
      )
    ).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Confirm card 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard card 2" }));
    expect(
      screen.getByRole("button", { name: "Save confirmed cards" }).disabled
    ).toBe(false);
  });

  test("saves only confirmed cards to an existing set and skips discarded cards", async () => {
    deriveCards.mockResolvedValue({ cards: derivedCandidates });
    createCard.mockResolvedValue({ id: 99 });

    renderNoteDetail();
    await screen.findByLabelText("Title *");
    fireEvent.click(
      screen.getByRole("button", { name: "Create cards from this note" })
    );
    await screen.findByLabelText("Card 1 front");
    fireEvent.change(screen.getByLabelText("Save cards to"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm card 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard card 2" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save confirmed cards" })
    );

    await waitFor(() => {
      expect(createCard).toHaveBeenCalledTimes(1);
    });
    expect(createCard).toHaveBeenCalledWith(
      "7",
      "Mitosis",
      "Cell division"
    );
    expect(createSet).not.toHaveBeenCalled();
  });

  test("retries a partial save without recreating the set or saved cards", async () => {
    deriveCards.mockResolvedValue({ cards: derivedCandidates });
    createSet.mockResolvedValue({ id: 51, title: "Biology" });
    createCard
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce(new Error("Temporary save failure"))
      .mockResolvedValueOnce({ id: 2 });

    renderNoteDetail();
    await screen.findByLabelText("Title *");
    fireEvent.click(
      screen.getByRole("button", { name: "Create cards from this note" })
    );
    await screen.findByLabelText("Card 1 front");
    fireEvent.click(screen.getByRole("button", { name: "Confirm card 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm card 2" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save confirmed cards" })
    );

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Temporary save failure"
    );
    expect(screen.getByText("Saved", { selector: "span" })).toBeTruthy();
    expect(createCard).toHaveBeenCalledTimes(2);
    expect(createSet).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Save confirmed cards" })
    );

    await waitFor(() => {
      expect(createCard).toHaveBeenCalledTimes(3);
    });
    expect(createCard).toHaveBeenNthCalledWith(
      1,
      "51",
      "Mitosis",
      "Cell division"
    );
    expect(createCard).toHaveBeenNthCalledWith(
      2,
      "51",
      "Meiosis",
      "Cell division producing gametes"
    );
    expect(createCard).toHaveBeenNthCalledWith(
      3,
      "51",
      "Meiosis",
      "Cell division producing gametes"
    );
    expect(createSet).toHaveBeenCalledTimes(1);
  });

  test("shows the no-cards result and a path to manual card creation", async () => {
    deriveCards.mockResolvedValue({ cards: [] });

    renderNoteDetail();
    await screen.findByLabelText("Title *");
    fireEvent.click(
      screen.getByRole("button", { name: "Create cards from this note" })
    );

    expect(
      await screen.findByText("No cards were found in this note")
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "My Sets" }).getAttribute("href")
    ).toBe("/mysets");
    expect(createCard).not.toHaveBeenCalled();
  });

  test("links to the selected existing set for manual card creation when no cards are found", async () => {
    deriveCards.mockResolvedValue({ cards: [] });

    renderNoteDetail();
    await screen.findByLabelText("Title *");
    fireEvent.click(
      screen.getByRole("button", { name: "Create cards from this note" })
    );

    expect(
      await screen.findByText("No cards were found in this note")
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Save cards to"), {
      target: { value: "7" },
    });

    expect(
      screen.getByRole("link", { name: "Existing set" }).getAttribute("href")
    ).toBe("/mysets/7");
  });
});

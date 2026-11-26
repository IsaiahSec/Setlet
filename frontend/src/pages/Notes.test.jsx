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
import { createNote, getNote, listNotes } from "../services/api";

vi.mock("../services/api", () => ({
  createNote: vi.fn(),
  deleteNote: vi.fn(),
  getNote: vi.fn(),
  listNotes: vi.fn(),
  updateNote: vi.fn(),
}));

const existingNote = {
  id: 12,
  title: "Biology",
  body: "Cells and their structures.",
  created_at: "2026-11-18T12:00:00+00:00",
};

function renderNotes(initialEntry = "/notes") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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
  listNotes.mockResolvedValue({ notes: [] });
  createNote.mockResolvedValue({ ...existingNote });
  getNote.mockResolvedValue({ ...existingNote });
});

describe("Notes list page", () => {
  test("lists note titles and creation dates", async () => {
    listNotes.mockResolvedValue({
      notes: [existingNote],
    });

    renderNotes();

    const noteLink = await screen.findByRole("link", { name: "Biology" });
    expect(noteLink.getAttribute("href")).toBe("/notes/12");
    expect(screen.getByText("Nov 18, 2026")).toBeTruthy();
  });

  test("shows the empty state when the user has no notes", async () => {
    renderNotes();

    expect(
      await screen.findByText("No notes yet. Create your first note above!")
    ).toBeTruthy();
  });

  test("shows the loading state while the list request is pending", () => {
    listNotes.mockImplementation(() => new Promise(() => {}));

    renderNotes();

    expect(screen.getByRole("status").textContent).toBe("Loading notes...");
  });

  test("creates a note and navigates to its detail page", async () => {
    renderNotes();

    fireEvent.change(screen.getByLabelText("Title *"), {
      target: { value: "Biology" },
    });
    fireEvent.change(screen.getByLabelText("Body *"), {
      target: { value: "Cells and their structures." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Note" }));

    expect((await screen.findByLabelText("Title *")).value).toBe("Biology");
    await waitFor(() => {
      expect(createNote).toHaveBeenCalledWith(
        "Biology",
        "Cells and their structures."
      );
      expect(getNote).toHaveBeenCalledWith("12");
    });
    expect(screen.getByRole("heading", { name: "Edit Note" })).toBeTruthy();
  });

  test("shows an API error when notes cannot be loaded", async () => {
    listNotes.mockRejectedValue(new Error("Unable to load notes"));

    renderNotes();

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Unable to load notes"
    );
  });

  test("shows the API's 400 message when note creation is rejected", async () => {
    createNote.mockRejectedValue(
      new Error("Title must be between 1 and 200 characters")
    );

    renderNotes();

    fireEvent.change(screen.getByLabelText("Title *"), {
      target: { value: "A".repeat(201) },
    });
    fireEvent.change(screen.getByLabelText("Body *"), {
      target: { value: "Note body" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Note" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Title must be between 1 and 200 characters"
    );
    expect(createNote).toHaveBeenCalledTimes(1);
  });
});

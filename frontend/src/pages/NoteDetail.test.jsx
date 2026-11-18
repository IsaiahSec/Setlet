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
  deleteNote,
  getNote,
  listNotes,
  updateNote,
} from "../services/api";

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
});

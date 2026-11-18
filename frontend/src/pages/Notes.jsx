import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createNote, listNotes } from "../services/api";
import "./Notes.css";

function formatNoteDate(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function Notes() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [createError, setCreateError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadNotes() {
      setLoading(true);
      setLoadError("");

      try {
        const data = await listNotes();
        if (!Array.isArray(data?.notes)) {
          throw new Error("The notes response was incomplete.");
        }
        if (active) setNotes(data.notes);
      } catch (err) {
        if (active) {
          setLoadError(err.message || "Unable to load your notes.");
          setNotes([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadNotes();

    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setCreateError("");

    if (!title.trim()) {
      setCreateError("Title is required");
      return;
    }
    if (!body.trim()) {
      setCreateError("Body is required");
      return;
    }

    setSaving(true);

    try {
      const note = await createNote(title, body);
      navigate(`/notes/${note.id}`);
    } catch (err) {
      setCreateError(err.message || "Unable to create your note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="notes-page" aria-busy={loading}>
      <div className="notes-container">
        <header className="notes-header">
          <span className="notes-kicker">Your learning space</span>
          <h1>My Notes</h1>
          <p>Keep your study ideas organized and easy to revisit.</p>
        </header>

        <section className="notes-panel">
          <h2>Create a Note</h2>
          <form className="notes-form" onSubmit={handleCreate}>
            <label htmlFor="note-title">Title *</label>
            <input
              id="note-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
            />

            <label htmlFor="note-body">Body *</label>
            <textarea
              id="note-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={50000}
              rows={6}
              required
            />

            {createError && (
              <p className="notes-error" role="alert">
                {createError}
              </p>
            )}

            <button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Note"}
            </button>
          </form>
        </section>

        <section className="notes-panel" aria-labelledby="notes-list-heading">
          <h2 id="notes-list-heading">Your Notes</h2>

          {loading ? (
            <p className="notes-status" role="status">
              Loading notes...
            </p>
          ) : loadError ? (
            <p className="notes-error" role="alert">
              {loadError}
            </p>
          ) : notes.length === 0 ? (
            <p className="notes-empty">
              No notes yet. Create your first note above!
            </p>
          ) : (
            <div className="notes-grid">
              {notes.map((note) => (
                <article className="notes-card" key={note.id}>
                  <h3>
                    <Link to={`/notes/${note.id}`}>{note.title}</Link>
                  </h3>
                  <time dateTime={note.created_at}>
                    {formatNoteDate(note.created_at)}
                  </time>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default Notes;

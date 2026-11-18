import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteNote, getNote, updateNote } from "../services/api";
import "./Notes.css";

function NoteDetail() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadNote() {
      setLoading(true);
      setError("");

      try {
        const data = await getNote(noteId);
        if (
          !data ||
          typeof data.title !== "string" ||
          typeof data.body !== "string"
        ) {
          throw new Error("The note response was incomplete.");
        }
        if (active) {
          setNote(data);
          setTitle(data.title);
          setBody(data.body);
        }
      } catch (err) {
        if (active) {
          if (err.status === 404) {
            setNotFound(true);
          } else {
            setError(err.message || "Unable to load this note.");
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadNote();

    return () => {
      active = false;
    };
  }, [noteId]);

  function showMutationError(err) {
    if (err.status === 404) {
      setNotFound(true);
      setError("");
    } else {
      setError(err.message || "Unable to update this note.");
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updatedNote = await updateNote(noteId, { title, body });
      setNote(updatedNote);
      setTitle(updatedNote.title);
      setBody(updatedNote.body);
      setSuccess("Note saved.");
    } catch (err) {
      showMutationError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");

    try {
      await deleteNote(noteId);
      navigate("/notes");
    } catch (err) {
      showMutationError(err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="notes-page" aria-busy={loading}>
      <div className="notes-container">
        <Link className="notes-back" to="/notes">
          Back to Notes
        </Link>

        {loading ? (
          <>
            <header className="notes-header">
              <h1>Note</h1>
            </header>
            <section className="notes-panel" aria-live="polite">
              <p className="notes-status" role="status">
                Loading note...
              </p>
            </section>
          </>
        ) : notFound ? (
          <section className="notes-panel" aria-labelledby="note-not-found">
            <h1 id="note-not-found">Note not found</h1>
          </section>
        ) : note ? (
          <>
            <header className="notes-header">
              <span className="notes-kicker">Your note</span>
              <h1>Edit Note</h1>
            </header>

            <section className="notes-panel">
              <form className="notes-form" onSubmit={handleSave}>
                <label htmlFor="edit-note-title">Title *</label>
                <input
                  id="edit-note-title"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setSuccess("");
                  }}
                  maxLength={200}
                  required
                />

                <label htmlFor="edit-note-body">Body *</label>
                <textarea
                  id="edit-note-body"
                  value={body}
                  onChange={(event) => {
                    setBody(event.target.value);
                    setSuccess("");
                  }}
                  maxLength={50000}
                  rows={12}
                  required
                />

                {error && (
                  <p className="notes-error" role="alert">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="notes-success" role="status">
                    {success}
                  </p>
                )}

                <div className="notes-actions">
                  <button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="notes-danger-button"
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(true);
                      setError("");
                    }}
                    disabled={deleting}
                  >
                    Delete
                  </button>
                </div>
              </form>

              {confirmingDelete && (
                <div
                  className="notes-delete-confirm"
                  role="group"
                  aria-label="Confirm note deletion"
                >
                  <p>Delete this note?</p>
                  <button
                    className="notes-danger-button"
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Yes, delete"}
                  </button>
                  <button
                    className="notes-secondary-button"
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="notes-panel">
            <p className="notes-error" role="alert">
              {error}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

export default NoteDetail;

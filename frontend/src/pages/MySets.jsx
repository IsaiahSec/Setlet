
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listSets, createSet, deleteSet } from "../services/api";
import "./MySets.css";

function MySets() {
  const navigate = useNavigate();

  const [sets, setSets] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSets() {
      try {
        const data = await listSets();
        setSets(Array.isArray(data) ? data : data.sets || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadSets();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Please enter a set title.");
      return;
    }

    setSaving(true);

    try {
      const data = await createSet(title.trim(), description.trim());
      const newSet = data.set || data;
      navigate(`/mysets/${newSet.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
  setError("");
  setDeletingId(id);

  try {
    await deleteSet(id);

    setSets((previousSets) => {
    return previousSets.filter((item) => item.id !== id);
});

    setConfirmId(null);
  } catch (err) {
    setError(err.message);
  } finally {
    setDeletingId(null);
  }
  }

  return (
    <main className="mysets-page">
      <div className="mysets-container">
        <header className="mysets-header">
          <h1>My Study Sets</h1>
          <p>Create and manage your flashcard collections.</p>
        </header>

        <section className="mysets-panel">
          <h2>Create a New Set</h2>

          <form onSubmit={handleCreate} className="mysets-form">
            <label htmlFor="set-title">Title *</label>
            <input
              id="set-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Biology Chapter 1"
              maxLength={200}
              required
            />

            <label htmlFor="set-description">
              Description (optional)
            </label>
            <textarea
              id="set-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What will you study?"
              maxLength={1000}
              rows={3}
            />

            <button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Set"}
            </button>
          </form>
        </section>

        {error && (
          <p role="alert" className="mysets-error">
            {error}
          </p>
        )}

        <section className="mysets-panel">
          <h2>Your Sets</h2>

          {loading ? (
            <p>Loading your study sets...</p>
          ) : sets.length === 0 ? (
            <p>No study sets yet. Create your first set above!</p>
          ) : (
            <div className="mysets-grid">
              {sets.map((set) => (
                <article className="mysets-card" key={set.id}>
                  <h3>
                    <Link to={`/mysets/${set.id}`}>
                      {set.title}
                    </Link>
                  </h3>

                  <p>{set.description || "No description"}</p>

                  <span
                    className={`mysets-visibility ${
                    set.visibility === "public" ? "public" : "private"
                  }`}
                  >
                  {set.visibility === "public" ? "Public" : "Private"}
                  </span>

                  {set.card_count != null && (
                  <p className="mysets-count">
                  {set.card_count} cards
                 </p>
                )}

                  <div className="mysets-actions">
                    <Link
                      to={`/study/${set.id}`}
                      className="mysets-study-button"
                    >
                     Study
                   </Link>
                    <Link
                      to={`/flip/${set.id}`}
                      className="mysets-study-button"
                    >
                      Flip through
                    </Link>
                  </div>

                  {confirmId === set.id ? (
                    <div className="mysets-actions">
                      <span>Delete this set?</span>
                      <button
                        type="button"
                        disabled={deletingId === set.id}
                        onClick={() => handleDelete(set.id)}
                      >
                        {deletingId === set.id
                          ? "Deleting..."
                          : "Yes, delete"}
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === set.id}
                        onClick={() => setConfirmId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(set.id)}
                    >
                      Delete
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default MySets;

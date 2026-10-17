
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getSet,
  updateSet,
  addCard,
  updateCard,
  deleteCard,
} from "../services/api";
import "./SetEditor.css";

function SetEditor() {
  const { setId } = useParams();

  const [studySet, setStudySet] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cards, setCards] = useState([]);

  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load the selected set and its cards
  useEffect(() => {
    let active = true;

    async function loadSet() {
      setLoading(true);
      setError("");

      try {
        const data = await getSet(setId);

        if (!active) return;

        setStudySet(data);
        setTitle(data.title || "");
        setDescription(data.description || "");
        setCards(data.cards || []);
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSet();

    return () => {
      active = false;
    };
  }, [setId]);

  // Save title and description
  async function handleSaveSet(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("Please enter a set title.");
      return;
    }

    setSaving(true);

    try {
      const updated = await updateSet(setId, {
        title: title.trim(),
        description: description.trim(),
      });

      setStudySet((previous) => ({ ...previous, ...updated }));
      setSuccess("Study set updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Add a card
  async function handleAddCard(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!newFront.trim() || !newBack.trim()) {
      setError("Please complete both sides of the card.");
      return;
    }

    setSaving(true);

    try {
      const card = await addCard(
        setId,
        newFront.trim(),
        newBack.trim()
      );

      setCards((previous) => [...previous, card]);
      setNewFront("");
      setNewBack("");
      setSuccess("Card added successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Edit a card
  async function handleUpdateCard(card) {
    setError("");
    setSuccess("");

    if (!card.front.trim() || !card.back.trim()) {
      setError("Both sides of the card are required.");
      return;
    }

    setSaving(true);

    try {
      const updated = await updateCard(setId, card.id, {
        front: card.front.trim(),
        back: card.back.trim(),
      });

      setCards((previous) =>
        previous.map((item) =>
          item.id === card.id ? updated : item
        )
      );

      setSuccess("Card updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Delete a card
  async function handleDeleteCard(cardId) {
    if (!window.confirm("Delete this card?")) return;

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      await deleteCard(setId, cardId);

      setCards((previous) =>
        previous.filter((card) => card.id !== cardId)
      );

      setSuccess("Card deleted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Update card inputs locally
  function handleCardChange(cardId, field, value) {
    setCards((previous) =>
      previous.map((card) =>
        card.id === cardId
          ? { ...card, [field]: value }
          : card
      )
    );
  }

  if (loading) {
    return (
      <div className="seteditor-page">
        <div className="seteditor-container">
          <p>Loading study set...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="seteditor-page">
      <div className="seteditor-container">
        <Link to="/my-sets" className="seteditor-back">
          ← Back to My Sets
        </Link>

        <header className="seteditor-header">
          <h1>Set Editor</h1>
          <p>Edit your study set and manage its flashcards.</p>
        </header>

        {error && (
          <div className="seteditor-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="seteditor-success" role="status">
            {success}
          </div>
        )}

        {!studySet ? (
          <div className="seteditor-panel">
            <p>Study set not found or unavailable.</p>
          </div>
        ) : (
          <>
            <section className="seteditor-panel">
              <h2>Set Details</h2>

              <form
                className="seteditor-form"
                onSubmit={handleSaveSet}
              >
                <label htmlFor="set-title">Title</label>
                <input
                  id="set-title"
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  maxLength={200}
                  required
                />

                <label htmlFor="set-description">
                  Description
                </label>
                <textarea
                  id="set-description"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  rows={3}
                />

                <div className="seteditor-actions">
                  <button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </section>

            <section className="seteditor-panel">
              <h2>Add a Card</h2>

              <form
                className="seteditor-form"
                onSubmit={handleAddCard}
              >
                <label htmlFor="new-front">Front</label>
                <textarea
                  id="new-front"
                  value={newFront}
                  onChange={(event) =>
                    setNewFront(event.target.value)
                  }
                  rows={2}
                  maxLength={2000}
                  required
                />

                <label htmlFor="new-back">Back</label>
                <textarea
                  id="new-back"
                  value={newBack}
                  onChange={(event) =>
                    setNewBack(event.target.value)
                  }
                  rows={2}
                  maxLength={2000}
                  required
                />

                <div className="seteditor-actions">
                  <button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Add Card"}
                  </button>
                </div>
              </form>
            </section>

            <section className="seteditor-panel">
              <h2>Cards ({cards.length})</h2>

              {cards.length === 0 ? (
                <p>No cards yet. Add your first card above.</p>
              ) : (
                cards.map((card, index) => (
                  <div className="seteditor-card" key={card.id}>
                    <h3>Card {index + 1}</h3>

                    <div className="seteditor-form">
                      <label htmlFor={`front-${card.id}`}>
                        Front
                      </label>
                      <textarea
                        id={`front-${card.id}`}
                        value={card.front}
                        onChange={(event) =>
                          handleCardChange(
                            card.id,
                            "front",
                            event.target.value
                          )
                        }
                        rows={2}
                        maxLength={2000}
                      />

                      <label htmlFor={`back-${card.id}`}>
                        Back
                      </label>
                      <textarea
                        id={`back-${card.id}`}
                        value={card.back}
                        onChange={(event) =>
                          handleCardChange(
                            card.id,
                            "back",
                            event.target.value
                          )
                        }
                        rows={2}
                        maxLength={2000}
                      />

                      <div className="seteditor-actions">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            handleUpdateCard(card)
                          }
                        >
                          Save Card
                        </button>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            handleDeleteCard(card.id)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default SetEditor;

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createCard,
  createSet,
  deleteNote,
  deriveCards,
  getNote,
  listSets,
  updateNote,
} from "../services/api";
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
  const [reviewOpen, setReviewOpen] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [studySets, setStudySets] = useState([]);
  const [setsError, setSetsError] = useState("");
  const [targetChoice, setTargetChoice] = useState("new");
  const [newSetTitle, setNewSetTitle] = useState("");
  const [createdSetId, setCreatedSetId] = useState(null);
  const [createdSetTitle, setCreatedSetTitle] = useState("");
  const [savingCards, setSavingCards] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const savingCardsRef = useRef(false);

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

  async function handleDerive() {
    setReviewOpen(true);
    setDeriving(true);
    setDeriveError("");
    setCandidates([]);
    setStudySets([]);
    setSetsError("");
    setTargetChoice("new");
    setNewSetTitle(note.title);
    setCreatedSetId(null);
    setCreatedSetTitle("");
    setSaveError("");
    setSaveSuccess("");

    const [derivedResult, setsResult] = await Promise.allSettled([
      deriveCards(noteId),
      listSets(),
    ]);

    if (derivedResult.status === "fulfilled") {
      const derivedCards = derivedResult.value?.cards;
      if (
        !Array.isArray(derivedCards) ||
        derivedCards.some(
          (card) =>
            !card ||
            typeof card.front !== "string" ||
            typeof card.back !== "string"
        )
      ) {
        setDeriveError("The derived card response was incomplete.");
      } else {
        setCandidates(
          derivedCards.map((card, index) => ({
            id: index,
            front: card.front,
            back: card.back,
            status: "unconfirmed",
          }))
        );
      }
    } else {
      setDeriveError(
        derivedResult.reason.message || "Unable to create candidate cards."
      );
    }

    if (setsResult.status === "fulfilled") {
      const data = setsResult.value;
      const sets = Array.isArray(data) ? data : data?.sets;
      if (Array.isArray(sets)) {
        setStudySets(sets);
      } else {
        setSetsError("Your study sets could not be loaded.");
      }
    } else {
      setSetsError(
        setsResult.reason.message || "Your study sets could not be loaded."
      );
    }

    setDeriving(false);
  }

  function updateCandidateStatus(candidateId, status) {
    setCandidates((previous) =>
      previous.map((candidate) =>
        candidate.id === candidateId
          ? { ...candidate, status }
          : candidate
      )
    );
    setSaveError("");
    setSaveSuccess("");
  }

  async function handleSaveConfirmedCards() {
    if (savingCardsRef.current) return;

    const confirmedCards = candidates.filter(
      (candidate) => candidate.status === "confirmed"
    );
    if (confirmedCards.length === 0) return;

    if (targetChoice === "new" && !newSetTitle.trim()) {
      setSaveError("Please enter a title for the new study set.");
      return;
    }
    if (
      targetChoice !== "new" &&
      !studySets.some((studySet) => String(studySet.id) === targetChoice)
    ) {
      setSaveError("Choose one of your study sets or create a new one.");
      return;
    }

    savingCardsRef.current = true;
    setSavingCards(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      let destinationId = targetChoice;
      let destinationTitle = "";

      if (targetChoice === "new") {
        destinationId = createdSetId;
        if (destinationId === null) {
          const created = await createSet(newSetTitle.trim(), "");
          const newSet = created?.set || created;
          if (newSet?.id == null) {
            throw new Error("The new study set response was incomplete.");
          }
          destinationId = String(newSet.id);
          setCreatedSetId(destinationId);
          setCreatedSetTitle(newSet.title || newSetTitle.trim());
        }
        destinationTitle =
          createdSetTitle || newSetTitle.trim();
      } else {
        const selectedSet = studySets.find(
          (studySet) => String(studySet.id) === targetChoice
        );
        destinationTitle = selectedSet?.title || "your study set";
      }

      let savedCount = 0;
      for (const candidate of confirmedCards) {
        try {
          await createCard(
            destinationId,
            candidate.front.trim(),
            candidate.back.trim()
          );
        } catch (saveError) {
          setSaveError(
            saveError.message || "Unable to save the remaining cards."
          );
          if (savedCount > 0) {
            setSaveSuccess(
              `Saved ${savedCount} card${savedCount === 1 ? "" : "s"}. Retry to save the remaining confirmed cards.`
            );
          }
          return;
        }

        setCandidates((previous) =>
          previous.map((item) =>
            item.id === candidate.id ? { ...item, status: "saved" } : item
          )
        );
        savedCount += 1;
      }

      setSaveSuccess(
        `Saved ${savedCount} card${savedCount === 1 ? "" : "s"} to ${destinationTitle}.`
      );
    } catch (saveError) {
      setSaveError(saveError.message || "Unable to save confirmed cards.");
    } finally {
      savingCardsRef.current = false;
      setSavingCards(false);
    }
  }

  const confirmedCount = candidates.filter(
    (candidate) => candidate.status === "confirmed"
  ).length;
  const unreviewedCount = candidates.filter(
    (candidate) => candidate.status === "unconfirmed"
  ).length;
  const noteHasUnsavedChanges =
    note && (title !== note.title || body !== note.body);
  const destinationLocked =
    createdSetId !== null ||
    candidates.some((candidate) => candidate.status === "saved");

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

              <div className="notes-actions notes-derive-actions">
                {!reviewOpen && (
                  <button
                    type="button"
                    onClick={handleDerive}
                    disabled={saving || deleting || noteHasUnsavedChanges}
                  >
                    Create cards from this note
                  </button>
                )}
              </div>
              {noteHasUnsavedChanges && (
                <p className="notes-status" role="status">
                  Save your note changes before creating cards.
                </p>
              )}

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

            {reviewOpen && (
              <section
                className="notes-panel"
                aria-labelledby="derived-cards-heading"
                aria-busy={deriving || savingCards}
              >
                <h2 id="derived-cards-heading">Review derived cards</h2>
                {deriving ? (
                  <p className="notes-status" role="status">
                    Preparing candidate cards...
                  </p>
                ) : (
                  <>
                    {deriveError && (
                      <div className="notes-error" role="alert">
                        <p>{deriveError}</p>
                        <button
                          type="button"
                          onClick={handleDerive}
                          disabled={deriving}
                        >
                          Try again
                        </button>
                      </div>
                    )}

                    {!deriveError && candidates.length === 0 && (
                      <div className="notes-empty-result">
                        <p>No cards were found in this note</p>
                        <p>
                          You can still add cards by hand in{" "}
                          {targetChoice !== "new" ? (
                            <Link to={`/mysets/${targetChoice}`}>
                              {studySets.find(
                                (studySet) =>
                                  String(studySet.id) === targetChoice
                              )?.title || "your selected set"}
                            </Link>
                          ) : (
                            <Link to="/mysets">My Sets</Link>
                          )}
                          .
                        </p>
                      </div>
                    )}

                    {setsError && (
                      <p className="notes-error" role="alert">
                        {setsError} You can still create a new set.
                      </p>
                    )}

                    {!deriveError && (
                      <>
                        <div className="notes-set-destination">
                          <label htmlFor="derived-cards-destination">
                            Save cards to
                          </label>
                          <select
                            id="derived-cards-destination"
                            value={targetChoice}
                            onChange={(event) => {
                              setTargetChoice(event.target.value);
                              setSaveError("");
                              setSaveSuccess("");
                            }}
                            disabled={destinationLocked || savingCards}
                          >
                            <option value="new">Create a new set</option>
                            {studySets.map((studySet) => (
                              <option
                                key={studySet.id}
                                value={String(studySet.id)}
                              >
                                {studySet.title}
                              </option>
                            ))}
                          </select>

                          {targetChoice === "new" && (
                            <>
                              <label htmlFor="derived-cards-set-title">
                                New set title
                              </label>
                              <input
                                id="derived-cards-set-title"
                                value={newSetTitle}
                                onChange={(event) => {
                                  setNewSetTitle(event.target.value);
                                  setSaveError("");
                                  setSaveSuccess("");
                                }}
                                maxLength={200}
                                disabled={destinationLocked || savingCards}
                              />
                            </>
                          )}
                        </div>

                        {candidates.length > 0 && (
                          <>
                            <p className="notes-review-summary">
                              {confirmedCount} confirmed ·{" "}
                              {candidates.filter(
                                (candidate) => candidate.status === "saved"
                              ).length}{" "}
                              saved · {unreviewedCount} awaiting review
                            </p>

                            <div className="notes-candidate-list">
                              {candidates.map((candidate, index) => (
                                <article
                                  className="notes-candidate-card"
                                  key={candidate.id}
                                >
                                  <div className="notes-candidate-heading">
                                    <h3>Candidate {index + 1}</h3>
                                    <span
                                      className={`notes-candidate-status notes-candidate-status-${candidate.status}`}
                                    >
                                      {candidate.status === "unconfirmed"
                                        ? "Needs review"
                                        : candidate.status === "confirmed"
                                          ? "Confirmed"
                                          : candidate.status === "saved"
                                            ? "Saved"
                                            : "Discarded"}
                                    </span>
                                  </div>
                                  <div className="notes-candidate-fields">
                                    <label htmlFor={`candidate-${index}-front`}>
                                      Front
                                    </label>
                                    <textarea
                                      id={`candidate-${index}-front`}
                                      aria-label={`Card ${index + 1} front`}
                                      value={candidate.front}
                                      maxLength={2000}
                                      rows={2}
                                      disabled={
                                        savingCards ||
                                        candidate.status === "saved"
                                      }
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setCandidates((previous) =>
                                          previous.map((item) =>
                                            item.id === candidate.id
                                              ? {
                                                  ...item,
                                                  front: value,
                                                  status:
                                                    item.status === "confirmed"
                                                      ? "unconfirmed"
                                                      : item.status,
                                                }
                                              : item
                                          )
                                        );
                                        setSaveError("");
                                        setSaveSuccess("");
                                      }}
                                    />
                                    <label htmlFor={`candidate-${index}-back`}>
                                      Back
                                    </label>
                                    <textarea
                                      id={`candidate-${index}-back`}
                                      aria-label={`Card ${index + 1} back`}
                                      value={candidate.back}
                                      maxLength={2000}
                                      rows={3}
                                      disabled={
                                        savingCards ||
                                        candidate.status === "saved"
                                      }
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setCandidates((previous) =>
                                          previous.map((item) =>
                                            item.id === candidate.id
                                              ? {
                                                  ...item,
                                                  back: value,
                                                  status:
                                                    item.status === "confirmed"
                                                      ? "unconfirmed"
                                                      : item.status,
                                                }
                                              : item
                                          )
                                        );
                                        setSaveError("");
                                        setSaveSuccess("");
                                      }}
                                    />
                                  </div>
                                  <div className="notes-actions notes-candidate-actions">
                                    <button
                                      type="button"
                                      aria-label={`${
                                        candidate.status === "confirmed"
                                          ? "Unconfirm"
                                          : "Confirm"
                                      } card ${index + 1}`}
                                      aria-pressed={
                                        candidate.status === "confirmed"
                                      }
                                      onClick={() => {
                                        const nextStatus =
                                          candidate.status === "confirmed"
                                            ? "unconfirmed"
                                            : "confirmed";
                                        if (
                                          nextStatus === "confirmed" &&
                                          (!candidate.front.trim() ||
                                            !candidate.back.trim())
                                        ) {
                                          setSaveError(
                                            "Each confirmed card needs a front and back."
                                          );
                                          return;
                                        }
                                        updateCandidateStatus(
                                          candidate.id,
                                          nextStatus
                                        );
                                      }}
                                      disabled={
                                        savingCards ||
                                        candidate.status === "saved"
                                      }
                                    >
                                      {candidate.status === "confirmed"
                                        ? "Confirmed"
                                        : "Confirm"}
                                    </button>
                                    <button
                                      className="notes-danger-button"
                                      type="button"
                                      aria-label={`Discard card ${index + 1}`}
                                      onClick={() =>
                                        updateCandidateStatus(
                                          candidate.id,
                                          "discarded"
                                        )
                                      }
                                      disabled={
                                        savingCards ||
                                        candidate.status === "saved" ||
                                        candidate.status === "discarded"
                                      }
                                    >
                                      {candidate.status === "discarded"
                                        ? "Discarded"
                                        : "Discard"}
                                    </button>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </>
                        )}

                        {saveError && (
                          <p className="notes-error" role="alert">
                            {saveError}
                          </p>
                        )}
                        {saveSuccess && (
                          <p className="notes-success" role="status">
                            {saveSuccess}
                          </p>
                        )}

                        {candidates.length > 0 && (
                          <button
                            className="notes-review-save"
                            type="button"
                            onClick={handleSaveConfirmedCards}
                            disabled={
                              savingCards ||
                              confirmedCount === 0 ||
                              unreviewedCount > 0 ||
                              (targetChoice === "new" &&
                                !newSetTitle.trim())
                            }
                          >
                            {savingCards
                              ? "Saving cards..."
                              : "Save confirmed cards"}
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
            )}
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

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSet, getStudySession, reviewCard } from "../services/api";
import "./StudyReview.css";

const ratings = [
  { value: 1, label: "Again" },
  { value: 2, label: "Hard" },
  { value: 3, label: "Good" },
  { value: 4, label: "Easy" },
];

function StudyReview() {
  const { setId } = useParams();

  const [setTitle, setSetTitle] = useState("Study Review");
  const [queue, setQueue] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    new: 0,
    due: 0,
    upcoming: 0,
  });
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [finished, setFinished] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);

  const savingRef = useRef(false);
  const card = queue[0];

  const loadSession = useCallback(async () => {
    setPracticeMode(false);
    setLoading(true);
    setError("");
    setNotFound(false);
    setFinished(false);
    setFlipped(false);
    setQueue([]);
    setReviewCount(0);
    setAgainCount(0);
    savingRef.current = false;

    try {
      const data = await getStudySession(setId);
      const studyCards = Array.isArray(data.cards) ? data.cards : [];

      setSetTitle(data.set?.title || "Study Review");
      setCounts(data.counts || {
        total: 0,
        new: 0,
        due: 0,
        upcoming: 0,
      });
      setQueue(studyCards);
      setSessionTotal(studyCards.length);
    } catch (err) {
      if (err.status === 404) {
        setNotFound(true);
      } else {
        setError(err.message || "Could not load study session.");
      }
    } finally {
      setLoading(false);
    }
  }, [setId]);

  const loadPracticeSession = useCallback(async () => {
    setPracticeMode(true);
    setLoading(true);
    setError("");
    setNotFound(false);
    setFinished(false);
    setFlipped(false);
    setQueue([]);
    setReviewCount(0);
    setAgainCount(0);
    savingRef.current = false;

    try {
      const data = await getSet(setId);
      const studySet = data.set || data;
      const practiceCards = Array.isArray(studySet.cards)
        ? studySet.cards
        : [];

      setSetTitle(studySet.title || "Study Review");
      setSessionTotal(practiceCards.length);

      if (practiceCards.length === 0) {
        setError("This set has no flashcards to practice.");
        return;
      }

      setQueue(practiceCards);
    } catch (err) {
      if (err.status === 404) {
        setNotFound(true);
      } else {
        setError(err.message || "Could not load flashcards for practice.");
      }
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleRating = useCallback(async (rating) => {
    if (!card || !flipped || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setError("");

    try {
      if (!practiceMode) {
        await reviewCard(card.id, rating);
      }

      setReviewCount((count) => count + 1);

      if (rating === 1) {
        setAgainCount((count) => count + 1);
      }

      const remaining = queue.slice(1);

      if (rating === 1) {
        remaining.push(card);
      }

      setQueue(remaining);
      setFlipped(false);

      if (remaining.length === 0) {
        setFinished(true);
      }
    } catch (err) {
      setError(err.message || "Could not save review. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [card, flipped, practiceMode, queue]);

  useEffect(() => {
    function handleKeyDown(event) {
      const tag = event.target.tagName;

      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat
      ) {
        return;
      }

      if (!card || loading || saving || finished) return;

      if (event.code === "Space" && tag !== "BUTTON") {
        event.preventDefault();
        setFlipped((value) => !value);
      }

      if (flipped && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        handleRating(Number(event.key));
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [card, flipped, loading, saving, finished, handleRating]);

  return (
    <main className="study-page">
      <div className="study-container">
        <Link className="study-back" to="/mysets">
          ← Back to My Sets
        </Link>

        <header className="study-header">
          <h1>{setTitle}</h1>
          <p>Practice your flashcards and track your progress.</p>
        </header>

        {loading ? (
          <section className="study-panel">
            <p>Loading flashcards...</p>
          </section>
        ) : notFound ? (
          <section className="study-panel">
            <h2>Set not found</h2>
            <p>This study set could not be found.</p>
          </section>
        ) : error && !card ? (
          <section className="study-panel">
            <p className="study-error" role="alert">{error}</p>
            <button
              className="study-button"
              type="button"
              onClick={practiceMode ? loadPracticeSession : loadSession}
            >
              Try again
            </button>
          </section>
        ) : finished ? (
          <section
            className="study-panel study-completion"
            aria-labelledby="study-completion-title"
            aria-live="polite"
          >
            <span className="study-completion-mark" aria-hidden="true">&#10003;</span>
            <p className="study-completion-eyebrow">Session complete</p>
            <h2 id="study-completion-title">
              {practiceMode ? "Practice Complete!" : "Study Complete!"}
            </h2>
            <p className="study-completion-copy">
              {practiceMode
                ? `You practiced all ${sessionTotal} cards. Your ratings and progress were not saved.`
                : `You reviewed all ${sessionTotal} cards. Your next reviews are scheduled based on your ratings.`}
            </p>
            <div className="study-completion-stats">
              <p>{practiceMode ? "Cards practiced" : "Reviews completed"}: {reviewCount}</p>
              <p>Rated Again: {againCount}</p>
            </div>
            <div className="study-completion-actions">
              <div className="study-completion-choice">
                <Link
                  className="study-button study-button-secondary"
                  to={`/flip/${setId}`}
                  aria-describedby="flip-through-description"
                >
                  Flip Through Again
                </Link>
                <span id="flip-through-description">
                  Practice every card without changing its review schedule.
                </span>
              </div>
              <div className="study-completion-choice">
                <button
                  className="study-button"
                  type="button"
                  onClick={loadSession}
                  aria-describedby="study-again-description"
                >
                  Study again
                </button>
                <span id="study-again-description">
                  Check for cards that are due for review.
                </span>
              </div>
            </div>
          </section>
        ) : !card ? (
          <section className="study-panel">
            <h2>Nothing to study right now</h2>
            <p className="study-empty-copy">
              No new or due cards are available. Your next reviews are scheduled for later.
            </p>
            <p>New: {counts.new}</p>
            <p>Due: {counts.due}</p>
            <p>Upcoming: {counts.upcoming}</p>
            <p>Total cards: {counts.total}</p>
            {counts.total > 0 && counts.new === 0 && counts.due === 0 && (
              <div className="study-empty-actions">
                <button
                  className="study-button study-empty-practice-button"
                  type="button"
                  onClick={loadPracticeSession}
                >
                  Practice Again
                </button>
                <Link
                  className="study-button study-empty-flip-button"
                  to={`/flip/${setId}`}
                >
                  Flip Through
                </Link>
              </div>
            )}
          </section>
        ) : (
          <section className="study-panel">
            <p className="study-progress">
              {Math.min(sessionTotal, reviewCount - againCount + 1)} of {sessionTotal}
            </p>
            <div
              className="study-progress-track review-progress-track"
              role="progressbar"
              aria-label="Study session progress"
              aria-valuemin="0"
              aria-valuemax={sessionTotal}
              aria-valuenow={Math.min(sessionTotal, reviewCount - againCount + 1)}
            >
              <span
                style={{ width: `${sessionTotal ? (Math.min(sessionTotal, reviewCount - againCount + 1) / sessionTotal) * 100 : 0}%` }}
              />
            </div>

            {error && (
              <p className="study-error" role="alert">{error}</p>
            )}

            {practiceMode && (
              <p className="study-practice-notice" role="status">
                Practice session. Ratings and progress will not be saved.
              </p>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => setFlipped((value) => !value)}
              aria-label="Flip flashcard"
              aria-pressed={flipped}
              className={`study-card${flipped ? " is-flipped" : ""}`}
            >
              <span className="study-card-inner">
                <span className="study-card-face study-card-front">
                  <span className="study-card-label">Front</span>
                  <span className="study-card-copy">{card.front}</span>
                  <span className="study-card-hint">Click or press Space to flip</span>
                </span>
                <span className="study-card-face study-card-back">
                  <span className="study-card-label">Back</span>
                  <span className="study-card-copy">{card.back}</span>
                  <span className="study-card-hint">Click or press Space to flip</span>
                </span>
              </span>
            </button>

            {flipped && (
              <div>
                <h3>How well did you remember?</h3>
                <div className="study-ratings">
                  {ratings.map((rating) => (
                    <button
                      key={rating.value}
                      type="button"
                      disabled={saving}
                      onClick={() => handleRating(rating.value)}
                    >
                      {rating.value}. {rating.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export default StudyReview;
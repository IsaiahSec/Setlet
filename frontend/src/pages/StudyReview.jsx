
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getStudySession, reviewCard } from "../services/api";
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

  const savingRef = useRef(false);
  const card = queue[0];

  const loadSession = useCallback(async () => {
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

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleRating = useCallback(async (rating) => {
    if (!card || !flipped || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setError("");

    try {
      await reviewCard(card.id, rating);

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
  }, [card, flipped, queue]);

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
              onClick={loadSession}
            >
              Try again
            </button>
          </section>
        ) : finished ? (
          <section className="study-panel">
            <h2>Study Complete!</h2>
            <p>Reviews completed: {reviewCount}</p>
            <p>Rated Again: {againCount}</p>
            <button
              className="study-button"
              type="button"
              onClick={loadSession}
            >
              Study again
            </button>
          </section>
        ) : !card ? (
          <section className="study-panel">
            <h2>Nothing to study right now</h2>
            <p>New: {counts.new}</p>
            <p>Due: {counts.due}</p>
            <p>Upcoming: {counts.upcoming}</p>
            <p>Total cards: {counts.total}</p>
          </section>
        ) : (
          <section className="study-panel">
            <p className="study-progress">
              {Math.min(sessionTotal, reviewCount - againCount + 1)} of {sessionTotal}
            </p>

            {error && (
              <p className="study-error" role="alert">{error}</p>
            )}

            <button
              className="study-card"
              type="button"
              disabled={saving}
              onClick={() => setFlipped((value) => !value)}
              aria-label="Flip flashcard"
            >
              <h3>{flipped ? "Back" : "Front"}</h3>
              <p>{flipped ? card.back : card.front}</p>
              <span>Click or press Space to flip</span>
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

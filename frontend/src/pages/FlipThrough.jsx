import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSet } from "../services/api";
import "./StudyReview.css";
import "./FlipThrough.css";

function shuffleCards(cards) {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function FlipThrough() {
  const { setId } = useParams();
  const [studySet, setStudySet] = useState(null);
  const [originalCards, setOriginalCards] = useState([]);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadSet() {
      setLoading(true);
      setError("");
      setNotFound(false);

      try {
        const data = await getSet(setId);
        if (!active) return;

        const loadedSet = data.set || data;
        const loadedCards = Array.isArray(loadedSet.cards)
          ? loadedSet.cards
          : [];

        setStudySet(loadedSet);
        setOriginalCards(loadedCards);
        setCards(loadedCards);
        setCurrentIndex(0);
        setFlipped(false);
        setShuffleEnabled(false);
        setCompleted(false);
      } catch (loadError) {
        if (!active) return;

        if ([403, 404].includes(loadError.status)) {
          setNotFound(true);
        } else {
          setError(loadError.message || "Could not load this study set.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSet();

    return () => {
      active = false;
    };
  }, [setId, retry]);

  const card = cards[currentIndex];

  function handleShuffleChange(event) {
    const enabled = event.target.checked;
    setShuffleEnabled(enabled);
    setCards(enabled ? shuffleCards(originalCards) : originalCards);
    setCurrentIndex(0);
    setFlipped(false);
    setCompleted(false);
  }

  function handlePrevious() {
    setCurrentIndex((index) => Math.max(0, index - 1));
    setFlipped(false);
  }

  function handleNext() {
    if (currentIndex >= cards.length - 1) {
      setCompleted(true);
      setFlipped(false);
      return;
    }

    setCurrentIndex((index) => index + 1);
    setFlipped(false);
  }

  function handleRestart() {
    setCards(shuffleEnabled ? shuffleCards(originalCards) : originalCards);
    setCurrentIndex(0);
    setFlipped(false);
    setCompleted(false);
  }

  useEffect(() => {
    function handleKeyDown(event) {
      const target = event.target;
      const tagName = target?.tagName;

      if (
        loading ||
        completed ||
        !card ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.code === "Space") {
        if (tagName === "BUTTON") return;
        event.preventDefault();
        setFlipped((value) => !value);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [card, completed, loading, currentIndex, cards.length]);

  return (
    <main className="study-page">
      <div className="study-container">
        <Link className="study-back" to="/mysets">
          ← Back to My Sets
        </Link>

        <header className="study-header">
          <h1>{studySet?.title || "Flip Through"}</h1>
          <p>Flip through your cards at your own pace.</p>
        </header>

        {loading ? (
          <section className="study-panel">
            <p>Loading flashcards...</p>
          </section>
        ) : notFound ? (
          <section className="study-panel">
            <h2>Set not found</h2>
            <p>This study set could not be found or is not accessible.</p>
            <Link className="study-back" to="/mysets">
              Back to My Sets
            </Link>
          </section>
        ) : error ? (
          <section className="study-panel">
            <p className="study-error" role="alert">{error}</p>
            <button
              className="study-button"
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          </section>
        ) : cards.length === 0 ? (
          <section className="study-panel">
            <h2>No flashcards in this set yet.</h2>
            <p>There are no cards to flip through.</p>
          </section>
        ) : completed ? (
          <section className="study-panel" aria-live="polite">
            <h2>Flip-through complete</h2>
            <p>You viewed all {cards.length} cards.</p>
            <button
              className="study-button"
              type="button"
              onClick={handleRestart}
            >
              Restart
            </button>
          </section>
        ) : (
          <section className="study-panel">
            <p className="flip-unsaved-message">
              Flip-through mode does not save study progress.
            </p>

            <div className="flip-toolbar">
              <div className="flip-progress-block">
                <p className="study-progress" aria-live="polite">
                  {currentIndex + 1} of {cards.length}
                </p>
                <div
                  className="study-progress-track"
                  role="progressbar"
                  aria-label="Flip-through progress"
                  aria-valuemin="0"
                  aria-valuemax={cards.length}
                  aria-valuenow={currentIndex + 1}
                >
                  <span style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }} />
                </div>
              </div>
              <label className="flip-shuffle">
                <input
                  type="checkbox"
                  checked={shuffleEnabled}
                  onChange={handleShuffleChange}
                />
                Shuffle
              </label>
            </div>

            <button
              type="button"
              onClick={() => setFlipped((value) => !value)}
              aria-label={`Flip flashcard. Showing ${flipped ? "back" : "front"}.`}
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

            <div className="flip-navigation">
              <button
                className="study-button"
                type="button"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
              >
                Previous
              </button>
              <button
                className="study-button"
                type="button"
                onClick={handleNext}
              >
                Next
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default FlipThrough;

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSet } from "../services/api";
import "./MySets.css";

function PublicSetView() {
  const { setId } = useParams();

  const [studySet, setStudySet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

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
        setStudySet(loadedSet);
      } catch (err) {
        if (!active) return;

        if (err.status === 404) {
          setNotFound(true);
        } else {
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

  return (
    <main className="mysets-page">
      <div className="mysets-container">
        <header className="mysets-header">
          <h1>Public Set View</h1>
          <p>Explore flashcards shared by other users.</p>
        </header>

        {loading ? (
          <section className="mysets-panel">
            <p>Loading study set...</p>
          </section>
        ) : notFound ? (
          <section className="mysets-panel">
            <h2>Set not found</h2>
            <Link to="/public">Back to Browse</Link>
          </section>
        ) : error ? (
          <section className="mysets-panel">
            <p role="alert" className="mysets-error">
              {error}
            </p>
            <Link to="/public">Back to Browse</Link>
          </section>
        ) : studySet ? (
          <>
            <section className="mysets-panel">
              <h2>{studySet.title}</h2>

              <p>
                {studySet.description || "No description"}
              </p>

              <p>
                by {studySet.owner_name || "Unknown"}
              </p>

              <div className="mysets-actions">
                <Link
                  to={`/study/${setId}`}
                  className="mysets-study-button"
                >
                  Study This Set
                </Link>
                <Link
                  to={`/flip/${setId}`}
                  className="mysets-study-button"
                >
                  Flip through
                </Link>
                {studySet.is_owner === true && (
                  <Link
                    to={`/mysets/${setId}`}
                    className="mysets-study-button"
                  >
                    Edit this set
                  </Link>
                )}
              </div>
            </section>

            <section className="mysets-panel">
              <h2>Flashcards</h2>

              {!studySet.cards ||
              studySet.cards.length === 0 ? (
                <p>No flashcards in this set yet.</p>
              ) : (
                <div className="mysets-grid">
                  {studySet.cards.map((card) => (
                    <article
                      className="mysets-card"
                      key={card.id}
                    >
                      <h3>Front</h3>
                      <p>{card.front}</p>

                      <h3>Back</h3>
                      <p>{card.back}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <Link to="/public">Back to Browse</Link>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default PublicSetView;

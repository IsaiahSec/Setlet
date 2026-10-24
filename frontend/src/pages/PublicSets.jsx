
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPublicSets } from "../services/api";
import "./MySets.css";
import "./PublicSets.css";

const PAGE_SIZE = 10;

function PublicSets() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sets, setSets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Wait 300 ms after typing before searching
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Load public sets from the API
  useEffect(() => {
    let active = true;

    async function loadSets() {
      setLoading(true);
      setError("");

      try {
        const data = await listPublicSets(
          query,
          page,
          PAGE_SIZE
        );

        if (!active) return;

        setSets(data.sets || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (active) {
          setError(err.message);
          setSets([]);
          setTotal(0);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSets();

    return () => {
      active = false;
    };
  }, [query, page]);

  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE)
  );

  return (
    <main className="mysets-page">
      <div className="mysets-container">
        <header className="mysets-header">
          <h1>Public Study Sets</h1>
          <p>
            Discover and study flashcards shared by others.
          </p>
        </header>

        <section className="mysets-panel">
          <h2>Browse Study Sets</h2>

          <label htmlFor="public-search">
            Search public sets
          </label>

          <input
            id="public-search"
            className="publicsets-search"
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search by title or description..."
          />
        </section>

        {error && (
          <p role="alert" className="mysets-error">
            {error}
          </p>
        )}

        <section className="mysets-panel">
          <h2>Available Sets</h2>

          {loading ? (
            <p>Loading public study sets...</p>
          ) : error ? null : sets.length === 0 ? (
            <p>
              {query
                ? "No public sets match your search."
                : "No public study sets available yet."}
            </p>
          ) : (
            <>
              <div className="mysets-grid">
                {sets.map((set) => (
                  <article
                    className="mysets-card"
                    key={set.id}
                  >
                    <h3>
                      <Link to={`/public/${set.id}`}>
                        {set.title}
                      </Link>
                    </h3>

                    <p>
                      {set.description ||
                        "No description"}
                    </p>

                    <p className="mysets-count">
                      {set.card_count ?? 0} cards
                    </p>

                    <p>
                      by {set.owner_name || "Unknown"}
                    </p>
                  </article>
                ))}
              </div>

              <div className="publicsets-pagination">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() =>
                    setPage((current) => current - 1)
                  }
                >
                  Previous
                </button>

                <span>
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) => current + 1)
                  }
                >
                  Next
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default PublicSets;


import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPublicSets, listSets } from "../services/api";
import "./MySets.css";
import "./PublicSets.css";

const PAGE_SIZE = 10;

function PublicSets() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sharedFrom, setSharedFrom] = useState("");
  const [sharedTo, setSharedTo] = useState("");
  const [owner, setOwner] = useState(null);
  const [page, setPage] = useState(1);
  const [sets, setSets] = useState([]);
  const [ownedPublicSets, setOwnedPublicSets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;

    async function loadSets() {
      setLoading(true);
      setError("");

      try {
        const [publicResult, ownedResult] = await Promise.allSettled([
          listPublicSets(query, page, PAGE_SIZE, {
            ownerId: owner?.isSelf ? undefined : owner?.id,
            sharedFrom,
            sharedTo,
          }),
          listSets(query),
        ]);

        if (publicResult.status === "rejected") {
          throw publicResult.reason;
        }
        if (!active) return;

        const ownResponse = ownedResult.status === "fulfilled"
          ? ownedResult.value
          : [];
        const ownSets = Array.isArray(ownResponse)
          ? ownResponse
          : ownResponse.sets || [];
        const data = publicResult.value;

        setSets(data.sets || []);
        setTotal(data.total || 0);
        setOwnedPublicSets(
          ownSets.filter((set) => set.visibility === "public")
        );
      } catch (err) {
        if (active) {
          setError(err.message);
          setSets([]);
          setTotal(0);
          setOwnedPublicSets([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSets();
    return () => {
      active = false;
    };
  }, [query, page, owner, sharedFrom, sharedTo]);

  function updateDateFilter(setFilter, value) {
    setPage(1);
    setFilter(value);
  }

  function formatSharedDate(value) {
    if (!value || Number.isNaN(new Date(value).getTime())) {
      return "Unknown date";
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(value));
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleSets = owner?.isSelf ? [] : sets;
  const visibleOwnedSets =
    !sharedFrom && !sharedTo && (!owner || owner.isSelf)
      ? ownedPublicSets
      : [];

  return (
    <main className="mysets-page">
      <div className="mysets-container">
        <header className="mysets-header">
          <h1>Public Study Sets</h1>
          <p>Discover and study flashcards shared by others.</p>
        </header>

        <section className="mysets-panel">
          <h2>Browse Study Sets</h2>
          <label htmlFor="public-search">Search public sets</label>
          <input
            id="public-search"
            className="publicsets-search"
            type="search"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search by title or description..."
          />

          <div className="publicsets-date-filters">
            <div>
              <label htmlFor="shared-from">Shared from</label>
              <input
                id="shared-from"
                type="date"
                value={sharedFrom}
                onChange={(event) =>
                  updateDateFilter(setSharedFrom, event.target.value)
                }
              />
            </div>
            <div>
              <label htmlFor="shared-to">Shared to</label>
              <input
                id="shared-to"
                type="date"
                value={sharedTo}
                onChange={(event) =>
                  updateDateFilter(setSharedTo, event.target.value)
                }
              />
            </div>
          </div>

        </section>

        {error && (
          <p role="alert" className="mysets-error">
            {error}
          </p>
        )}

        <section className="mysets-panel">
          <h2>Available Sets</h2>
          {owner && (
            <div className="publicsets-owner-filter">
              <span>Owner: {owner.name}</span>
              <button
                type="button"
                aria-label="Clear owner filter"
                onClick={() => {
                  setPage(1);
                  setOwner(null);
                }}
              >
                Clear
              </button>
            </div>
          )}

          {loading ? (
            <p>Loading public study sets...</p>
          ) : error ? null : visibleSets.length === 0 && visibleOwnedSets.length === 0 ? (
            <p>
              {query
                ? "No public sets match your search."
                : "No public study sets available yet."}
            </p>
          ) : (
            <>
              {visibleOwnedSets.length > 0 && (
                <>
                  <h3>Your Public Sets</h3>
                  <div className="mysets-grid">
                    {visibleOwnedSets.map((set) => (
                      <article className="mysets-card" key={set.id}>
                        <h3>
                          <Link to={`/public/${set.id}`}>{set.title}</Link>
                        </h3>
                        <p>{set.description || "No description"}</p>
                        <p className="mysets-count">
                          {set.card_count ?? 0} cards
                        </p>
                        <p>by You</p>
                        <p className="publicsets-shared-date">
                          Shared date unavailable
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setPage(1);
                            setOwner({ id: null, name: "You", isSelf: true });
                          }}
                        >
                          More from You
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              )}

              {visibleSets.length > 0 && (
                <>
                  <div className="mysets-grid">
                    {visibleSets.map((set) => (
                      <article className="mysets-card" key={set.id}>
                        <h3>
                          <Link to={`/public/${set.id}`}>{set.title}</Link>
                        </h3>
                        <p>{set.description || "No description"}</p>
                        <p className="mysets-count">
                          {set.card_count ?? 0} cards
                        </p>
                        <p>by {set.owner_name || "Unknown"}</p>
                        <p className="publicsets-shared-date">
                          Shared {formatSharedDate(set.shared_at)}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setPage(1);
                            setOwner({
                              id: set.owner_id,
                              name: set.owner_name || "Unknown",
                            });
                          }}
                        >
                          More from {set.owner_name || "this owner"}
                        </button>
                      </article>
                    ))}
                  </div>

                  <div className="publicsets-pagination">
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      Previous
                    </button>
                    <span>Page {page} of {totalPages}</span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default PublicSets;

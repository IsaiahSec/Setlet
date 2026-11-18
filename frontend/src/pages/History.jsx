import { useEffect, useState } from "react";
import { getHistory } from "../services/api";
import "./History.css";

function isHistoryResponse(data) {
  return (
    data &&
    typeof data === "object" &&
    data.totals &&
    Number.isFinite(data.totals.sets_studied) &&
    Number.isFinite(data.totals.cards_reviewed) &&
    Number.isFinite(data.totals.reviews) &&
    Array.isArray(data.last_30_days) &&
    data.last_30_days.every(
      (day) =>
        typeof day.date === "string" && Number.isFinite(day.reviews)
    ) &&
    data.upcoming &&
    Number.isFinite(data.upcoming.overdue) &&
    Array.isArray(data.upcoming.days) &&
    data.upcoming.days.every(
      (day) => typeof day.date === "string" && Number.isFinite(day.due)
    )
  );
}

function formatDate(date) {
  const parsedDate = new Date(`${date}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}

function History() {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const data = await getHistory();
        if (!isHistoryResponse(data)) {
          throw new Error("The history response was incomplete.");
        }
        if (active) setHistory(data);
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to load your history.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, [retryCount]);

  const maxDailyReviews = history
    ? Math.max(0, ...history.last_30_days.map((day) => day.reviews))
    : 0;

  return (
    <main className="history-page" aria-busy={loading}>
      <div className="history-container">
        <header className="history-header">
          <span className="history-kicker">Your progress</span>
          <h1>Your History</h1>
          <p>Review your study activity and see what is coming up.</p>
        </header>

        {loading ? (
          <section className="history-panel" aria-live="polite">
            <p className="history-status" role="status">
              Loading your history...
            </p>
          </section>
        ) : error ? (
          <section className="history-panel" aria-labelledby="history-error-heading">
            <h2 id="history-error-heading">History unavailable</h2>
            <p className="history-error" role="alert">
              {error}
            </p>
            <button
              className="history-retry"
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              Try again
            </button>
          </section>
        ) : history ? (
          <>
            <section
              className="history-stats"
              aria-label="Review statistics"
            >
              <article className="history-stat">
                <span>Sets studied</span>
                <strong>{history.totals.sets_studied}</strong>
              </article>
              <article className="history-stat">
                <span>Cards reviewed</span>
                <strong>{history.totals.cards_reviewed}</strong>
              </article>
              <article className="history-stat">
                <span>Total reviews</span>
                <strong>{history.totals.reviews}</strong>
              </article>
            </section>

            {history.totals.reviews === 0 && (
              <p className="history-empty" role="status">
                No reviews yet. Review some cards to see your history here.
              </p>
            )}

            <div className="history-sections">
              <section
                className="history-panel"
                aria-labelledby="daily-reviews-heading"
              >
                <div className="history-section-heading">
                  <div>
                    <h2 id="daily-reviews-heading">Reviews per day</h2>
                    <p>Daily reviews over the last 30 days</p>
                  </div>
                  <span className="history-section-mark" aria-hidden="true">
                    30
                  </span>
                </div>
                <ol className="history-daily-list" aria-label="Daily reviews">
                  {history.last_30_days.map((day) => {
                    const width =
                      maxDailyReviews === 0
                        ? 0
                        : (day.reviews / maxDailyReviews) * 100;

                    return (
                      <li className="history-daily-row" key={day.date}>
                        <time dateTime={day.date}>{formatDate(day.date)}</time>
                        <span className="history-bar-track" aria-hidden="true">
                          <span
                            className="history-bar"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="history-daily-count">
                          {day.reviews}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section
                className="history-panel"
                aria-labelledby="upcoming-heading"
              >
                <div className="history-section-heading">
                  <div>
                    <h2 id="upcoming-heading">Upcoming</h2>
                    <p>Cards due over the next 14 days</p>
                  </div>
                </div>
                <div className="history-overdue">
                  <span>Overdue</span>
                  <strong>{history.upcoming.overdue}</strong>
                </div>
                <ol className="history-upcoming-list" aria-label="Upcoming reviews">
                  {history.upcoming.days.map((day) => (
                    <li key={day.date}>
                      <time dateTime={day.date}>{formatDate(day.date)}</time>
                      <span>
                        {day.due} {day.due === 1 ? "card" : "cards"}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default History;

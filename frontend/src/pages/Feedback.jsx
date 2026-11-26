import { useState } from "react";
import { sendFeedback } from "../services/api";
import "./Feedback.css";

const MAX_MESSAGE_LENGTH = 2000;

function Feedback() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    setError("");

    try {
      await sendFeedback(message);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Could not send feedback right now");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="feedback-page">
      <div className="feedback-container">
        <header className="feedback-header">
          <span className="feedback-kicker">Help us improve</span>
          <h1>Send Feedback</h1>
          <p>Share a suggestion or let us know how Setlet can work better for you.</p>
        </header>

        <section className="feedback-panel">
          {submitted ? (
            <div className="feedback-confirmation" role="status">
              <span className="feedback-confirmation-mark" aria-hidden="true">
                ✓
              </span>
              <h2>Thank you for your feedback</h2>
              <p>Your message has been received.</p>
            </div>
          ) : (
            <form className="feedback-form" onSubmit={handleSubmit}>
              <label htmlFor="feedback-message">Your message</label>
              <textarea
                id="feedback-message"
                name="message"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setError("");
                }}
                maxLength={MAX_MESSAGE_LENGTH}
                rows={8}
                aria-describedby="feedback-character-count"
                placeholder="Tell us what you think..."
              />
              <div
                className="feedback-character-count"
                id="feedback-character-count"
                aria-live="polite"
              >
                {message.length} / {MAX_MESSAGE_LENGTH} characters
              </div>

              {error && (
                <p className="feedback-error" role="alert">
                  {error}
                </p>
              )}

              <button
                className="feedback-send"
                type="submit"
                disabled={!message.trim() || sending}
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export default Feedback;

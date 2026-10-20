import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { isDueToday } from "../lib/readiness";
import type { Flashcard } from "../types";

interface FlashcardsProps {
  cards: Flashcard[];
  busy: boolean;
  onReview: (card: Flashcard, result: "got-it" | "missed") => Promise<boolean>;
  onRefresh: () => void;
}

export default function Flashcards({ cards, busy, onReview, onRefresh }: FlashcardsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  const dueCards = useMemo(() => cards.filter((card) => isDueToday(card.next_review_at)), [cards]);
  const reviewCards = dueCards.length ? dueCards : cards;
  const card = reviewCards[selectedIndex] ?? null;
  const isDue = card ? isDueToday(card.next_review_at) : false;

  async function review(result: "got-it" | "missed") {
    if (!card || !isDue || savingReview) return;
    setSavingReview(true);
    setReviewMessage("");
    let saved = false;
    try {
      saved = await onReview(card, result);
    } catch {
      saved = false;
    }
    if (!saved) {
      setReviewMessage("This review could not be saved. Please try again.");
      setSavingReview(false);
      return;
    }
    setFlipped(false);
    setSelectedIndex((current) => Math.min(current, Math.max(0, reviewCards.length - 2)));
    setSavingReview(false);
  }

  function moveCard(direction: -1 | 1) {
    setSelectedIndex((current) => (current + direction + reviewCards.length) % reviewCards.length);
    setFlipped(false);
  }

  return (
    <main className="flashcards-page">
      <section className="dashboard-hero flashcards-hero">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" />{"SMALL REVIEWS, STRONGER RECALL"}</div>
          <h1>{"Your mistake-made flashcards."}</h1>
          <p>{"A wrong answer becomes a quick review, spaced out as you grow more confident."}</p>
        </div>
        <Button variant="secondary" onClick={onRefresh} disabled={busy}>
          <RotateCcw size={16} />{"Refresh"}
        </Button>
      </section>

      {busy && <p className="dashboard-loading" role="status">{"Getting things ready…"}</p>}

      <section className="flashcard-stats" aria-label={"Flashcard review summary"}>
        <article className="flashcard-stat due-stat">
          <span className="flashcard-stat-icon"><Sparkles size={19} /></span>
          <div><strong>{dueCards.length}</strong><span>{"Due today"}</span></div>
        </article>
        <article className="flashcard-stat">
          <span className="flashcard-stat-icon"><RotateCcw size={18} /></span>
          <div><strong>{cards.length}</strong><span>{"Total cards"}</span></div>
        </article>
        <p className="leitner-note">{"Review boxes use 1, 2, 4, 7 and 14 day intervals."}</p>
      </section>

      {busy && !cards.length ? (
        <section className="flashcard-skeleton" role="status" aria-label={"Getting things ready…"}>
          <span className="skeleton-line skeleton-short" />
          <span className="skeleton-card" />
          <span className="skeleton-line skeleton-medium" />
        </section>
      ) : !card ? (
        <section className="empty-state flashcards-empty">
          <span className="empty-state-icon"><Sparkles size={22} /></span>
          <h2>{"Your first card is waiting to be made."}</h2>
          <p>{"When you miss a question, we’ll turn it into a flashcard you can revisit here."}</p>
        </section>
      ) : (
        <section className="flashcard-review" aria-labelledby="flashcard-topic">
          <div className="flashcard-review-top">
            <span className="review-counter">{selectedIndex + 1} / {reviewCards.length}</span>
            <span className="box-level">{`Box ${card.box} of 5`}</span>
          </div>
          <div className="leitner-boxes" aria-label={`Box ${card.box} of 5`}>
            {[1, 2, 3, 4, 5].map((box) => (
              <span key={box} className={box <= card.box ? "leitner-box active" : "leitner-box"} />
            ))}
          </div>

          <button
            type="button"
            className={`flashcard ${flipped ? "is-flipped" : ""}`}
            onClick={() => setFlipped((current) => !current)}
            aria-label={flipped ? "Show flashcard front" : "Show answer"}
            aria-pressed={flipped}
          >
            <span className="flashcard-face flashcard-front">
              <span className="flashcard-side-label">{"REMEMBER THE IDEA"}</span>
              <strong id="flashcard-topic">{card.front}</strong>
              <span className="flashcard-hint">{"Tap to flip"}</span>
            </span>
            <span className="flashcard-face flashcard-back">
              <span className="flashcard-side-label">{"THE TAKEAWAY"}</span>
              <span className="flashcard-answer">{card.back}</span>
              <span className="flashcard-hint">{"Tap to flip"}</span>
            </span>
          </button>

          <div className="flashcard-controls">
            <button className="card-nav-button" type="button" onClick={() => moveCard(-1)} aria-label={"Previous card"} disabled={reviewCards.length < 2}>
              <ArrowLeft size={17} />
            </button>
            {!flipped ? (
              <Button size="large" onClick={() => setFlipped(true)}>{"Show answer"}<ArrowRight size={16} /></Button>
            ) : isDue ? (
              <div className="review-actions">
                <Button variant="secondary" size="large" disabled={savingReview} onClick={() => void review("missed")}>{"Missed"}</Button>
                <Button size="large" disabled={savingReview} onClick={() => void review("got-it")}>{"Got it"}<ArrowRight size={16} /></Button>
              </div>
            ) : (
              <span className="next-review-note">{`Next review ${new Date(card.next_review_at).toLocaleDateString()}`}</span>
            )}
            <button className="card-nav-button" type="button" onClick={() => moveCard(1)} aria-label={"Next card"} disabled={reviewCards.length < 2}>
              <ArrowRight size={17} />
            </button>
          </div>
          {reviewMessage && <p className="form-error" role="alert">{reviewMessage}</p>}
          <p className="flashcard-progress-note">
            {dueCards.length ? `${dueCards.length} due today · ${cards.length} total cards` : "All caught up for today. You can still browse your cards."}
          </p>
        </section>
      )}
    </main>
  );
}

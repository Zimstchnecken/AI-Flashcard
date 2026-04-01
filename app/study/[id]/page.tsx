"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { intervalLabel, type Rating, type ReviewRecord } from "@/lib/sm2";

type DueCard = {
  id: string;
  question: string;
  answer: string;
  hint?: string | null;
  review: ReviewRecord;
};

type StudyPayload = {
  deck: { id: string; name: string };
  dueCards: DueCard[];
  totalCards: number;
};

const RATING_OPTIONS: Array<{ label: string; value: Rating; className: string }> = [
  { label: "Again", value: 0, className: "border-[var(--error)] text-[var(--error)]" },
  { label: "Hard", value: 2, className: "border-[var(--warning)] text-[var(--warning)]" },
  { label: "Good", value: 4, className: "border-border text-text-primary" },
  { label: "Easy", value: 5, className: "border-[var(--success)] text-[var(--success)]" },
];

export default function StudyPage() {
  const params = useParams<{ id: string }>();
  const deckId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deckName, setDeckName] = useState("Study Deck");
  const [cards, setCards] = useState<DueCard[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [remembered, setRemembered] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const currentCard = cards[index] ?? null;
  const reviewedCount = index;
  const isComplete = index >= cards.length;

  const progressPercent = useMemo(() => {
    if (cards.length === 0) {
      return 0;
    }
    return Math.min(100, Math.round((reviewedCount / cards.length) * 100));
  }, [cards.length, reviewedCount]);

  useEffect(() => {
    async function loadDueCards() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/study?deckId=${deckId}`);
        const data = (await response.json()) as StudyPayload | { error?: string };

        if (!response.ok) {
          throw new Error("error" in data ? data.error : "Unable to load study cards.");
        }

        if (!("dueCards" in data)) {
          throw new Error("Unexpected study payload.");
        }

        setDeckName(data.deck.name);
        setCards(data.dueCards);
        setTotalCards(data.totalCards);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load study cards.");
      } finally {
        setLoading(false);
      }
    }

    if (deckId) {
      loadDueCards();
    }
  }, [deckId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "Space" && currentCard && !submitting) {
        event.preventDefault();
        setFlipped((value) => !value);
      }

      if (event.key === "?") {
        event.preventDefault();
        setShowHelp((value) => !value);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentCard, submitting]);

  async function rateCard(rating: Rating) {
    if (!currentCard) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: currentCard.id, rating }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to record review.");
      }

      if (rating >= 3) {
        setRemembered((value) => value + 1);
      }

      setIndex((value) => value + 1);
      setFlipped(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to record review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-enter mx-auto min-h-screen w-full max-w-5xl px-6 py-10 md:px-10">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link className="mono text-xs text-text-secondary hover:text-primary" href="/decks">
            Back to Decks
          </Link>
          <button
            type="button"
            className="mono rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:border-primary hover:text-primary"
            onClick={() => setShowHelp(true)}
            aria-label="Open keyboard shortcuts help"
          >
            ?
          </button>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold tracking-[-0.02em] md:text-3xl">{deckName}</h1>
          <p className="mono text-xs text-text-secondary">
            {Math.min(reviewedCount + 1, Math.max(cards.length, 1))} / {Math.max(cards.length, 1)} due
          </p>
        </div>
      </header>

      <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-primary transition-all duration-400" style={{ width: `${progressPercent}%` }} />
      </div>

      {loading ? (
        <section className="panel p-8 text-text-secondary">Loading due cards...</section>
      ) : error ? (
        <section className="panel p-8">
          <p className="mono text-xs text-[var(--error)]">{error}</p>
        </section>
      ) : isComplete ? (
        <section className="panel space-y-4 p-8">
          <h2 className="text-3xl font-bold tracking-[-0.02em]">Session Complete</h2>
          <p className="text-text-secondary">You reviewed {reviewedCount} cards from this session.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="mono text-xs text-text-secondary">Reviewed</div>
              <div className="mt-2 font-mono text-3xl">{reviewedCount}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="mono text-xs text-text-secondary">Remembered</div>
              <div className="mt-2 font-mono text-3xl">{remembered}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="mono text-xs text-text-secondary">Deck Size</div>
              <div className="mt-2 font-mono text-3xl">{totalCards}</div>
            </div>
          </div>
          <div className="flex gap-3">
            <Link className="mono rounded-xl border border-border px-4 py-2 hover:border-primary hover:text-primary" href={`/study/${deckId}`}>
              Study Again
            </Link>
            <Link className="mono rounded-xl bg-primary px-4 py-2 text-background" href="/decks">
              Back to Decks
            </Link>
          </div>
        </section>
      ) : currentCard ? (
        <section className="mx-auto max-w-xl space-y-6">
          <button
            type="button"
            onClick={() => setFlipped((value) => !value)}
            className="panel h-[320px] w-full cursor-pointer rounded-[20px] p-8 text-left transition hover:border-primary"
            aria-label="Flip flashcard"
          >
            {!flipped ? (
              <div className="flex h-full flex-col justify-between">
                <p className="text-center text-2xl italic leading-relaxed">{currentCard.question}</p>
                <div className="space-y-2">
                  {currentCard.hint ? (
                    <p className="text-sm text-text-secondary">Hint: {currentCard.hint}</p>
                  ) : null}
                  <p className="mono text-xs text-text-secondary">Press Space or click to reveal answer</p>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col justify-between">
                <p className="text-lg leading-relaxed text-text-primary">{currentCard.answer}</p>
                <p className="mono text-xs text-text-secondary">Choose your confidence below</p>
              </div>
            )}
          </button>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RATING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={!flipped || submitting}
                onClick={() => rateCard(option.value)}
                className={`rounded-xl border bg-surface px-4 py-3 text-left transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${option.className}`}
                aria-label={`Rate card ${option.label}`}
              >
                <div className="mono text-xs">{option.label}</div>
                <div className="mt-1 text-xs text-text-secondary">
                  {intervalLabel(option.value, currentCard.review)}
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel p-8 text-text-secondary">No due cards right now. You are caught up.</section>
      )}

      {showHelp ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-6" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts help">
          <div className="panel w-full max-w-lg space-y-4 p-6">
            <h2 className="text-2xl font-bold tracking-[-0.02em]">Keyboard Shortcuts</h2>
            <ul className="space-y-2 text-text-secondary">
              <li><span className="mono">Space</span> Flip current card</li>
              <li><span className="mono">?</span> Toggle this help panel</li>
              <li><span className="mono">Tab</span> Move through rating buttons</li>
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="mono rounded-xl bg-primary px-4 py-2 text-sm text-background"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Toast from "@/components/ui/Toast";

type Deck = {
  id: string;
  name: string;
  created_at: string;
};

type DeckCard = {
  id: string;
  question: string;
  answer: string;
  hint?: string | null;
  position: number;
};

export default function DeckDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const deckId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [savingDeck, setSavingDeck] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState(false);
  const [workingCardId, setWorkingCardId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  useEffect(() => {
    async function loadDeck() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/decks/${deckId}`);
        const data = (await response.json()) as { deck?: Deck; cards?: DeckCard[]; error?: string };

        if (!response.ok || !data.deck) {
          throw new Error(data.error ?? "Unable to load deck.");
        }

        setDeck(data.deck);
        setCards(data.cards ?? []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load deck.");
      } finally {
        setLoading(false);
      }
    }

    if (deckId) {
      loadDeck();
    }
  }, [deckId]);

  function updateLocalCard(id: string, key: "question" | "answer" | "hint", value: string) {
    setCards((current) =>
      current.map((card) => {
        if (card.id !== id) {
          return card;
        }
        return { ...card, [key]: key === "hint" ? value || null : value };
      }),
    );
  }

  async function saveDeckName() {
    if (!deck) {
      return;
    }

    setSavingDeck(true);
    try {
      const response = await fetch(`/api/decks/${deck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deck.name.trim() || "Untitled Deck" }),
      });

      const data = (await response.json()) as { deck?: Deck; error?: string };
      if (!response.ok || !data.deck) {
        throw new Error(data.error ?? "Failed to update deck name.");
      }

      setDeck(data.deck);
      setToast({ message: "Deck name updated.", kind: "success" });
    } catch (cause) {
      setToast({
        message: cause instanceof Error ? cause.message : "Failed to update deck name.",
        kind: "error",
      });
    } finally {
      setSavingDeck(false);
    }
  }

  async function saveCard(card: DeckCard) {
    setWorkingCardId(card.id);
    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: card.question.trim(),
          answer: card.answer.trim(),
          hint: card.hint ?? null,
          position: card.position,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update card.");
      }

      setToast({ message: "Card updated.", kind: "success" });
    } catch (cause) {
      setToast({
        message: cause instanceof Error ? cause.message : "Failed to update card.",
        kind: "error",
      });
    } finally {
      setWorkingCardId(null);
    }
  }

  async function deleteCard(cardId: string) {
    setWorkingCardId(cardId);
    try {
      const response = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete card.");
      }

      setCards((current) => current.filter((card) => card.id !== cardId));
      setToast({ message: "Card deleted.", kind: "success" });
    } catch (cause) {
      setToast({
        message: cause instanceof Error ? cause.message : "Failed to delete card.",
        kind: "error",
      });
    } finally {
      setWorkingCardId(null);
    }
  }

  async function removeDeck() {
    if (!deck) {
      return;
    }

    setDeletingDeck(true);
    try {
      const response = await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete deck.");
      }

      router.push("/decks");
    } catch (cause) {
      setToast({
        message: cause instanceof Error ? cause.message : "Failed to delete deck.",
        kind: "error",
      });
      setDeletingDeck(false);
    }
  }

  return (
    <main className="page-enter mx-auto min-h-screen w-full max-w-5xl px-6 py-12 md:px-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <Link className="mono text-xs text-text-secondary hover:text-primary" href="/decks">
            Back to Decks
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <input
              className="focus-ring rounded-md border bg-surface-2 px-3 py-2 text-3xl font-bold tracking-[-0.02em]"
              value={deck?.name ?? ""}
              onChange={(event) =>
                setDeck((current) => (current ? { ...current, name: event.target.value } : current))
              }
              aria-label="Deck name"
            />
            <button
              type="button"
              onClick={saveDeckName}
              disabled={!deck || savingDeck}
              className="mono rounded-lg border border-border px-3 py-2 text-xs hover:border-primary hover:text-primary disabled:opacity-60"
            >
              {savingDeck ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <Link className="mono rounded-xl border border-[var(--success)] px-4 py-2 text-sm text-[var(--success)]" href={`/study/${deckId}`}>
            Study Now
          </Link>
          <button
            type="button"
            onClick={removeDeck}
            disabled={deletingDeck || !deck}
            className="mono rounded-xl border border-[var(--error)] px-4 py-2 text-sm text-[var(--error)] disabled:opacity-60"
          >
            {deletingDeck ? "Deleting..." : "Delete Deck"}
          </button>
        </div>
      </header>

      {loading ? <section className="panel p-8 text-text-secondary">Loading deck...</section> : null}
      {error ? <section className="panel p-8"><p className="mono text-xs text-[var(--error)]">{error}</p></section> : null}

      {!loading && !error ? (
        <section className="space-y-4">
          {cards.map((card, idx) => (
            <article key={card.id} className="panel space-y-3 p-6">
              <p className="mono text-xs text-text-secondary">Card {idx + 1}</p>
              <textarea
                className="focus-ring min-h-20 w-full rounded-md border bg-surface-2 px-3 py-2 text-lg font-semibold"
                value={card.question}
                onChange={(event) => updateLocalCard(card.id, "question", event.target.value)}
                aria-label={`Card ${idx + 1} question`}
              />
              <textarea
                className="focus-ring min-h-24 w-full rounded-md border bg-surface-2 px-3 py-2 text-text-secondary"
                value={card.answer}
                onChange={(event) => updateLocalCard(card.id, "answer", event.target.value)}
                aria-label={`Card ${idx + 1} answer`}
              />
              <textarea
                className="focus-ring min-h-14 w-full rounded-md border bg-surface-2 px-3 py-2 text-sm text-text-secondary"
                value={card.hint ?? ""}
                placeholder="Optional hint"
                onChange={(event) => updateLocalCard(card.id, "hint", event.target.value)}
                aria-label={`Card ${idx + 1} hint`}
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => saveCard(card)}
                  disabled={workingCardId === card.id}
                  className="mono rounded-lg border border-border px-3 py-2 text-xs hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  {workingCardId === card.id ? "Saving..." : "Save Card"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteCard(card.id)}
                  disabled={workingCardId === card.id}
                  className="mono rounded-lg border border-[var(--error)] px-3 py-2 text-xs text-[var(--error)] disabled:opacity-60"
                >
                  Delete Card
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {toast ? <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} /> : null}
    </main>
  );
}

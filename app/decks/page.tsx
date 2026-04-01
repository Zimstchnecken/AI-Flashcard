"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DeckListItem = {
  id: string;
  name: string;
  created_at: string;
  cardCount: number;
};

export default function DecksPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decks, setDecks] = useState<DeckListItem[]>([]);

  useEffect(() => {
    async function loadDecks() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/decks");
        const data = (await response.json()) as { decks?: DeckListItem[]; error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load decks.");
        }

        setDecks(data.decks ?? []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load decks.");
      } finally {
        setLoading(false);
      }
    }

    loadDecks();
  }, []);

  return (
    <main className="page-enter mx-auto min-h-screen w-full max-w-6xl px-6 py-12 md:px-10">
      <header className="mb-10 flex items-center justify-between gap-4">
        <h1 className="text-4xl font-bold tracking-[-0.02em]">My Decks</h1>
        <Link className="mono rounded-xl bg-primary px-4 py-2 text-sm text-background" href="/">
          + New Deck
        </Link>
      </header>

      {loading ? <section className="panel p-8 text-text-secondary">Loading decks...</section> : null}
      {error ? <section className="panel p-8"><p className="mono text-xs text-[var(--error)]">{error}</p></section> : null}

      {!loading && !error && decks.length === 0 ? (
        <section className="panel space-y-3 p-8">
          <p className="text-text-secondary">You have no decks yet. Generate your first deck from the landing page.</p>
          <Link className="mono text-xs text-primary" href="/">
            Generate Flashcards -&gt;
          </Link>
        </section>
      ) : null}

      {!loading && !error && decks.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <article key={deck.id} className="panel space-y-4 p-6">
              <h2 className="text-xl font-semibold tracking-[-0.02em]">{deck.name}</h2>
              <p className="mono text-xs text-text-secondary">
                {deck.cardCount} cards · {new Date(deck.created_at).toLocaleDateString()}
              </p>
              <div className="flex gap-3">
                <Link className="mono rounded-lg border border-border px-3 py-2 text-xs hover:border-primary hover:text-primary" href={`/decks/${deck.id}`}>
                  Open
                </Link>
                <Link className="mono rounded-lg border border-[var(--success)] px-3 py-2 text-xs text-[var(--success)]" href={`/study/${deck.id}`}>
                  Study
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}

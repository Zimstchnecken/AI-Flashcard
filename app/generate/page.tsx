"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Toast from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import type { Card, GenerateResponse } from "@/types";

type StoredPayload = GenerateResponse & {
  sourceTextLength?: number;
  createdAt?: string;
};

const STORAGE_KEY = "ai-flashcards:latest-generate";

function readStoredPayload(): StoredPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredPayload;
  } catch {
    return null;
  }
}

export default function GeneratePage() {
  const router = useRouter();
  const initialPayload = readStoredPayload();
  const [cards, setCards] = useState<Card[]>(initialPayload?.cards ?? []);
  const [deckName, setDeckName] = useState(initialPayload?.deckNameSuggestion ?? "Generated Deck");
  const [modelUsed] = useState(initialPayload?.modelUsed ?? "unknown");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  const estimatedMinutes = useMemo(() => {
    if (!cards.length) {
      return 0;
    }
    return Math.max(1, Math.ceil(cards.length / 2.5));
  }, [cards.length]);

  function updateCard(id: string, key: "question" | "answer", value: string) {
    setCards((current) =>
      current.map((card) => (card.id === id ? { ...card, [key]: value } : card)),
    );
  }

  function deleteCard(id: string) {
    setCards((current) => current.filter((card) => card.id !== id));
  }

  function addCard() {
    setCards((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        question: "New question",
        answer: "New answer",
      },
    ]);
  }

  async function saveDeck() {
    setSaveMessage(null);
    if (!cards.length) {
      setSaveMessage("Add at least one card before saving.");
      setToast({ message: "Add at least one card before saving.", kind: "error" });
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setToast({ message: "Please sign in to save your deck.", kind: "error" });
        router.push("/auth");
        return;
      }

      const response = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deckName.trim() || "Untitled Deck",
          cards: cards.map((card) => ({
            question: card.question.trim(),
            answer: card.answer.trim(),
            hint: card.hint ?? null,
          })),
        }),
      });

      const data = (await response.json()) as { deck?: { id: string }; error?: string };
      if (!response.ok || !data.deck) {
        throw new Error(data.error ?? "Failed to save deck.");
      }

      router.push(`/decks/${data.deck.id}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Failed to save deck.";
      setSaveMessage(message);
      setToast({ message, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-enter mx-auto min-h-screen w-full max-w-6xl px-6 py-12 md:px-10">
      <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="mono text-xs text-text-secondary">Generate Preview</div>
          <input
            className="focus-ring rounded-md border bg-surface-2 px-4 py-2 text-3xl font-bold tracking-[-0.02em]"
            value={deckName}
            onChange={(event) => setDeckName(event.target.value)}
            aria-label="Deck name"
          />
          <p className="mono text-xs text-text-secondary">
            Generated {cards.length} cards · ~{estimatedMinutes} min review · via {modelUsed}
          </p>
        </div>
        <div className="flex gap-3">
          <Link className="focus-ring rounded-xl border border-border px-4 py-2 hover:border-primary hover:text-primary" href="/">
            Regenerate
          </Link>
          <button
            className="mono rounded-xl bg-primary px-6 py-2 text-sm font-medium text-background disabled:opacity-60"
            type="button"
            onClick={saveDeck}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Deck"}
          </button>
        </div>
      </section>

      {saveMessage ? <p className="mono mb-6 text-xs text-[var(--error)]">{saveMessage}</p> : null}

      {cards.length === 0 ? (
        <section className="panel p-8 text-text-secondary">
          No generated cards found yet. Start from the landing page.
        </section>
      ) : (
        <section className="grid gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <article key={card.id} className="panel space-y-4 p-6">
              <label className="mono block text-xs text-text-secondary">Question</label>
              <textarea
                className="focus-ring min-h-24 w-full rounded-md border bg-surface-2 px-4 py-3"
                value={card.question}
                onChange={(event) => updateCard(card.id, "question", event.target.value)}
              />

              <label className="mono block text-xs text-text-secondary">Answer</label>
              <textarea
                className="focus-ring min-h-24 w-full rounded-md border bg-surface-2 px-4 py-3"
                value={card.answer}
                onChange={(event) => updateCard(card.id, "answer", event.target.value)}
              />

              <div className="flex justify-end">
                <button
                  className="mono rounded-lg border border-[var(--error)] px-3 py-2 text-xs text-[var(--error)] hover:bg-[rgba(207,68,68,0.1)]"
                  type="button"
                  onClick={() => deleteCard(card.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <div className="mt-8">
        <button
          className="focus-ring mono rounded-xl border border-border px-4 py-3 text-sm hover:border-primary hover:text-primary"
          type="button"
          onClick={addCard}
        >
          + Add Card
        </button>
      </div>

      {toast ? <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} /> : null}
    </main>
  );
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const CardInputSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(1000),
  hint: z.string().max(200).nullable().optional(),
});

const CreateDeckSchema = z.object({
  name: z.string().min(2).max(100),
  cards: z.array(CardInputSchema).min(1).max(100),
});

function isMissingSchemaTable(message?: string) {
  return Boolean(message?.includes("Could not find the table 'public.decks'"));
}

export async function GET() {
  const supabase = await createClient();
  const auth = await supabase.auth.getUser();

  if (!auth.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("decks")
    .select("id, name, created_at, cards(id)")
    .eq("user_id", auth.data.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingSchemaTable(error.message)) {
      return NextResponse.json(
        {
          error:
            "Database schema is not initialized. Run supabase/migrations/001_initial_schema.sql in Supabase SQL editor and retry.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const decks = (data ?? []).map((deck) => ({
    id: deck.id,
    name: deck.name,
    created_at: deck.created_at,
    cardCount: Array.isArray(deck.cards) ? deck.cards.length : 0,
  }));

  return NextResponse.json({ decks });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await supabase.auth.getUser();

  if (!auth.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = CreateDeckSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid deck payload" }, { status: 400 });
  }

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({
      user_id: auth.data.user.id,
      name: parsed.data.name,
    })
    .select("id, name, user_id, created_at")
    .single();

  if (deckError || !deck) {
    if (isMissingSchemaTable(deckError?.message)) {
      return NextResponse.json(
        {
          error:
            "Database schema is not initialized. Run supabase/migrations/001_initial_schema.sql in Supabase SQL editor and retry.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: deckError?.message ?? "Failed to create deck" }, { status: 500 });
  }

  const cardsPayload = parsed.data.cards.map((card, index) => ({
    deck_id: deck.id,
    question: card.question,
    answer: card.answer,
    hint: card.hint ?? null,
    position: index,
  }));

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .insert(cardsPayload)
    .select("id, question, answer, hint");

  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      deck: {
        ...deck,
        cards: cards ?? [],
      },
    },
    { status: 201 },
  );
}

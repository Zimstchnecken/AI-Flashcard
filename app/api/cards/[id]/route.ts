import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const UpdateCardSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(1000),
  hint: z.string().max(200).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const auth = await supabase.auth.getUser();

  if (!auth.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = UpdateCardSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid card payload" }, { status: 400 });
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, deck_id")
    .eq("id", params.id)
    .single();

  if (cardError || !card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const { data: deck } = await supabase
    .from("decks")
    .select("id")
    .eq("id", card.deck_id)
    .eq("user_id", auth.data.user.id)
    .single();

  if (!deck) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("cards")
    .update({
      question: parsed.data.question,
      answer: parsed.data.answer,
      hint: parsed.data.hint ?? null,
      ...(typeof parsed.data.position === "number" ? { position: parsed.data.position } : {}),
    })
    .eq("id", params.id)
    .select("id, question, answer, hint, position")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to update card" }, { status: 500 });
  }

  return NextResponse.json({ card: data });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const auth = await supabase.auth.getUser();

  if (!auth.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, deck_id")
    .eq("id", params.id)
    .single();

  if (cardError || !card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const { data: deck } = await supabase
    .from("decks")
    .select("id")
    .eq("id", card.deck_id)
    .eq("user_id", auth.data.user.id)
    .single();

  if (!deck) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("cards").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

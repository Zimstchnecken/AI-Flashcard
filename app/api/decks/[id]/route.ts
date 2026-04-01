import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const UpdateDeckSchema = z.object({
  name: z.string().min(2).max(100),
});

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const auth = await supabase.auth.getUser();

  if (!auth.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id, name, user_id, created_at")
    .eq("id", params.id)
    .eq("user_id", auth.data.user.id)
    .single();

  if (deckError || !deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, question, answer, hint, position")
    .eq("deck_id", params.id)
    .order("position", { ascending: true });

  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 });
  }

  return NextResponse.json({ deck, cards: cards ?? [] });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const auth = await supabase.auth.getUser();

  if (!auth.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = UpdateDeckSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid deck payload" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("decks")
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", auth.data.user.id)
    .select("id, name, user_id, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ deck: data });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const auth = await supabase.auth.getUser();

  if (!auth.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("decks")
    .delete()
    .eq("id", params.id)
    .eq("user_id", auth.data.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

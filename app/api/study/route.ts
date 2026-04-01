import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { calculateNextReview, type Rating } from "@/lib/sm2";
import { createClient } from "@/lib/supabase/server";

const StudySchema = z.object({
  cardId: z.string().uuid(),
  rating: z.union([z.literal(0), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
});

const DeckQuerySchema = z.object({
  deckId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await supabase.auth.getUser();

  if (!auth.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = DeckQuerySchema.safeParse({
    deckId: request.nextUrl.searchParams.get("deckId"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });
  }

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id, name")
    .eq("id", parsed.data.deckId)
    .eq("user_id", auth.data.user.id)
    .single();

  if (deckError || !deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, question, answer, hint, position")
    .eq("deck_id", deck.id)
    .order("position", { ascending: true });

  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 });
  }

  const cardIds = (cards ?? []).map((card) => card.id);
  const { data: reviews, error: reviewsError } = await supabase
    .from("card_reviews")
    .select("card_id, repetitions, ease_factor, interval_days, next_review_at")
    .eq("user_id", auth.data.user.id)
    .in("card_id", cardIds.length ? cardIds : ["00000000-0000-0000-0000-000000000000"]);

  if (reviewsError) {
    return NextResponse.json({ error: reviewsError.message }, { status: 500 });
  }

  const now = Date.now();
  const reviewByCardId = new Map((reviews ?? []).map((review) => [review.card_id, review]));
  const dueCards = (cards ?? [])
    .filter((card) => {
      const review = reviewByCardId.get(card.id);
      if (!review || !review.next_review_at) {
        return true;
      }
      return new Date(review.next_review_at).getTime() <= now;
    })
    .map((card) => {
      const review = reviewByCardId.get(card.id);
      return {
        id: card.id,
        question: card.question,
        answer: card.answer,
        hint: card.hint,
        review: {
          repetitions: review?.repetitions ?? 0,
          easeFactor: Number(review?.ease_factor ?? 2.5),
          intervalDays: review?.interval_days ?? 0,
        },
      };
    });

  return NextResponse.json({
    deck,
    dueCards,
    totalCards: cards?.length ?? 0,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await supabase.auth.getUser();

  if (!auth.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = StudySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review payload" }, { status: 400 });
  }

  const { cardId, rating } = parsed.data;

  const { data: review, error: reviewError } = await supabase
    .from("card_reviews")
    .select("id, repetitions, ease_factor, interval_days")
    .eq("card_id", cardId)
    .eq("user_id", auth.data.user.id)
    .maybeSingle();

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  const next = calculateNextReview(
    {
      repetitions: review?.repetitions ?? 0,
      easeFactor: Number(review?.ease_factor ?? 2.5),
      intervalDays: review?.interval_days ?? 0,
    },
    rating as Rating,
  );

  const { error: upsertError } = await supabase.from("card_reviews").upsert(
    {
      card_id: cardId,
      user_id: auth.data.user.id,
      repetitions: next.repetitions,
      ease_factor: next.easeFactor,
      interval_days: next.intervalDays,
      next_review_at: next.nextReviewAt.toISOString(),
      last_rating: rating,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "card_id,user_id" },
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: stats } = await supabase
    .from("user_stats")
    .select("streak_days, last_studied_at, total_reviewed")
    .eq("user_id", auth.data.user.id)
    .maybeSingle();

  const lastDate = stats?.last_studied_at ?? null;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let streakDays = stats?.streak_days ?? 0;
  if (!lastDate) {
    streakDays = 1;
  } else if (lastDate === today) {
    streakDays = stats?.streak_days ?? 1;
  } else if (lastDate === yesterdayStr) {
    streakDays = (stats?.streak_days ?? 0) + 1;
  } else {
    streakDays = 1;
  }

  await supabase.from("user_stats").upsert(
    {
      user_id: auth.data.user.id,
      streak_days: streakDays,
      last_studied_at: today,
      total_reviewed: (stats?.total_reviewed ?? 0) + 1,
    },
    { onConflict: "user_id" },
  );

  return NextResponse.json({
    nextReviewAt: next.nextReviewAt.toISOString(),
    intervalDays: next.intervalDays,
  });
}

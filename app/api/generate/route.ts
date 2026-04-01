import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts";
import { checkRateLimit } from "@/lib/rate-limit";
import { callWithFallback } from "@/lib/openrouter";

const GenerateRequestSchema = z.object({
  text: z.string().min(50, "Please paste at least 50 characters.").max(20000),
  count: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(30)]),
});

const CardSchema = z.object({
  question: z.string().min(10).max(500),
  answer: z.string().min(5).max(1000),
  hint: z.string().max(200).nullable().optional(),
});

const ResponseSchema = z.object({
  deck_name: z.string().min(3).max(100),
  cards: z.array(CardSchema).min(1).max(50),
});

function getRequesterKey(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "anonymous";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = GenerateRequestSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid input.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const rate = await checkRateLimit(getRequesterKey(req), 10, 60 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in 1 hour." },
        { status: 429 },
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not configured on the server." },
        { status: 500 },
      );
    }

    const text = parsed.data.text.slice(0, 20000);
    const systemPrompt = buildSystemPrompt(parsed.data.count);
    const userPrompt = buildUserPrompt(text, parsed.data.count);

    const completion = await callWithFallback([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const parsedModelResponse = ResponseSchema.safeParse(JSON.parse(completion.text));
    if (!parsedModelResponse.success) {
      return NextResponse.json(
        { error: "The AI returned an unexpected format. Please retry." },
        { status: 500 },
      );
    }

    const cards = parsedModelResponse.data.cards.map((card, index) => ({
      id: `card-${index + 1}-${Date.now()}`,
      question: card.question,
      answer: card.answer,
      hint: card.hint ?? null,
    }));

    return NextResponse.json({
      deckNameSuggestion: parsedModelResponse.data.deck_name,
      cards,
      modelUsed: completion.modelUsed,
    });
  } catch (error) {
    console.error("[generate] failed", error);

    const message =
      error instanceof Error
        ? error.message
        : "Could not generate cards right now. Please try again in a moment.";

    if (message.includes("All models failed")) {
      return NextResponse.json(
        { error: "All free AI models failed right now. Please retry in a moment." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Could not generate cards right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}

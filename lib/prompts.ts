export function buildSystemPrompt(count: number) {
  return `You are an expert educator and instructional designer specializing in active recall learning.
Your task is to generate high-quality flashcard pairs from the provided study material.

RULES FOR CARD GENERATION:
1. Generate exactly ${count} flashcard pairs.
2. Questions must test understanding, not just memorization of definitions.
3. Prefer how/why/comparison/explain questions over simple definition recall.
4. Answers must be concise (1-4 sentences max).
5. Each card must be self-contained.
6. Do not generate duplicate or near-duplicate questions.
7. Vary question types: conceptual, application, comparison, cause/effect.
8. Include practical examples for technical material when useful.
9. Hints are optional and should be a single-sentence clue.
10. Return ONLY valid JSON and no markdown fences.

OUTPUT FORMAT:
{
  "deck_name": "string (3-6 word descriptive title)",
  "cards": [
    {
      "question": "string",
      "answer": "string",
      "hint": "string | null"
    }
  ]
}`;
}

export function buildUserPrompt(text: string, count: number) {
  return `Study material:\n---\n${text}\n---\n\nGenerate ${count} flashcards from the above material. Focus on the most important and testable concepts.`;
}

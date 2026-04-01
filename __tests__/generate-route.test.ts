import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const checkRateLimit = vi.fn();
const callWithFallback = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit,
}));

vi.mock("@/lib/openrouter", () => ({
  callWithFallback,
}));

describe("POST /api/generate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 1000 });
    callWithFallback.mockResolvedValue({
      text: JSON.stringify({
        deck_name: "Test Deck",
        cards: [
          {
            question: "Why is active recall useful for memory retention?",
            answer: "It forces retrieval practice, which strengthens memory pathways.",
            hint: null,
          },
        ],
      }),
      modelUsed: "meta-llama/llama-3.3-70b-instruct:free",
    });
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  it("returns 429 when rate limited", async () => {
    checkRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });
    process.env.OPENROUTER_API_KEY = "sk-test";

    const { POST } = await import("@/app/api/generate/route");
    const req = new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "a".repeat(100),
        count: 10,
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(429);
  });

  it("returns cards payload on success", async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";

    const { POST } = await import("@/app/api/generate/route");
    const req = new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "This is sufficient educational content for test generation. ".repeat(4),
        count: 10,
      }),
    });

    const res = await POST(req as never);
    const json = (await res.json()) as { cards?: unknown[]; modelUsed?: string };

    expect(res.status).toBe(200);
    expect(Array.isArray(json.cards)).toBe(true);
    expect(json.modelUsed).toBe("meta-llama/llama-3.3-70b-instruct:free");
  });
});

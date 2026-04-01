import OpenAI from "openai";

export const DEFAULT_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "openai/gpt-oss-20b:free",
  "qwen/qwen3-coder:free",
  "meta-llama/llama-3.2-3b-instruct:free",
] as const;

export type Model = string;

let modelCache: { fetchedAt: number; models: string[] } | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured on the server.");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "AI Flashcard Generator",
    },
  });

  return { client, apiKey };
}

async function getCandidateModels(apiKey: string) {
  const now = Date.now();
  if (modelCache && now - modelCache.fetchedAt < 10 * 60 * 1000) {
    return modelCache.models;
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`models request failed with ${response.status}`);
    }

    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    const liveFreeModels = (payload.data ?? [])
      .map((model) => model.id ?? "")
      .filter((id) => id.endsWith(":free"))
      .filter((id) => !id.includes("-vl"))
      .slice(0, 25);

    const combined = Array.from(new Set([...liveFreeModels, ...DEFAULT_MODELS]));
    modelCache = { fetchedAt: now, models: combined };
    return combined;
  } catch {
    return [...DEFAULT_MODELS];
  }
}

export async function callWithFallback(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]) {
  const { client: openrouter, apiKey } = getOpenRouterClient();
  const failures: string[] = [];
  const models = await getCandidateModels(apiKey);

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const completion = await openrouter.chat.completions.create({
          model,
          temperature: 0.5,
          max_tokens: 4096,
          response_format: { type: "json_object" },
          messages,
        });

        const raw = completion.choices[0]?.message?.content ?? "";
        return {
          text: raw.replace(/```json|```/g, "").trim(),
          modelUsed: model,
        };
      } catch (error) {
        const status = (error as { status?: number })?.status;
        const message =
          (error as { message?: string })?.message ??
          (error as { error?: { message?: string } })?.error?.message ??
          "unknown error";

        // Some free models reject json_object mode. Retry same model without response_format.
        if (status === 400) {
          try {
            const completion = await openrouter.chat.completions.create({
              model,
              temperature: 0.5,
              max_tokens: 4096,
              messages,
            });

            const raw = completion.choices[0]?.message?.content ?? "";
            return {
              text: raw.replace(/```json|```/g, "").trim(),
              modelUsed: model,
            };
          } catch (fallbackError) {
            const fallbackStatus = (fallbackError as { status?: number })?.status;
            const fallbackMessage =
              (fallbackError as { message?: string })?.message ??
              (fallbackError as { error?: { message?: string } })?.error?.message ??
              "unknown error";
            failures.push(
              `${model}#${attempt}:${status ?? "unknown"}:${message} | no-json:${fallbackStatus ?? "unknown"}:${fallbackMessage}`,
            );

            if ((fallbackStatus === 429 || fallbackStatus === 500 || fallbackStatus === 503) && attempt < 2) {
              await sleep(600 * attempt);
              continue;
            }

            if (
              fallbackStatus === 400 ||
              fallbackStatus === 404 ||
              fallbackStatus === 429 ||
              fallbackStatus === 500 ||
              fallbackStatus === 503
            ) {
              break;
            }

            throw fallbackError;
          }
        }

        failures.push(`${model}#${attempt}:${status ?? "unknown"}:${message}`);

        const retryable = status === 429 || status === 500 || status === 503;
        if (retryable && attempt < 2) {
          await sleep(600 * attempt);
          continue;
        }

        // Continue fallback on transient and model-capability errors.
        if (status === 400 || status === 404 || status === 429 || status === 500 || status === 503) {
          break;
        }
        throw error;
      }
    }
  }

  throw new Error(`All models failed (${failures.join(" | ")}).`);
}

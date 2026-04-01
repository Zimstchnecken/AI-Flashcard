"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import Toast from "@/components/ui/Toast";
import type { GenerateResponse } from "@/types";

const STORAGE_KEY = "ai-flashcards:latest-generate";
const COUNT_OPTIONS = [5, 10, 20, 30] as const;

type InputMode = "text" | "pdf";
type PdfMeta = {
  name: string;
  pageCount: number;
  wordCount: number;
  trimmed: boolean;
};

async function readApiPayload(response: Response) {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { error: raw.startsWith("<!DOCTYPE") ? "Server returned an unexpected response." : raw };
  }
}

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<InputMode>("text");
  const [count, setCount] = useState<(typeof COUNT_OPTIONS)[number]>(10);
  const [pdfMeta, setPdfMeta] = useState<PdfMeta | null>(null);
  const [pdfState, setPdfState] = useState<"idle" | "uploading" | "extracting" | "ready">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const charCount = useMemo(() => text.length, [text]);

  async function generateCards() {
    setError(null);

    if (text.trim().length < 50) {
      setError("Paste at least 50 characters to generate meaningful cards.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, count }),
      });

      const data = (await readApiPayload(response)) as GenerateResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Generation failed.");
      }

      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...data,
          sourceTextLength: text.length,
          createdAt: new Date().toISOString(),
        }),
      );

      router.push("/generate");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Generation failed.";
      setError(message);
      setToast(message);
    } finally {
      setLoading(false);
    }
  }

  async function onPdfSelected(file: File | null) {
    if (!file) {
      return;
    }

    setError(null);
    setPdfState("uploading");
    setPdfMeta(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      setPdfState("extracting");
      const response = await fetch("/api/parse-pdf", {
        method: "POST",
        body: formData,
      });

      const data = (await readApiPayload(response)) as {
        text?: string;
        pageCount?: number;
        wordCount?: number;
        trimmed?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "PDF extraction failed.");
      }

      if (typeof data.text !== "string") {
        throw new Error("Unexpected PDF response format.");
      }

      setText(data.text);
      setPdfMeta({
        name: file.name,
        pageCount: Number(data.pageCount ?? 0),
        wordCount: Number(data.wordCount ?? 0),
        trimmed: Boolean(data.trimmed),
      });
      setPdfState("ready");
      setMode("text");
      setToast("PDF text extracted. You can now generate cards.");
    } catch (cause) {
      setPdfState("idle");
      const message = cause instanceof Error ? cause.message : "PDF extraction failed.";
      setError(message);
      setToast(message);
    }
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <main className="page-enter mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-12 pt-20 md:px-10">
        <section className="max-w-3xl space-y-6">
          <h1 className="text-4xl font-bold tracking-[-0.02em] md:text-6xl">
            Turn any text into flashcards in seconds.
          </h1>
          <p className="max-w-2xl text-lg text-text-secondary md:text-xl">
            Paste a paragraph or upload a PDF, generate polished question-answer cards,
            and study with spaced repetition.
          </p>
        </section>

        <section className="panel w-full max-w-4xl space-y-6 p-6 md:p-8">
          <div className="flex items-center gap-2">
            {(["text", "pdf"] as const).map((tab) => (
              <button
                key={tab}
                className={`mono rounded-md border px-3 py-2 text-xs transition ${
                  mode === tab
                    ? "border-primary bg-primary text-background"
                    : "border-border text-text-secondary hover:border-primary hover:text-primary"
                }`}
                type="button"
                onClick={() => setMode(tab)}
              >
                {tab === "text" ? "Text" : "PDF"}
              </button>
            ))}
          </div>

          {mode === "pdf" ? (
            <div className="space-y-4 rounded-xl border border-dashed border-border bg-surface-2 p-6">
              <p className="text-base text-text-primary">Drag and drop is coming next. For now, choose a PDF file below.</p>
              <p className="mono text-xs text-text-secondary">Max 10MB · PDF only</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => onPdfSelected(event.target.files?.[0] ?? null)}
              />
              <button
                className="focus-ring mono rounded-xl border border-border px-4 py-3 text-sm hover:border-primary hover:text-primary"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={pdfState === "extracting" || pdfState === "uploading"}
              >
                {pdfState === "uploading" || pdfState === "extracting" ? "Extracting PDF..." : "Choose PDF"}
              </button>

              {pdfMeta ? (
                <div className="space-y-2">
                  <p className="mono text-xs text-text-secondary">
                    {pdfMeta.name} · {pdfMeta.pageCount} pages · ~{pdfMeta.wordCount.toLocaleString()} words
                  </p>
                  {pdfMeta.trimmed ? (
                    <p className="mono text-xs text-warning">
                      Your PDF was trimmed to fit the model context window (20,000 characters).
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <textarea
            className="focus-ring min-h-60 w-full rounded-md border bg-surface-2 px-4 py-4 text-base text-text-primary placeholder:text-text-secondary"
            placeholder="Paste your study material here..."
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 20000))}
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="mono text-xs text-text-secondary">{charCount.toLocaleString()} / 20,000 characters</span>
            <div className="flex items-center gap-2">
              <span className="mono text-xs text-text-secondary">Generate:</span>
              {COUNT_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={`mono rounded-md border px-3 py-2 text-xs transition ${
                    count === option
                      ? "border-primary bg-primary text-background"
                      : "border-border text-text-secondary hover:border-primary hover:text-primary"
                  }`}
                  type="button"
                  onClick={() => setCount(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          {error ? (
            <p className="mono text-xs text-[var(--error)]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <button
              className="mono rounded-xl bg-primary px-6 py-3 text-sm font-medium text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={generateCards}
              disabled={loading}
              aria-label="Generate flashcards"
            >
              {loading ? "Generating..." : "Generate Flashcards"}
            </button>
          </div>

          {loading ? (
            <div className="grid gap-4 pt-2 sm:grid-cols-2" aria-hidden="true">
              <div className="skeleton-shimmer h-24 rounded-xl border border-border" />
              <div className="skeleton-shimmer h-24 rounded-xl border border-border" />
            </div>
          ) : null}
        </section>

        <p className="mono text-xs text-text-secondary">
          Generation preview and PDF extraction are active. Auth saving is next.
        </p>
      </main>

      {toast ? <Toast message={toast} kind={error ? "error" : "success"} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

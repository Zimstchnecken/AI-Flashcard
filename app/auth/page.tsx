"use client";

import { FormEvent, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [rememberEmail, setRememberEmail] = useState(true);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const remembered = localStorage.getItem("mnemonic:remember-email") === "1";
    const storedEmail = localStorage.getItem("mnemonic:email") ?? "";
    setRememberEmail(remembered);
    if (remembered && storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage(null);

    if (rememberEmail) {
      localStorage.setItem("mnemonic:remember-email", "1");
      localStorage.setItem("mnemonic:email", email);
    } else {
      localStorage.removeItem("mnemonic:remember-email");
      localStorage.removeItem("mnemonic:email");
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      setStatus("sent");
      setMessage("Check your inbox for the magic link.");
    } catch (cause) {
      setStatus("error");
      setMessage(cause instanceof Error ? cause.message : "Unable to send magic link.");
    }
  }

  return (
    <main className="page-enter mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-20 md:px-10">
      <section className="panel w-full space-y-4 p-8">
        <h1 className="text-3xl font-bold tracking-[-0.02em]">Sign In</h1>
        <p className="text-text-secondary">Use your email and we will send a secure magic link.</p>

        <form className="space-y-4" onSubmit={sendMagicLink}>
          <div className="space-y-2">
            <label className="mono text-xs text-text-secondary" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="focus-ring h-12 w-full rounded-md border bg-surface-2 px-4"
              placeholder="you@example.com"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-secondary" htmlFor="remember-email">
            <input
              id="remember-email"
              type="checkbox"
              checked={rememberEmail}
              onChange={(event) => setRememberEmail(event.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Remember my email on this device
          </label>

          <p className="mono text-[10px] text-text-secondary">
            Session stays signed in by Supabase until you log out.
          </p>

          {message ? (
            <p className={`mono text-xs ${status === "error" ? "text-[var(--error)]" : "text-text-secondary"}`}>
              {message}
            </p>
          ) : null}

          <button
            className="mono rounded-xl bg-primary px-6 py-3 text-sm font-medium text-background transition hover:brightness-110 disabled:opacity-60"
            type="submit"
            disabled={status === "sending"}
          >
            {status === "sending" ? "Sending..." : "Send Magic Link"}
          </button>
        </form>
      </section>
    </main>
  );
}

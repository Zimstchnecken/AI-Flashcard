"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type UserState = {
  email: string | null;
};

export default function AppHeader() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserState | null>(null);
  const hasSupabaseEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const supabase = useMemo(() => {
    if (!hasSupabaseEnv) {
      return null;
    }
    return createClient();
  }, [hasSupabaseEnv]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setUser(null);
      return;
    }

    const client = supabase;

    let mounted = true;

    async function loadUser() {
      const { data } = await client.auth.getUser();
      if (!mounted) {
        return;
      }
      if (data.user) {
        setUser({ email: data.user.email ?? null });
      } else {
        setUser(null);
      }
      setLoading(false);
    }

    loadUser();

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email ?? null });
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-10">
      <Link href="/" className="mono text-sm text-primary">
        Mnemonic
      </Link>

      <nav className="flex items-center gap-3 text-sm">
        <Link className="focus-ring rounded-md px-3 py-2 hover:text-primary" href="/decks">
          My Decks
        </Link>

        {loading ? (
          <span className="mono text-xs text-text-secondary">Checking session...</span>
        ) : user ? (
          <>
            <span className="mono rounded-md border border-border px-2 py-1 text-[10px] text-text-secondary">
              Logged in: {user.email ?? "user"}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="focus-ring mono rounded-md border border-border px-3 py-2 text-xs hover:border-primary hover:text-primary"
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            className="focus-ring rounded-md border border-border px-3 py-2 hover:border-primary hover:text-primary"
            href="/auth"
          >
            Sign In
          </Link>
        )}
      </nav>
    </header>
  );
}

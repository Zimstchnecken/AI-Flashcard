import { NextResponse } from "next/server";

function configured(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export async function GET() {
  const checks = {
    supabaseUrl: configured(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: configured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: configured(process.env.SUPABASE_SERVICE_ROLE_KEY),
    openRouterApiKey: configured(process.env.OPENROUTER_API_KEY),
    appUrl: configured(process.env.NEXT_PUBLIC_APP_URL),
  };

  const healthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}

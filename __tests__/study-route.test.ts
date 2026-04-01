import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();

function createQueryBuilder() {
  const queryBuilder = {
    eq: vi.fn(() => queryBuilder),
    select: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    upsert: vi.fn(async () => ({ error: null })),
  };

  return queryBuilder;
}

function buildSupabaseMock() {
  const queryBuilder = createQueryBuilder();
  return {
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn(() => queryBuilder),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => buildSupabaseMock()),
}));

describe("POST /api/study", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when no user session", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const { POST } = await import("@/app/api/study/route");
    const req = new Request("http://localhost/api/study", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: "6f9f0f24-87b2-4f39-8552-8513625ac6ab", rating: 4 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid payload", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "test-user" } } });

    const { POST } = await import("@/app/api/study/route");
    const req = new Request("http://localhost/api/study", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: "bad-id", rating: 9 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

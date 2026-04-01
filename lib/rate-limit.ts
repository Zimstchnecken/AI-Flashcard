type Entry = {
  count: number;
  resetAt: number;
};

const bucket = new Map<string, Entry>();

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

function checkRateLimitInMemory(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const current = bucket.get(key);

  if (!current || now >= current.resetAt) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (current.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  bucket.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - current.count),
    resetAt: current.resetAt,
  };
}

async function checkRateLimitUpstash(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_URL;
  const redisToken = process.env.UPSTASH_REDIS_TOKEN;

  if (!redisUrl || !redisToken) {
    throw new Error("Upstash is not configured.");
  }

  const windowSeconds = Math.ceil(windowMs / 1000);
  const redisKey = `rate:${key}`;

  const incrResponse = await fetch(`${redisUrl}/incr/${encodeURIComponent(redisKey)}`, {
    headers: { Authorization: `Bearer ${redisToken}` },
    cache: "no-store",
  });

  if (!incrResponse.ok) {
    throw new Error("Unable to increment Redis rate limit counter.");
  }

  const incrJson = (await incrResponse.json()) as { result?: number };
  const count = incrJson.result ?? 0;

  if (count === 1) {
    await fetch(`${redisUrl}/expire/${encodeURIComponent(redisKey)}/${windowSeconds}`, {
      headers: { Authorization: `Bearer ${redisToken}` },
      cache: "no-store",
    });
  }

  const ttlResponse = await fetch(`${redisUrl}/ttl/${encodeURIComponent(redisKey)}`, {
    headers: { Authorization: `Bearer ${redisToken}` },
    cache: "no-store",
  });

  const ttlJson = ttlResponse.ok ? ((await ttlResponse.json()) as { result?: number }) : { result: windowSeconds };
  const ttl = Math.max(0, ttlJson.result ?? windowSeconds);
  const resetAt = Date.now() + ttl * 1000;

  if (count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - count),
    resetAt,
  };
}

export async function checkRateLimit(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
  const hasUpstash = Boolean(process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN);

  if (hasUpstash) {
    try {
      return await checkRateLimitUpstash(key, maxRequests, windowMs);
    } catch {
      return checkRateLimitInMemory(key, maxRequests, windowMs);
    }
  }

  return checkRateLimitInMemory(key, maxRequests, windowMs);
}

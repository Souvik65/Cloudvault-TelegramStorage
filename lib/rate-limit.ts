type WindowEntry = {
  count: number;
  resetAt: number;
};

type AuthFailureEntry = {
  failures: number;
  lockUntil: number;
  updatedAt: number;
};

declare global {
  var __svRateWindows: Map<string, WindowEntry> | undefined;
  var __svAuthFailures: Map<string, AuthFailureEntry> | undefined;
}

const rateWindows = globalThis.__svRateWindows ?? new Map<string, WindowEntry>();
const authFailures = globalThis.__svAuthFailures ?? new Map<string, AuthFailureEntry>();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__svRateWindows = rateWindows;
  globalThis.__svAuthFailures = authFailures;
}

// Memory management: Prevent unbounded growth of in-memory maps
const MAX_ENTRIES = 10000;

/**
 * Removes expired entries from the rate-limiting maps to prevent memory leaks.
 */
function pruneExpiredEntries() {
  const now = Date.now();
  
  // 1. Soft prune: Remove only genuinely expired entries
  for (const [key, entry] of rateWindows) {
    if (now >= entry.resetAt) {
      rateWindows.delete(key);
    }
  }

  const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
  for (const [key, entry] of authFailures) {
    if (entry.lockUntil > 0 && now >= entry.lockUntil) {
      authFailures.delete(key);
    } else if (entry.lockUntil === 0 && now - entry.updatedAt > STALE_THRESHOLD) {
      authFailures.delete(key);
    }
  }

  // 2. Hard cap: If still over limit (under attack), forcibly evict oldest 20%
  // Map.keys() returns entries in insertion order, so the first ones are the oldest.
  if (rateWindows.size > MAX_ENTRIES) {
    const toDelete = Math.floor(MAX_ENTRIES * 0.2);
    let deleted = 0;
    for (const key of rateWindows.keys()) {
      if (deleted >= toDelete) break;
      rateWindows.delete(key);
      deleted++;
    }
    console.warn(`[RATE-LIMIT] Memory threshold reached (${MAX_ENTRIES}). Forcibly evicted ${deleted} active rate-limit entries.`);
  }

  if (authFailures.size > MAX_ENTRIES) {
    const toDelete = Math.floor(MAX_ENTRIES * 0.2);
    let deleted = 0;
    for (const key of authFailures.keys()) {
      if (deleted >= toDelete) break;
      authFailures.delete(key);
      deleted++;
    }
    console.warn(`[RATE-LIMIT] Memory threshold reached (${MAX_ENTRIES}). Forcibly evicted ${deleted} active auth-failure entries.`);
  }
}

/**
 * Gets the client IP address from the request headers.
 * 
 * SECURITY NOTE: This function trusts 'X-Forwarded-For' and 'X-Real-IP' headers.
 * In production, ensure your server is behind a trusted reverse proxy (like Nginx,
 * Cloudflare, or Vercel) that strips or overwrites these headers to prevent IP spoofing.
 */
export function getClientIp(req: Request) {
  // Try X-Forwarded-For (standard for proxies)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // The first IP is the original client, but only if the proxy is trusted.
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  // Fallback to X-Real-IP
  const real = req.headers.get('x-real-ip');
  if (real) return real;

  // Fallback to a placeholder. Using a constant like '0.0.0.0' instead of 'unknown'
  // helps maintain consistent data types and clearly marks unidentifiable sources.
  return '0.0.0.0';
}

export function consumeFixedWindow(
  namespace: string,
  key: string,
  maxRequests: number,
  windowMs: number
 ) {
  // Prune if memory threshold is reached
  if (rateWindows.size > MAX_ENTRIES) {
    pruneExpiredEntries();
  }

  const now = Date.now();
  const entryKey = `${namespace}:${key}`;
  const existing = rateWindows.get(entryKey);

  if (!existing || now >= existing.resetAt) {
    const fresh: WindowEntry = { count: 1, resetAt: now + windowMs };
    rateWindows.set(entryKey, fresh);
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - fresh.count),
      resetAt: Math.ceil(fresh.resetAt / 1000),
      retryAfter: 0,
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: Math.ceil(existing.resetAt / 1000),
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - existing.count),
    resetAt: Math.ceil(existing.resetAt / 1000),
    retryAfter: 0,
  };
}

export function getAuthBackoffSeconds(key: string) {
  const entry = authFailures.get(key);
  if (!entry) return 0;
  const now = Date.now();
  if (entry.lockUntil <= now) return 0;
  return Math.ceil((entry.lockUntil - now) / 1000);
}

export function clearAuthFailures(key: string) {
  authFailures.delete(key);
}

export function registerAuthFailure(key: string) {
  // Prune if memory threshold is reached
  if (authFailures.size > MAX_ENTRIES) {
    pruneExpiredEntries();
  }

  const now = Date.now();
  let current = authFailures.get(key);

  // If the lockout has already expired, reset the failure count for a fresh start.
  // This prevents permanent penalization after the wait period is over.
  if (!current || (current.lockUntil > 0 && current.lockUntil <= now)) {
    current = { failures: 0, lockUntil: 0, updatedAt: now };
  }

  current.failures += 1;

  let lockSeconds = 0;
  if (current.failures >= 5) lockSeconds = 900; // 15 mins
  else if (current.failures === 4) lockSeconds = 300; // 5 mins
  else if (current.failures === 3) lockSeconds = 120; // 2 mins

  current.lockUntil = lockSeconds > 0 ? now + lockSeconds * 1000 : 0;
  current.updatedAt = now;
  authFailures.set(key, current);
  return lockSeconds;
}

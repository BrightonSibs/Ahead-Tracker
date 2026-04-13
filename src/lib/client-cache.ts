'use client';

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();

function normalizeCacheKey(url: string) {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(url, base);
    const sortedParams = Array.from(parsed.searchParams.entries())
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => (
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
      ));
    const search = sortedParams.length > 0
      ? `?${new URLSearchParams(sortedParams).toString()}`
      : '';

    return `${parsed.pathname}${search}`;
  } catch {
    return url;
  }
}

function resolveTtlMs(url: string, overrideTtlMs?: number) {
  if (overrideTtlMs !== undefined) return overrideTtlMs;

  const cacheKey = normalizeCacheKey(url);

  if (cacheKey.startsWith('/api/departments')) return 5 * 60_000;
  if (cacheKey.startsWith('/api/researchers')) return 2 * 60_000;
  if (cacheKey.startsWith('/api/publications')) return 2 * 60_000;
  if (cacheKey.startsWith('/api/analytics')) return 90_000;

  return 60_000;
}

function handleAuthFailure(status: number, url: string) {
  if (typeof window === 'undefined' || status !== 401) return;

  responseCache.clear();
  window.dispatchEvent(new CustomEvent('ahead:auth-error', { detail: { status, url } }));
}

async function readJsonResponse<T>(response: Response, url: string, ttlMs: number): Promise<T> {
  if (!response.ok) {
    handleAuthFailure(response.status, url);
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  const data = await response.json();
  responseCache.set(url, { data, expiresAt: Date.now() + ttlMs });
  return data as T;
}

export async function fetchJsonCached<T>(
  url: string,
  options?: { ttlMs?: number; force?: boolean },
): Promise<T> {
  const cacheKey = normalizeCacheKey(url);
  const ttlMs = resolveTtlMs(url, options?.ttlMs);
  const now = Date.now();
  const cached = responseCache.get(cacheKey);

  if (!options?.force && cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  if (!options?.force && cached) {
    if (!inflightRequests.has(cacheKey)) {
      const refresh = fetch(url)
        .then(response => readJsonResponse<T>(response, cacheKey, ttlMs))
        .finally(() => {
          inflightRequests.delete(cacheKey);
        });

      inflightRequests.set(cacheKey, refresh);
    }

    return cached.data as T;
  }

  if (!options?.force && inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey) as Promise<T>;
  }

  const request = fetch(url)
    .then(response => readJsonResponse<T>(response, cacheKey, ttlMs))
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, request);
  return request;
}

export function warmJsonCache(urls: string[], ttlMs = 30_000) {
  urls.forEach(url => {
    void fetchJsonCached(url, { ttlMs }).catch(() => {});
  });
}

export function invalidateJsonCache(matcher?: string | RegExp) {
  if (!matcher) {
    responseCache.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    const matches = typeof matcher === 'string' ? key.startsWith(matcher) : matcher.test(key);
    if (matches) {
      responseCache.delete(key);
    }
  }
}

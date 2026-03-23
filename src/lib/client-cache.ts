'use client';

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();

export async function fetchJsonCached<T>(
  url: string,
  options?: { ttlMs?: number; force?: boolean },
): Promise<T> {
  const ttlMs = options?.ttlMs ?? 30_000;
  const now = Date.now();
  const cached = responseCache.get(url);

  if (!options?.force && cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  if (!options?.force && inflightRequests.has(url)) {
    return inflightRequests.get(url) as Promise<T>;
  }

  const request = fetch(url)
    .then(async response => {
      if (!response.ok) {
        throw new Error(`Request failed (${response.status}) for ${url}`);
      }

      const data = await response.json();
      responseCache.set(url, { data, expiresAt: now + ttlMs });
      return data as T;
    })
    .finally(() => {
      inflightRequests.delete(url);
    });

  inflightRequests.set(url, request);
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

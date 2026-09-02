/**
 * Tiny stale-while-revalidate cache for API reads.
 *
 * The app fetched everything with bare useEffect, so every navigation showed a
 * skeleton while data the client had seconds ago was re-downloaded. This keeps
 * one shared cache: `useQuery` returns the cached value instantly and, when the
 * entry is older than `staleMs`, revalidates in the background — pages render
 * immediately and quietly update in place.
 *
 * Entries also persist to sessionStorage so a reload paints from cache while
 * fresh data loads. Session-scoped on purpose: case data should not outlive the
 * tab on a shared machine. The whole cache is dropped on sign-out.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

type Entry = {
  data: unknown;
  /** When the data was fetched — staleness is measured against this. */
  at: number;
};

const PERSIST_PREFIX = "tc.cache:";
/** Entries older than this are not restored from sessionStorage. */
const PERSIST_MAX_AGE_MS = 30 * 60 * 1000;

const memory = new Map<string, Entry>();
const errors = new Map<string, string>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();
/** Bumped on any change to a key (data OR error) — the hook's re-render signal. */
const versions = new Map<string, number>();

const bump = (key: string): void => {
  versions.set(key, (versions.get(key) ?? 0) + 1);
};

const notify = (key: string): void => {
  bump(key);
  listeners.get(key)?.forEach((fn) => fn());
};

const persist = (key: string, entry: Entry): void => {
  try {
    sessionStorage.setItem(PERSIST_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota or private mode — memory cache still works */
  }
};

const restore = (key: string): Entry | undefined => {
  try {
    const raw = sessionStorage.getItem(PERSIST_PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as Entry;
    if (!entry || typeof entry.at !== "number" || Date.now() - entry.at > PERSIST_MAX_AGE_MS) {
      sessionStorage.removeItem(PERSIST_PREFIX + key);
      return undefined;
    }
    memory.set(key, entry);
    bump(key);
    return entry;
  } catch {
    return undefined;
  }
};

export function getCached<T>(key: string): T | undefined {
  const entry = memory.get(key) ?? restore(key);
  return entry?.data as T | undefined;
}

export function setCached<T>(key: string, data: T): void {
  const entry: Entry = { data, at: Date.now() };
  memory.set(key, entry);
  errors.delete(key);
  persist(key, entry);
  notify(key);
}

/** Drops every entry whose key starts with `prefix`. Call after mutations. */
export function invalidateQueries(prefix: string): void {
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) {
      memory.delete(key);
      notify(key);
    }
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(PERSIST_PREFIX + prefix)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/** Wipes everything — sign-out and user switches. */
export function clearQueryCache(): void {
  memory.clear();
  errors.clear();
  inflight.clear();
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(PERSIST_PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
  for (const key of listeners.keys()) notify(key);
}

/**
 * Fetches with per-key dedup: concurrent callers share one request. Always
 * hits the network (staleness is the hook's concern), then updates the cache.
 */
export function fetchQuery<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const req = fetcher()
    .then((data) => {
      setCached(key, data);
      return data;
    })
    .catch((err: unknown) => {
      errors.set(key, err instanceof Error ? err.message : "Request failed");
      notify(key);
      throw err;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, req);
  return req;
}

export function getQueryError(key: string): string | null {
  return errors.get(key) ?? null;
}

const entryAge = (key: string): number => {
  const entry = memory.get(key);
  return entry ? Date.now() - entry.at : Infinity;
};

export function isStale(key: string, staleMs: number): boolean {
  return entryAge(key) > staleMs;
}

// ─── React hook ───────────────────────────────────────────────────────────────

export type QueryOptions = {
  /** Cached data younger than this skips the background revalidation. */
  staleMs?: number;
  /** When false, nothing is fetched (e.g. missing permission). */
  enabled?: boolean;
};

export type QueryState<T> = {
  /** Cached or fresh data. Undefined only before the very first response. */
  data: T | undefined;
  /** True only while fetching with nothing cached — the "show a skeleton" signal. */
  loading: boolean;
  error: string | null;
  /** Bypasses staleness and refetches now (background — data stays visible). */
  refresh: () => Promise<void>;
  /** Optimistically replaces the cached value. */
  mutate: (data: T) => void;
};

export function useQuery<T>(key: string | null, fetcher: () => Promise<T>, options?: QueryOptions): QueryState<T> {
  const { staleMs = 15_000, enabled = true } = options ?? {};

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!key) return () => {};
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(onChange);
      return () => {
        set!.delete(onChange);
        if (set!.size === 0) listeners.delete(key);
      };
    },
    [key],
  );

  // Subscribe to the key's version, then read data/error off the maps. Reading
  // through a counter (not the entry object) means error-only changes re-render too.
  useSyncExternalStore(subscribe, () => {
    if (!key) return 0;
    if (!memory.has(key)) restore(key);
    return versions.get(key) ?? 0;
  });
  const entry = key ? memory.get(key) : undefined;

  useEffect(() => {
    if (!key || !enabled) return;
    if (!isStale(key, staleMs)) return;
    fetchQuery(key, fetcherRef.current).catch(() => {});
  }, [key, enabled, staleMs]);

  const refresh = useCallback(async () => {
    if (!key) return;
    await fetchQuery(key, fetcherRef.current).catch(() => {});
  }, [key]);

  const mutate = useCallback(
    (data: T) => {
      if (key) setCached(key, data);
    },
    [key],
  );

  const data = entry?.data as T | undefined;
  return {
    data,
    loading: enabled && !!key && data === undefined && getQueryError(key) === null,
    error: key ? getQueryError(key) : null,
    refresh,
    mutate,
  };
}

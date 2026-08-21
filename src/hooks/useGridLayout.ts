import { useCallback, useEffect, useRef, useState } from "react";
import { gridLayoutsApi, type GridLayoutItem, type GridSurface } from "@/lib/crm-api";

const SAVE_DEBOUNCE_MS = 600;

type Options<T extends GridLayoutItem> = {
  surface: GridSurface;
  defaultLayout: T[];
  normalize: (items: T[]) => T[];
  legacyStorageKey?: string;
};

export type GridLayoutState<T extends GridLayoutItem> = {
  layout: T[] | null;
  persist: (items: T[]) => void;
  reset: () => void;
  revision: number;
  error: string | null;
};

function readLegacyLayout<T extends GridLayoutItem>(key: string | undefined): T[] | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function clearLegacyLayout(key: string | undefined): void {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function useGridLayout<T extends GridLayoutItem>({
  surface,
  defaultLayout,
  normalize,
  legacyStorageKey,
}: Options<T>): GridLayoutState<T> {
  const [layout, setLayout] = useState<T[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;
  const pendingRef = useRef<T[] | null>(null);
  const timerRef = useRef<number | null>(null);
  const seenUpdatedAtRef = useRef<string | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const items = pendingRef.current;
    if (!items) return;
    pendingRef.current = null;
    gridLayoutsApi
      .save(surface, items)
      .then(({ layout: record }) => {
        seenUpdatedAtRef.current = record.updatedAt;
      })
      .catch(() => {});
  }, [surface]);

  useEffect(() => {
    let active = true;

    gridLayoutsApi
      .get(surface)
      .then(({ layout: record }) => {
        if (!active) return;

        if (record.items) {
          clearLegacyLayout(legacyStorageKey);
          seenUpdatedAtRef.current = record.updatedAt;
          setLayout(normalizeRef.current(record.items as T[]));
          return;
        }

        const legacy = readLegacyLayout<T>(legacyStorageKey);
        if (legacy) {
          const normalized = normalizeRef.current(legacy);
          setLayout(normalized);
          gridLayoutsApi
            .save(surface, normalized)
            .then(({ layout: saved }) => {
              seenUpdatedAtRef.current = saved.updatedAt;
              clearLegacyLayout(legacyStorageKey);
            })
            .catch(() => {});
          return;
        }

        setLayout(defaultLayout);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load your saved layout.");
        setLayout(defaultLayout);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, legacyStorageKey]);

  useEffect(() => {
    const sync = () => {
      if (document.visibilityState !== "visible") return;
      if (pendingRef.current) return;

      gridLayoutsApi
        .get(surface)
        .then(({ layout: record }) => {
          if (!record.items) return;
          if (record.updatedAt === seenUpdatedAtRef.current) return;
          seenUpdatedAtRef.current = record.updatedAt;
          setLayout(normalizeRef.current(record.items as T[]));
          setRevision((r) => r + 1);
        })
        .catch(() => {});
    };

    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [surface]);

  const persist = useCallback(
    (items: T[]) => {
      const normalized = normalizeRef.current(items);
      setLayout(normalized);
      pendingRef.current = normalized;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  const reset = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    seenUpdatedAtRef.current = null;
    setLayout(defaultLayout);
    setRevision((r) => r + 1);
    clearLegacyLayout(legacyStorageKey);
    gridLayoutsApi.reset(surface).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, legacyStorageKey]);

  return { layout, persist, reset, revision, error };
}

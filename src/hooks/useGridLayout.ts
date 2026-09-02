import { useCallback, useEffect, useRef, useState } from "react";
import {
  gridLayoutsApi,
  type GridLayoutItem,
  type GridLayoutPage,
  type GridLayoutRecord,
  type GridLayoutWidget,
  type GridSurface,
} from "@/lib/crm-api";
import { getCached, setCached } from "@/lib/query-cache";

const SAVE_DEBOUNCE_MS = 600;
/** Focus/visibility syncs are background freshness checks — once a minute is plenty. */
const SYNC_MIN_INTERVAL_MS = 60_000;

const layoutCacheKey = (surface: GridSurface): string => `grid-layout:${surface}`;

type Options<T extends GridLayoutItem> = {
  surface: GridSurface;
  defaultLayout: T[];
  normalize: (items: T[]) => T[];
  legacyStorageKey?: string;
  /**
   * When false, layout is read-only: no API saves, no legacy migration, and
   * `persist` / `reset` are local no-ops against the server. Used for shared
   * surfaces (case-detail) for nonΓÇôSuperAdmin users.
   */
  editable?: boolean;
  /** When set, this surface persists carousel pages with the item list. */
  defaultPages?: GridLayoutPage[];
  /**
   * Normalize items + optional saved pages + optional saved custom-widget
   * definitions into a coherent document. Required when `defaultPages` is set.
   * `phase` distinguishes loading a saved document ("load") from normalizing a
   * user edit before saving ("persist") — load may inject newly-shipped panels.
   */
  normalizeDocument?: (
    items: T[],
    pages: GridLayoutPage[] | null | undefined,
    widgets: GridLayoutWidget[] | null | undefined,
    phase?: "load" | "persist",
  ) => { items: T[]; pages: GridLayoutPage[]; widgets?: GridLayoutWidget[] };
};

export type GridLayoutState<T extends GridLayoutItem> = {
  layout: T[] | null;
  pages: GridLayoutPage[] | null;
  widgets: GridLayoutWidget[] | null;
  persist: (items: T[], pages?: GridLayoutPage[], widgets?: GridLayoutWidget[]) => void;
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
  editable = true,
  defaultPages,
  normalizeDocument,
}: Options<T>): GridLayoutState<T> {
  // Start with defaults so pages render immediately; sync saved layout when the API responds.
  const [layout, setLayout] = useState<T[] | null>(() => normalize(defaultLayout));
  const [pages, setPages] = useState<GridLayoutPage[] | null>(() => defaultPages ?? null);
  const [widgets, setWidgets] = useState<GridLayoutWidget[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;
  const normalizeDocRef = useRef(normalizeDocument);
  normalizeDocRef.current = normalizeDocument;
  const defaultPagesRef = useRef(defaultPages);
  defaultPagesRef.current = defaultPages;
  const pendingRef = useRef<{ items: T[]; pages?: GridLayoutPage[]; widgets?: GridLayoutWidget[] } | null>(null);
  const timerRef = useRef<number | null>(null);
  const seenUpdatedAtRef = useRef<string | null>(null);
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const pagesRef = useRef<GridLayoutPage[] | null>(null);
  pagesRef.current = pages;
  const widgetsRef = useRef<GridLayoutWidget[] | null>(null);
  widgetsRef.current = widgets;

  const applyDocument = useCallback(
    (
      items: T[],
      savedPages: GridLayoutPage[] | null | undefined,
      savedWidgets: GridLayoutWidget[] | null | undefined,
    ) => {
      if (normalizeDocRef.current && defaultPagesRef.current) {
        const doc = normalizeDocRef.current(items, savedPages ?? defaultPagesRef.current, savedWidgets, "load");
        setLayout(doc.items);
        setPages(doc.pages);
        pagesRef.current = doc.pages;
        const w = doc.widgets ?? [];
        setWidgets(w);
        widgetsRef.current = w;
        return { items: doc.items, pages: doc.pages, widgets: w };
      }
      const normalized = normalizeRef.current(items);
      setLayout(normalized);
      setPages(null);
      pagesRef.current = null;
      setWidgets(null);
      widgetsRef.current = null;
      return { items: normalized, pages: null as GridLayoutPage[] | null, widgets: null as GridLayoutWidget[] | null };
    },
    [],
  );

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!editableRef.current) {
      pendingRef.current = null;
      return;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    const pagesToSave = pending.pages ?? pagesRef.current ?? undefined;
    const widgetsToSave = pending.widgets ?? widgetsRef.current ?? undefined;
    gridLayoutsApi
      .save(surface, pending.items, pagesToSave, widgetsToSave)
      .then(({ layout: record }) => {
        seenUpdatedAtRef.current = record.updatedAt;
        setCached(layoutCacheKey(surface), record);
      })
      .catch((err: unknown) => {
        console.error(`[grid-layout] save failed (${surface}):`, err);
      });
  }, [surface]);

  useEffect(() => {
    let active = true;

    // Paint the last-seen layout immediately — the network round-trip below
    // only corrects it if someone changed the layout since.
    const cached = getCached<GridLayoutRecord>(layoutCacheKey(surface));
    if (cached?.items) {
      seenUpdatedAtRef.current = cached.updatedAt;
      applyDocument(cached.items as T[], cached.pages, cached.widgets);
    }

    gridLayoutsApi
      .get(surface)
      .then(({ layout: record }) => {
        if (!active) return;
        setCached(layoutCacheKey(surface), record);

        if (record.items) {
          clearLegacyLayout(legacyStorageKey);
          if (cached?.items && record.updatedAt === seenUpdatedAtRef.current) return;
          seenUpdatedAtRef.current = record.updatedAt;
          applyDocument(record.items as T[], record.pages, record.widgets);
          if (cached?.items) setRevision((r) => r + 1);
          return;
        }

        const legacy = editableRef.current ? readLegacyLayout<T>(legacyStorageKey) : null;
        if (legacy) {
          const doc = applyDocument(legacy, defaultPagesRef.current, null);
          gridLayoutsApi
            .save(surface, doc.items, doc.pages ?? undefined, doc.widgets ?? undefined)
            .then(({ layout: saved }) => {
              seenUpdatedAtRef.current = saved.updatedAt;
              clearLegacyLayout(legacyStorageKey);
            })
            .catch((err: unknown) => {
              console.error(`[grid-layout] legacy migrate failed (${surface}):`, err);
            });
          return;
        }

        if (editableRef.current) clearLegacyLayout(legacyStorageKey);
        applyDocument(defaultLayout, defaultPagesRef.current, null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load your saved layout.");
        applyDocument(defaultLayout, defaultPagesRef.current, null);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, legacyStorageKey, editable, applyDocument]);

  useEffect(() => {
    let lastSyncAt = Date.now();
    const sync = () => {
      if (document.visibilityState !== "visible") return;
      if (pendingRef.current) return;
      // Alt-tabbing used to fire a layout GET every single time — throttle it.
      if (Date.now() - lastSyncAt < SYNC_MIN_INTERVAL_MS) return;
      lastSyncAt = Date.now();

      gridLayoutsApi
        .get(surface)
        .then(({ layout: record }) => {
          setCached(layoutCacheKey(surface), record);
          if (!record.items) {
            if (seenUpdatedAtRef.current === null) return;
            seenUpdatedAtRef.current = null;
            applyDocument(defaultLayout, defaultPagesRef.current, null);
            setRevision((r) => r + 1);
            return;
          }
          if (record.updatedAt === seenUpdatedAtRef.current) return;
          seenUpdatedAtRef.current = record.updatedAt;
          applyDocument(record.items as T[], record.pages, record.widgets);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, applyDocument]);

  const persist = useCallback(
    (items: T[], nextPages?: GridLayoutPage[], nextWidgets?: GridLayoutWidget[]) => {
      const pagesForDoc = nextPages ?? pagesRef.current ?? defaultPagesRef.current;
      const widgetsForDoc = nextWidgets ?? widgetsRef.current ?? undefined;
      const doc =
        normalizeDocRef.current && pagesForDoc
          ? normalizeDocRef.current(items, pagesForDoc, widgetsForDoc, "persist")
          : {
              items: normalizeRef.current(items),
              pages: nextPages ?? pagesRef.current,
              widgets: widgetsForDoc,
            };

      setLayout(doc.items);
      if (doc.pages) {
        setPages(doc.pages);
        pagesRef.current = doc.pages;
      }
      if (doc.widgets !== undefined) {
        setWidgets(doc.widgets ?? null);
        widgetsRef.current = doc.widgets ?? null;
      }
      if (!editableRef.current) return;
      pendingRef.current = { items: doc.items, pages: doc.pages ?? undefined, widgets: doc.widgets ?? undefined };
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
    applyDocument(defaultLayout, defaultPagesRef.current, null);
    setRevision((r) => r + 1);
    clearLegacyLayout(legacyStorageKey);
    if (!editableRef.current) return;
    gridLayoutsApi
      .reset(surface)
      .then(({ layout: record }) => setCached(layoutCacheKey(surface), record))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, legacyStorageKey, applyDocument]);

  return { layout, pages, widgets, persist, reset, revision, error };
}

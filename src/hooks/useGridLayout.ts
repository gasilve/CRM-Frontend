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

/** Empty arrays are truthy in JS but mean "no layout" — never treat them as saved. */
const hasItems = (items: GridLayoutItem[] | null | undefined): items is GridLayoutItem[] =>
  Array.isArray(items) && items.length > 0;

/**
 * Stable identity of a rendered document. GridStack only rebuilds when the
 * mount key changes, so the hook has to know when an applied document actually
 * differs from the one on screen and bump `revision` for it.
 */
function docSignature(
  items: GridLayoutItem[],
  pages: GridLayoutPage[] | null | undefined,
  widgets: GridLayoutWidget[] | null | undefined,
): string {
  return JSON.stringify([
    items.map((i) => [i.id, i.x, i.y, i.w, i.h, i.pageId ?? null]),
    (pages ?? []).map((p) => [p.id, p.name]),
    (widgets ?? []).map((w) => [
      w.id,
      w.title,
      w.columns ?? 1,
      w.persisted ?? false,
      (w.fields ?? []).map((f) => [f.key, f.label]),
    ]),
  ]);
}

type Options<T extends GridLayoutItem> = {
  surface: GridSurface;
  defaultLayout: T[];
  normalize: (items: T[]) => T[];
  legacyStorageKey?: string;
  /**
   * When false, layout is read-only: no API saves, no legacy migration, and
   * `persist` / `reset` are local no-ops against the server. Used for shared
   * surfaces (case-detail) for non–SuperAdmin users.
   */
  editable?: boolean;
  /** When set, this surface persists carousel pages with the item list. */
  defaultPages?: GridLayoutPage[];
  /** Seed custom-widget defs used on reset / first paint when nothing is saved. */
  defaultWidgets?: GridLayoutWidget[];
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

type SeedDoc<T extends GridLayoutItem> = {
  items: T[];
  pages: GridLayoutPage[] | null;
  widgets: GridLayoutWidget[] | null;
  updatedAt: string | null;
};

/**
 * Resolve the document that should paint on the very first render. Prefer a
 * non-empty cached layout so GridStack mounts once with the real house layout
 * instead of mounting on the built-in default and remounting when the cache
 * arrives (that remount races GridStack and can wipe the layout to []).
 */
function seedDocument<T extends GridLayoutItem>(
  surface: GridSurface,
  defaultLayout: T[],
  defaultPages: GridLayoutPage[] | undefined,
  defaultWidgets: GridLayoutWidget[] | undefined,
  normalize: (items: T[]) => T[],
  normalizeDocument:
    | ((
        items: T[],
        pages: GridLayoutPage[] | null | undefined,
        widgets: GridLayoutWidget[] | null | undefined,
        phase?: "load" | "persist",
      ) => { items: T[]; pages: GridLayoutPage[]; widgets?: GridLayoutWidget[] })
    | undefined,
): SeedDoc<T> {
  const cached = getCached<GridLayoutRecord>(layoutCacheKey(surface));
  if (hasItems(cached?.items)) {
    if (normalizeDocument && defaultPages) {
      const doc = normalizeDocument(
        cached.items as T[],
        cached.pages ?? defaultPages,
        cached.widgets ?? defaultWidgets ?? null,
        "load",
      );
      if (hasItems(doc.items)) {
        return {
          items: doc.items,
          pages: doc.pages,
          widgets: doc.widgets ?? [],
          updatedAt: cached.updatedAt,
        };
      }
    } else {
      const items = normalize(cached.items as T[]);
      if (hasItems(items)) {
        return { items, pages: null, widgets: null, updatedAt: cached.updatedAt };
      }
    }
  }

  if (normalizeDocument && defaultPages) {
    const doc = normalizeDocument(defaultLayout, defaultPages, defaultWidgets ?? null, "load");
    return { items: doc.items, pages: doc.pages, widgets: doc.widgets ?? [], updatedAt: null };
  }
  return {
    items: normalize(defaultLayout),
    pages: defaultPages ?? null,
    widgets: defaultWidgets ?? null,
    updatedAt: null,
  };
}

export function useGridLayout<T extends GridLayoutItem>({
  surface,
  defaultLayout,
  normalize,
  legacyStorageKey,
  editable = true,
  defaultPages,
  defaultWidgets,
  normalizeDocument,
}: Options<T>): GridLayoutState<T> {
  const [seed] = useState(() =>
    seedDocument(surface, defaultLayout, defaultPages, defaultWidgets, normalize, normalizeDocument),
  );

  const [layout, setLayout] = useState<T[] | null>(() => seed.items);
  const [pages, setPages] = useState<GridLayoutPage[] | null>(() => seed.pages);
  const [widgets, setWidgets] = useState<GridLayoutWidget[] | null>(() => seed.widgets);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;
  const normalizeDocRef = useRef(normalizeDocument);
  normalizeDocRef.current = normalizeDocument;
  const defaultLayoutRef = useRef(defaultLayout);
  defaultLayoutRef.current = defaultLayout;
  const defaultPagesRef = useRef(defaultPages);
  defaultPagesRef.current = defaultPages;
  const defaultWidgetsRef = useRef(defaultWidgets);
  defaultWidgetsRef.current = defaultWidgets;
  const pendingRef = useRef<{ items: T[]; pages?: GridLayoutPage[]; widgets?: GridLayoutWidget[] } | null>(null);
  const timerRef = useRef<number | null>(null);
  const seenUpdatedAtRef = useRef<string | null>(seed.updatedAt);
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const pagesRef = useRef<GridLayoutPage[] | null>(pages);
  pagesRef.current = pages;
  const widgetsRef = useRef<GridLayoutWidget[] | null>(widgets);
  widgetsRef.current = widgets;
  const layoutRef = useRef<T[] | null>(layout);
  layoutRef.current = layout;

  // Signature of whatever the grid is currently mounted with.
  const appliedSigRef = useRef<string>(docSignature(seed.items, seed.pages, seed.widgets));

  const applyDocument = useCallback(
    (
      rawItems: T[],
      savedPages: GridLayoutPage[] | null | undefined,
      savedWidgets: GridLayoutWidget[] | null | undefined,
      opts?: { force?: boolean },
    ) => {
      // A remount race can hand us []. Never replace a real layout with nothing.
      const items = hasItems(rawItems) ? rawItems : defaultLayoutRef.current;
      const widgetsOrDefault =
        savedWidgets ?? defaultWidgetsRef.current ?? null;

      const commit = (
        nextItems: T[],
        nextPages: GridLayoutPage[] | null,
        nextWidgets: GridLayoutWidget[] | null,
      ) => {
        if (!hasItems(nextItems) && hasItems(layoutRef.current ?? undefined)) {
          // Normalized to empty while we still have widgets on screen — refuse.
          return null;
        }
        const sig = docSignature(nextItems, nextPages, nextWidgets);
        const changed = sig !== appliedSigRef.current;
        appliedSigRef.current = sig;
        layoutRef.current = nextItems;
        // GridStack only rebuilds when mountKey changes. Bump only when the
        // document actually differs from what the grid was seeded/mounted with.
        if (changed || opts?.force) setRevision((r) => r + 1);
        return { items: nextItems, pages: nextPages, widgets: nextWidgets };
      };

      if (normalizeDocRef.current && defaultPagesRef.current) {
        const doc = normalizeDocRef.current(
          items,
          savedPages ?? defaultPagesRef.current,
          widgetsOrDefault,
          "load",
        );
        const w = doc.widgets ?? [];
        const applied = commit(doc.items, doc.pages, w);
        if (!applied) {
          return {
            items: layoutRef.current ?? doc.items,
            pages: pagesRef.current ?? doc.pages,
            widgets: widgetsRef.current ?? w,
          };
        }
        setLayout(applied.items);
        setPages(applied.pages);
        pagesRef.current = applied.pages;
        setWidgets(applied.widgets);
        widgetsRef.current = applied.widgets;
        return applied;
      }
      const normalized = normalizeRef.current(items);
      const applied = commit(normalized, null, null);
      if (!applied) {
        return {
          items: layoutRef.current ?? normalized,
          pages: null as GridLayoutPage[] | null,
          widgets: null as GridLayoutWidget[] | null,
        };
      }
      setLayout(applied.items);
      setPages(null);
      pagesRef.current = null;
      setWidgets(null);
      widgetsRef.current = null;
      return applied;
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
    if (!pending || !hasItems(pending.items)) {
      pendingRef.current = null;
      return;
    }
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

    // Cache was already painted via seedDocument. Only re-apply here when the
    // effect re-runs (editable/surface change) and cache still looks valid.
    const cached = getCached<GridLayoutRecord>(layoutCacheKey(surface));
    if (hasItems(cached?.items) && cached.updatedAt !== seenUpdatedAtRef.current) {
      seenUpdatedAtRef.current = cached.updatedAt;
      applyDocument(cached.items as T[], cached.pages, cached.widgets);
    } else if (hasItems(cached?.items)) {
      seenUpdatedAtRef.current = cached.updatedAt;
    }

    gridLayoutsApi
      .get(surface)
      .then(({ layout: record }) => {
        if (!active) return;

        if (!hasItems(record.items)) {
          // Server says "no saved layout" (null) or handed us a poisoned [].
          // Code default is the truth — do not keep a stale in-memory seed,
          // and never re-upload legacy localStorage onto a shared house
          // surface (that undoes an admin reset of case-detail).
          setCached(layoutCacheKey(surface), {
            ...record,
            items: null,
          });
          clearLegacyLayout(legacyStorageKey);

          const isSharedSurface = surface === "case-detail" || surface === "cases-table";
          if (!isSharedSurface && editableRef.current) {
            const legacy = readLegacyLayout<T>(legacyStorageKey);
            if (legacy) {
              const doc = applyDocument(legacy, defaultPagesRef.current, null);
              if (editableRef.current && hasItems(doc.items)) {
                gridLayoutsApi
                  .save(surface, doc.items, doc.pages ?? undefined, doc.widgets ?? undefined)
                  .then(({ layout: saved }) => {
                    seenUpdatedAtRef.current = saved.updatedAt;
                    clearLegacyLayout(legacyStorageKey);
                  })
                  .catch((err: unknown) => {
                    console.error(`[grid-layout] legacy migrate failed (${surface}):`, err);
                  });
              }
              return;
            }
          }

          seenUpdatedAtRef.current = null;
          applyDocument(
            defaultLayoutRef.current,
            defaultPagesRef.current,
            defaultWidgetsRef.current,
            { force: true },
          );
          return;
        }

        setCached(layoutCacheKey(surface), record);
        clearLegacyLayout(legacyStorageKey);
        if (record.updatedAt === seenUpdatedAtRef.current) return;
        seenUpdatedAtRef.current = record.updatedAt;
        applyDocument(record.items as T[], record.pages, record.widgets);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load your saved layout.");
        if (seenUpdatedAtRef.current === null) {
          applyDocument(
            defaultLayoutRef.current,
            defaultPagesRef.current,
            defaultWidgetsRef.current,
          );
        }
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
      if (Date.now() - lastSyncAt < SYNC_MIN_INTERVAL_MS) return;
      lastSyncAt = Date.now();

      gridLayoutsApi
        .get(surface)
        .then(({ layout: record }) => {
          if (!hasItems(record.items)) {
            // Do not wipe a live layout because the server returned null/[].
            return;
          }
          setCached(layoutCacheKey(surface), record);
          if (record.updatedAt === seenUpdatedAtRef.current) return;
          seenUpdatedAtRef.current = record.updatedAt;
          applyDocument(record.items as T[], record.pages, record.widgets);
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
      // Remount races can report zero nodes. Never let that erase the house layout.
      if (!hasItems(items)) {
        console.warn(`[grid-layout] refused to persist an empty layout (${surface})`);
        return;
      }

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

      if (!hasItems(doc.items)) {
        console.warn(`[grid-layout] normalize emptied the layout — refusing to persist (${surface})`);
        return;
      }

      setLayout(doc.items);
      layoutRef.current = doc.items;
      if (doc.pages) {
        setPages(doc.pages);
        pagesRef.current = doc.pages;
      }
      if (doc.widgets !== undefined) {
        setWidgets(doc.widgets ?? null);
        widgetsRef.current = doc.widgets ?? null;
      }
      // The grid already reflects this edit — record it so a later sync of the
      // same document does not remount mid-interaction.
      appliedSigRef.current = docSignature(
        doc.items,
        doc.pages ?? pagesRef.current,
        doc.widgets ?? widgetsRef.current,
      );
      if (!editableRef.current) return;
      pendingRef.current = { items: doc.items, pages: doc.pages ?? undefined, widgets: doc.widgets ?? undefined };
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush, surface],
  );

  const reset = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    seenUpdatedAtRef.current = null;
    const defaults = defaultLayoutRef.current;
    const defaultPages = defaultPagesRef.current;
    const defaultWidgets = defaultWidgetsRef.current;
    try {
      sessionStorage.removeItem(`tc.cache:grid-layout:${surface}`);
    } catch {
      /* ignore */
    }
    applyDocument(defaults, defaultPages, defaultWidgets ?? null, { force: true });
    clearLegacyLayout(legacyStorageKey);
    setCached(layoutCacheKey(surface), {
      surface,
      items: null,
      pages: null,
      widgets: null,
      source: "default",
      updatedAt: null,
    });
    if (!editableRef.current) return;
    gridLayoutsApi
      .save(surface, defaults, defaultPages, defaultWidgets ?? undefined)
      .then(({ layout: record }) => {
        seenUpdatedAtRef.current = record.updatedAt;
        setCached(layoutCacheKey(surface), record);
      })
      .catch(() => {
        gridLayoutsApi.reset(surface).catch(() => {});
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, legacyStorageKey, applyDocument]);

  return { layout, pages, widgets, persist, reset, revision, error };
}

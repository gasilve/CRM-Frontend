import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarPlus, Car, Folder, Users } from "lucide-react";
import { CaseDetailSkeleton, PanelLoader } from "@/components/ui/LoadingState";
import { casesApi, investigatorsApi, ApiError, type CaseDetail as CaseDetailType, type CaseStatus } from "@/lib/crm-api";
import { invalidateQueries, useQuery } from "@/lib/query-cache";
import { useAuth } from "@/contexts/AuthContext";
import { useGridLayout } from "@/hooks/useGridLayout";
import { CaseSubjectHeader } from "@/components/case/CaseSubjectHeader";
import { CaseActionBar, type CaseDrawerId } from "@/components/case/CaseActionBar";
import { CasePageArrows } from "@/components/case/CasePageArrows";
import { CaseDrawer } from "@/components/case/CaseDrawer";
import { CaseVehiclesDrawer } from "@/components/case/CaseVehiclesDrawer";
import { CasePeopleDrawer } from "@/components/case/CasePeopleDrawer";
import { CaseFolderDrawer } from "@/components/case/CaseFolderDrawer";
import { DragDock } from "@/components/dashboard/DragDock";
import { ConfirmModal } from "@/components/dashboard/ConfirmModal";
import type { Subject } from "@/lib/mock-data";
import {
  CASE_DEFAULT_LAYOUT,
  CASE_DEFAULT_PAGES,
  CASE_LEGACY_LS_KEY,
  CASE_PAGE_ROWS,
  RESERVED_WIDGET_TITLE,
  createCasePage,
  createCustomWidgetDef,
  isCustomWidgetId,
  isReservedWidgetTitle,
  normalizeCaseDocument,
  normalizeCaseLayout,
  sameWidgetTitle,
  type CaseLayoutItem,
  type CasePanelCtx,
  type CustomCaseWidgetDef,
} from "./case-detail-widgets";
import { CaseDetailGrid, type CaseDetailGridHandle } from "./CaseDetailGrid";
import { CaseDetailPageNav } from "./CaseDetailPageNav";
import { CustomWidgetBuilderModal } from "./CustomCaseWidget";
import CaseWidgetDock from "./CaseWidgetDock";
import { caseWidgetDebug, resolveDragDropTarget, type DragDropTarget } from "@/lib/case-widget-debug";

const STATUS_CONFIG: Record<CaseStatus, { label: string; dot: string; pill: string; text: string }> = {
  open: { label: "Open", dot: "#4ade80", pill: "rgba(74,222,128,0.15)", text: "#4ade80" },
  suspended: { label: "Suspended", dot: "#f59e0b", pill: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  closed: { label: "Closed", dot: "#5b6680", pill: "rgba(91,102,128,0.15)", text: "#7a8499" },
};

const DRAWER_META: Record<CaseDrawerId, { title: string; icon: React.ReactNode }> = {
  vehicles: { title: "Vehicles", icon: <Car size={16} strokeWidth={1.8} /> },
  people: { title: "People", icon: <Users size={16} strokeWidth={1.8} /> },
  folder: { title: "Case folder", icon: <Folder size={16} strokeWidth={1.8} /> },
};

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, can, canSee, canEdit, isSuperadmin, isPending: authPending } = useAuth();
  const canEditCase = can("cases.edit");
  const canEditLayout = !authPending && isSuperadmin;

  const [activePageId, setActivePageId] = useState<string>(CASE_DEFAULT_PAGES[0].id);
  /** Bumped when the layout changes outside of the grids themselves (page delete, trash, widget delete). */
  const [gridToken, setGridToken] = useState(0);

  const [activeDrawer, setActiveDrawer] = useState<CaseDrawerId | null>(null);
  const [dockOpen, setDockOpen] = useState(false);
  const [dockPlacingWidgetId, setDockPlacingWidgetId] = useState<string | null>(null);
  const dockPlacing = dockPlacingWidgetId !== null;
  const dockPlacingCustom = dockPlacingWidgetId !== null && isCustomWidgetId(dockPlacingWidgetId);
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);
  const [builderWidgetId, setBuilderWidgetId] = useState<string | null>(null);
  const trashHoveredRef = useRef(false);
  const [trashHovered, setTrashHovered] = useState(false);
  const saveHoveredRef = useRef(false);
  const [saveHovered, setSaveHovered] = useState(false);
  const unsaveHoveredRef = useRef(false);
  const [unsaveHovered, setUnsaveHovered] = useState(false);
  /** Set when a save-to-library drop needs the user to resolve a name clash. */
  const [savePrompt, setSavePrompt] = useState<
    | { kind: "reserved"; widgetId: string }
    | { kind: "overwrite"; widgetId: string; replaceId: string; title: string }
    | null
  >(null);
  /** Geometry of the widget being dragged, so a drop on the dock can put it back. */
  const dragOriginRef = useRef<CaseLayoutItem | null>(null);

  const {
    layout,
    pages,
    widgets,
    persist: persistLayout,
    revision: layoutRevision,
  } = useGridLayout<CaseLayoutItem>({
    surface: "case-detail",
    defaultLayout: CASE_DEFAULT_LAYOUT,
    normalize: normalizeCaseLayout,
    normalizeDocument: (items, savedPages, savedWidgets, phase) =>
      normalizeCaseDocument(items, savedPages, savedWidgets as CustomCaseWidgetDef[] | null, phase),
    defaultPages: CASE_DEFAULT_PAGES,
    legacyStorageKey: CASE_LEGACY_LS_KEY,
    editable: canEditLayout,
  });
  const gridHandleRef = useRef<CaseDetailGridHandle | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const widgetsRef = useRef(widgets);
  widgetsRef.current = widgets;

  const resolvedPages = pages ?? CASE_DEFAULT_PAGES;

  useEffect(() => {
    if (!pages?.length) return;
    if (!pages.some((p) => p.id === activePageId)) {
      setActivePageId(pages[0].id);
    }
  }, [pages, activePageId]);

  useEffect(() => {
    document.body.classList.toggle("dashboard-trash-hovered", trashHovered);
    return () => document.body.classList.remove("dashboard-trash-hovered");
  }, [trashHovered]);

  /** Clear drag chrome if the page unmounts mid-gesture (crash, navigation, etc.). */
  useEffect(() => {
    return () => {
      document.body.classList.remove("dashboard-widget-dragging");
      document.body.classList.remove("dashboard-dock-placing");
      document.body.classList.remove("dashboard-trash-hovered");
    };
  }, []);

  const persistAllItems = useCallback(
    (items: CaseLayoutItem[]) => {
      persistLayout(items, pagesRef.current ?? undefined, widgetsRef.current ?? undefined);
    },
    [persistLayout],
  );

  const renamePage = useCallback(
    (pageId: string, name: string) => {
      const current = pagesRef.current ?? CASE_DEFAULT_PAGES;
      const next = current.map((p) => (p.id === pageId ? { ...p, name } : p));
      persistLayout(layoutRef.current ?? CASE_DEFAULT_LAYOUT, next, widgetsRef.current ?? undefined);
    },
    [persistLayout],
  );

  const addPage = useCallback(() => {
    const current = pagesRef.current ?? CASE_DEFAULT_PAGES;
    const page = createCasePage(`Page ${current.length + 1}`);
    const next = [...current, page];
    persistLayout(layoutRef.current ?? CASE_DEFAULT_LAYOUT, next, widgetsRef.current ?? undefined);
    setActivePageId(page.id);
  }, [persistLayout]);

  const deletePage = useCallback((pageId: string) => {
    const current = pagesRef.current ?? CASE_DEFAULT_PAGES;
    if (current.length <= 1) return;
    const next = current.filter((p) => p.id !== pageId);

    // Rehome the deleted page's widgets onto whichever remaining page still
    // has room at the bottom, so nothing is squeezed past the row cap.
    const all = layoutRef.current ?? CASE_DEFAULT_LAYOUT;
    const bottoms = new Map(
      next.map((p) => [
        p.id,
        all.filter((i) => i.pageId === p.id).reduce((m, i) => Math.max(m, i.y + i.h), 0),
      ]),
    );
    const items = all.map((item) => {
      if (item.pageId !== pageId) return item;
      const host =
        next.find((p) => (bottoms.get(p.id) ?? 0) + item.h <= CASE_PAGE_ROWS) ?? next[0];
      const y = bottoms.get(host.id) ?? 0;
      bottoms.set(host.id, y + item.h);
      return { ...item, pageId: host.id, y };
    });

    persistLayout(items, next, widgetsRef.current ?? undefined);
    setActivePageId((cur) => (cur === pageId ? next[0].id : cur));
    // Live grids own their own state, so a data-only move needs a rebuild.
    setGridToken((t) => t + 1);
  }, [persistLayout]);

  // ── Custom widgets ─────────────────────────────────────────────────────────

  /**
   * Called synchronously by the grid when the "new widget" dock template lands.
   * The definition must exist before the drop is persisted, so update the ref
   * eagerly and let React state catch up.
   */
  const handleCreateCustomWidget = useCallback((): string | null => {
    const def = createCustomWidgetDef();
    const next = [...(widgetsRef.current ?? []), def];
    widgetsRef.current = next;
    persistLayout(layoutRef.current ?? [], pagesRef.current ?? undefined, next);
    setBuilderWidgetId(def.id);
    return def.id;
  }, [persistLayout]);

  /** Auto-save while the builder is open — keeps the board's copy live, never closes it. */
  const handleWidgetDefChange = useCallback(
    (def: CustomCaseWidgetDef) => {
      const current = widgetsRef.current ?? [];
      const next = current.some((w) => w.id === def.id)
        ? current.map((w) => (w.id === def.id ? def : w))
        : [...current, def];
      widgetsRef.current = next;
      persistLayout(layoutRef.current ?? [], pagesRef.current ?? undefined, next);
    },
    [persistLayout],
  );

  /**
   * Keeps a widget in the reusable list. The list holds at most one widget per
   * name, so overwriting drops the previous definition and its placements.
   */
  const scheduleGridRebuild = useCallback(() => {
    caseWidgetDebug.log("scheduleGridRebuild");
    window.setTimeout(() => setGridToken((t) => t + 1), 0);
  }, []);

  /** Push saved layout coords into the live grid without remounting GridStack. */
  const applyLayoutItemsToGrid = useCallback((items: CaseLayoutItem[]) => {
    const grid = gridHandleRef.current?.getGrid();
    if (!grid) {
      caseWidgetDebug.warn("applyLayoutItemsToGrid: no active grid");
      return false;
    }
    let applied = 0;
    for (const item of items) {
      const target = grid.getGridItems().find((el) => {
        if (el.classList.contains("dock-carousel-item")) return false;
        const nodeId = el.gridstackNode?.id ?? el.getAttribute("gs-id");
        return nodeId === item.id;
      });
      if (!target) continue;
      try {
        grid.update(target, { x: item.x, y: item.y, w: item.w, h: item.h });
        applied += 1;
      } catch (err) {
        caseWidgetDebug.error("grid.update failed", { itemId: item.id, err });
      }
    }
    caseWidgetDebug.log("applyLayoutItemsToGrid", { applied, total: items.length });
    return applied > 0;
  }, []);

  const commitSaveToLibrary = useCallback(
    (widgetId: string, replaceId?: string, baseItems?: CaseLayoutItem[]) => {
      caseWidgetDebug.log("commitSaveToLibrary start", { widgetId, replaceId });
      try {
        const current = widgetsRef.current ?? [];
        let nextWidgets = current.map((w) => (w.id === widgetId ? { ...w, persisted: true } : w));
        let nextItems = baseItems ?? layoutRef.current ?? [];
        if (replaceId) {
          nextWidgets = nextWidgets.filter((w) => w.id !== replaceId);
          nextItems = nextItems.filter((i) => i.id !== replaceId);
        }
        widgetsRef.current = nextWidgets;
        persistLayout(nextItems, pagesRef.current ?? undefined, nextWidgets);
        // Avoid mountKey rebuild here — it races GridStack drag teardown and crashes.
        window.setTimeout(() => {
          applyLayoutItemsToGrid(nextItems);
          caseWidgetDebug.log("commitSaveToLibrary done", { widgetId });
        }, 0);
      } catch (err) {
        caseWidgetDebug.error("commitSaveToLibrary failed", err);
        throw err;
      }
    },
    [persistLayout, applyLayoutItemsToGrid],
  );

  /** Drop a saved custom widget on the crossed bookmark — remove from the reusable list. */
  const commitRemoveFromLibrary = useCallback(
    (widgetId: string, capturedOrigin?: CaseLayoutItem | null) => {
      caseWidgetDebug.log("commitRemoveFromLibrary", { widgetId });
      const current = widgetsRef.current ?? [];
      const def = current.find((w) => w.id === widgetId);
      if (!def?.persisted) return;

      const onPage = (layoutRef.current ?? []).some((i) => i.id === widgetId);
      if (onPage) {
        const items = (layoutRef.current ?? []).map((i) =>
          capturedOrigin && i.id === capturedOrigin.id ? capturedOrigin : i,
        );
        const nextWidgets = current.map((w) =>
          w.id === widgetId ? { ...w, persisted: false } : w,
        );
        widgetsRef.current = nextWidgets;
        persistLayout(items, pagesRef.current ?? undefined, nextWidgets);
        window.setTimeout(() => applyLayoutItemsToGrid(items), 0);
        return;
      }

      const nextWidgets = current.filter((w) => w.id !== widgetId);
      widgetsRef.current = nextWidgets;
      persistLayout(layoutRef.current ?? [], pagesRef.current ?? undefined, nextWidgets);
    },
    [persistLayout, applyLayoutItemsToGrid],
  );

  /** Snap a dragged widget back to its pre-drag grid cell without a full rebuild when possible. */
  const revertWidgetPosition = useCallback(
    (origin: CaseLayoutItem) => {
      caseWidgetDebug.log("revertWidgetPosition", { id: origin.id, x: origin.x, y: origin.y });
      const items = (layoutRef.current ?? []).map((i) => (i.id === origin.id ? origin : i));
      layoutRef.current = items;
      persistLayout(items, pagesRef.current ?? undefined, widgetsRef.current ?? undefined);
      window.setTimeout(() => {
        if (!applyLayoutItemsToGrid(items)) scheduleGridRebuild();
      }, 0);
    },
    [persistLayout, applyLayoutItemsToGrid, scheduleGridRebuild],
  );

  /**
   * The bookmark target is not a grid cell — snap the widget back to where
   * the drag started so the board matches the saved layout document.
   */
  const snapDraggedWidgetHome = useCallback(
    (origin?: CaseLayoutItem | null) => {
      const o = origin ?? dragOriginRef.current;
      if (!o) {
        caseWidgetDebug.warn("snapDraggedWidgetHome: no origin");
        return;
      }
      revertWidgetPosition(o);
    },
    [revertWidgetPosition],
  );

  /** A custom widget was dropped on the bookmark target. */
  const handleSaveDropped = useCallback(
    (widgetId: string, capturedOrigin: CaseLayoutItem | null) => {
      caseWidgetDebug.log("handleSaveDropped", { widgetId, origin: capturedOrigin?.id });
      try {
        const def = (widgetsRef.current ?? []).find((w) => w.id === widgetId);
        if (!def) {
          caseWidgetDebug.warn("handleSaveDropped: widget def missing", widgetId);
          return;
        }

        const items = (layoutRef.current ?? []).map((i) =>
          capturedOrigin && i.id === capturedOrigin.id ? capturedOrigin : i,
        );

        if (isReservedWidgetTitle(def.title)) {
          snapDraggedWidgetHome(capturedOrigin);
          setSavePrompt({ kind: "reserved", widgetId });
          return;
        }
        const clash = (widgetsRef.current ?? []).find(
          (w) => w.id !== widgetId && w.persisted && sameWidgetTitle(w.title, def.title),
        );
        if (clash) {
          snapDraggedWidgetHome(capturedOrigin);
          setSavePrompt({
            kind: "overwrite",
            widgetId,
            replaceId: clash.id,
            title: def.title.trim(),
          });
          return;
        }
        commitSaveToLibrary(widgetId, undefined, items);
      } catch (err) {
        caseWidgetDebug.error("handleSaveDropped failed", err);
      }
    },
    [commitSaveToLibrary, snapDraggedWidgetHome],
  );

  const handleUnsaveDropped = useCallback(
    (widgetId: string, capturedOrigin: CaseLayoutItem | null) => {
      caseWidgetDebug.log("handleUnsaveDropped", { widgetId, origin: capturedOrigin?.id });
      try {
        if (!isCustomWidgetId(widgetId)) return;
        const def = (widgetsRef.current ?? []).find((w) => w.id === widgetId);
        if (!def?.persisted) return;
        const onPage = (layoutRef.current ?? []).some((i) => i.id === widgetId);
        if (onPage) {
          snapDraggedWidgetHome(capturedOrigin);
        }
        commitRemoveFromLibrary(widgetId, capturedOrigin);
      } catch (err) {
        caseWidgetDebug.error("handleUnsaveDropped failed", err);
      }
    },
    [commitRemoveFromLibrary, snapDraggedWidgetHome],
  );

  // ── Drag-to-trash ──────────────────────────────────────────────────────────

  const removePlacedWidget = useCallback(
    (widgetId: string) => {
      // Draft (never-persisted) custom widgets are fully deleted when removed
      // from the board — only persisted ones survive, like premade panels.
      if (isCustomWidgetId(widgetId)) {
        const existing = (widgetsRef.current ?? []).find((w) => w.id === widgetId);
        if (existing && !existing.persisted) {
          widgetsRef.current = (widgetsRef.current ?? []).filter((w) => w.id !== widgetId);
        }
      }

      // Prefer removing through GridStack so the grids' own change sync stays
      // consistent; fall back to a data-only removal plus a rebuild.
      const grid = gridHandleRef.current?.getGrid();
      if (grid) {
        const target = grid.getGridItems().find((el) => {
          if (el.classList.contains("dock-carousel-item")) return false;
          const nodeId = el.gridstackNode?.id ?? el.getAttribute("gs-id");
          return nodeId === widgetId;
        });
        if (target) {
          try {
            grid.removeWidget(target, true, true);
            return;
          } catch {
            /* fall through to data removal */
          }
        }
      }
      const next = (layoutRef.current ?? []).filter((i) => i.id !== widgetId);
      persistLayout(next, pagesRef.current ?? undefined, widgetsRef.current ?? undefined);
      setGridToken((t) => t + 1);
    },
    [persistLayout],
  );

  const handleWidgetDragStart = useCallback((widgetId: string | null) => {
    setDockOpen(false);
    setDraggingWidgetId(widgetId);
    dragOriginRef.current = widgetId
      ? (layoutRef.current ?? []).find((i) => i.id === widgetId) ?? null
      : null;
  }, []);

  const handleWidgetDragStop = useCallback(
    (widgetId: string | null, dropTarget: DragDropTarget): boolean => {
      const origin = dragOriginRef.current;
      let target = dropTarget;
      if (!target) {
        target = resolveDragDropTarget(0, 0, {
          unsave: unsaveHoveredRef.current,
          trash: trashHoveredRef.current,
          save: saveHoveredRef.current,
        });
      }
      caseWidgetDebug.log("handleWidgetDragStop", {
        widgetId,
        dropTarget: target,
        origin: origin?.id,
      });
      try {
        if (widgetId && target === "unsave" && isCustomWidgetId(widgetId)) {
          window.setTimeout(() => {
            handleUnsaveDropped(widgetId, origin);
          }, 0);
          return true;
        }
        if (widgetId && target === "trash") {
          window.setTimeout(() => {
            try {
              removePlacedWidget(widgetId);
            } catch (err) {
              caseWidgetDebug.error("removePlacedWidget failed", err);
            }
          }, 0);
          return true;
        }
        if (widgetId && target === "save" && isCustomWidgetId(widgetId)) {
          window.setTimeout(() => {
            handleSaveDropped(widgetId, origin);
          }, 0);
          return true;
        }
        return false;
      } finally {
        setDraggingWidgetId(null);
        trashHoveredRef.current = false;
        setTrashHovered(false);
        saveHoveredRef.current = false;
        setSaveHovered(false);
        unsaveHoveredRef.current = false;
        setUnsaveHovered(false);
        dragOriginRef.current = null;
      }
    },
    [removePlacedWidget, handleSaveDropped, handleUnsaveDropped],
  );

  /** While dragging from the widget dock, allow dropping on unsave to delete a saved template. */
  useEffect(() => {
    if (!dockPlacing) return;

    const readDockDragId = (): string | null => {
      const helper = document.querySelector<HTMLElement>(
        "body > .dock-carousel-item.ui-draggable-dragging, body > .ui-draggable-dragging[gs-id]",
      );
      return helper?.getAttribute("gs-id") ?? helper?.getAttribute("data-dock-widget") ?? null;
    };

    const onUp = (ev: PointerEvent) => {
      const target = resolveDragDropTarget(ev.clientX, ev.clientY, {
        unsave: unsaveHoveredRef.current,
        trash: trashHoveredRef.current,
        save: saveHoveredRef.current,
      });
      if (target !== "unsave") return;
      const widgetId = readDockDragId();
      if (!widgetId || !isCustomWidgetId(widgetId)) return;
      window.setTimeout(() => handleUnsaveDropped(widgetId, null), 0);
    };

    document.addEventListener("pointerup", onUp, true);
    return () => document.removeEventListener("pointerup", onUp, true);
  }, [dockPlacing, handleUnsaveDropped]);

  // ── Data ───────────────────────────────────────────────────────────────────
  // Cached: revisiting a case renders instantly from the last fetch while a
  // background request brings it up to date. `null` marks a confirmed 404.

  const caseQuery = useQuery(
    id ? `case:${id}` : null,
    () =>
      casesApi
        .get(id!)
        .then((res): CaseDetailType | null => res.case)
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }),
    { enabled: !!id },
  );
  const kase = caseQuery.data ?? null;
  const notFound = caseQuery.data === null;
  const error = caseQuery.error;

  const load = useCallback(() => {
    // Mutations refetch in the background and refresh any cached case list.
    void caseQuery.refresh();
    invalidateQueries("cases:list");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseQuery.refresh]);

  const investigatorsQuery = useQuery("investigators:list", () => investigatorsApi.list(), {
    staleMs: 5 * 60_000,
  });
  const investigatorOptions = (investigatorsQuery.data?.investigators ?? []).map((i) => ({
    id: i.id,
    name: i.name,
  }));

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="font-mono text-[0.75rem] text-[var(--color-text-lo)]">CASE NOT FOUND</div>
        <div className="editorial text-[2rem] text-[var(--color-text-hi)]">404</div>
        <button onClick={() => navigate("/cases")} className="eyebrow text-[var(--color-accent)]">
          ← Back to Cases
        </button>
      </div>
    );
  }

  if (!kase) {
    return (
      <div className="flex h-full flex-col">
        {error ? (
          <div className="surface grid flex-1 place-items-center text-[0.8125rem] text-[var(--color-neg)]">{error}</div>
        ) : (
          <CaseDetailSkeleton />
        )}
      </div>
    );
  }

  const cfg = STATUS_CONFIG[kase.status];
  const primaryAddress = kase.addresses.find((a) => a.isPrimary) ?? kase.addresses[0];
  const subject: Subject = {
    name: kase.subjectName,
    dob: kase.subjectDob ? kase.subjectDob.slice(0, 10) : undefined,
    address: primaryAddress?.line1,
    city: primaryAddress?.city ?? undefined,
    state: primaryAddress?.state ?? kase.state ?? undefined,
    zip: primaryAddress?.zip ?? undefined,
    description: kase.subjectDescription ?? undefined,
  };

  const panelCtx: CasePanelCtx = {
    case: kase,
    currentUserId: user?.id ?? "",
    investigatorOptions,
    onRefresh: load,
    canEdit: canEditCase,
    canAssign: can("cases.assign"),
    canPostJournal: can("cases.journal.write"),
    canModerateJournal: can("cases.journal.moderate"),
    canSee,
    canEditField: (field) => canEditCase && canEdit(field),
    getCustomWidget: (widgetId) => (widgetsRef.current ?? []).find((w) => w.id === widgetId) ?? null,
    onEditCustomWidget: canEditLayout ? (widgetId) => setBuilderWidgetId(widgetId) : undefined,
  };

  const builderDef = builderWidgetId ? (widgets ?? []).find((w) => w.id === builderWidgetId) ?? null : null;
  const draggingCustomDef =
    draggingWidgetId && isCustomWidgetId(draggingWidgetId)
      ? (widgets ?? []).find((w) => w.id === draggingWidgetId)
      : null;
  const drawerMeta = activeDrawer ? DRAWER_META[activeDrawer] : null;

  return (
    <div className="case-detail-page">
      <CaseSubjectHeader
        className="mb-4 shrink-0"
        subject={subject}
        claimNumber={kase.claimNumber ?? kase.caseNumber}
        aliases={kase.subjectAliases}
        showMeta={false}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate("/cases")}
              className="inline-flex items-center gap-1.5 rounded-[0.625rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            >
              <ArrowLeft size={13} strokeWidth={1.8} />
              Cases
            </button>
            {can("schedule.manage") && (
              <button
                type="button"
                onClick={() => navigate(`/schedule?case=${kase.id}`)}
                className="inline-flex items-center gap-1.5 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)]"
              >
                <CalendarPlus size={13} strokeWidth={1.8} />
                Schedule
              </button>
            )}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.71875rem] font-medium"
              style={{ background: cfg.pill, color: cfg.text }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: cfg.dot }} />
              {cfg.label}
            </span>
          </>
        }
      />

      {layout ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <CaseDetailPageNav
            pages={resolvedPages}
            activePageId={activePageId}
            editable={canEditLayout}
            onSelect={setActivePageId}
            onRename={renamePage}
            onAddPage={canEditLayout ? addPage : undefined}
            onDeletePage={canEditLayout ? deletePage : undefined}
          />
          <div className="min-h-0 flex-1">
            <CaseDetailGrid
              pages={resolvedPages}
              activePageId={activePageId}
              onActivePageChange={setActivePageId}
              layout={layout}
              mountKey={`${kase.id}:${layoutRevision}:${gridToken}:${canEditLayout ? "edit" : "view"}`}
              ctx={panelCtx}
              gridRef={gridHandleRef}
              onLayoutPersist={persistAllItems}
              editable={canEditLayout}
              onWidgetDragStart={canEditLayout ? handleWidgetDragStart : undefined}
              onWidgetDragStop={canEditLayout ? handleWidgetDragStop : undefined}
              onCreateCustomWidget={canEditLayout ? handleCreateCustomWidget : undefined}
            />
          </div>
        </div>
      ) : (
        <PanelLoader message="Loading layout" />
      )}

      {layout && (
        <CasePageArrows pages={resolvedPages} activePageId={activePageId} onSelect={setActivePageId} />
      )}

      <CaseActionBar
        canEditLayout={canEditLayout}
        activeDrawer={activeDrawer}
        dockOpen={dockOpen}
        onToggleDock={() => {
          setActiveDrawer(null);
          setDockOpen((open) => !open);
        }}
        onOpenDrawer={(drawerId) => {
          setDockOpen(false);
          setActiveDrawer((cur) => (cur === drawerId ? null : drawerId));
        }}
      />

      {drawerMeta && (
        <CaseDrawer
          open
          title={drawerMeta.title}
          icon={drawerMeta.icon}
          onClose={() => setActiveDrawer(null)}
        >
          {activeDrawer === "vehicles" && <CaseVehiclesDrawer ctx={panelCtx} />}
          {activeDrawer === "people" && <CasePeopleDrawer ctx={panelCtx} />}
          {activeDrawer === "folder" && <CaseFolderDrawer ctx={panelCtx} />}
        </CaseDrawer>
      )}

      {canEditLayout && layout && (
        <>
          <CaseWidgetDock
            open={dockOpen}
            ctx={panelCtx}
            layout={layout}
            customWidgets={widgets ?? []}
            gridRef={gridHandleRef}
            gridMountKey={`${layoutRevision}:${gridToken}:${activePageId}`}
            onClose={() => setDockOpen(false)}
            onPlacingChange={setDockPlacingWidgetId}
          />

          <DragDock
            visible={draggingWidgetId !== null || dockPlacing}
            trashHovered={trashHovered}
            onTrashHoverChange={(hovered) => {
              trashHoveredRef.current = hovered;
              setTrashHovered(hovered);
            }}
            showUnsave={draggingCustomDef?.persisted === true || dockPlacingCustom}
            unsaveHovered={unsaveHovered}
            onUnsaveHoverChange={(hovered) => {
              unsaveHoveredRef.current = hovered;
              setUnsaveHovered(hovered);
            }}
            showSave={
              draggingWidgetId !== null &&
              isCustomWidgetId(draggingWidgetId) &&
              draggingCustomDef?.persisted !== true
            }
            saveHovered={saveHovered}
            onSaveHoverChange={(hovered) => {
              saveHoveredRef.current = hovered;
              setSaveHovered(hovered);
            }}
          />

          <CustomWidgetBuilderModal
            open={builderWidgetId !== null}
            def={builderDef}
            canSee={canSee}
            onChange={handleWidgetDefChange}
            onClose={() => setBuilderWidgetId(null)}
          />

          <ConfirmModal
            open={savePrompt?.kind === "reserved"}
            title="Name it first"
            description={
              <>
                “{RESERVED_WIDGET_TITLE}” is reserved for the blank template in the widget
                menu. Give this widget its own name to keep it for reuse.
              </>
            }
            cancelLabel="Close"
            confirmLabel="Rename widget"
            onCancel={() => setSavePrompt(null)}
            onConfirm={() => {
              if (savePrompt?.kind === "reserved") setBuilderWidgetId(savePrompt.widgetId);
              setSavePrompt(null);
            }}
          />

          <ConfirmModal
            open={savePrompt?.kind === "overwrite"}
            title="Overwrite saved widget?"
            description={
              <>
                A saved widget named “{savePrompt?.kind === "overwrite" ? savePrompt.title : ""}”
                already exists. Overwriting replaces it — the old one is removed from the widget
                menu and from any page it sits on.
              </>
            }
            confirmLabel="Overwrite"
            danger
            onCancel={() => setSavePrompt(null)}
            onConfirm={() => {
              if (savePrompt?.kind === "overwrite") {
                commitSaveToLibrary(savePrompt.widgetId, savePrompt.replaceId);
              }
              setSavePrompt(null);
            }}
          />
        </>
      )}
    </div>
  );
}

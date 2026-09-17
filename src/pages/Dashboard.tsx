import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { CasePageArrows } from "@/components/case/CasePageArrows";
import { DashboardActionBar } from "@/components/dashboard/DashboardActionBar";
import { DragDock } from "@/components/dashboard/DragDock";
import { PanelLoader } from "@/components/ui/LoadingState";
import { useGridLayout } from "@/hooks/useGridLayout";
import { WidgetBridgeSync } from "@/lib/widget-bridge";
import type { GridLayoutPage } from "@/lib/crm-api";
import {
  DASHBOARD_BOARD_1,
  DASHBOARD_DEFAULT_PAGES,
  DASHBOARD_LEGACY_LS_KEY,
  DASHBOARD_MAX_BOARDS,
  DEFAULT_LAYOUT,
  WIDGETS,
  normalizeDashboardDocument,
  normalizeLayout,
  type LayoutItem,
  type WidgetId,
} from "./dashboard-widgets";
import { DashboardGrid, type DashboardGridHandle } from "./DashboardGrid";
import WidgetDock from "./WidgetDock";

const ACTIVE_BOARD_LS = "accenty.crm.dashboard.active-board";

export default function Dashboard() {
  return (
    <>
      <WidgetBridgeSync />
      <DashboardInner />
    </>
  );
}

function DashboardInner() {
  const {
    layout: savedLayout,
    pages: savedPages,
    persist: persistLayout,
    reset: resetLayout,
    revision: layoutRevision,
    error: layoutError,
  } = useGridLayout<LayoutItem>({
    surface: "dashboard",
    defaultLayout: DEFAULT_LAYOUT,
    normalize: normalizeLayout,
    legacyStorageKey: DASHBOARD_LEGACY_LS_KEY,
    defaultPages: DASHBOARD_DEFAULT_PAGES,
    normalizeDocument: (items, pages) => normalizeDashboardDocument(items, pages),
  });

  const allItems = savedLayout ?? [];
  const boards = savedPages ?? DASHBOARD_DEFAULT_PAGES;

  const [activeBoardId, setActiveBoardId] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_BOARD_LS) || DASHBOARD_BOARD_1;
    } catch {
      return DASHBOARD_BOARD_1;
    }
  });
  const [deleteMode, setDeleteMode] = useState(false);

  useEffect(() => {
    if (!boards.some((b) => b.id === activeBoardId)) {
      setActiveBoardId(boards[0]?.id ?? DASHBOARD_BOARD_1);
    }
  }, [boards, activeBoardId]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_BOARD_LS, activeBoardId);
    } catch {
      /* ignore */
    }
  }, [activeBoardId]);

  useEffect(() => {
    if (boards.length <= 2) setDeleteMode(false);
  }, [boards.length]);

  const layout = useMemo(
    () => allItems.filter((i) => (i.pageId ?? DASHBOARD_BOARD_1) === activeBoardId),
    [allItems, activeBoardId],
  );

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const allItemsRef = useRef(allItems);
  allItemsRef.current = allItems;
  const boardsRef = useRef(boards);
  boardsRef.current = boards;
  const activeBoardRef = useRef(activeBoardId);
  activeBoardRef.current = activeBoardId;

  const gridHandleRef = useRef<DashboardGridHandle | null>(null);
  const [mountKey, setMountKey] = useState(0);
  const [dockOpen, setDockOpen] = useState(false);
  const [draggingWidgetId, setDraggingWidgetId] = useState<WidgetId | null>(null);
  const [dockPlacing, setDockPlacing] = useState(false);
  const trashHoveredRef = useRef(false);
  const [trashHovered, setTrashHovered] = useState(false);

  const hiddenIds = useMemo(() => {
    const shown = new Set(layout.map((l) => l.id));
    return new Set((Object.keys(WIDGETS) as WidgetId[]).filter((id) => !shown.has(id)));
  }, [layout]);

  const persistBoardLayout = useCallback(
    (pageItems: LayoutItem[], nextPages?: GridLayoutPage[]) => {
      const boardId = activeBoardRef.current;
      const stamped = pageItems.map((i) => ({ ...i, pageId: boardId }));
      const others = allItemsRef.current.filter((i) => (i.pageId ?? DASHBOARD_BOARD_1) !== boardId);
      persistLayout([...others, ...stamped], nextPages ?? boardsRef.current);
    },
    [persistLayout],
  );

  const applyGridEditMode = useCallback(() => {
    const grid = gridHandleRef.current?.getGrid();
    const el = gridHandleRef.current?.getEl();
    if (!grid || !el) return;
    el.classList.add("dashboard-edit");
    grid.enableMove(true);
    grid.enableResize(true);
  }, []);

  const applyGridEditModeRef = useRef(applyGridEditMode);
  applyGridEditModeRef.current = applyGridEditMode;

  const handleAfterExternalDrop = useCallback(() => {
    applyGridEditModeRef.current();
  }, []);

  const layoutReady = savedLayout !== null;
  useEffect(() => {
    applyGridEditMode();
  }, [applyGridEditMode, mountKey, layoutReady, activeBoardId, layoutRevision]);

  useEffect(() => {
    document.body.classList.toggle("dashboard-trash-hovered", trashHovered);
    return () => document.body.classList.remove("dashboard-trash-hovered");
  }, [trashHovered]);

  const removeWidget = useCallback(
    (id: WidgetId) => {
      const next = layoutRef.current.filter((l) => l.id !== id);
      layoutRef.current = next;
      gridHandleRef.current?.syncLayoutBaseline(next);
      persistBoardLayout(next);
      const grid = gridHandleRef.current?.getGrid();
      if (grid) {
        const items = grid.getGridItems();
        const target = items.find((el) => {
          if (!el.classList.contains("grid-stack-item")) return false;
          if (el.classList.contains("dock-carousel-item")) return false;
          const nodeId = el.gridstackNode?.id ?? el.getAttribute("gs-id");
          return nodeId === id;
        });
        if (target) {
          try {
            gridHandleRef.current?.releaseWidgetRoot(id);
            grid.removeWidget(target, true, false);
          } catch {
            setMountKey((v) => v + 1);
          }
          return;
        }
      }
      setMountKey((v) => v + 1);
    },
    [persistBoardLayout],
  );

  const handleWidgetDragStop = useCallback(
    (id: WidgetId | null) => {
      if (id && trashHoveredRef.current) removeWidget(id);
      setDraggingWidgetId(null);
      trashHoveredRef.current = false;
      setTrashHovered(false);
    },
    [removeWidget],
  );

  const handleWidgetDragStart = useCallback((id: WidgetId | null) => {
    setDockOpen(false);
    setDraggingWidgetId(id);
  }, []);

  const addBoard = useCallback(() => {
    const current = boardsRef.current;
    if (current.length >= DASHBOARD_MAX_BOARDS) return;
    const n = current.length + 1;
    const id = `board-${n}-${Date.now().toString(36)}`;
    const nextPages = [...current, { id, name: String(n) }];
    persistLayout(allItemsRef.current, nextPages);
    setActiveBoardId(id);
    setDeleteMode(false);
    setMountKey((v) => v + 1);
  }, [persistLayout]);

  const deleteBoard = useCallback(
    (pageId: string) => {
      const current = boardsRef.current;
      if (current.length <= 2) return;
      const next = current.filter((p) => p.id !== pageId);
      // Drop widgets that lived only on the deleted board (don't rehome — dashboards are independent).
      const items = allItemsRef.current.filter((i) => (i.pageId ?? DASHBOARD_BOARD_1) !== pageId);
      persistLayout(items, next);
      setActiveBoardId((cur) => (cur === pageId ? next[0].id : cur));
      setMountKey((v) => v + 1);
      if (next.length <= 2) setDeleteMode(false);
    },
    [persistLayout],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="page-header mb-3 flex shrink-0 flex-wrap items-end justify-between gap-4">
        <h1 className="page-title editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Dashboard</h1>
        <div className="mb-0.5 flex flex-wrap items-center gap-1">
          {boards.map((board) => (
            <div key={board.id} className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  setActiveBoardId(board.id);
                  setMountKey((v) => v + 1);
                }}
                className={cn(
                  "grid h-7 min-w-7 place-items-center rounded-[0.5rem] border px-2 font-mono text-[0.6875rem] tabular-nums transition-colors",
                  activeBoardId === board.id
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                    : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]",
                  deleteMode && boards.length > 2 && "rounded-r-none border-r-0",
                )}
                aria-label={`Dashboard ${board.name}`}
                aria-current={activeBoardId === board.id ? "page" : undefined}
              >
                {board.name}
              </button>
              {deleteMode && boards.length > 2 && (
                <button
                  type="button"
                  onClick={() => deleteBoard(board.id)}
                  className="grid h-7 w-7 place-items-center rounded-r-[0.5rem] border border-[var(--color-line)] text-[var(--color-neg)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-neg)_16%,transparent)]"
                  aria-label={`Delete dashboard ${board.name}`}
                  title="Delete dashboard"
                >
                  <X size={12} strokeWidth={2.2} />
                </button>
              )}
            </div>
          ))}
          {boards.length < DASHBOARD_MAX_BOARDS && (
            <button
              type="button"
              onClick={addBoard}
              className="grid h-7 w-7 place-items-center rounded-[0.5rem] border border-dashed border-[var(--color-line)] text-[var(--color-text-lo)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
              aria-label="Add dashboard"
              title="Add dashboard"
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          )}
          {boards.length > 2 && (
            <button
              type="button"
              onClick={() => setDeleteMode((v) => !v)}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-[0.5rem] border transition-colors",
                deleteMode
                  ? "border-[var(--color-neg)]/50 bg-[color-mix(in_srgb,var(--color-neg)_12%,transparent)] text-[var(--color-neg)]"
                  : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]",
              )}
              aria-label={deleteMode ? "Done deleting" : "Delete a dashboard"}
              title={deleteMode ? "Done" : "Delete dashboard"}
            >
              <Trash2 size={13} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      {layoutError && (
        <div className="anim-banner surface mb-3 shrink-0 rounded-[0.875rem] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.06)] px-4 py-3 text-[0.8125rem] text-[var(--color-warn)]">
          {layoutError} Showing the default arrangement — changes may not be saved.
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!layoutReady ? (
          <PanelLoader message="Loading your layout" />
        ) : (
          <>
            {layout.length === 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-1 text-center"
                style={{ height: 480 }}
              >
                <p className="editorial text-[1.25rem] text-[var(--color-text-mid)]">Empty dashboard</p>
                <p className="text-[0.8125rem] text-[var(--color-text-lo)]">Use the menu below to add widgets.</p>
              </div>
            )}
            <DashboardGrid
              layout={layout}
              mountKey={`${mountKey}:${layoutRevision}:${activeBoardId}`}
              gridRef={gridHandleRef}
              onLayoutPersist={persistBoardLayout}
              onWidgetDragStart={handleWidgetDragStart}
              onWidgetDragStop={handleWidgetDragStop}
              onAfterExternalDrop={handleAfterExternalDrop}
            />
          </>
        )}
      </div>

      <CasePageArrows
        pages={boards}
        activePageId={activeBoardId}
        onSelect={(pageId) => {
          setActiveBoardId(pageId);
          setMountKey((v) => v + 1);
        }}
      />

      <DashboardActionBar
        visible={layoutReady && draggingWidgetId === null}
        dockOpen={dockOpen}
        onToggleDock={() => setDockOpen((o) => !o)}
        onResetLayout={() => {
          resetLayout();
          setActiveBoardId(DASHBOARD_BOARD_1);
          setDeleteMode(false);
          setMountKey((v) => v + 1);
        }}
      />

      <DragDock
        visible={draggingWidgetId !== null || dockPlacing}
        trashHovered={trashHovered}
        onTrashHoverChange={(h) => {
          trashHoveredRef.current = h;
          setTrashHovered(h);
        }}
      />

      <WidgetDock
        open={dockOpen}
        onClose={() => setDockOpen(false)}
        hiddenIds={hiddenIds}
        gridRef={gridHandleRef}
        gridMountKey={`${mountKey}:${layoutRevision}:${activeBoardId}`}
        onPlacingChange={setDockPlacing}
      />
    </div>
  );
}

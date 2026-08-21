import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardAddFab } from "@/components/dashboard/DashboardAddFab";
import { DragTrash } from "@/components/dashboard/DragTrash";
import { PanelLoader } from "@/components/ui/LoadingState";
import { useGridLayout } from "@/hooks/useGridLayout";
import {
  DASHBOARD_LEGACY_LS_KEY,
  DEFAULT_LAYOUT,
  WIDGETS,
  normalizeLayout,
  type LayoutItem,
  type WidgetId,
} from "./dashboard-widgets";
import { DashboardGrid, type DashboardGridHandle } from "./DashboardGrid";
import WidgetDock from "./WidgetDock";

export default function Dashboard() {
  const {
    layout: savedLayout,
    persist: persistLayout,
    revision: layoutRevision,
    error: layoutError,
  } = useGridLayout<LayoutItem>({
    surface: "dashboard",
    defaultLayout: DEFAULT_LAYOUT,
    normalize: normalizeLayout,
    legacyStorageKey: DASHBOARD_LEGACY_LS_KEY,
  });

  const layout = savedLayout ?? [];
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const gridHandleRef = useRef<DashboardGridHandle | null>(null);
  const [mountKey, setMountKey] = useState(0);
  const [dockOpen, setDockOpen] = useState(false);
  const [draggingWidgetId, setDraggingWidgetId] = useState<WidgetId | null>(
    null,
  );
  const [dockPlacing, setDockPlacing] = useState(false);
  const trashHoveredRef = useRef(false);
  const [trashHovered, setTrashHovered] = useState(false);

  const hiddenIds = useMemo(() => {
    const shown = new Set(layout.map((l) => l.id));
    return new Set(
      (Object.keys(WIDGETS) as WidgetId[]).filter((id) => !shown.has(id)),
    );
  }, [layout]);

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

  // Also keyed on layoutReady: the grid only mounts once the saved layout arrives.
  const layoutReady = savedLayout !== null;
  useEffect(() => {
    applyGridEditMode();
  }, [applyGridEditMode, mountKey, layoutReady]);

  useEffect(() => {
    document.body.classList.toggle("dashboard-trash-hovered", trashHovered);
    return () => document.body.classList.remove("dashboard-trash-hovered");
  }, [trashHovered]);

  const removeWidget = useCallback((id: WidgetId) => {
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
          grid.removeWidget(target, true, true);
        } catch {
          const next = layoutRef.current.filter((l) => l.id !== id);
          persistLayout(next);
          setMountKey((v) => v + 1);
        }
        return;
      }
    }
    const next = layoutRef.current.filter((l) => l.id !== id);
    persistLayout(next);
    setMountKey((v) => v + 1);
  }, [persistLayout]);

  const handleWidgetDragStop = useCallback(
    (id: WidgetId | null) => {
      if (id && trashHoveredRef.current) {
        removeWidget(id);
      }
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

  const toggleDock = () => {
    setDockOpen((open) => !open);
  };

  return (
    <div className="relative pb-28">
      <div className="page-header mb-4">
        <h1 className="page-title editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">
          Dashboard
        </h1>
      </div>

      {layoutError && (
        <div className="anim-banner surface mb-4 rounded-[0.875rem] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.06)] px-4 py-3 text-[0.8125rem] text-[var(--color-warn)]">
          {layoutError} Showing the default arrangement — changes may not be saved.
        </div>
      )}

      <div className="relative">
        {!layoutReady ? (
          <PanelLoader message="Loading your layout" />
        ) : (
          <>
            {layout.length === 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-1 text-center"
                style={{ height: 480 }}
              >
                <p className="editorial text-[1.25rem] text-[var(--color-text-mid)]">
                  Empty dashboard
                </p>
                <p className="text-[0.8125rem] text-[var(--color-text-lo)]">
                  Use the + button below to add widgets.
                </p>
              </div>
            )}
            <DashboardGrid
              layout={layout}
              mountKey={`${mountKey}:${layoutRevision}`}
              gridRef={gridHandleRef}
              onLayoutPersist={persistLayout}
              onWidgetDragStart={handleWidgetDragStart}
              onWidgetDragStop={handleWidgetDragStop}
              onAfterExternalDrop={handleAfterExternalDrop}
            />
          </>
        )}
      </div>

      <DashboardAddFab
        visible={layoutReady && !dockOpen && draggingWidgetId === null}
        onClick={toggleDock}
      />

      <DragTrash
        visible={draggingWidgetId !== null || dockPlacing}
        hovered={trashHovered}
        onHoverChange={(hovered) => {
          trashHoveredRef.current = hovered;
          setTrashHovered(hovered);
        }}
      />

      <WidgetDock
        open={dockOpen}
        hiddenIds={hiddenIds}
        gridRef={gridHandleRef}
        gridMountKey={mountKey}
        onClose={() => setDockOpen(false)}
        onPlacingChange={setDockPlacing}
      />
    </div>
  );
}

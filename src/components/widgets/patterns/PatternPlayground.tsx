import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GridStack, type GridStackNode, type GridStackOptions } from "gridstack";
import { cn } from "@/lib/cn";
import { designPx } from "@/lib/rem";
import { settleGridMetrics } from "@/lib/grid-stack-host";
import type { PatternId, PatternTheme } from "@/lib/pattern-size";
import { PATTERN_GRID_CELLS } from "@/lib/pattern-size";
import { catalogForTheme, renderPattern } from "@/components/widgets/patterns";
import { CELL_HEIGHT, COLUMNS, GRID_MARGIN } from "@/pages/dashboard-widgets";

type Placed = {
  id: string;
  patternId: PatternId;
  x: number;
  y: number;
  w: number;
  h: number;
};

type HostEl = HTMLElement & { gridstackNode?: GridStackNode };

/**
 * Real GridStack playground — drag by pattern header, resize like dashboard/case.
 */
export function PatternPlayground({ theme }: { theme: PatternTheme }) {
  const catalog = useMemo(() => catalogForTheme(theme), [theme]);
  const hostRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<GridStack | null>(null);
  const rootsRef = useRef(new Map<string, Root>());
  const placedRef = useRef<Placed[]>([]);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const [count, setCount] = useState(0);

  const nearestSize = useCallback(
    (patternId: PatternId, w: number, h: number) => {
      const def = catalogForTheme(themeRef.current).find((p) => p.id === patternId);
      const sizes = def?.sizes ?? ["M"];
      // Prefer the largest size that still fits the footprint.
      const fit = [...sizes].reverse().find((s) => {
        const c = PATTERN_GRID_CELLS[s];
        return c.cols <= w && c.rows <= h;
      });
      return fit ?? sizes[0];
    },
    [],
  );

  const paintNode = useCallback(
    (el: HTMLElement, patternId: PatternId, w: number, h: number) => {
      const content = (el.querySelector(":scope > .grid-stack-item-content") as HTMLElement | null) ?? el;
      let root = rootsRef.current.get(el.getAttribute("gs-id") ?? "");
      const id = el.getAttribute("gs-id") ?? "";
      if (!root) {
        root = createRoot(content);
        if (id) rootsRef.current.set(id, root);
      }
      const size = nearestSize(patternId, w, h);
      root.render(
        <div className="h-full w-full overflow-hidden">{renderPattern(patternId, size, themeRef.current)}</div>,
      );
    },
    [nearestSize],
  );

  const destroyGrid = useCallback(() => {
    for (const root of rootsRef.current.values()) {
      try {
        root.unmount();
      } catch {
        /* ignore */
      }
    }
    rootsRef.current.clear();
    const grid = gridRef.current;
    if (grid) {
      try {
        grid.destroy(true);
      } catch {
        /* ignore */
      }
      gridRef.current = null;
    }
    if (hostRef.current) hostRef.current.innerHTML = "";
  }, []);

  useEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl) return;

    destroyGrid();

    hostEl.classList.add("grid-stack", "min-h-[32rem]", "dashboard-edit");

    const opts: GridStackOptions = {
      column: COLUMNS,
      cellHeight: designPx(CELL_HEIGHT),
      margin: designPx(GRID_MARGIN),
      float: true,
      animate: false,
      disableResize: false,
      disableDrag: false,
      draggable: {
        handle: ".widget-shell-header",
        cancel: ".widget-shell-body,input,textarea,button,a,select",
        appendTo: "body",
      },
      resizable: { handles: "n,e,s,w,se,sw,ne,nw" },
    };

    const grid = GridStack.init(opts, hostEl);
    gridRef.current = grid;
    settleGridMetrics(grid, CELL_HEIGHT, GRID_MARGIN);

    GridStack.renderCB = (el, node) => {
      const id = String(node.id ?? "");
      const placed = placedRef.current.find((p) => p.id === id);
      if (!placed) return;
      paintNode(el, placed.patternId, node.w ?? placed.w, node.h ?? placed.h);
    };

    // Re-hydrate any items that survived a theme remount intent
    if (placedRef.current.length > 0) {
      // Drop placements whose pattern isn't in the new theme catalog
      const ids = new Set(catalogForTheme(theme).map((p) => p.id));
      placedRef.current = placedRef.current.filter((p) => ids.has(p.patternId));
      grid.load(
        placedRef.current.map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
          minW: 2,
          minH: 2,
        })),
      );
      setCount(placedRef.current.length);
    }

    const onChange = () => {
      const nodes = (grid.save(false) as GridStackNode[]) ?? [];
      placedRef.current = placedRef.current
        .map((p) => {
          const n = nodes.find((node) => node.id === p.id);
          if (!n) return p;
          return { ...p, x: n.x ?? p.x, y: n.y ?? p.y, w: n.w ?? p.w, h: n.h ?? p.h };
        })
        .filter((p) => nodes.some((n) => n.id === p.id));

      for (const p of placedRef.current) {
        const item = hostEl.querySelector(`.grid-stack-item[gs-id="${CSS.escape(p.id)}"]`) as HostEl | null;
        if (item) paintNode(item, p.patternId, p.w, p.h);
      }
      setCount(placedRef.current.length);
    };

    grid.on("change", onChange);
    grid.on("resizestop", onChange);
    grid.on("dragstop", onChange);

    const onResize = () => settleGridMetrics(grid, CELL_HEIGHT, GRID_MARGIN);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      try {
        grid.off("change");
        grid.off("resizestop");
        grid.off("dragstop");
      } catch {
        /* ignore */
      }
      destroyGrid();
    };
    // Re-init when theme changes so catalog + paint theme stay aligned
  }, [theme, destroyGrid, paintNode]);

  const add = (patternId: PatternId) => {
    const grid = gridRef.current;
    if (!grid) return;
    const def = catalog.find((p) => p.id === patternId);
    if (!def) return;
    const size = def.sizes.includes("M") ? "M" : def.sizes[0];
    const cells = PATTERN_GRID_CELLS[size];
    const id = `${patternId}-${Date.now()}`;
    const placed: Placed = {
      id,
      patternId,
      x: 0,
      y: 0,
      w: cells.cols,
      h: cells.rows,
    };
    placedRef.current = [...placedRef.current, placed];
    grid.addWidget({
      id,
      w: placed.w,
      h: placed.h,
      minW: 2,
      minH: 2,
      autoPosition: true,
    });
    const el = hostRef.current?.querySelector(`.grid-stack-item[gs-id="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (el) paintNode(el, patternId, placed.w, placed.h);
    setCount(placedRef.current.length);
  };

  const clear = () => {
    const grid = gridRef.current;
    if (!grid) return;
    for (const p of [...placedRef.current]) {
      const el = hostRef.current?.querySelector(`.grid-stack-item[gs-id="${CSS.escape(p.id)}"]`);
      if (el) grid.removeWidget(el as HTMLElement, true, false);
      const root = rootsRef.current.get(p.id);
      if (root) {
        try {
          root.unmount();
        } catch {
          /* ignore */
        }
        rootsRef.current.delete(p.id);
      }
    }
    placedRef.current = [];
    setCount(0);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {catalog.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => add(p.id)}
            className="rounded-[0.5rem] border border-[var(--color-line)] px-2 py-1 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-mid)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            + {p.label}
          </button>
        ))}
        {count > 0 && (
          <button
            type="button"
            onClick={clear}
            className="ml-auto rounded-[0.5rem] border border-[#f87171]/40 px-2 py-1 font-mono text-[0.5rem] uppercase tracking-wider text-[#f87171]"
          >
            Clear
          </button>
        )}
      </div>
      <p className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">
        Drag from the pattern header · resize from edges/corners · same GridStack as dashboard.
        {count === 0 && " Add a pattern to start."}
      </p>
      <div
        ref={hostRef}
        className={cn("rounded-[0.875rem] border border-dashed border-[var(--color-line)] p-1")}
      />
    </div>
  );
}

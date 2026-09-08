import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function BeamLoader({ className }: { className?: string }) {
  return (
    <div className={cn("load-beam", className)} aria-hidden>
      <span className="load-beam__pulse" />
    </div>
  );
}

export function LoadingCaption({ children }: { children: ReactNode }) {
  return <p className="load-caption">{children}</p>;
}

/** Centered panel loader — replaces lonely spinners in content areas. */
export function PanelLoader({ message = "Loading" }: { message?: string }) {
  return (
    <div className="surface h-full">
      <div className="load-panel" role="status" aria-live="polite" aria-busy="true">
        <BeamLoader className="load-panel__beam" />
        <LoadingCaption>{message}</LoadingCaption>
      </div>
    </div>
  );
}

type TableSkeletonProps = {
  colClass: string;
  /** Dynamic grid tracks (e.g. user-configured columns) — merged onto each row. */
  colStyle?: React.CSSProperties;
  headers: string[];
  rows?: number;
  widths?: string[];
};

/** Table-shaped skeleton — keeps layout stable while data fetches. */
export function TableSkeleton({ colClass, colStyle, headers, rows = 8, widths }: TableSkeletonProps) {
  const bar = (index: number) => widths?.[index] ?? (index === 2 ? "88%" : index === 0 ? "72%" : "64%");

  return (
    <div className="surface flex h-full min-h-0 flex-col overflow-hidden p-0" role="status" aria-live="polite" aria-busy="true">
      <div className={cn(colClass, "shrink-0 border-b border-[var(--color-line)] py-2.5")} style={colStyle}>
        {headers.map((header) => (
          <span key={header} className="eyebrow">
            {header}
          </span>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className={cn(
              colClass,
              "items-center py-2",
              row < rows - 1 && "border-b border-[var(--color-line)]",
            )}
            style={colStyle}
          >
            {headers.map((header, col) => (
              <div
                key={`${header}-${col}`}
                className="load-shimmer h-3 max-w-full rounded-[0.3125rem]"
                style={{ width: bar(col) }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-[var(--color-line)] px-5 py-3">
        <BeamLoader />
      </div>
    </div>
  );
}

/** Case detail skeleton — mirrors subject header + single-page widget grid. */
export function CaseDetailSkeleton() {
  return (
    <div className="case-detail-page" role="status" aria-live="polite" aria-busy="true">
      <div className="mb-4 shrink-0 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <div className="load-shimmer h-9 w-56 max-w-full rounded-[0.375rem]" />
          <div className="load-shimmer h-3.5 w-72 max-w-full rounded-[0.3125rem]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="load-shimmer h-8 w-20 rounded-[0.625rem]" />
          <div className="load-shimmer h-8 w-24 rounded-[0.625rem]" />
          <div className="load-shimmer h-8 w-20 rounded-full" />
        </div>
      </div>

      <div
        className="grid min-h-0 flex-1 gap-2"
        style={{
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gridTemplateRows: "repeat(9, minmax(0, 1fr))",
        }}
      >
        <div className="surface load-shimmer rounded-[0.625rem]" style={{ gridColumn: "1 / 5", gridRow: "1 / 4" }} />
        <div className="surface load-shimmer rounded-[0.625rem]" style={{ gridColumn: "5 / 7", gridRow: "1 / 4" }} />
        <div className="surface load-shimmer rounded-[0.625rem]" style={{ gridColumn: "7 / 10", gridRow: "1 / 4" }} />
        <div className="surface load-shimmer rounded-[0.625rem]" style={{ gridColumn: "10 / 13", gridRow: "1 / 4" }} />
        <div className="surface load-shimmer rounded-[0.625rem]" style={{ gridColumn: "1 / 4", gridRow: "4 / 10" }} />
        <div className="surface load-shimmer rounded-[0.625rem]" style={{ gridColumn: "4 / 7", gridRow: "4 / 7" }} />
        <div className="surface load-shimmer rounded-[0.625rem]" style={{ gridColumn: "7 / 10", gridRow: "4 / 7" }} />
        <div className="surface load-shimmer rounded-[0.625rem]" style={{ gridColumn: "10 / 13", gridRow: "4 / 10" }} />
        <div className="surface load-shimmer rounded-[0.625rem]" style={{ gridColumn: "4 / 7", gridRow: "7 / 10" }} />
        <div className="surface load-shimmer rounded-[0.625rem]" style={{ gridColumn: "7 / 10", gridRow: "7 / 10" }} />
      </div>
    </div>
  );
}

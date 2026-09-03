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

/** Case detail grid skeleton. */
export function CaseDetailSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4" role="status" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <div className="load-shimmer h-8 w-8 rounded-[0.5rem]" />
        <div className="load-shimmer h-4 w-28 rounded-[0.3125rem]" />
      </div>
      <div className="load-shimmer h-16 w-full max-w-xl rounded-[0.875rem]" />
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="surface load-shimmer min-h-[9rem] rounded-[0.875rem]" />
        ))}
      </div>
      <div className="flex justify-center pt-2">
        <BeamLoader className="w-40" />
      </div>
    </div>
  );
}

import { useEffect, useState, type DragEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

/** Monday-based grid of 42 cells covering the visible month. */
export function monthCells(year: number, month: number): Date[] {
  const first = startOfMonth(year, month);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first.getTime() - mondayOffset * DAY_MS);
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * DAY_MS));
}

export function MiniMonthCalendar({
  selectedIso,
  onSelect,
  coveredIsos,
  onViewChange,
  dropActive,
  onDayDragOver,
  onDayDrop,
  className,
}: {
  selectedIso: string;
  onSelect: (iso: string) => void;
  /** Days that already have at least one assignment (show a small dot). */
  coveredIsos?: ReadonlySet<string>;
  /** Fires when the visible month pane changes (incl. initial). */
  onViewChange?: (view: { year: number; month: number; from: string; to: string }) => void;
  /** Highlight days as drop targets while dragging an assignment. */
  dropActive?: boolean;
  onDayDragOver?: (iso: string, e: DragEvent) => void;
  onDayDrop?: (iso: string, e: DragEvent) => void;
  className?: string;
}) {
  const selected = new Date(`${selectedIso}T00:00:00`);
  const [viewYear, setViewYear] = useState(() => selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selected.getMonth());

  // Keep the month pane aligned when the parent jumps days (Today / arrows).
  useEffect(() => {
    const d = new Date(`${selectedIso}T00:00:00`);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [selectedIso]);

  useEffect(() => {
    const cells = monthCells(viewYear, viewMonth);
    onViewChange?.({
      year: viewYear,
      month: viewMonth,
      from: isoOf(cells[0]),
      to: isoOf(cells[41]),
    });
  }, [viewYear, viewMonth, onViewChange]);

  const todayIso = isoOf(new Date());
  const cells = monthCells(viewYear, viewMonth);
  const title = startOfMonth(viewYear, viewMonth).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <div className={cn("surface p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="grid h-7 w-7 place-items-center rounded-[0.375rem] text-[var(--color-text-mid)] transition-colors hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]"
        >
          <ChevronLeft size={14} strokeWidth={1.8} />
        </button>
        <div className="font-mono text-[0.6875rem] uppercase tracking-wider text-[var(--color-text-hi)]">{title}</div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="grid h-7 w-7 place-items-center rounded-[0.375rem] text-[var(--color-text-mid)] transition-colors hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]"
        >
          <ChevronRight size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-0.5 text-center font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d) => {
          const iso = isoOf(d);
          const inMonth = d.getMonth() === viewMonth;
          const isSelected = iso === selectedIso;
          const isToday = iso === todayIso;
          const covered = coveredIsos?.has(iso) ?? false;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              onDragOver={(e) => {
                if (!dropActive) return;
                e.preventDefault();
                onDayDragOver?.(iso, e);
              }}
              onDrop={(e) => {
                if (!dropActive) return;
                e.preventDefault();
                onDayDrop?.(iso, e);
              }}
              className={cn(
                "relative grid aspect-square place-items-center rounded-full font-mono text-[0.6875rem] transition-colors",
                !inMonth && "text-[var(--color-text-lo)]/50",
                inMonth && !isSelected && "text-[var(--color-text-mid)] hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]",
                isToday && !isSelected && "font-semibold text-[var(--color-accent-2)]",
                isSelected && "bg-[var(--color-accent)] text-white",
                dropActive && inMonth && "ring-1 ring-[rgba(74,127,255,0.45)]",
              )}
            >
              {d.getDate()}
              {covered && inMonth && (
                <span
                  className={cn(
                    "absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
                    isSelected ? "bg-white/90" : "bg-[var(--color-accent-2)]",
                  )}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

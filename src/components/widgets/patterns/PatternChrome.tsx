import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PatternSize } from "@/lib/pattern-size";

/** Labeled glass frame for Pattern Lab — size is explicit, not measured. */
export function PatternFrame({
  title,
  size,
  children,
  className,
  padded = true,
  theme = "glass",
  badge,
}: {
  title: string;
  size: PatternSize;
  children: ReactNode;
  className?: string;
  padded?: boolean;
  theme?: "glass" | "buzz";
  /** Unread / attention count — Theme B cue */
  badge?: number;
}) {
  const compact = size === "XS" || size === "S";
  const isBuzz = theme === "buzz";
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden",
        theme === "glass" ? "surface" : "pattern-buzz-frame",
        className,
      )}
      data-pattern-theme={theme}
    >
      <div
        className={cn(
          "widget-shell-header flex shrink-0 items-center justify-between gap-2 border-b",
          isBuzz
            ? "border-[var(--color-line-2)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
            : "border-[var(--color-line)]",
          compact ? "px-3 py-2" : "px-4 py-2.5",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              "min-w-0 truncate font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--color-text-hi)]",
              isBuzz && "tracking-[0.16em]",
            )}
          >
            {title}
          </div>
          {isBuzz && badge != null && badge > 0 && (
            <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-[var(--color-neg)] px-1 font-mono text-[0.5rem] font-bold leading-none text-white shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-ink-2)_80%,transparent)]">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-[0.375rem] border px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-wider",
            isBuzz
              ? "border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]"
              : "border-[var(--color-line-2)] text-[var(--color-text-lo)]",
          )}
        >
          {size}
        </span>
      </div>
      <div
        className={cn(
          "widget-shell-body flex min-h-0 flex-1 flex-col overflow-hidden",
          padded && (compact ? "p-3" : "p-3.5"),
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function MockPill({ children, color = "#38bdf8" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.5625rem] font-medium"
      style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      {children}
    </span>
  );
}

export function MockRailRow({
  title,
  subtitle,
  meta,
  accent = "var(--color-accent)",
  onClick,
  cozy = false,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  accent?: string;
  onClick?: () => void;
  cozy?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_40%,transparent)] text-left",
        cozy ? "px-2.5 py-2" : "px-2 py-1.5",
        onClick && "cursor-pointer transition-colors hover:border-[var(--color-line-2)]",
      )}
    >
      <span className="absolute inset-y-1.5 left-0 w-[0.15rem] rounded-full" style={{ background: accent }} aria-hidden />
      <div className="min-w-0 flex-1 pl-1.5">
        <div className="truncate text-[0.78125rem] font-medium text-[var(--color-text-hi)]">{title}</div>
        {subtitle && (
          <div className="truncate font-mono text-[0.5625rem] uppercase tracking-[0.08em] text-[var(--color-text-lo)]">
            {subtitle}
          </div>
        )}
      </div>
      {meta}
    </Tag>
  );
}

export type MetricAlign = "stack" | "center" | "end";

/** Metric tile — label on top, value centered by default (fixes wide lonely numbers). */
export function MockMetric({
  value,
  label,
  tone,
  align = "center",
  dense = false,
}: {
  value: string;
  label: string;
  tone?: string;
  align?: MetricAlign;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-[0.75rem] border border-[var(--color-line-2)] bg-[color-mix(in_srgb,var(--color-ink-3)_50%,transparent)]",
        dense ? "px-2 py-1.5" : "px-2.5 py-2",
        align === "center" && "items-center justify-center text-center",
        align === "end" && "items-end justify-center text-right",
        align === "stack" && "items-start justify-center text-left",
      )}
    >
      <div className="font-mono text-[0.5rem] uppercase leading-snug tracking-[0.12em] text-[var(--color-text-lo)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-semibold tabular-nums leading-none tracking-tight",
          dense ? "text-[1.125rem]" : "text-[1.375rem]",
        )}
        style={{ color: tone ?? "var(--color-text-hi)" }}
      >
        {value}
      </div>
    </div>
  );
}

export function MockBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="w-[5.5rem] shrink-0 truncate font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]"
        title={label}
      >
        {label}
      </span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-ink-3)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)]"
          style={{ width: `${Math.max(8, (value / max) * 100)}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-[0.75rem] tabular-nums text-[var(--color-text-hi)]">{value}</span>
    </div>
  );
}

export function MoreFooter({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 pt-0.5 text-center font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--color-text-lo)] transition-colors hover:text-[var(--color-text-hi)]"
    >
      +{count} more
    </button>
  );
}

/** Expand overflow lists without mid-body scrollbars on the widget. */
export function PatternExpandModal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close" onClick={onClose} />
      <div className="surface anim-modal relative z-10 flex max-h-[min(36rem,80vh)] w-full max-w-lg flex-col overflow-hidden rounded-[0.875rem] border border-[var(--color-line)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
          <div className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[var(--color-text-hi)]">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-[0.5rem] text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

import type { CSSProperties, ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { useWidgetLayout, type WidgetDensity } from "@/lib/widget-layout";

/**
 * Composition primitives for dashboard widgets.
 * Prefer these over free-form flex layouts — see useWidgetLayout().
 */

export function WidgetHero({
  value,
  label,
  delta,
  accent,
  children,
}: {
  value?: ReactNode;
  label?: string;
  delta?: string;
  accent?: string;
  children?: ReactNode;
}) {
  return (
    <div className="widget-hero flex h-full min-h-0 flex-col justify-center gap-2">
      {children ?? (
        <>
          <div
            className="editorial text-[2.25rem] leading-none tracking-tight tabular-nums"
            style={{ color: accent ?? "var(--color-text-hi)" }}
          >
            {value}
          </div>
          {label && (
            <div className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--color-text-lo)]">
              {label}
            </div>
          )}
          {delta && <div className="text-[0.75rem] leading-snug text-[var(--color-text-mid)]">{delta}</div>}
        </>
      )}
    </div>
  );
}

export function WidgetMetricStrip({
  metrics,
  columns,
  stretch = true,
}: {
  metrics: { key: string; label: string; value: ReactNode; tone?: string }[];
  columns?: 2 | 3 | 4;
  /** Fill remaining body height so metrics aren't stuck at the top of a tall card. */
  stretch?: boolean;
}) {
  const { density, pxWidth } = useWidgetLayout();
  const cols =
    columns ??
    (metrics.length <= 2 ? 2 : metrics.length === 3 ? 3 : density === "dense" || pxWidth < 320 ? 2 : 4);

  return (
    <div
      className={cn(
        "grid gap-2",
        stretch && "h-full auto-rows-fr content-stretch",
        cols === 2 && "grid-cols-2",
        cols === 3 && "grid-cols-3",
        cols === 4 && "grid-cols-2",
      )}
    >
      {metrics.map((m) => (
        <div
          key={m.key}
          className={cn(
            "widget-metric relative flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-[0.75rem] border border-[var(--color-line-2)] text-center",
            "bg-[color-mix(in_srgb,var(--color-ink-3)_50%,transparent)] px-2.5 py-2",
          )}
        >
          <div
            className="font-mono text-[0.5rem] uppercase leading-snug tracking-[0.12em] text-[var(--color-text-lo)]"
            title={m.label}
          >
            {m.label}
          </div>
          <div
            className="mt-1 text-[1.25rem] font-semibold tabular-nums leading-none tracking-tight"
            style={{ color: m.tone ?? "var(--color-text-hi)" }}
          >
            {m.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function WidgetFeed<T>({
  items,
  slots,
  total,
  getKey,
  renderItem,
  empty,
  onShowMore,
  /** How many items to mount in the scrollable list before "+N more". */
  scrollCap,
}: {
  items: T[];
  slots: number;
  total?: number;
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  empty?: ReactNode;
  /** Prefer this over a dead "+N more" label — expand modal or load more. */
  onShowMore?: () => void;
  scrollCap?: number;
}) {
  const safeSlots = Math.max(1, slots);
  // Mount a scrollable window (≥ visible slots, at least 8) so tall tiles show 4–5+
  // cards and the rest are reachable by scroll — not truncated to 2 with dead space.
  const cap = scrollCap ?? Math.max(safeSlots + 2, 8);
  const visible = items.slice(0, Math.min(items.length, cap));
  const remainder = Math.max(0, (total ?? items.length) - visible.length);

  if (items.length === 0) return <>{empty}</>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
      <ul
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden overscroll-contain",
          "[scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--color-line-2)_80%,transparent)_transparent]",
        )}
      >
        {visible.map((item, i) => (
          <li
            key={getKey(item)}
            className="widget-feed-row shrink-0"
            style={{ animationDelay: `${Math.min(i, 5) * 40}ms` } as CSSProperties}
          >
            {renderItem(item, i)}
          </li>
        ))}
      </ul>
      {remainder > 0 && (
        <button
          type="button"
          onClick={onShowMore}
          disabled={!onShowMore}
          className={cn(
            "shrink-0 pt-0.5 text-center font-mono text-[0.5625rem] uppercase tracking-[0.12em] transition-colors",
            onShowMore
              ? "text-[var(--color-accent-2)] hover:text-[var(--color-text-hi)]"
              : "cursor-default text-[var(--color-text-lo)]",
          )}
        >
          +{remainder} more
        </button>
      )}
    </div>
  );
}

export function WidgetMedia({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative h-full min-h-0 w-full overflow-hidden", className)}>{children}</div>;
}

/** Ops list row — quiet accent rail, no glow haze. */
export function WidgetFeedRow({
  title,
  subtitle,
  meta,
  accent = "var(--color-accent)",
  onClick,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="group relative flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_40%,transparent)] px-2 py-1.5 text-left transition-colors hover:border-[var(--color-line-2)] hover:bg-[color-mix(in_srgb,var(--color-ink-3)_62%,transparent)]"
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
    </button>
  );
}

export function WidgetSplit({
  primary,
  secondary,
  showSecondary,
  direction = "column",
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  showSecondary: boolean;
  direction?: "column" | "row";
}) {
  if (!showSecondary || !secondary) {
    return <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">{primary}</div>;
  }
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 gap-2.5 overflow-hidden",
        direction === "column" ? "flex-col" : "flex-col md:flex-row",
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{primary}</div>
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col overflow-hidden",
          direction === "column" ? "max-h-[40%] shrink-0" : "md:w-[42%] md:shrink-0",
        )}
      >
        {secondary}
      </div>
    </div>
  );
}

/** Featured intel / feed card with category color rail. */
export function IntelCard({
  title,
  summary,
  meta,
  accent = "#38bdf8",
  href,
  onClick,
  density = "comfortable",
  featured = false,
}: {
  title: string;
  summary?: string | null;
  meta?: ReactNode;
  accent?: string;
  href?: string | null;
  onClick?: () => void;
  density?: WidgetDensity;
  featured?: boolean;
}) {
  const open = () => {
    if (onClick) onClick();
    else if (href) window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={open}
      title={title}
      className={cn(
        "intel-card group relative w-full overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] text-left transition-colors",
        "bg-[color-mix(in_srgb,var(--color-ink-3)_45%,transparent)] hover:border-[var(--color-line-2)] hover:bg-[color-mix(in_srgb,var(--color-ink-3)_65%,transparent)]",
        featured ? "px-3 py-2.5" : "px-2.5 py-2",
      )}
    >
      <span className="absolute inset-y-1.5 left-0 w-[0.18rem] rounded-full" style={{ background: accent }} aria-hidden />
      {meta && <div className="relative mb-1 flex min-w-0 flex-wrap items-center gap-1.5 pl-2">{meta}</div>}
      <div
        className={cn(
          "relative pl-2 font-medium leading-snug text-[var(--color-text-hi)]",
          featured ? "text-[0.875rem] line-clamp-2" : density === "rich" ? "text-[0.78125rem] line-clamp-2" : "text-[0.78125rem] line-clamp-1",
        )}
      >
        {title}
      </div>
      {summary && density === "rich" && (
        <div className="relative mt-1 line-clamp-2 pl-2 text-[0.65625rem] leading-snug text-[var(--color-text-mid)]">
          {summary}
        </div>
      )}
      {href && (
        <ExternalLink
          size={11}
          className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-60"
          style={{ color: accent }}
        />
      )}
    </button>
  );
}

import type { ReactNode } from "react";
import { AlertTriangle, Loader2, Maximize2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useWidgetLayout } from "@/lib/widget-layout";
import { useWidgetSize } from "@/lib/widget-size";

/**
 * The one shell every new widget (dashboard + intel) is built on — a
 * unification of the dashboard's `Card`/`CardHeader` and case-detail's
 * `PanelShell`. Dense density automatically simplifies its own header so a
 * shrunk widget doesn't clip a full title + eyebrow + action row.
 *
 * Body content should use WidgetHero / WidgetMetricStrip / WidgetFeed /
 * WidgetMedia / WidgetSplit from WidgetChrome.tsx.
 */
export function WidgetShell({
  title,
  icon: Icon,
  eyebrow,
  action,
  onExpand,
  children,
  className,
  bodyClassName,
  padded = true,
  scroll = false,
}: {
  title: string;
  icon?: LucideIcon;
  eyebrow?: string;
  action?: ReactNode;
  /** Header expand control — opens a detail modal for widgets with overflow. */
  onExpand?: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  padded?: boolean;
  /** Prefer false: density recipes + expand modal beat mid-body scrollbars. */
  scroll?: boolean;
}) {
  const { density } = useWidgetLayout();
  const { tier } = useWidgetSize();
  const compact = density === "dense" || tier === "compact";

  return (
    <div className={cn("widget-shell surface flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div
        className={cn(
          "widget-shell-header shrink-0 flex items-center gap-2.5 border-b border-[var(--color-line)]",
          compact ? "px-3 py-2" : "px-4 py-2.5",
        )}
      >
        {Icon && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]/55 text-[var(--color-text-mid)]">
            <Icon size={compact ? 12 : 13} strokeWidth={1.8} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && !compact && (
            <div className="font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">
              {eyebrow}
            </div>
          )}
          <div
            className={cn(
              "truncate font-mono uppercase tracking-[0.14em] text-[var(--color-text-hi)]",
              compact ? "text-[0.625rem]" : "text-[0.6875rem]",
            )}
          >
            {title}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 normal-case tracking-normal">
          {action}
          {onExpand && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              className="grid h-7 w-7 place-items-center rounded-[0.5rem] text-[var(--color-text-lo)] transition-colors hover:bg-[var(--color-ink-3)]/60 hover:text-[var(--color-text-hi)]"
              aria-label={`Expand ${title}`}
              title="Expand"
            >
              <Maximize2 size={13} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>
      <div
        className={cn(
          "widget-shell-body flex min-h-0 flex-1 flex-col",
          scroll ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden",
          padded && (compact ? "p-3" : "p-4"),
          bodyClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Big-number hero stat — the standard "compact" tier body for most metric widgets. */
export function BigStat({
  value,
  label,
  tone = "default",
  delta,
  icon: Icon,
}: {
  value: ReactNode;
  label: string;
  tone?: "default" | "positive" | "negative" | "warning";
  delta?: string;
  icon?: LucideIcon;
}) {
  const toneColor: Record<string, string> = {
    default: "var(--color-text-hi)",
    positive: "#4ade80",
    negative: "#f87171",
    warning: "#f59e0b",
  };
  return (
    <div className="flex h-full flex-col items-start justify-center gap-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} strokeWidth={1.8} style={{ color: toneColor[tone] }} />}
        <span className="text-[2rem] font-semibold tabular-nums leading-none tracking-tight" style={{ color: toneColor[tone] }}>
          {value}
        </span>
      </div>
      <div className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</div>
      {delta && <div className="font-mono text-[0.625rem] text-[var(--color-text-mid)]">{delta}</div>}
    </div>
  );
}

/** Compact-tier row: label left, value right — used to stack 2-3 quick facts in a tight widget. */
export function StatRow({ label, value, tone }: { label: string; value: ReactNode; tone?: "positive" | "negative" | "warning" }) {
  const toneColor = tone
    ? { positive: "#4ade80", negative: "#f87171", warning: "#f59e0b" }[tone]
    : "var(--color-text-hi)";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</span>
      <span className="shrink-0 text-[0.8125rem] font-medium" style={{ color: toneColor }}>
        {value}
      </span>
    </div>
  );
}

/** Standard/expanded-tier stat grid — 2, 3 or 4 up. */
export function StatGrid({ cols = 2, children }: { cols?: 2 | 3 | 4; children: ReactNode }) {
  const colClass = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[cols];
  return <div className={cn("grid gap-3", colClass)}>{children}</div>;
}

export function StatTile({ value, label, tone = "default" }: { value: ReactNode; label: string; tone?: "default" | "positive" | "negative" | "warning" }) {
  const toneColor: Record<string, string> = {
    default: "var(--color-text-hi)",
    positive: "#4ade80",
    negative: "#f87171",
    warning: "#f59e0b",
  };
  return (
    <div className="flex flex-col items-center justify-center rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]/40 px-3 py-2.5 text-center">
      <div className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--color-text-lo)]">{label}</div>
      <div className="mt-1 text-[1.5rem] font-semibold tabular-nums leading-none tracking-tight" style={{ color: toneColor[tone] }}>
        {value}
      </div>
    </div>
  );
}

/** Horizontal bar-list — label, count, proportional bar. Used for service mix / region breakdowns / status buckets. */
export function MiniBarList({
  rows,
  colorFor,
}: {
  rows: { key: string; label: string; value: number }[];
  colorFor?: (key: string) => string | undefined;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.key} className="flex min-w-0 shrink-0 items-center gap-2">
          <span
            className="w-[6.5rem] shrink-0 truncate font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]"
            title={r.label}
          >
            {r.label}
          </span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-ink-3)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(6, (r.value / max) * 100)}%`,
                background: colorFor?.(r.key) ?? "var(--color-accent)",
              }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-[0.75rem] tabular-nums text-[var(--color-text-hi)]">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Stack of StatRows that fills tall tiles without leaving a weird empty middle. */
export function StatStack({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-col justify-center gap-2.5">{children}</div>;
}

export function WidgetLoading() {
  return (
    <div className="grid h-full min-h-[3rem] place-items-center">
      <Loader2 size={16} className="animate-spin text-[var(--color-text-lo)]" />
    </div>
  );
}

export function WidgetEmpty({ icon: Icon, label }: { icon?: LucideIcon; label: string }) {
  return (
    <div className="grid h-full min-h-[3rem] place-items-center gap-1.5 px-2 text-center">
      {Icon && <Icon size={16} strokeWidth={1.6} className="text-[var(--color-text-lo)]" />}
      <span className="max-w-[16rem] font-mono text-[0.65625rem] leading-snug text-[var(--color-text-lo)]">{label}</span>
    </div>
  );
}

export function WidgetErrorState({ message = "Couldn't load this widget." }: { message?: string }) {
  return (
    <div className="grid h-full min-h-[3rem] place-items-center gap-1.5 px-2 text-center">
      <AlertTriangle size={16} strokeWidth={1.6} className="text-[#f59e0b]" />
      <span className="max-w-[16rem] font-mono text-[0.65625rem] leading-snug text-[var(--color-text-lo)]">{message}</span>
    </div>
  );
}

/** Status/priority pill — background tint derived from a hex colour, consistent across every new widget. */
export function Pill({ children, color = "#94a3b8" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-medium"
      style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      {children}
    </span>
  );
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60_000);
  const suffix = ms >= 0 ? "ago" : "from now";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ${suffix}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ${suffix}`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ${suffix}`;
  const months = Math.round(days / 30);
  return `${months}mo ${suffix}`;
}

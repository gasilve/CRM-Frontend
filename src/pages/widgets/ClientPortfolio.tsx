import { Building2 } from "lucide-react";
import { clientsApi } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { cn } from "@/lib/cn";
import { WidgetHero } from "@/components/widgets/WidgetChrome";
import { WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

const SLICE_COLORS = ["var(--color-accent)", "#a78bfa", "var(--color-pos)", "var(--color-warn)", "#38bdf8", "#f87171"];

/** Share-of-book donut from top clients by open caseload. */
export function ClientPortfolio() {
  const { density, pxWidth } = useWidgetLayout();
  const { data, loading, error } = useQuery("dashboard:clients-summary", () => clientsApi.summary(), { staleMs: 60_000 });

  const top = data?.topByOpenCases ?? [];
  const totalOpen = Math.max(1, top.reduce((s, c) => s + c.openCases, 0));
  const slices = top.slice(0, 5).map((c, i) => ({
    id: c.id,
    label: c.company,
    count: c.openCases,
    pct: Math.round((c.openCases / totalOpen) * 100),
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
  // Fold remainder into Other when more than 5.
  const rest = top.slice(5).reduce((s, c) => s + c.openCases, 0);
  if (rest > 0) {
    slices.push({
      id: "other",
      label: "Other",
      count: rest,
      pct: Math.max(1, Math.round((rest / totalOpen) * 100)),
      color: "var(--color-text-lo)",
    });
  }
  // Normalize pct to ~100 for conic gradient.
  const pctSum = slices.reduce((s, x) => s + x.pct, 0) || 1;
  let cursor = 0;
  const stops = slices
    .map((s) => {
      const share = (s.pct / pctSum) * 100;
      const start = cursor;
      cursor += share;
      return `${s.color} ${start}% ${cursor}%`;
    })
    .join(", ");

  const horizontal = pxWidth >= 340 && density !== "dense";

  return (
    <WidgetShell title="Client Portfolio" icon={Building2} eyebrow="Share of book">
      {loading && !data ? (
        <WidgetLoading />
      ) : error || !data ? (
        <WidgetErrorState />
      ) : top.length === 0 ? (
        <WidgetEmpty icon={Building2} label="No client caseload yet." />
      ) : density === "dense" ? (
        <WidgetHero value={data.totalClients} label="Accounts" delta={`${data.activeClients} active`} />
      ) : (
        <div className={cn("flex h-full min-h-0 gap-3", horizontal ? "flex-row items-center" : "flex-col items-center justify-center")}>
          <div className="relative shrink-0">
            <div
              className={cn("rounded-full", horizontal ? "h-28 w-28" : "h-24 w-24")}
              style={{ background: `conic-gradient(${stops || "var(--color-line) 0% 100%"})` }}
            />
            <div className="absolute inset-[22%] grid place-items-center rounded-full bg-[var(--color-ink-2)]">
              <div className="text-center">
                <div className="font-mono text-[0.4375rem] uppercase text-[var(--color-text-lo)]">Open</div>
                <div className="text-[0.875rem] font-semibold tabular-nums text-[var(--color-text-hi)]">{totalOpen}</div>
              </div>
            </div>
          </div>
          <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1.5 overflow-hidden", !horizontal && "w-full")}>
            {slices.map((s) => (
              <div key={s.id} className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-[0.75rem] text-[var(--color-text-hi)]">{s.label}</span>
                <span className="shrink-0 font-mono text-[0.625rem] tabular-nums text-[var(--color-text-lo)]">{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

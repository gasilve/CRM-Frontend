import { useMemo, useState } from "react";
import { Users2 } from "lucide-react";
import { scheduleApi, REGION_LABELS, type Region } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { cn } from "@/lib/cn";
import { WidgetHero, WidgetMetricStrip } from "@/components/widgets/WidgetChrome";
import { WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Coverage hybrid: hero/metrics at small sizes; metrics + roster at L+. */
export function FieldCoverageToday() {
  const { density, showSecondary, slots } = useWidgetLayout({ rowPx: 28, reservedPx: 88 });
  const today = todayIso();
  const { data, loading, error } = useQuery(`dashboard:schedule-today:${today}`, () => scheduleApi.list({ from: today, to: today }), {
    staleMs: 30_000,
  });

  const blocks = data?.blocks ?? [];
  const byUser = useMemo(() => {
    const map = new Map<string, { name: string; cases: string[]; region: string | null }>();
    for (const b of blocks) {
      const cur = map.get(b.userId) ?? { name: b.user.name, cases: [], region: b.user.region };
      if (!cur.cases.includes(b.case.caseNumber)) cur.cases.push(b.case.caseNumber);
      map.set(b.userId, cur);
    }
    return [...map.values()];
  }, [blocks]);

  const investigatorIds = new Set(blocks.map((b) => b.userId));
  const caseIds = new Set(blocks.map((b) => b.caseId));
  const rushToday = blocks.filter((b) => b.case.priority === "rush" && b.case.status !== "closed");
  const onCase = byUser.filter((u) => u.cases.length > 0).length;

  return (
    <WidgetShell title="Field Coverage Today" icon={Users2} eyebrow="Scheduling">
      {loading && !data ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetErrorState />
      ) : blocks.length === 0 ? (
        <WidgetEmpty icon={Users2} label="No one scheduled today." />
      ) : density === "dense" ? (
        <WidgetHero
          value={investigatorIds.size}
          label="In the field today"
          delta={`${onCase} on case · ${rushToday.length} rush`}
        />
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          <WidgetMetricStrip
            stretch={false}
            columns={3}
            metrics={[
              { key: "field", label: "In field", value: investigatorIds.size },
              { key: "on", label: "On case", value: onCase, tone: "var(--color-pos)" },
              { key: "cases", label: "Cases", value: caseIds.size },
            ]}
          />
          {showSecondary && (
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
              <div className="shrink-0 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--color-text-lo)]">
                Roster · {byUser.length}
              </div>
              {byUser.slice(0, Math.max(3, slots)).map((u) => (
                <div key={u.name} className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[0.75rem] text-[var(--color-text-hi)]">{u.name}</div>
                    <div className="truncate font-mono text-[0.5rem] uppercase text-[var(--color-text-lo)]">
                      {u.region ? REGION_LABELS[u.region as Region] ?? u.region : "Unassigned"} · {u.cases[0]}
                      {u.cases.length > 1 ? ` +${u.cases.length - 1}` : ""}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.4375rem] uppercase",
                      "bg-[color-mix(in_srgb,var(--color-pos)_16%,transparent)] text-[var(--color-pos)]",
                    )}
                  >
                    On case
                  </span>
                </div>
              ))}
              {rushToday.length > 0 && (
                <div className="mt-auto shrink-0 rounded-[0.5rem] bg-[rgba(248,113,113,0.12)] px-2 py-1.5 font-mono text-[0.625rem] text-[#f87171]">
                  {rushToday.length} rush covered today
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

import { Clock } from "lucide-react";
import { casesApi } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { WidgetHero } from "@/components/widgets/WidgetChrome";
import { WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

/** Age-band tiles — 0–7 / 8–14 / 15–30 / 30+. */
export function CaseAgingTurnaround() {
  const { density } = useWidgetLayout();
  const { data, loading, error } = useQuery("dashboard:cases-aging", () => casesApi.aging(), { staleMs: 60_000 });

  const buckets = [
    { key: "d0_7", label: "0–7d", value: data?.buckets?.d0_7 ?? 0, tone: "var(--color-pos)" },
    { key: "d8_14", label: "8–14d", value: data?.buckets?.d8_14 ?? 0, tone: "var(--color-accent)" },
    { key: "d15_30", label: "15–30d", value: data?.buckets?.d15_30 ?? 0, tone: "var(--color-warn)" },
    { key: "d30p", label: "30d+", value: data?.buckets?.d30p ?? 0, tone: "var(--color-neg)" },
  ];

  return (
    <WidgetShell title="Aging Buckets" icon={Clock} eyebrow="Operations">
      {loading && !data ? (
        <WidgetLoading />
      ) : error || !data ? (
        <WidgetErrorState />
      ) : density === "dense" ? (
        <WidgetHero value={`${data.avgOpenDays}d`} label="Avg. days open" delta={`oldest ${data.oldestOpenDays}d`} />
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          <div className="flex shrink-0 items-baseline justify-between gap-2">
            <div>
              <div className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--color-text-lo)]">
                Avg turnaround
              </div>
              <div className="text-[1.25rem] font-semibold tabular-nums leading-none text-[var(--color-text-hi)]">
                {data.avgOpenDays}d
              </div>
            </div>
            <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">{data.openCount} open</span>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
            {buckets.map((b) => (
              <div
                key={b.key}
                className="flex min-h-[2.75rem] flex-col items-center justify-center gap-1 overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_40%,transparent)] px-2 py-2 text-center"
              >
                <div className="text-[1.125rem] font-semibold tabular-nums leading-none" style={{ color: b.tone }}>
                  {b.value}
                </div>
                <div className="font-mono text-[0.4375rem] uppercase leading-none tracking-[0.1em] text-[var(--color-text-lo)]">
                  {b.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

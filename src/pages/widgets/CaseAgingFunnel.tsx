import { Filter } from "lucide-react";
import { casesApi } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { WidgetHero, WidgetMetricStrip } from "@/components/widgets/WidgetChrome";
import { MiniBarList, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

/** KPI strip + horizontal age funnel. */
export function CaseAgingFunnel() {
  const { density, pxHeight } = useWidgetLayout();
  const { data, loading, error } = useQuery("dashboard:cases-aging", () => casesApi.aging(), { staleMs: 60_000 });

  const rows = [
    { key: "d0_7", label: "0–7 days", value: data?.buckets?.d0_7 ?? 0 },
    { key: "d8_14", label: "8–14 days", value: data?.buckets?.d8_14 ?? 0 },
    { key: "d15_30", label: "15–30 days", value: data?.buckets?.d15_30 ?? 0 },
    { key: "d30p", label: "30+ days", value: data?.buckets?.d30p ?? 0 },
  ];
  // Drop lowest-priority empty bands when the tile is short so the last row never clips.
  const visibleRows =
    pxHeight < 220 ? rows.filter((r) => r.value > 0 || r.key === "d0_7" || r.key === "d30p").slice(0, 3) : rows;

  return (
    <WidgetShell title="Aging Funnel" icon={Filter} eyebrow="Operations">
      {loading && !data ? (
        <WidgetLoading />
      ) : error || !data ? (
        <WidgetErrorState />
      ) : density === "dense" ? (
        <WidgetHero
          value={`${data.avgOpenDays}d`}
          label="Avg open"
          delta={`${data.buckets?.d30p ?? 0} at 30d+`}
          accent={(data.buckets?.d30p ?? 0) > 0 ? "var(--color-neg)" : undefined}
        />
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          <WidgetMetricStrip
            stretch={false}
            columns={3}
            metrics={[
              { key: "avg", label: "Avg", value: `${data.avgOpenDays}d` },
              { key: "p95", label: "P95", value: `${data.p95OpenDays ?? data.oldestOpenDays}d` },
              {
                key: "old",
                label: "30d+",
                value: data.buckets?.d30p ?? 0,
                tone: (data.buckets?.d30p ?? 0) > 0 ? "var(--color-neg)" : undefined,
              },
            ]}
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            <MiniBarList rows={visibleRows} />
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

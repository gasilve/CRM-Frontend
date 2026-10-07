import { FolderKanban } from "lucide-react";
import { casesApi } from "@/lib/crm-api";
import { prodigySummary } from "@/lib/prodigy-api";

const USE_PRODIGY = import.meta.env.VITE_USE_PRODIGY_BACKEND === "true";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { WidgetHero, WidgetMetricStrip } from "@/components/widgets/WidgetChrome";
import { MiniBarList, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

const SHORT_SERVICE: Record<string, string> = {
  surveillance: "Surveil",
  workers_comp: "WC",
  social_media: "Social",
  fmla: "FMLA",
  background: "BG",
};

/** Metric-over-bars: status strip + scrollable service mix. */
export function CaseloadOverview() {
  const { density, pxHeight } = useWidgetLayout();
  const { data, loading, error } = useQuery("dashboard:cases-summary", () => USE_PRODIGY ? prodigySummary() : casesApi.summary(), { staleMs: 30_000 });
  // Need room for 2×2 metrics (~120px) + at least one full bar row — otherwise metrics only.
  const showBars = pxHeight >= 240;

  return (
    <WidgetShell title="Caseload Overview" icon={FolderKanban} eyebrow="Operations">
      {loading && !data ? (
        <WidgetLoading />
      ) : error || !data ? (
        <WidgetErrorState />
      ) : density === "dense" ? (
        <WidgetHero
          value={data.openCount}
          label="Open cases"
          delta={`${data.rushCount} rush · ${data.overdueCount} overdue`}
        />
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          <div className={showBars ? "max-h-[58%] shrink-0 overflow-hidden" : "min-h-0 flex-1"}>
            <WidgetMetricStrip
              stretch={!showBars}
              columns={2}
              metrics={[
                { key: "open", label: "Open", value: data.openCount },
                { key: "susp", label: "Suspended", value: data.suspendedCount, tone: "#f59e0b" },
                { key: "closed", label: "Closed", value: data.closedCount },
                {
                  key: "over",
                  label: "Overdue",
                  value: data.overdueCount,
                  tone: data.overdueCount > 0 ? "#f87171" : undefined,
                },
              ]}
            />
          </div>
          {showBars && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="mb-1.5 shrink-0 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                Service mix · open
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
                <MiniBarList
                  rows={data.byService
                    .filter((s) => s.count > 0)
                    .sort((a, b) => b.count - a.count)
                    .map((s) => ({
                      key: s.service,
                      label: SHORT_SERVICE[s.service] ?? SERVICE_LABELS[s.service] ?? s.service,
                      value: s.count,
                    }))}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

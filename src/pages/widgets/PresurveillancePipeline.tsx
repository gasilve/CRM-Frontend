import { useWidgetNavigate } from "@/lib/widget-bridge";
import { Radar } from "lucide-react";
import { casesApi } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { WidgetFeed, WidgetFeedRow, WidgetHero, WidgetSplit } from "@/components/widgets/WidgetChrome";
import { MiniBarList, Pill, WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  skipped: "Skipped",
  fetched: "Fetched",
};

export function PresurveillancePipeline() {
  const { density, secondarySlots, showSecondary } = useWidgetLayout({ rowPx: 44 });
  const navigate = useWidgetNavigate();
  const { data, loading, error } = useQuery("dashboard:presurveillance", () => casesApi.presurveillanceSummary(), { staleMs: 30_000 });

  const hasStuck = (data?.stuck.length ?? 0) > 0;

  return (
    <WidgetShell title="Pre-surveillance Pipeline" icon={Radar} eyebrow="Research">
      {loading && !data ? (
        <WidgetLoading />
      ) : error || !data ? (
        <WidgetErrorState />
      ) : data.byStatus.every((s) => s.count === 0) ? (
        <WidgetEmpty icon={Radar} label="No pre-surveillance in flight." />
      ) : density === "dense" ? (
        <WidgetHero
          value={data.stuckCount}
          label="Stuck > 5 days"
          accent={data.stuckCount > 0 ? "#f59e0b" : "#4ade80"}
        />
      ) : (
        <WidgetSplit
          showSecondary={showSecondary && hasStuck}
          primary={
            <div className="flex h-full min-h-0 flex-col justify-center gap-2">
              <MiniBarList
                rows={data.byStatus.map((s) => ({
                  key: s.status,
                  label: STATUS_LABEL[s.status] ?? s.status,
                  value: s.count,
                }))}
              />
              {!hasStuck && (
                <div className="mt-2 rounded-[0.5rem] border border-[var(--color-line)] px-2.5 py-2 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                  No cases stuck &gt; 5 days
                </div>
              )}
            </div>
          }
          secondary={
            <div className="flex h-full min-h-0 flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                  Stuck cases
                </span>
                {data.stuckCount > 0 && <Pill color="#f59e0b">{data.stuckCount}</Pill>}
              </div>
              <WidgetFeed
                items={data.stuck}
                slots={secondarySlots}
                getKey={(c) => c.presurveillanceId}
                empty={<WidgetEmpty label="Nothing stuck." />}
                renderItem={(c) => (
                  <WidgetFeedRow
                    title={c.subjectName}
                    subtitle={c.caseNumber}
                    accent="#f59e0b"
                    onClick={() => navigate(`/cases/${c.id}`)}
                  />
                )}
              />
            </div>
          }
        />
      )}
    </WidgetShell>
  );
}

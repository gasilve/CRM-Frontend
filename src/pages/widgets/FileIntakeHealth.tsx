import { useState } from "react";
import { useWidgetNavigate } from "@/lib/widget-bridge";
import { FileWarning } from "lucide-react";
import { casesApi } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { WidgetFeed, WidgetFeedRow, WidgetHero, WidgetMetricStrip } from "@/components/widgets/WidgetChrome";
import { WidgetExpandModal } from "@/components/widgets/WidgetExpandModal";
import { MiniBarList, WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

/** Bars-fill: storage mix + failed queue. */
export function FileIntakeHealth() {
  const [expanded, setExpanded] = useState(false);
  const { density, slots } = useWidgetLayout({ rowPx: 44, reservedPx: 96 });
  const navigate = useWidgetNavigate();
  const { data, loading, error } = useQuery("dashboard:files-health", () => casesApi.filesHealth(), { staleMs: 30_000 });

  return (
    <WidgetShell
      title="Evidence & File Health"
      icon={FileWarning}
      eyebrow="Evidence"
      onExpand={(data?.failed.length ?? 0) > 0 ? () => setExpanded(true) : undefined}
    >
      {loading && !data ? (
        <WidgetLoading />
      ) : error || !data ? (
        <WidgetErrorState />
      ) : density === "dense" ? (
        <WidgetHero
          value={data.failedCount}
          label="Failed uploads"
          accent={data.failedCount > 0 ? "#f87171" : "#4ade80"}
          delta={`${data.last24h} added last 24h`}
        />
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-2">
          <WidgetMetricStrip
            stretch={false}
            columns={3}
            metrics={[
              { key: "t", label: "Total", value: data.total },
              { key: "d", label: "24h", value: data.last24h },
              {
                key: "f",
                label: "Failed",
                value: data.failedCount,
                tone: data.failedCount > 0 ? "#f87171" : undefined,
              },
            ]}
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="mb-1.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
              Storage
            </div>
            <MiniBarList rows={data.byStorage.map((s) => ({ key: s.storage, label: s.storage, value: s.count }))} />
          </div>
          {data.failed.length > 0 && (
            <WidgetFeed
              items={data.failed}
              slots={Math.max(1, Math.min(2, slots))}
              getKey={(f) => f.id}
              onShowMore={() => setExpanded(true)}
              renderItem={(f) => (
                <WidgetFeedRow
                  title={f.filename}
                  subtitle={f.case.caseNumber}
                  accent="#f87171"
                  onClick={() => navigate(`/cases/${f.case.id}`)}
                />
              )}
            />
          )}
        </div>
      )}
      <WidgetExpandModal title="Failed uploads" open={expanded} onClose={() => setExpanded(false)}>
        {(data?.failed ?? []).map((f) => (
          <WidgetFeedRow
            key={f.id}
            title={f.filename}
            subtitle={f.case.caseNumber}
            accent="#f87171"
            onClick={() => navigate(`/cases/${f.case.id}`)}
          />
        ))}
        {(data?.failed.length ?? 0) === 0 && <WidgetEmpty label="No failed files." />}
      </WidgetExpandModal>
    </WidgetShell>
  );
}

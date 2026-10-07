import { useState } from "react";
import { useWidgetNavigate } from "@/lib/widget-bridge";
import { AlertOctagon } from "lucide-react";
import { casesApi } from "@/lib/crm-api";
import { prodigyCases } from "@/lib/prodigy-api";

const USE_PRODIGY = import.meta.env.VITE_USE_PRODIGY_BACKEND === "true";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { WidgetFeed, WidgetFeedRow, WidgetHero, WidgetMetricStrip } from "@/components/widgets/WidgetChrome";
import { WidgetExpandModal } from "@/components/widgets/WidgetExpandModal";
import { Pill, WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

const priorityColor = (overdue: boolean) => (overdue ? "var(--color-neg)" : "var(--color-warn)");

/** Rush & Overdue — metric-over-list: Pending / Active / Overdue + queue. */
export function RushOverdueQueue() {
  const [expanded, setExpanded] = useState(false);
  const { density, slots } = useWidgetLayout({ rowPx: 48, reservedPx: 88 });
  const navigate = useWidgetNavigate();
  const { data, loading, error } = useQuery("dashboard:cases-urgent", () => casesApi.urgent(), { staleMs: 30_000 });
  const summary = useQuery("dashboard:cases-summary", () => casesApi.summary(), { staleMs: 30_000 });
  const rows = data?.cases ?? [];

  const pending = summary.data?.suspendedCount ?? 0;
  const active = summary.data?.openCount ?? rows.length;
  const overdue = data?.overdueCount ?? rows.filter((c) => (c.daysOverdue ?? 0) > 0).length;

  const renderRow = (c: (typeof rows)[0]) => {
    const isOverdue = c.daysOverdue != null && c.daysOverdue > 0;
    const accent = priorityColor(isOverdue);
    return (
      <WidgetFeedRow
        title={c.subjectName}
        subtitle={`${c.caseNumber} · ${SERVICE_LABELS[c.service] ?? c.service}`}
        accent={accent}
        onClick={() => navigate(`/cases/${c.id}`)}
        meta={<Pill color={accent}>{isOverdue ? `${c.daysOverdue}d late` : c.priority}</Pill>}
      />
    );
  };

  return (
    <WidgetShell
      title="Rush & Overdue"
      icon={AlertOctagon}
      eyebrow="Operations"
      onExpand={rows.length > 0 ? () => setExpanded(true) : undefined}
    >
      {loading && !data ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetErrorState />
      ) : rows.length === 0 ? (
        <WidgetEmpty icon={AlertOctagon} label="Nothing overdue — clean queue." />
      ) : density === "dense" ? (
        <WidgetHero
          value={rows.length}
          label="Need attention"
          accent={overdue > 0 ? "var(--color-neg)" : "var(--color-warn)"}
        />
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          <WidgetMetricStrip
            stretch={false}
            columns={3}
            metrics={[
              { key: "p", label: "Pending", value: pending, tone: "var(--color-warn)" },
              { key: "a", label: "Active", value: active },
              { key: "o", label: "Overdue", value: overdue, tone: overdue > 0 ? "var(--color-neg)" : undefined },
            ]}
          />
          <WidgetFeed
            items={rows}
            slots={Math.max(2, slots)}
            getKey={(c) => c.id}
            onShowMore={() => setExpanded(true)}
            renderItem={(c) => renderRow(c)}
          />
        </div>
      )}
      <WidgetExpandModal title="Rush & Overdue" open={expanded} onClose={() => setExpanded(false)}>
        {rows.map((c) => (
          <div key={c.id}>{renderRow(c)}</div>
        ))}
      </WidgetExpandModal>
    </WidgetShell>
  );
}

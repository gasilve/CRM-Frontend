import { useState } from "react";
import { useWidgetNavigate } from "@/lib/widget-bridge";
import { AlertOctagon } from "lucide-react";
import { casesApi } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { WidgetFeed, WidgetFeedRow, WidgetHero } from "@/components/widgets/WidgetChrome";
import { WidgetExpandModal } from "@/components/widgets/WidgetExpandModal";
import { Pill, WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

/**
 * Formerly Pending Intake — replaced with a Rush & Overdue stack list
 * (intake felt redundant next to the metric-over-list rush widget).
 */
export function PendingIntakeInbox() {
  const [expanded, setExpanded] = useState(false);
  const { density, slots } = useWidgetLayout({ rowPx: 48 });
  const navigate = useWidgetNavigate();
  const { data, loading, error } = useQuery("dashboard:cases-urgent", () => casesApi.urgent(), { staleMs: 30_000 });
  const rows = data?.cases ?? [];

  const renderRow = (c: (typeof rows)[0]) => {
    const overdue = c.daysOverdue != null && c.daysOverdue > 0;
    const accent = overdue ? "var(--color-neg)" : "var(--color-warn)";
    return (
      <WidgetFeedRow
        title={c.subjectName}
        subtitle={`${c.caseNumber} · ${SERVICE_LABELS[c.service] ?? c.service}`}
        accent={accent}
        onClick={() => navigate(`/cases/${c.id}`)}
        meta={<Pill color={accent}>{overdue ? `${c.daysOverdue}d late` : c.priority}</Pill>}
      />
    );
  };

  return (
    <WidgetShell
      title="Rush Queue"
      icon={AlertOctagon}
      eyebrow="Operations"
      onExpand={rows.length > 0 ? () => setExpanded(true) : undefined}
    >
      {loading && !data ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetErrorState />
      ) : rows.length === 0 ? (
        <WidgetEmpty icon={AlertOctagon} label="Nothing in the rush queue." />
      ) : density === "dense" ? (
        <WidgetHero value={rows.length} label="Rush / overdue" accent="var(--color-warn)" />
      ) : (
        <WidgetFeed
          items={rows}
          slots={slots}
          getKey={(c) => c.id}
          onShowMore={() => setExpanded(true)}
          renderItem={(c) => renderRow(c)}
        />
      )}
      <WidgetExpandModal title="Rush Queue" open={expanded} onClose={() => setExpanded(false)}>
        {rows.map((c) => (
          <div key={c.id}>{renderRow(c)}</div>
        ))}
      </WidgetExpandModal>
    </WidgetShell>
  );
}

import { useState } from "react";
import { useWidgetNavigate } from "@/lib/widget-bridge";
import { UserCheck } from "lucide-react";
import { casesApi } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { useAuth } from "@/contexts/AuthContext";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { WidgetFeed, WidgetFeedRow, WidgetHero } from "@/components/widgets/WidgetChrome";
import { WidgetExpandModal } from "@/components/widgets/WidgetExpandModal";
import { Pill, WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

const priorityColor: Record<string, string> = { rush: "#f87171", standard: "#94a3b8", low: "#64748b" };

export function MyActiveCases() {
  const [expanded, setExpanded] = useState(false);
  const { density, slots } = useWidgetLayout({ rowPx: 52 });
  const navigate = useWidgetNavigate();
  const { user } = useAuth();
  const { data, loading, error } = useQuery(
    user ? `dashboard:my-cases:${user.id}` : null,
    () => casesApi.list({ assignedTo: user!.id, status: "open", sortBy: "dueDate", sortDir: "asc", pageSize: 25 }),
    { staleMs: 30_000, enabled: !!user },
  );
  const cases = data?.cases ?? [];

  const renderRow = (c: (typeof cases)[0]) => (
    <WidgetFeedRow
      title={c.subjectName}
      subtitle={`${c.caseNumber} · ${SERVICE_LABELS[c.service] ?? c.service}`}
      accent={priorityColor[c.priority] ?? "#94a3b8"}
      onClick={() => navigate(`/cases/${c.id}`)}
      meta={<Pill color={priorityColor[c.priority] ?? "#94a3b8"}>{c.priority}</Pill>}
    />
  );

  return (
    <WidgetShell
      title="My Active Cases"
      icon={UserCheck}
      eyebrow="My queue"
      onExpand={cases.length > 0 ? () => setExpanded(true) : undefined}
    >
      {loading && !data ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetErrorState />
      ) : cases.length === 0 ? (
        <WidgetEmpty icon={UserCheck} label="No open cases assigned to you." />
      ) : density === "dense" ? (
        <WidgetHero
          value={cases.length}
          label="Assigned to me"
          delta={`${cases.filter((c) => c.priority === "rush").length} rush`}
        />
      ) : (
        <WidgetFeed
          items={cases}
          slots={slots}
          getKey={(c) => c.id}
          onShowMore={() => setExpanded(true)}
          renderItem={(c) => renderRow(c)}
        />
      )}
      <WidgetExpandModal title="My Active Cases" open={expanded} onClose={() => setExpanded(false)}>
        {cases.map((c) => (
          <div key={c.id}>{renderRow(c)}</div>
        ))}
      </WidgetExpandModal>
    </WidgetShell>
  );
}

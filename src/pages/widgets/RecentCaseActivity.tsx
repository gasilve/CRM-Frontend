import { useState } from "react";
import { useWidgetNavigate } from "@/lib/widget-bridge";
import { Activity, Briefcase, Camera, Car, Home, MessageSquare, ScanFace, StickyNote } from "lucide-react";
import { casesApi, type CaseDayEntryType } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { WidgetFeed, WidgetFeedRow, WidgetHero } from "@/components/widgets/WidgetChrome";
import { WidgetExpandModal } from "@/components/widgets/WidgetExpandModal";
import { WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell, relativeTime } from "@/components/widgets/WidgetShell";

const ENTRY_ICON: Record<CaseDayEntryType, typeof StickyNote> = {
  note: StickyNote,
  qa: MessageSquare,
  photo_person: Camera,
  photo_vehicle: Car,
  photo_home: Home,
  face_match: ScanFace,
  manager_note: Briefcase,
};

const ENTRY_LABEL: Record<CaseDayEntryType, string> = {
  note: "logged a note",
  qa: "answered a question",
  photo_person: "added a subject photo",
  photo_vehicle: "added a vehicle photo",
  photo_home: "added a home photo",
  face_match: "ran a face match",
  manager_note: "left an office note",
};

export function RecentCaseActivity() {
  const [expanded, setExpanded] = useState(false);
  const { density, slots } = useWidgetLayout({ rowPx: 48 });
  const navigate = useWidgetNavigate();
  const { data, loading, error } = useQuery("dashboard:journal-recent", () => casesApi.journalRecent(), { staleMs: 20_000 });
  const entries = data?.entries ?? [];

  const renderRow = (e: (typeof entries)[0]) => {
    const Icon = ENTRY_ICON[e.type] ?? StickyNote;
    return (
      <WidgetFeedRow
        title={`${e.author?.name ?? "Someone"} ${ENTRY_LABEL[e.type] ?? "updated"}`}
        subtitle={`${e.case.caseNumber} · ${e.case.subjectName} · ${relativeTime(e.createdAt)}`}
        accent="var(--color-accent)"
        onClick={() => navigate(`/cases/${e.case.id}`)}
        meta={
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[0.375rem] text-[var(--color-text-lo)]">
            <Icon size={13} strokeWidth={1.7} />
          </span>
        }
      />
    );
  };

  return (
    <WidgetShell
      title="Recent Case Activity"
      icon={Activity}
      eyebrow="Live feed"
      onExpand={entries.length > 0 ? () => setExpanded(true) : undefined}
    >
      {loading && !data ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetErrorState />
      ) : entries.length === 0 ? (
        <WidgetEmpty icon={Activity} label="No recent activity." />
      ) : density === "dense" ? (
        <WidgetHero value={entries.length} label="Recent entries" delta={entries[0] ? ENTRY_LABEL[entries[0].type] : undefined} />
      ) : (
        <WidgetFeed
          items={entries}
          slots={slots}
          getKey={(e) => e.id}
          onShowMore={() => setExpanded(true)}
          renderItem={(e) => renderRow(e)}
        />
      )}
      <WidgetExpandModal title="Recent Case Activity" open={expanded} onClose={() => setExpanded(false)}>
        {entries.map((e) => (
          <div key={e.id}>{renderRow(e)}</div>
        ))}
      </WidgetExpandModal>
    </WidgetShell>
  );
}

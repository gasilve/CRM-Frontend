import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Columns2, MapPin, User } from "lucide-react";
import {
  evidencePhotosForCase,
  SERVICE_LABELS,
  TAG_COLORS,
  type CaseStatus,
  type InvCase,
  type Investigator,
  type TimeEntry,
} from "@/lib/mock-data";
import { cn } from "@/lib/cn";
import { ImageComparisonModal } from "@/components/case/ImageComparisonModal";

const STATUS_CONFIG: Record<
  CaseStatus,
  { label: string; dot: string; pill: string; text: string }
> = {
  open: { label: "Open", dot: "#4ade80", pill: "rgba(74,222,128,0.15)", text: "#4ade80" },
  suspended: {
    label: "Suspended",
    dot: "#f59e0b",
    pill: "rgba(245,158,11,0.15)",
    text: "#f59e0b",
  },
  closed: {
    label: "Closed",
    dot: "#5b6680",
    pill: "rgba(91,102,128,0.15)",
    text: "#7a8499",
  },
};

export function Field({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-text-lo)]">
        {label}
      </div>
      <div
        className={
          mono
            ? "font-mono text-[11.5px] text-[var(--color-text-hi)]"
            : "text-[12.5px] text-[var(--color-text-hi)]"
        }
      >
        {value}
      </div>
    </div>
  );
}

function PanelShell({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div className="eyebrow shrink-0 border-b border-[var(--color-line)] px-4 py-2.5 flex items-center gap-2">
        {icon}
        {title}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}

export function SubjectPhotoPanel({ c }: { c: InvCase }) {
  const photos = useMemo(() => {
    const base = evidencePhotosForCase(c.id);
    if (!c.subject.photoUrl) return base;
    return [
      {
        id: `${c.id}-primary`,
        caseId: c.id,
        url: c.subject.photoUrl,
        label: "Subject primary",
        kind: "primary" as const,
        capturedAt: c.dateOpened,
      },
      ...base,
    ];
  }, [c]);

  const primary = photos[0];
  const gallery = photos.slice(1);
  const [compareOpen, setCompareOpen] = useState(false);
  const [uploadedId, setUploadedId] = useState<string | undefined>();

  const openCompare = (probeId?: string) => {
    setUploadedId(probeId ?? photos[1]?.id ?? photos[0]?.id);
    setCompareOpen(true);
  };

  return (
    <PanelShell title="Subject photo" icon={<User size={11} strokeWidth={1.8} />}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="relative min-h-[120px] flex-1 overflow-hidden rounded-[10px] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]">
          {primary ? (
            <img
              src={primary.url}
              alt={primary.label}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2">
              <User size={28} strokeWidth={1.2} className="text-[var(--color-text-lo)]" />
              <span className="font-mono text-[9px] tracking-wider text-[var(--color-text-lo)]">
                NO PHOTO
              </span>
            </div>
          )}
        </div>

        {gallery.length > 0 && (
          <div>
            <div className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-text-lo)]">
              Other photos · {gallery.length}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {gallery.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={`${p.label} · ${p.capturedAt}`}
                  onClick={() => openCompare(p.id)}
                  className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[8px] border border-[var(--color-line-2)] bg-[var(--color-ink-2)] transition-opacity hover:opacity-90"
                >
                  <img
                    src={p.url}
                    alt={p.label}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => openCompare()}
          disabled={photos.length < 2}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2 text-[11.5px] font-medium transition-colors",
            photos.length < 2
              ? "cursor-not-allowed border-[var(--color-line)] text-[var(--color-text-lo)] opacity-50"
              : "border-[var(--color-line-2)] bg-[var(--color-ink-2)] text-[var(--color-text-mid)] hover:border-[var(--color-line-3)] hover:text-[var(--color-text-hi)]",
          )}
        >
          <Columns2 size={13} strokeWidth={1.8} />
          Visual Comparison
        </button>
      </div>

      <ImageComparisonModal
        open={compareOpen}
        photos={photos}
        uploadedId={uploadedId}
        subjectOnFileId={photos[0]?.id}
        subjectName={c.subject.name}
        caseReference={c.clientFileNum}
        onClose={() => setCompareOpen(false)}
      />
    </PanelShell>
  );
}

export function SubjectDetailsPanel({ c }: { c: InvCase }) {
  const s = c.subject;
  return (
    <PanelShell title="Subject" icon={<User size={11} strokeWidth={1.8} />}>
      <div className="space-y-2.5">
        <Field label="Full Name" value={s.name} mono={false} />
        {s.dob && <Field label="Date of Birth" value={s.dob} />}
        {s.address && <Field label="Street" value={s.address} mono={false} />}
        {(s.city || s.state) && (
          <Field
            label="City / State"
            value={[s.city, s.state].filter(Boolean).join(", ")}
            mono={false}
          />
        )}
        {s.zip && <Field label="ZIP" value={s.zip} />}
        {s.description && (
          <div>
            <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-[var(--color-text-lo)]">
              Description
            </div>
            <div className="text-[11.5px] leading-relaxed text-[var(--color-text-mid)]">
              {s.description}
            </div>
          </div>
        )}
      </div>
    </PanelShell>
  );
}

export function TimelinePanel({ c }: { c: InvCase }) {
  return (
    <PanelShell title="Case timeline">
      <div className="flex h-full items-center gap-0 px-1">
        <TimelineSegment label="Opened" date={c.dateOpened} color="#4a7fff" active />
        <div className="h-px flex-1 bg-[var(--color-line-2)]" />
        {c.status === "suspended" && (
          <>
            <TimelineSegment label="Suspended" date="—" color="#f59e0b" active />
            <div className="h-px flex-1 border-t border-dashed border-[var(--color-line-2)]" />
          </>
        )}
        <TimelineSegment
          label={c.status === "closed" ? "Closed" : "In Progress"}
          date={c.dateClosed ?? "Ongoing"}
          color={c.status === "closed" ? "#5b6680" : "#4ade80"}
          active={c.status !== "open"}
          dim={c.status === "open"}
        />
      </div>
    </PanelShell>
  );
}

function TimelineSegment({
  label,
  date,
  color,
  active,
  dim,
}: {
  label: string;
  date: string;
  color: string;
  active?: boolean;
  dim?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1", dim && "opacity-35")}>
      <div
        className="h-2.5 w-2.5 rounded-full"
        style={{
          background: active ? color : "var(--color-line-2)",
          boxShadow: active ? `0 0 8px ${color}80` : "none",
        }}
      />
      <div className="font-mono text-[9.5px] text-[var(--color-text-mid)]">{label}</div>
      <div className="font-mono text-[9px] text-[var(--color-text-lo)]">{date}</div>
    </div>
  );
}

export function CaseInfoPanel({ c }: { c: InvCase }) {
  const cfg = STATUS_CONFIG[c.status];
  return (
    <PanelShell title="Case info">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Field label="Status" value={cfg.label} mono={false} />
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium"
            style={{ background: cfg.pill, color: cfg.text }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
            {cfg.label}
          </span>
        </div>
        <Field label="Claim number" value={c.clientFileNum} />
        <Field label="Client" value={c.client} mono={false} />
        <Field label="Service" value={SERVICE_LABELS[c.service]} mono={false} />
        <Field label="State" value={c.state} />
        <Field label="Date Opened" value={c.dateOpened} />
        {c.dateClosed && <Field label="Date Closed" value={c.dateClosed} />}
        <Field label="Days Open" value={String(c.daysOpen)} />
        {c.budget != null && (
          <Field
            label="Budget"
            value={`${c.hoursLogged?.toFixed(1) ?? "0"} / ${c.budget} hrs`}
          />
        )}
      </div>
    </PanelShell>
  );
}

export function TagsPanel({ c }: { c: InvCase }) {
  return (
    <PanelShell title="Tags">
      <div className="flex flex-wrap gap-2">
        {c.tags.map((tag) => {
          const col = TAG_COLORS[tag];
          return (
            <span
              key={tag}
              className="rounded-full px-3 py-1 text-[11px] font-medium tracking-wide"
              style={{ background: col.bg, color: col.text }}
            >
              {tag}
            </span>
          );
        })}
      </div>
    </PanelShell>
  );
}

export function InvestigatorsPanel({
  investigators,
}: {
  investigators: Investigator[];
}) {
  return (
    <PanelShell title="Assigned investigators">
      <div className="flex flex-col gap-3">
        {investigators.map((inv) => {
          const isLive = inv.status !== "off_duty";
          return (
            <div key={inv.id} className="flex items-center gap-3">
              <div className="relative">
                <div
                  className="grid h-9 w-9 place-items-center rounded-full text-[11px] font-semibold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))",
                  }}
                >
                  {inv.initials}
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-ink-2)]"
                  style={{ background: isLive ? "#4ade80" : "#5b6680" }}
                />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-[var(--color-text-hi)]">
                  {inv.name}
                </div>
                <div className="font-mono text-[10px] text-[var(--color-text-lo)]">
                  {inv.status === "off_duty"
                    ? "Off Duty"
                    : inv.status === "on_case"
                      ? "On Case"
                      : "Clocked In"}
                  {inv.location && ` · ${inv.location}`}
                </div>
              </div>
            </div>
          );
        })}
        {investigators.length === 0 && (
          <div className="font-mono text-[11.5px] text-[var(--color-text-lo)]">
            No investigators assigned.
          </div>
        )}
      </div>
    </PanelShell>
  );
}

export function TimeLogPanel({ entries }: { entries: TimeEntry[] }) {
  const totalHours = entries.reduce((s, t) => s + t.hours, 0);
  return (
    <div className="surface flex h-full min-h-0 flex-col overflow-hidden">
      <div className="eyebrow shrink-0 border-b border-[var(--color-line)] px-4 py-2.5 flex items-center gap-2">
        Time log
        <span className="ml-auto font-mono text-[10px] normal-case tracking-normal text-[var(--color-text-lo)]">
          {totalHours.toFixed(1)} hrs total
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {entries.length > 0 ? (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                <th className="px-4 py-2 text-left">
                  <span className="eyebrow text-[9px]">Date</span>
                </th>
                <th className="px-4 py-2 text-left">
                  <span className="eyebrow text-[9px]">Investigator</span>
                </th>
                <th className="px-4 py-2 text-left">
                  <span className="eyebrow text-[9px]">Location</span>
                </th>
                <th className="px-4 py-2 text-right">
                  <span className="eyebrow text-[9px]">Hours</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[var(--color-line)] last:border-0 hover:bg-white/[0.018]"
                >
                  <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--color-text-mid)]">
                    {t.date}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-[var(--color-text-mid)]">
                    {t.investigatorName}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 font-mono text-[10.5px] text-[var(--color-text-lo)]">
                      <MapPin size={9} strokeWidth={1.8} /> {t.location}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[12px] text-[var(--color-text-hi)]">
                    {t.hours.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-8 font-mono text-[11.5px] text-[var(--color-text-lo)]">
            No time entries logged yet.
          </div>
        )}
      </div>
    </div>
  );
}

export function NotesPanel({ c }: { c: InvCase }) {
  return (
    <PanelShell title="Notes">
      {c.notes ? (
        <p className="text-[13px] leading-relaxed text-[var(--color-text-mid)]">{c.notes}</p>
      ) : (
        <p className="font-mono text-[11.5px] text-[var(--color-text-lo)]">No notes on this case.</p>
      )}
    </PanelShell>
  );
}

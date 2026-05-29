import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User, MapPin, Calendar, Clock, Tag, FileText } from "lucide-react";
import { invCases, investigators, timeEntries, TAG_COLORS, SERVICE_LABELS } from "@/lib/mock-data";
import type { CaseStatus } from "@/lib/mock-data";

const STATUS_CONFIG: Record<CaseStatus, { label: string; dot: string; pill: string; text: string }> = {
  open:      { label: "Open",      dot: "#4ade80", pill: "rgba(74,222,128,0.15)",  text: "#4ade80" },
  suspended: { label: "Suspended", dot: "#f59e0b", pill: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  closed:    { label: "Closed",    dot: "#5b6680", pill: "rgba(91,102,128,0.15)", text: "#7a8499" },
};

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const c = invCases.find((x) => x.id === id);

  if (!c) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="font-mono text-[12px] text-[var(--color-text-lo)]">CASE NOT FOUND</div>
        <div className="editorial text-[32px] text-[var(--color-text-hi)]">404</div>
        <button onClick={() => navigate("/cases")} className="eyebrow text-[var(--color-accent)]">
          ← Back to Cases
        </button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[c.status];
  const assignedInvestigators = c.assignedTo.map((id) => investigators.find((i) => i.id === id)).filter(Boolean);
  const caseTimeEntries = timeEntries.filter((t) => t.caseId === c.id);
  const totalHours = caseTimeEntries.reduce((s, t) => s + t.hours, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => navigate("/cases")}
          className="mb-3 flex items-center gap-2 text-[12px] text-[var(--color-text-lo)] transition-colors hover:text-[var(--color-text-mid)]"
        >
          <ArrowLeft size={13} strokeWidth={1.8} /> Cases
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] text-[var(--color-text-lo)]">{c.id} · {c.clientFileNum}</div>
            <h1 className="editorial mt-0.5 text-[32px] leading-none text-[var(--color-text-hi)]">
              {c.subject.name}
            </h1>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium"
            style={{ background: cfg.pill, color: cfg.text }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: cfg.dot }} />
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Status timeline strip */}
      <div className="surface p-4">
        <div className="eyebrow mb-3">Case Timeline</div>
        <div className="flex items-center gap-0">
          <TimelineSegment label="Opened" date={c.dateOpened} color="#4a7fff" active />
          <div className="h-px flex-1 bg-[var(--color-line-2)]" />
          {c.status === "suspended" && (
            <>
              <TimelineSegment label="Suspended" date="2026-05-20" color="#f59e0b" active />
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
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-[280px_1fr] gap-5">
        {/* Subject card */}
        <div className="flex flex-col gap-4">
          <div className="surface p-5">
            <div className="eyebrow mb-4">Subject</div>
            {/* Photo placeholder */}
            <div className="mb-4 flex aspect-[3/4] w-full items-center justify-center rounded-[10px] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]">
              <div className="flex flex-col items-center gap-2">
                <User size={28} strokeWidth={1.2} className="text-[var(--color-text-lo)]" />
                <span className="font-mono text-[9px] tracking-wider text-[var(--color-text-lo)]">NO PHOTO</span>
              </div>
            </div>
            <div className="space-y-2.5">
              <Field label="Full Name" value={c.subject.name} mono={false} />
              {c.subject.dob && <Field label="Date of Birth" value={c.subject.dob} />}
              {c.subject.city && (
                <Field label="Location" value={`${c.subject.city}, ${c.subject.state}`} />
              )}
              {c.subject.description && (
                <div>
                  <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-[var(--color-text-lo)]">Description</div>
                  <div className="text-[11.5px] leading-relaxed text-[var(--color-text-mid)]">{c.subject.description}</div>
                </div>
              )}
            </div>
          </div>

          {/* Case metadata */}
          <div className="surface p-5">
            <div className="eyebrow mb-4">Case Info</div>
            <div className="space-y-2.5">
              <Field label="Client" value={c.client} mono={false} />
              <Field label="Service" value={SERVICE_LABELS[c.service]} mono={false} />
              <Field label="State" value={c.state} />
              <Field label="Date Opened" value={c.dateOpened} />
              {c.dateClosed && <Field label="Date Closed" value={c.dateClosed} />}
              <Field label="Days Open" value={String(c.daysOpen)} />
              {c.budget && (
                <Field label="Budget" value={`${c.hoursLogged?.toFixed(1) ?? "0"} / ${c.budget} hrs`} />
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Tags */}
          <div className="surface p-5">
            <div className="eyebrow mb-3 flex items-center gap-2">
              <Tag size={11} strokeWidth={1.8} /> Tags
            </div>
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
          </div>

          {/* Assigned investigators */}
          <div className="surface p-5">
            <div className="eyebrow mb-3 flex items-center gap-2">
              <User size={11} strokeWidth={1.8} /> Assigned Investigators
            </div>
            <div className="flex flex-col gap-3">
              {assignedInvestigators.map((inv) => {
                if (!inv) return null;
                const isLive = inv.status !== "off_duty";
                return (
                  <div key={inv.id} className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className="grid h-9 w-9 place-items-center rounded-full text-[11px] font-semibold text-white"
                        style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
                      >
                        {inv.initials}
                      </div>
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-ink-2)]"
                        style={{ background: isLive ? "#4ade80" : "#5b6680" }}
                      />
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-[var(--color-text-hi)]">{inv.name}</div>
                      <div className="font-mono text-[10px] text-[var(--color-text-lo)]">
                        {inv.status === "off_duty" ? "Off Duty" : inv.status === "on_case" ? "On Case" : "Clocked In"}
                        {inv.location && ` · ${inv.location}`}
                      </div>
                    </div>
                  </div>
                );
              })}
              {assignedInvestigators.length === 0 && (
                <div className="font-mono text-[11.5px] text-[var(--color-text-lo)]">No investigators assigned.</div>
              )}
            </div>
          </div>

          {/* Time entries */}
          <div className="surface overflow-hidden p-0">
            <div className="border-b border-[var(--color-line)] px-5 py-3.5">
              <div className="eyebrow flex items-center gap-2">
                <Clock size={11} strokeWidth={1.8} /> Time Log
                <span className="ml-auto font-mono text-[10px] text-[var(--color-text-lo)]">
                  {totalHours.toFixed(1)} hrs total
                </span>
              </div>
            </div>
            {caseTimeEntries.length > 0 ? (
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="px-5 py-2.5 text-left"><span className="eyebrow text-[9px]">Date</span></th>
                    <th className="px-5 py-2.5 text-left"><span className="eyebrow text-[9px]">Investigator</span></th>
                    <th className="px-5 py-2.5 text-left"><span className="eyebrow text-[9px]">Location</span></th>
                    <th className="px-5 py-2.5 text-right"><span className="eyebrow text-[9px]">Hours</span></th>
                  </tr>
                </thead>
                <tbody>
                  {caseTimeEntries.map((t) => (
                    <tr key={t.id} className="border-b border-[var(--color-line)] last:border-0 hover:bg-white/[0.018]">
                      <td className="px-5 py-3 font-mono text-[11px] text-[var(--color-text-mid)]">{t.date}</td>
                      <td className="px-5 py-3 text-[12px] text-[var(--color-text-mid)]">{t.investigatorName}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 font-mono text-[10.5px] text-[var(--color-text-lo)]">
                          <MapPin size={9} strokeWidth={1.8} /> {t.location}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[12px] text-[var(--color-text-hi)]">
                        {t.hours.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-5 py-8 font-mono text-[11.5px] text-[var(--color-text-lo)]">
                No time entries logged yet.
              </div>
            )}
          </div>

          {/* Notes */}
          {c.notes && (
            <div className="surface p-5">
              <div className="eyebrow mb-3 flex items-center gap-2">
                <FileText size={11} strokeWidth={1.8} /> Notes
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--color-text-mid)]">{c.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="mb-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</div>
      <div className={mono ? "font-mono text-[11.5px] text-[var(--color-text-hi)]" : "text-[12.5px] text-[var(--color-text-hi)]"}>
        {value}
      </div>
    </div>
  );
}

function TimelineSegment({ label, date, color, active, dim }: { label: string; date: string; color: string; active?: boolean; dim?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center gap-1", dim && "opacity-35")}>
      <div
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: active ? color : "var(--color-line-2)", boxShadow: active ? `0 0 8px ${color}80` : "none" }}
      />
      <div className="font-mono text-[9.5px] text-[var(--color-text-mid)]">{label}</div>
      <div className="font-mono text-[9px] text-[var(--color-text-lo)]">{date}</div>
    </div>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

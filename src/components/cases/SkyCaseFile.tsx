import { useEffect, useLayoutEffect, useRef } from "react";
import type { CaseDetail, CaseStatus } from "@/lib/crm-api";
import { SERVICE_LABELS } from "@/lib/mock-data";

const REGION: Record<string, string> = { ca: "California", tristate: "Tri-state", texas: "Texas" };

const STATUS: Record<CaseStatus, { label: string; color: string }> = {
  open: { label: "Open", color: "var(--active)" },
  suspended: { label: "Suspended", color: "var(--working)" },
  closed: { label: "Closed", color: "var(--ink3)" },
};

function when(iso: string | null): { main: string; year: string } | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return {
    main: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    year: String(date.getFullYear()),
  };
}

function shortDate(iso: string | null): string {
  const parsed = when(iso);
  return parsed ? `${parsed.main}, ${parsed.year}` : "—";
}

function clock(value: string | null): string {
  if (!value) return "—";
  if (/^\d{1,2}:\d{2}/.test(value)) return value.slice(0, 5);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function roleOf(role: string): string {
  const clean = role.replace(/[_-]+/g, " ").trim();
  if (!clean) return "Investigator";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function money(value: number | null): string | null {
  if (value == null) return null;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function Field({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null;
  return (
    <div className="pl">
      <span className="k">{k}</span>
      <span className="t">{v}</span>
    </div>
  );
}

function fileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The case file, drawn with Skyview's own cards. The wheel stays put. The left
 * card is the identity card's twin, the people sit where the schedule sits,
 * and the rail is adjuster, status, and files.
 */
export default function SkyCaseFile({ kase, leaving }: { kase: CaseDetail | null; leaving: boolean }) {
  const rootRef = useRef<HTMLElement>(null);

  // Play the entrance backwards from wherever it is. A new reverse animation
  // snaps to the hidden keyframe instead of moving.
  useEffect(() => {
    if (!leaving) return;
    const root = rootRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>(".sky-file-card, .sky-file-bottom, .sky-file-rail");
    nodes.forEach((node) => {
      for (const animation of node.getAnimations()) {
        const name = (animation as Animation & { animationName?: string }).animationName;
        if (name !== "sky-col-in") continue;
        animation.reverse();
      }
    });
  }, [leaving]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const page = root?.closest<HTMLElement>(".page");
    const frame = page?.closest<HTMLElement>(".sky-v6-scale");
    if (!root || !page || !frame) return;
    const measure = () => {
      const view = Math.max(frame.clientHeight, 640);
      root.style.height = `${view}px`;
      const wheel = page.querySelector<HTMLElement>(":scope > .center > .wheel");
      if (!wheel) return;
      const gap = wheel.offsetTop + wheel.offsetHeight + 48;
      const room = view - 40 - 28 - 260;
      root.style.setProperty("--sky-wheel-h", `${Math.max(180, Math.min(gap, room))}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  const opened = when(kase?.dateOpened ?? null);
  const due = when(kase?.dueDate ?? null);
  const status = kase ? STATUS[kase.status] : STATUS.open;
  const assignments = kase?.assignments ?? [];
  const files = kase?.files ?? [];
  const people = (kase?.people ?? []).filter((person) => !person.isSubject);
  const title = kase?.claimNumber || kase?.caseNumber || "Case file";
  const aside = kase?.claimNumber ? kase.caseNumber : null;
  const client = kase?.client as
    | (NonNullable<CaseDetail["client"]> & {
        contactName?: string | null;
        contactEmail?: string | null;
        contactPhone?: string | null;
        location?: string | null;
        address?: string | null;
      })
    | null
    | undefined;
  const where = [kase?.region ? REGION[kase.region] ?? kase.region : null, kase?.state].filter(Boolean).join(" · ");

  return (
    <section ref={rootRef} className="sky-file" aria-label="Case file">
      <div className="g id sky-file-card">
        <p className="occ">Case file</p>
        <h2 className="sky-file-title">{title}</h2>
        <p className="client">
          <span className={kase?.client ? "" : "sky-empty"}>{kase?.client?.company ?? "No client"}</span>
          {kase && <span className="cap c">{SERVICE_LABELS[kase.service]}</span>}
          {aside && <span className="cap">{aside}</span>}
        </p>

        <div className="facts">
          <div className="fact">
            <div className="sec">Client</div>
            <p className={client ? "sky-file-who" : "sky-file-who sky-empty"}>{client?.company ?? "No client"}</p>
            <Field k="Contact" v={client?.contactName} />
            <Field k="Email" v={client?.contactEmail} />
            <Field k="Phone" v={client?.contactPhone} />
            <Field k="Office" v={client?.location || client?.address} />
            <Field k="Claim" v={kase?.claimNumber} />
            <Field k="Policy" v={kase?.policyNumber} />
          </div>

          <div className="fact">
            <div className="sky-file-dates">
              <div>
                <b>{opened?.main ?? "—"}</b>
                <span>{opened ? `${opened.year} · Opened` : "Opened"}</span>
              </div>
              <div>
                <b className={due ? "" : "sky-empty"}>{due?.main ?? "—"}</b>
                <span>
                  {due ? `${due.year} · Due` : "Due"}
                  {kase?.daysAllotted ? ` · ${kase.daysAllotted} days` : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="fact">
            <div className="sec">The file</div>
            <Field k="Injury" v={kase?.dateOfInjury ? shortDate(kase.dateOfInjury) : null} />
            <Field k="Closed" v={kase?.dateClosed ? shortDate(kase.dateClosed) : null} />
            <Field k="Start" v={kase?.startTime ? clock(kase.startTime) : null} />
            <Field k="Where" v={where || null} />
            <Field k="Value" v={money(kase?.estimatedValue ?? null)} />
            <Field k="Priority" v={kase?.priority === "rush" ? "Rush" : kase ? "Standard" : null} />
            {kase?.tags?.length ? <Field k="Tags" v={kase.tags.join(", ")} /> : null}
            {kase?.description?.trim() ? <p className="sum">{kase.description.trim()}</p> : null}
          </div>
        </div>
      </div>

      <div className="sky-file-mid">
        <div className="sky-file-gap" />
        <div className="g sky-file-bottom">
          <div className="sec">On this case</div>
          {assignments.length === 0 && people.length === 0 ? (
            <p className="sum sky-empty">No one assigned yet.</p>
          ) : (
            <>
              {assignments.map((person) => (
                <div className="pl" key={person.id}>
                  <span className="k">{person.user.name}</span>
                  <span className="t">{roleOf(person.role)}</span>
                  <span className="a">{shortDate(person.assignedAt)}</span>
                </div>
              ))}
              {people.map((person) => (
                <div className="pl" key={person.id}>
                  <span className="k">{person.name}</span>
                  <span className="t">{roleOf(person.relationship)}</span>
                  {person.phone && <span className="a">{person.phone}</span>}
                </div>
              ))}
            </>
          )}
          <div className="sec" style={{ marginTop: 16 }}>
            Files
          </div>
          {files.length === 0 ? (
            <p className="sum sky-empty">No documents yet.</p>
          ) : (
            files.map((file) => (
              <div className="pl" key={file.id}>
                <span className="k">{file.filename}</span>
                <span className="t">{fileSize(file.sizeBytes)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sky-file-rail">
        <div className="g idl">
          <div className="sec">Adjuster</div>
          <p className={kase?.adjusterName ? "sky-file-who" : "sky-file-who sky-empty"}>
            {kase?.adjusterName || "No adjuster on file"}
          </p>
          <Field k="Email" v={kase?.adjusterEmail} />
          <Field k="Phone" v={kase?.adjusterPhone} />
        </div>

        <div className="g idl">
          <div className="sec">Status</div>
          <p className="sky-file-status" style={{ color: status.color }}>
            {status.label}
          </p>
          <Field k="Case" v={kase?.caseNumber} />
          <Field k="Round" v={kase?.reopened ? "Reopened" : null} />
          <Field k="Employer" v={kase?.subjectEmployer} />
          <Field k="Work" v={kase?.subjectWorkStatus} />
          <Field k="Language" v={kase?.subjectLanguage} />
        </div>
      </div>
    </section>
  );
}

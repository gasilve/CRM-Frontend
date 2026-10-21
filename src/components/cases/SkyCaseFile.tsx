import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import type { CaseDetail, UpdateCasePayload } from "@/lib/crm-api";
import { CASE_WORKS, CLAIM_LABELS, CLAIM_TYPES, WORK_LABELS, claimLabel, type CaseWork, type ClaimType } from "@/lib/case-kind";
import { ageFromDob, calendarDateKey } from "@/lib/dates";
import { SkyFieldPop, useSkyFieldPop, type SkyEditor, type SkyFieldRequest } from "@/components/cases/SkyFieldMenu";

function ageOf(iso: string | null | undefined): number | null {
  const key = iso ? calendarDateKey(iso) : null;
  if (!key) return null;
  const age = ageFromDob(key);
  return age >= 0 && age < 130 ? age : null;
}

function dateKey(iso: string | null | undefined): string {
  if (!iso) return "";
  return calendarDateKey(iso) ?? iso.slice(0, 10);
}

function showDate(iso: string | null | undefined): string {
  const key = dateKey(iso);
  if (!key) return "—";
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function text(value: string | null | undefined): string {
  const clean = value?.trim();
  return clean || "—";
}

/**
 * The case file over Sky View. The wheel stays. The top repeats the identity
 * card. The four short cards are the referral: subject, insurance, defense, employer.
 */
export default function SkyCaseFile({
  kase,
  leaving,
  canEdit,
  onChange,
}: {
  kase: CaseDetail | null;
  leaving: boolean;
  canEdit: boolean;
  onChange: (patch: UpdateCasePayload) => void;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const fieldPop = useSkyFieldPop();
  const { open } = fieldPop;
  const [openCard, setOpenCard] = useState<"adjuster" | "attorney" | null>(null);

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
      const gap = wheel.offsetTop + wheel.offsetHeight + 28;
      const room = view - 40 - 28 - 260;
      root.style.setProperty("--sky-wheel-h", `${Math.max(180, Math.min(gap, room))}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  const editText = (event: MouseEvent, title: string, key: keyof UpdateCasePayload, value: string | null | undefined, multiline = false) => {
    if (!canEdit || !kase) return;
    const request: SkyFieldRequest = {
      title,
      editor: { kind: "text", title, value: value ?? "", multiline },
      onSave: async (fields) => {
        onChange({ [key]: fields.value.trim() || null } as UpdateCasePayload);
      },
    };
    open(event, request);
  };

  const editDate = (event: MouseEvent, title: string, key: "dateOfInjury" | "dueDate" | "subjectDob", value: string | null | undefined) => {
    if (!canEdit || !kase) return;
    open(event, {
      title,
      editor: { kind: "date", title, value: dateKey(value) },
      onSave: async (fields) => {
        onChange({ [key]: fields.value || null });
      },
    });
  };

  const editNumber = (event: MouseEvent, title: string, key: "daysAsked" | "daysDone", value: number | null | undefined) => {
    if (!canEdit || !kase) return;
    open(event, {
      title,
      editor: { kind: "text", title, value: value == null ? "" : String(value) },
      onSave: async (fields) => {
        const raw = fields.value.trim();
        if (!raw) {
          onChange({ [key]: null });
          return;
        }
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > 999) throw new Error("Use a whole number.");
        onChange({ [key]: n });
      },
    });
  };

  const editClaim = (event: MouseEvent) => {
    if (!canEdit || !kase) return;
    open(event, {
      title: "Claim type",
      editor: {
        kind: "choice",
        title: "Claim type",
        value: kase.claimType ?? "",
        emptyLabel: "Not set",
        options: CLAIM_TYPES.map((value) => ({ value, label: CLAIM_LABELS[value] })),
      },
      onSave: async (fields) => {
        onChange({ claimType: (fields.value || null) as ClaimType | null });
      },
    });
  };

  const editWorks = (event: MouseEvent) => {
    if (!canEdit || !kase) return;
    open(event, {
      title: "Work",
      editor: {
        kind: "checks",
        title: "Work on this case",
        value: (kase.works ?? []).join(","),
        options: CASE_WORKS.map((value) => ({ value, label: WORK_LABELS[value] })),
      } satisfies SkyEditor,
      onSave: async (fields) => {
        const works = fields.value.split(",").filter((item): item is CaseWork => (CASE_WORKS as readonly string[]).includes(item));
        const service = works.find((work) => work !== "MED");
        onChange({ works, ...(service ? { service } : {}) });
      },
    });
  };

  const works = kase?.works ?? [];
  const age = ageOf(kase?.subjectDob);
  const hint = canEdit ? "Right-click to edit" : undefined;

  return (
    <section ref={rootRef} className="sky-file" aria-label="Case file">
      <div className="g id sky-file-card">
        <p className="occ">Case file</p>
        <h2 className="sky-file-title">{kase?.subjectName || "Case file"}</h2>
        <p className="client">
          <span className={kase?.subjectJobTitle ? "" : "sky-empty"}>{kase?.subjectJobTitle || "No work on file"}</span>
          <span className="cap">{age == null ? "Age —" : `Age ${age}`}</span>
        </p>
        <p className="client kinds">
          <span className={kase?.claimType ? "cap c" : "cap ghost"} title={hint} onContextMenu={editClaim}>
            {claimLabel(kase?.claimType)}
          </span>
          {works.length === 0 ? (
            <span className="cap ghost" title={hint} onContextMenu={editWorks}>
              Work not set
            </span>
          ) : (
            works.map((work) => (
              <span key={work} className="cap c" title={hint} onContextMenu={editWorks}>
                {WORK_LABELS[work]}
              </span>
            ))
          )}
        </p>

        <div className="facts">
          <div className="fact">
            <div className="sec">Subject</div>
            <Line k="Phone" v={text(kase?.subjectPhone)} title={hint} onContextMenu={(event) => editText(event, "Phone", "subjectPhone", kase?.subjectPhone)} />
            <Line k="Date of birth" v={showDate(kase?.subjectDob)} title={hint} onContextMenu={(event) => editDate(event, "Date of birth", "subjectDob", kase?.subjectDob)} />
            <Line
              k="Aliases"
              v={kase?.subjectAliases?.length ? kase.subjectAliases.join(", ") : "—"}
              title={hint}
              onContextMenu={(event) =>
                canEdit &&
                kase &&
                open(event, {
                  title: "Aliases",
                  editor: { kind: "text", title: "Aliases", value: (kase.subjectAliases ?? []).join(", ") },
                  onSave: async (fields) => {
                    onChange({ subjectAliases: fields.value.split(",").map((item) => item.trim()).filter(Boolean) });
                  },
                })
              }
            />
          </div>
          <div className="fact">
            <div className="sec">Why we are watching</div>
            <p className="sum" title={hint} onContextMenu={(event) => editText(event, "Articulable suspicion", "suspicion", kase?.suspicion, true)}>
              {text(kase?.suspicion)}
            </p>
            <Line k="Body parts" v={text(kase?.bodyParts)} title={hint} onContextMenu={(event) => editText(event, "Body parts", "bodyParts", kase?.bodyParts)} />
            <Line k="Restrictions" v={text(kase?.restrictions)} title={hint} onContextMenu={(event) => editText(event, "Restrictions", "restrictions", kase?.restrictions, true)} />
            <Line k="Required dates" v={text(kase?.requiredDates)} title={hint} onContextMenu={(event) => editText(event, "Required dates", "requiredDates", kase?.requiredDates)} />
          </div>
        </div>
      </div>

      <div className="sky-file-mid">
        <div className="sky-file-gap" />
        <div className="g sky-file-bottom">
          <div className="sec">Insurance</div>
          <p className="sky-file-who">{kase?.client?.company || "No carrier"}</p>
          <button
            type="button"
            className="sky-file-person"
            title={hint}
            onClick={() => setOpenCard(openCard === "adjuster" ? null : "adjuster")}
            onContextMenu={(event) => editText(event, "Adjuster", "adjusterName", kase?.adjusterName)}
          >
            {kase?.adjusterName || "No adjuster"}
          </button>
          <Line k="Email" v={text(kase?.adjusterEmail)} title={hint} onContextMenu={(event) => editText(event, "Adjuster email", "adjusterEmail", kase?.adjusterEmail)} />
          {(openCard === "adjuster" || kase?.adjusterPhone) && (
            <Line k="Phone" v={text(kase?.adjusterPhone)} title={hint} onContextMenu={(event) => editText(event, "Adjuster phone", "adjusterPhone", kase?.adjusterPhone)} />
          )}
          <Line k="Claim" v={text(kase?.claimNumber)} title={hint} onContextMenu={(event) => editText(event, "Claim number", "claimNumber", kase?.claimNumber)} />
          <Line k="Injury" v={showDate(kase?.dateOfInjury)} title={hint} onContextMenu={(event) => editDate(event, "Date of injury", "dateOfInjury", kase?.dateOfInjury)} />
          <Line k="Due" v={showDate(kase?.dueDate)} title={hint} onContextMenu={(event) => editDate(event, "Due date", "dueDate", kase?.dueDate)} />
          <Line k="Days asked" v={kase?.daysAsked == null ? "—" : String(kase.daysAsked)} title={hint} onContextMenu={(event) => editNumber(event, "Days asked", "daysAsked", kase?.daysAsked)} />
          <Line k="Days done" v={kase?.daysDone == null ? "—" : String(kase.daysDone)} title={hint} onContextMenu={(event) => editNumber(event, "Days done", "daysDone", kase?.daysDone)} />
        </div>
      </div>

      <div className="sky-file-rail">
        <div className="g idl">
          <div className="sec">Defense firm</div>
          <button
            type="button"
            className="sky-file-person"
            title={hint}
            onClick={() => setOpenCard(openCard === "attorney" ? null : "attorney")}
            onContextMenu={(event) => editText(event, "Attorney", "defenseAttorneyName", kase?.defenseAttorneyName)}
          >
            {kase?.defenseAttorneyName || "No attorney"}
          </button>
          <Line k="Firm" v={text(kase?.defenseFirm)} title={hint} onContextMenu={(event) => editText(event, "Law firm", "defenseFirm", kase?.defenseFirm)} />
          <Line k="Phone" v={text(kase?.defensePhone)} title={hint} onContextMenu={(event) => editText(event, "Attorney phone", "defensePhone", kase?.defensePhone)} />
          {openCard === "attorney" && (
            <>
              <Line k="Address" v={text(kase?.defenseAddress)} title={hint} onContextMenu={(event) => editText(event, "Attorney address", "defenseAddress", kase?.defenseAddress, true)} />
              <Line k="Email" v={text(kase?.defenseEmail)} title={hint} onContextMenu={(event) => editText(event, "Attorney email", "defenseEmail", kase?.defenseEmail)} />
              <Line k="Court case" v={text(kase?.courtCaseNumber)} title={hint} onContextMenu={(event) => editText(event, "Court case number", "courtCaseNumber", kase?.courtCaseNumber)} />
            </>
          )}
        </div>
        <div className="g idl">
          <div className="sec">Employer</div>
          <p className="sky-file-who" title={hint} onContextMenu={(event) => editText(event, "Employer", "subjectEmployer", kase?.subjectEmployer)}>
            {kase?.subjectEmployer || "No employer"}
          </p>
          <Line k="Contact" v={text(kase?.employerContactName)} title={hint} onContextMenu={(event) => editText(event, "Employer contact", "employerContactName", kase?.employerContactName)} />
          <Line k="Phone" v={text(kase?.employerPhone)} title={hint} onContextMenu={(event) => editText(event, "Employer phone", "employerPhone", kase?.employerPhone)} />
          <Line k="Email" v={text(kase?.employerEmail)} title={hint} onContextMenu={(event) => editText(event, "Employer email", "employerEmail", kase?.employerEmail)} />
        </div>
      </div>
      <SkyFieldPop
        pop={fieldPop.pop}
        busy={fieldPop.busy}
        fault={fieldPop.fault}
        onEdit={fieldPop.toEdit}
        onNew={fieldPop.toNew}
        onPick={fieldPop.pick}
        onClear={fieldPop.clear}
        onCommit={fieldPop.commit}
        onClose={fieldPop.close}
      />
    </section>
  );
}

function Line({
  k,
  v,
  title,
  onContextMenu,
}: {
  k: string;
  v: string;
  title?: string;
  onContextMenu?: (event: MouseEvent) => void;
}) {
  return (
    <div className="pl" title={title} onContextMenu={onContextMenu}>
      <span className="k">{k}</span>
      <span className={v === "—" ? "t sky-empty" : "t"}>{v}</span>
    </div>
  );
}

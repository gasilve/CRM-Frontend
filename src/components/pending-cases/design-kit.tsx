/**
 * Shared contract and primitives for the pending-case detail designs.
 *
 * `PendingCaseDetail` owns all data and mutations; each design under
 * `./designs` is a pure presentation of the same `PendingCaseView`.
 */
import type { ReactNode } from "react";
import { Check, Pencil, Plus, Trash2, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  CaseProposal,
  PendingCaseDetail as PendingCase,
  ProposalAssignment,
  ProposalSubject,
  ProposalVehicle,
} from "@/lib/crm-api";

export type BusyAction = "save" | "accept" | "reject" | "files";

export interface PendingCaseActions {
  back: () => void;
  startEdit: () => void;
  cancelEdit: () => void;
  save: () => void;
  openAccept: () => void;
  openReject: () => void;
  fetchFiles: () => void;
  openAcceptedCase: () => void;
  setSubject: (patch: Partial<ProposalSubject>) => void;
  setAssignment: (patch: Partial<ProposalAssignment>) => void;
  setVehicle: (index: number, patch: Partial<ProposalVehicle>) => void;
  addVehicle: () => void;
  removeVehicle: (index: number) => void;
}

export interface PendingCaseView {
  pendingCase: PendingCase;
  proposal: CaseProposal;
  claimNumber: string | null;
  subject: ProposalSubject;
  assignment: ProposalAssignment;
  vehicles: ProposalVehicle[];
  /** True while the admin is correcting the proposal before a decision. */
  editing: boolean;
  /** True once accepted or rejected — the proposal is then read-only. */
  decided: boolean;
  busy: BusyAction | null;
  error: string | null;
  rawJson: string;
  actions: PendingCaseActions;
}

// ─── Field maps ───────────────────────────────────────────────────────────────

export type SubjectTextKey = Exclude<keyof ProposalSubject, "addresses" | "phones">;

export const SUBJECT_FIELDS: { key: SubjectTextKey; label: string; mono?: boolean }[] = [
  { key: "name", label: "Name" },
  { key: "dob", label: "Date of birth", mono: true },
  { key: "ssnLast4", label: "SSN (last 4)", mono: true },
  { key: "job", label: "Job title" },
  { key: "employer", label: "Employer" },
  { key: "employerContact", label: "Employer contact" },
  { key: "employerPhone", label: "Employer phone", mono: true },
  { key: "physical", label: "Physical description" },
];

export const ASSIGNMENT_FIELDS: { key: keyof ProposalAssignment; label: string; mono?: boolean }[] = [
  { key: "insurer", label: "Insurer" },
  { key: "adjusterName", label: "Adjuster" },
  { key: "adjusterEmail", label: "Adjuster email", mono: true },
  { key: "adjusterPhone", label: "Adjuster phone", mono: true },
  { key: "reportDueDate", label: "Report due", mono: true },
  { key: "dateOfLoss", label: "Date of loss", mono: true },
  { key: "surveillanceDays", label: "Surveillance days", mono: true },
  { key: "typeOfClaim", label: "Claim type" },
  { key: "type", label: "Assignment type" },
  { key: "isRepresented", label: "Represented" },
  { key: "defenseAttorney", label: "Defense attorney" },
  { key: "defenseLawFirm", label: "Defense law firm" },
  { key: "defensePhone", label: "Defense phone", mono: true },
];

export const NARRATIVE_FIELDS: { key: keyof ProposalAssignment; label: string }[] = [
  { key: "bodyParts", label: "Body parts" },
  { key: "restrictions", label: "Restrictions" },
  { key: "injuryDescription", label: "Injury description" },
  { key: "suspicion", label: "Reason for the case" },
  { key: "instructions", label: "Adjuster instructions" },
];

export const EMPTY_VEHICLE: ProposalVehicle = {
  year: null,
  color: null,
  makeModel: null,
  plate: null,
  registeredOwner: null,
  source: null,
};

// ─── Formatting ───────────────────────────────────────────────────────────────

export const fieldClass =
  "w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 py-1.5 text-[0.78125rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]";

export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const fmtBytes = (bytes: number | null): string => {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const vehicleHeadline = (vehicle: ProposalVehicle): string =>
  [vehicle.year, vehicle.color, vehicle.makeModel].filter(Boolean).join(" ") || "Unidentified vehicle";

// ─── Review readiness ─────────────────────────────────────────────────────────

export interface ChecklistEntry {
  label: string;
  ok: boolean;
  /** A miss worth flagging but not worth blocking the decision on. */
  advisory?: boolean;
  detail: string;
}

/** What an admin usually wants confirmed before turning a proposal into a case. */
export const reviewChecklist = (view: PendingCaseView): ChecklistEntry[] => {
  const { subject, assignment, vehicles, pendingCase, claimNumber } = view;
  return [
    {
      label: "Subject name",
      ok: Boolean(subject.name?.trim()),
      detail: subject.name?.trim() || "Required before a case can be created",
    },
    {
      label: "Claim number",
      ok: Boolean(claimNumber?.trim()),
      advisory: true,
      detail: claimNumber?.trim() || "No claim number in the payload",
    },
    {
      label: "Insurer",
      ok: Boolean(assignment.insurer?.trim()),
      advisory: true,
      detail: assignment.insurer?.trim() || "No client will be linked",
    },
    {
      label: "Date of loss",
      ok: Boolean(assignment.dateOfLoss?.trim()),
      advisory: true,
      detail: assignment.dateOfLoss?.trim() || "Not supplied by the ingestor",
    },
    {
      label: "Subject address",
      ok: subject.addresses.length > 0,
      advisory: true,
      detail: subject.addresses[0] ?? "No address to surveil",
    },
    {
      label: "Vehicles",
      ok: vehicles.length > 0,
      advisory: true,
      detail: vehicles.length > 0 ? `${vehicles.length} on file` : "None in this payload",
    },
    {
      label: "Files",
      ok: pendingCase.files.length > 0,
      advisory: true,
      detail:
        pendingCase.files.length > 0
          ? `${pendingCase.files.length} stored`
          : pendingCase.proposal.attachments.length > 0
            ? `${pendingCase.proposal.attachments.length} listed, none fetched`
            : "No attachments sent",
    },
  ];
};

// ─── Review actions ───────────────────────────────────────────────────────────

export type ActionTone = "neutral" | "accent" | "positive" | "danger";

export interface ActionSpec {
  key: "cancel" | "save" | "edit" | "reject" | "accept";
  label: string;
  icon: LucideIcon;
  tone: ActionTone;
  primary: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}

/**
 * The decision controls available right now, as data. Designs render these
 * however they like so the workflow stays identical across every layout.
 */
export const reviewActions = (view: PendingCaseView): ActionSpec[] => {
  const { editing, decided, busy, actions } = view;
  if (decided) return [];
  const working = busy !== null;

  if (editing) {
    return [
      {
        key: "cancel",
        label: "Cancel",
        icon: X,
        tone: "neutral",
        primary: false,
        loading: false,
        disabled: working,
        onClick: actions.cancelEdit,
      },
      {
        key: "save",
        label: "Save corrections",
        icon: Check,
        tone: "accent",
        primary: true,
        loading: busy === "save",
        disabled: working,
        onClick: actions.save,
      },
    ];
  }

  return [
    {
      key: "edit",
      label: "Edit",
      icon: Pencil,
      tone: "neutral",
      primary: false,
      loading: false,
      disabled: working,
      onClick: actions.startEdit,
    },
    {
      key: "reject",
      label: "Reject",
      icon: Trash2,
      tone: "danger",
      primary: false,
      loading: busy === "reject",
      disabled: working,
      onClick: actions.openReject,
    },
    {
      key: "accept",
      label: "Accept as case",
      icon: Check,
      tone: "positive",
      primary: true,
      loading: busy === "accept",
      disabled: working,
      onClick: actions.openAccept,
    },
  ];
};

export const TONE_RING: Record<ActionTone, string> = {
  neutral: "var(--color-line-2)",
  accent: "rgba(74,127,255,0.4)",
  positive: "rgba(74,222,128,0.4)",
  danger: "rgba(248,113,113,0.35)",
};

export const TONE_FILL: Record<ActionTone, string> = {
  neutral: "transparent",
  accent: "var(--color-accent-soft)",
  positive: "rgba(74,222,128,0.12)",
  danger: "rgba(248,113,113,0.08)",
};

export const TONE_TEXT: Record<ActionTone, string> = {
  neutral: "var(--color-text-mid)",
  accent: "var(--color-text-hi)",
  positive: "#4ade80",
  danger: "var(--color-neg)",
};

// ─── Primitives ───────────────────────────────────────────────────────────────

export function EditableField({
  label,
  value,
  editing,
  onChange,
  mono = false,
  multiline = false,
  className,
}: {
  label: string;
  value: string | null;
  editing: boolean;
  onChange: (value: string | null) => void;
  mono?: boolean;
  multiline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</div>
      {editing ? (
        multiline ? (
          <textarea
            rows={2}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            className={cn(fieldClass, "resize-y")}
          />
        ) : (
          <input value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={fieldClass} />
        )
      ) : (
        <div
          className={cn(
            "break-words text-[0.78125rem] leading-relaxed text-[var(--color-text-hi)]",
            mono && "font-mono text-[0.71875rem]",
            !value && "text-[var(--color-text-lo)]",
          )}
        >
          {value ?? "—"}
        </div>
      )}
    </div>
  );
}

export function StringListEditor({
  label,
  values,
  editing,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  editing: boolean;
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</span>
        {editing && (
          <button
            type="button"
            onClick={() => onChange([...values, ""])}
            className="inline-flex items-center gap-1 text-[0.625rem] text-[var(--color-accent-2)]"
          >
            <Plus size={10} strokeWidth={2} />
            Add
          </button>
        )}
      </div>

      {values.length === 0 && !editing ? (
        <div className="text-[0.78125rem] text-[var(--color-text-lo)]">—</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {values.map((entry, index) =>
            editing ? (
              <div key={index} className="flex items-center gap-1.5">
                <input
                  value={entry}
                  placeholder={placeholder}
                  onChange={(e) => onChange(values.map((value, i) => (i === index ? e.target.value : value)))}
                  className={fieldClass}
                />
                <button
                  type="button"
                  aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
                  onClick={() => onChange(values.filter((_, i) => i !== index))}
                  className="shrink-0 rounded-[0.5rem] p-1.5 text-[var(--color-text-lo)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-neg)]"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div key={index} className="text-[0.78125rem] leading-relaxed text-[var(--color-text-hi)]">
                {entry}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function MicroField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
        {label}
      </span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 text-[0.71875rem] text-[var(--color-text-hi)] focus:border-[var(--color-accent)] focus:outline-none"
      />
    </label>
  );
}

export function VehicleEditor({
  vehicle,
  onChange,
  onRemove,
}: {
  vehicle: ProposalVehicle;
  onChange: (patch: Partial<ProposalVehicle>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 p-2.5">
      <div className="grid grid-cols-[4rem_5rem_1fr_6rem_2rem] items-end gap-2">
        <MicroField label="Year" value={vehicle.year} onChange={(year) => onChange({ year })} />
        <MicroField label="Color" value={vehicle.color} onChange={(color) => onChange({ color })} />
        <MicroField label="Make / model" value={vehicle.makeModel} onChange={(makeModel) => onChange({ makeModel })} />
        <MicroField label="Plate" value={vehicle.plate} onChange={(plate) => onChange({ plate })} />
        <button
          type="button"
          aria-label="Remove vehicle"
          onClick={onRemove}
          className="mb-1 grid h-7 place-items-center rounded-[0.5rem] text-[var(--color-text-lo)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-neg)]"
        >
          <X size={13} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <MicroField
          label="Registered owner"
          value={vehicle.registeredOwner}
          onChange={(registeredOwner) => onChange({ registeredOwner })}
        />
        <MicroField label="Source" value={vehicle.source} onChange={(source) => onChange({ source })} />
      </div>
    </div>
  );
}

export function RawPayload({ json, className }: { json: string; className?: string }) {
  return (
    <details className={cn("surface overflow-hidden p-0", className)}>
      <summary className="eyebrow cursor-pointer px-4 py-2.5 text-[var(--color-text-mid)]">
        Raw payload as received
      </summary>
      <pre className="max-h-[24rem] overflow-auto border-t border-[var(--color-line)] px-4 py-3 font-mono text-[0.65625rem] leading-relaxed text-[var(--color-text-mid)]">
        {json}
      </pre>
    </details>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="anim-banner surface shrink-0 rounded-[0.875rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-4 py-3 text-[0.8125rem] text-[var(--color-neg)]">
      {message}
    </div>
  );
}

/** Shown in place of the review controls once the proposal has been decided. */
export function DecidedBanner({ view }: { view: PendingCaseView }) {
  const { pendingCase, actions } = view;
  return (
    <div className="surface flex shrink-0 flex-wrap items-center gap-3 rounded-[0.875rem] border border-[var(--color-line)] px-4 py-3">
      <p className="text-[0.78125rem] text-[var(--color-text-mid)]">
        {pendingCase.status === "accepted"
          ? "This proposal was accepted and is now a case."
          : "This proposal was rejected. It stays on record but is out of the inbox."}
        {pendingCase.reviewedBy && ` Reviewed by ${pendingCase.reviewedBy.name}.`}
      </p>
      {pendingCase.acceptedCaseId && (
        <button type="button" onClick={actions.openAcceptedCase} className="eyebrow ml-auto text-[var(--color-accent)]">
          Open the case →
        </button>
      )}
    </div>
  );
}

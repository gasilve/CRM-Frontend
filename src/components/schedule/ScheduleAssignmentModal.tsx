import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CaseGlanceCard, glanceFromListItem } from "@/components/cases/CaseGlanceCard";
import { CoverStatusMark } from "@/components/icons";
import { INVESTIGATOR_BG } from "@/components/schedule/CalendarDayRow";
import { placeholderCoverStatus } from "@/components/schedule/cover-status";
import {
  ApiError,
  REGION_LABELS,
  type CaseListItem,
  type InvestigatorListItem,
  type ScheduleBlock,
  type SchedulePriorWork,
} from "@/lib/crm-api";
import { priorKey, sortCasesForInvestigator, sortInvestigatorsForCase } from "./AssignEntityModal";

/** New assignment: pick → notes in one shell. Nothing is created until Done. */
export type AssignCaseFlow = {
  kind: "assign-case";
  step: "pick" | "notes";
  investigator: InvestigatorListItem;
  dayLabel: string;
  cases: CaseListItem[];
  priorWork: SchedulePriorWork[];
  excludeCaseIds?: Set<string>;
  /** Set after a case is chosen; assignment is still pending until Done. */
  draftCase?: CaseListItem;
  draftNotes: string;
};

export type AssignInvestigatorFlow = {
  kind: "assign-investigator";
  step: "pick" | "notes";
  kase: CaseListItem;
  dayLabel: string;
  investigators: InvestigatorListItem[];
  priorWork: SchedulePriorWork[];
  excludeUserIds?: Set<string>;
  draftInvestigator?: InvestigatorListItem;
  draftNotes: string;
};

/** Existing assignment — notes only. */
export type EditNotesFlow = {
  kind: "edit-notes";
  step: "notes";
  block: ScheduleBlock;
  othersThatDay: ScheduleBlock[];
};

export type AssignmentFlow = AssignCaseFlow | AssignInvestigatorFlow | EditNotesFlow;

type Props = {
  flow: AssignmentFlow;
  canManage: boolean;
  busy?: boolean;
  onClose: () => void;
  /** Advance pick → notes (parent updates flow with draft entity). */
  onDraftCase?: (caseId: string) => void;
  onDraftInvestigator?: (userId: string) => void;
  onBackToPick?: () => void;
  /** Commit draft: create assignment + optional notes, then parent closes. */
  onConfirmAssign?: (notes: string | null) => Promise<void>;
  onSaveNotes: (notes: string | null) => Promise<void>;
  onRemove: () => void;
  onGoToCase: () => void;
  /** Same-case peers for the draft notes warning (optional). */
  othersThatDay?: ScheduleBlock[];
  /** When set, the investigator step also asks which day. */
  dateValue?: string;
  onDateChange?: (iso: string) => void;
  /** Save a named, colored day on the case being scheduled. */
  onCreateSpecial?: (input: { date: string; name: string; color: string }) => Promise<void>;
};

function SignalBadge({
  icon,
  label,
  className,
}: {
  icon: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[0.53125rem] uppercase tracking-wider",
        className,
      )}
    >
      {icon}
      {label}
    </span>
  );
}

/**
 * One fixed-size shell: pick entity → notes.
 * New assigns stay drafts until Done; Cancel / X discards with no API create.
 */
export function ScheduleAssignmentModal({
  flow,
  canManage,
  busy,
  onClose,
  onDraftCase,
  onDraftInvestigator,
  onBackToPick,
  onConfirmAssign,
  onSaveNotes,
  onRemove,
  onGoToCase,
  othersThatDay = [],
  dateValue,
  onDateChange,
  onCreateSpecial,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isDraft = flow.kind !== "edit-notes";
  const phase = flow.step;

  const title =
    flow.kind === "edit-notes"
      ? flow.block.case.subjectName
      : phase === "pick"
        ? flow.kind === "assign-case"
          ? "Assign case"
          : onDateChange
            ? "Schedule a day"
            : "Assign investigator"
        : "Assignment notes";

  const subtitle = (() => {
    if (flow.kind === "edit-notes") {
      const dateLabel = new Date(`${flow.block.date.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      return `${flow.block.case.caseNumber} · ${dateLabel} · ${flow.block.user.name}`;
    }
    if (phase === "pick") {
      return flow.kind === "assign-case"
        ? `${flow.investigator.name} · ${flow.dayLabel}`
        : `${flow.kase.subjectName} · ${flow.kase.caseNumber} · ${flow.dayLabel}`;
    }
    if (flow.kind === "assign-case" && flow.draftCase) {
      return `${flow.draftCase.subjectName} · ${flow.draftCase.caseNumber} → ${flow.investigator.name} · ${flow.dayLabel}`;
    }
    if (flow.kind === "assign-investigator" && flow.draftInvestigator) {
      return `${flow.kase.subjectName} · ${flow.kase.caseNumber} → ${flow.draftInvestigator.name} · ${flow.dayLabel}`;
    }
    return flow.dayLabel;
  })();

  const peers =
    flow.kind === "edit-notes" ? flow.othersThatDay : othersThatDay;

  const phaseKey =
    flow.kind === "edit-notes"
      ? `edit-${flow.block.id}`
      : `${flow.kind}-${phase}-${
          flow.kind === "assign-case"
            ? flow.draftCase?.id ?? "pick"
            : flow.draftInvestigator?.id ?? "pick"
        }`;

  return (
    <>
      <div className="anim-backdrop fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 flex h-[min(42rem,90vh)] w-[min(48rem,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col">
        <div className="surface flex h-full min-h-0 flex-1 flex-col gap-5 overflow-hidden rounded-[1rem] p-7 sm:p-8">
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="editorial text-[1.5rem] leading-tight text-[var(--color-text-hi)] sm:text-[1.65rem]">
                {title}
              </h2>
              <p className="mt-1 font-mono text-[0.75rem] text-[var(--color-text-lo)]">{subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {phase === "notes" && !isDraft && (
                <button
                  type="button"
                  onClick={onGoToCase}
                  className="flex items-center gap-1 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[0.65625rem] text-[var(--color-text-mid)] transition-colors hover:border-[rgba(74,127,255,0.45)] hover:text-[var(--color-accent-2)]"
                >
                  <ArrowUpRight size={11} strokeWidth={1.8} />
                  Go to case
                </button>
              )}
              <button type="button" onClick={onClose} className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
                <X size={16} />
              </button>
            </div>
          </div>

          <div key={phaseKey} className="anim-assign-phase flex min-h-0 flex-1 flex-col gap-5">
            {flow.kind === "assign-case" && phase === "pick" && (
              <PickCaseStep flow={flow} busy={busy} onPick={(id) => onDraftCase?.(id)} />
            )}
            {flow.kind === "assign-investigator" && phase === "pick" && (
              <PickInvestigatorStep
                flow={flow}
                busy={busy}
                dateValue={dateValue}
                onDateChange={onDateChange}
                onCreateSpecial={onCreateSpecial}
                onPick={(id) => onDraftInvestigator?.(id)}
              />
            )}
            {phase === "notes" && (
              <NotesStep
                initialNotes={
                  flow.kind === "edit-notes" ? (flow.block.notes ?? "") : flow.draftNotes
                }
                notesKey={
                  flow.kind === "edit-notes"
                    ? flow.block.id
                    : flow.kind === "assign-case"
                      ? flow.draftCase?.id ?? "draft"
                      : flow.draftInvestigator?.id ?? "draft"
                }
                othersThatDay={peers}
                canManage={canManage}
                isDraft={isDraft}
                busy={busy}
                onBack={isDraft ? onBackToPick : undefined}
                onCancel={onClose}
                onConfirm={async (notes) => {
                  if (isDraft) {
                    await onConfirmAssign?.(notes);
                  } else {
                    await onSaveNotes(notes);
                    onClose();
                  }
                }}
                onRemove={flow.kind === "edit-notes" ? onRemove : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function PickCaseStep({
  flow,
  busy,
  onPick,
}: {
  flow: AssignCaseFlow;
  busy?: boolean;
  onPick: (caseId: string) => void;
}) {
  const [q, setQ] = useState("");
  const prior = useMemo(
    () => new Set(flow.priorWork.map((p) => priorKey(p.caseId, p.userId))),
    [flow.priorWork],
  );
  const list = useMemo(() => {
    const pool = flow.cases.filter((c) => !flow.excludeCaseIds?.has(c.id));
    const sorted = sortCasesForInvestigator(pool, flow.investigator, prior);
    const needle = q.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter(
      (c) =>
        c.caseNumber.toLowerCase().includes(needle) ||
        c.subjectName.toLowerCase().includes(needle) ||
        (c.client?.company?.toLowerCase().includes(needle) ?? false) ||
        (c.region && REGION_LABELS[c.region].toLowerCase().includes(needle)),
    );
  }, [flow.cases, flow.excludeCaseIds, flow.investigator, prior, q]);

  return (
    <>
      <SearchField value={q} onChange={setQ} placeholder="Search cases…" />
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        {busy && <BusyRow />}
        {!busy && list.length === 0 && <EmptyRow text="No open cases to assign." />}
        {!busy &&
          list.map((c) => (
            <CaseGlanceCard
              key={c.id}
              glance={glanceFromListItem(c)}
              tone="amber"
              inert
              onOpen={busy ? undefined : () => onPick(c.id)}
            />
          ))}
      </div>
    </>
  );
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function MonthCalendar({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const selected = new Date(`${value}T12:00:00`);
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const lead = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];

  return (
    <div className="shrink-0 rounded-[1rem] border border-[var(--color-line)] px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-text-mid)] hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[0.9rem] font-medium text-[var(--color-text-hi)]">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-text-mid)] hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.72rem]">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
          <div key={label} className="py-1 text-[var(--color-text-lo)]">
            {label}
          </div>
        ))}
        {cells.map((day, index) =>
          day == null ? (
            <div key={`empty-${index}`} />
          ) : (
            <button
              key={day}
              type="button"
              onClick={() => onChange(isoDate(year, month, day))}
              className={cn(
                "rounded-full py-1.5 text-[var(--color-text-mid)] hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]",
                isoDate(year, month, day) === value && "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)] hover:text-white",
              )}
            >
              {day}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

const SPECIAL_COLORS = ["#c084fc", "#ffc857", "#3ee08a", "#5aa9ff", "#ff5c63", "#ff9f45"];

function SpecialDateForm({
  date,
  busy,
  onCreate,
}: {
  date: string;
  busy?: boolean;
  onCreate: (input: { date: string; name: string; color: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SPECIAL_COLORS[0]);
  return (
    <form
      className="flex flex-col gap-2 rounded-[0.75rem] border border-[var(--color-line)] px-3 py-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        void onCreate({ date, name: trimmed, color }).then(() => setName(""));
      }}
    >
      <div className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Special date</div>
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          maxLength={40}
          className="min-w-0 flex-1 rounded-full border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 py-1.5 text-[0.8125rem] text-[var(--color-text-hi)] outline-none"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] disabled:opacity-40"
        >
          Add
        </button>
      </div>
      <div className="flex gap-1.5">
        {SPECIAL_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={swatch}
            onClick={() => setColor(swatch)}
            className="h-5 w-5 rounded-full border-2"
            style={{ background: swatch, borderColor: color === swatch ? "#fff" : "transparent" }}
          />
        ))}
      </div>
    </form>
  );
}

function PickInvestigatorStep({
  flow,
  busy,
  dateValue,
  onDateChange,
  onCreateSpecial,
  onPick,
}: {
  flow: AssignInvestigatorFlow;
  busy?: boolean;
  dateValue?: string;
  onDateChange?: (iso: string) => void;
  onCreateSpecial?: (input: { date: string; name: string; color: string }) => Promise<void>;
  onPick: (userId: string) => void;
}) {
  const [q, setQ] = useState("");
  const prior = useMemo(
    () => new Set(flow.priorWork.map((p) => priorKey(p.caseId, p.userId))),
    [flow.priorWork],
  );
  const list = useMemo(() => {
    const pool = flow.investigators.filter((i) => !flow.excludeUserIds?.has(i.id));
    const sorted = sortInvestigatorsForCase(pool, flow.kase, prior);
    const needle = q.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter(
      (i) =>
        i.name.toLowerCase().includes(needle) ||
        i.email.toLowerCase().includes(needle) ||
        (i.region && REGION_LABELS[i.region].toLowerCase().includes(needle)),
    );
  }, [flow.investigators, flow.excludeUserIds, flow.kase, prior, q]);

  return (
    <>
      {dateValue && onDateChange && <MonthCalendar value={dateValue} onChange={onDateChange} />}
      {dateValue && onCreateSpecial && <SpecialDateForm date={dateValue} busy={busy} onCreate={onCreateSpecial} />}
      <SearchField value={q} onChange={setQ} placeholder="Search investigators…" />
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {busy && <BusyRow />}
        {!busy && list.length === 0 && <EmptyRow text="No investigators available." />}
        {!busy &&
          list.map((inv) => {
            const matched = !!flow.kase.region && inv.region === flow.kase.region;
            const worked = prior.has(priorKey(flow.kase.id, inv.id));
            const cover = placeholderCoverStatus(inv.id);
            return (
              <button
                key={inv.id}
                type="button"
                disabled={busy}
                onClick={() => onPick(inv.id)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-[0.625rem] border px-3 py-2.5 text-left transition-colors",
                  matched
                    ? "border-[rgba(74,222,128,0.45)] bg-[color-mix(in_srgb,var(--color-pos)_18%,var(--color-ink-3))]"
                    : "border-[var(--color-line)] bg-[var(--color-ink-2)] hover:border-[var(--color-line-2)]",
                )}
              >
                <span
                  className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
                  style={{ background: INVESTIGATOR_BG }}
                >
                  <User size={15} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{inv.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {matched ? (
                      <SignalBadge
                        icon={<MapPin size={9} strokeWidth={1.8} />}
                        label="Same region"
                        className="bg-[rgba(74,222,128,0.12)] text-[var(--color-pos)]"
                      />
                    ) : (
                      <SignalBadge
                        icon={<MapPin size={9} strokeWidth={1.8} />}
                        label={inv.region ? REGION_LABELS[inv.region] : "No region"}
                        className="bg-[var(--color-ink-3)] text-[var(--color-text-mid)]"
                      />
                    )}
                    {worked ? (
                      <SignalBadge
                        icon={<History size={9} strokeWidth={1.8} />}
                        label="Previously assigned"
                        className="bg-[rgba(74,127,255,0.12)] text-[var(--color-accent-2)]"
                      />
                    ) : (
                      <SignalBadge
                        icon={<Sparkles size={9} strokeWidth={1.8} />}
                        label="Never assigned"
                        className="bg-[var(--color-ink-3)] text-[var(--color-text-lo)]"
                      />
                    )}
                    <CoverStatusMark status={cover} size={11} />
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </>
  );
}

function NotesStep({
  initialNotes,
  notesKey,
  othersThatDay,
  canManage,
  isDraft,
  busy: parentBusy,
  onBack,
  onCancel,
  onConfirm,
  onRemove,
}: {
  initialNotes: string;
  notesKey: string;
  othersThatDay: ScheduleBlock[];
  canManage: boolean;
  isDraft: boolean;
  busy?: boolean;
  onBack?: () => void;
  onCancel: () => void;
  onConfirm: (notes: string | null) => Promise<void>;
  onRemove?: () => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(initialNotes);
    setError(null);
  }, [notesKey, initialNotes]);

  const save = async () => {
    const next = notes.trim() || null;
    if (!isDraft && next === (initialNotes.trim() || null)) {
      onCancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the changes.");
    } finally {
      setBusy(false);
    }
  };

  const locked = busy || parentBusy;

  return (
    <>
      {othersThatDay.length > 0 && (
        <div className="shrink-0 rounded-[0.625rem] border border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.07)] px-3.5 py-2.5 text-[0.75rem] text-[#fb923c]">
          Also on this case that day: {othersThatDay.map((b) => b.user.name).join(", ")}.
        </div>
      )}

      {canManage ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <label className="mb-1.5 block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--color-text-lo)]">
            Notes <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Meet at the Wawa on Route 9, bring the long lens…"
            autoFocus
            className="min-h-[9rem] w-full flex-1 resize-y rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3.5 py-3 text-[0.875rem] leading-relaxed text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          {isDraft && (
            <p className="mt-2 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
              Nothing is saved until you press Done. Cancel discards this assignment.
            </p>
          )}
        </div>
      ) : initialNotes ? (
        <p className="rounded-[0.625rem] bg-[var(--color-ink-2)] px-3.5 py-3 text-[0.875rem] leading-relaxed text-[var(--color-text-mid)]">
          {initialNotes}
        </p>
      ) : (
        <p className="font-mono text-[0.75rem] text-[var(--color-text-lo)]">No notes on this assignment.</p>
      )}

      {error && <div className="text-[0.75rem] text-[var(--color-neg)]">{error}</div>}

      {canManage && (
        <div className="flex shrink-0 items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                disabled={locked}
                onClick={onBack}
                className="flex items-center gap-1.5 rounded-[0.625rem] border border-[var(--color-line)] px-3.5 py-2.5 text-[0.8125rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] disabled:opacity-50"
              >
                <ArrowLeft size={12} strokeWidth={1.8} />
                Back
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                disabled={locked}
                onClick={onRemove}
                className="flex items-center gap-1.5 rounded-[0.625rem] border border-[rgba(248,113,113,0.3)] px-3.5 py-2.5 text-[0.8125rem] text-[var(--color-neg)] transition-colors hover:bg-[rgba(248,113,113,0.08)] disabled:opacity-50"
              >
                <Trash2 size={12} strokeWidth={1.8} />
                Remove
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={onCancel}
              className="rounded-[0.625rem] border border-[var(--color-line)] px-4 py-2.5 text-[0.8125rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={locked}
              className="flex items-center gap-2 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-5 py-2.5 text-[0.8125rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)] disabled:pointer-events-none disabled:opacity-50"
            >
              {locked && <Loader2 size={13} className="animate-spin" />}
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative shrink-0">
      <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
        className="w-full rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] py-2 pl-8 pr-3 text-[0.8125rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]"
      />
    </div>
  );
}

function BusyRow() {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-[var(--color-text-lo)]">
      <Loader2 size={14} className="animate-spin" />
      Saving…
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="grid place-items-center py-10 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">{text}</div>
  );
}

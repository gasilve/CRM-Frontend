/**
 * Triage — decision-first. A sticky rail scores how complete the proposal is and
 * carries the accept/reject controls; gaps in the data are flagged inline.
 */
import { ArrowLeft, Car, Check, DownloadCloud, Loader2, Minus, Paperclip } from "lucide-react";
import { cn } from "@/lib/cn";
import { CaseTypePill, FilesPill, IngestorStatusPill, ReviewStatusPill } from "@/components/cases/PendingCasePills";
import {
  ASSIGNMENT_FIELDS,
  DecidedBanner,
  EditableField,
  ErrorBanner,
  NARRATIVE_FIELDS,
  RawPayload,
  SUBJECT_FIELDS,
  StringListEditor,
  TONE_FILL,
  TONE_RING,
  TONE_TEXT,
  VehicleEditor,
  fmtBytes,
  fmtDateTime,
  reviewActions,
  reviewChecklist,
  vehicleHeadline,
  type PendingCaseView,
} from "../design-kit";

export default function TriageDesign({ view }: { view: PendingCaseView }) {
  const { pendingCase, proposal, subject, assignment, vehicles, editing, decided, busy, error, rawJson, actions } =
    view;
  const specs = reviewActions(view);
  const checklist = reviewChecklist(view);
  const met = checklist.filter((entry) => entry.ok).length;
  const readiness = Math.round((met / checklist.length) * 100);
  const blocker = checklist.find((entry) => !entry.ok && !entry.advisory);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-4">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={actions.back}
            className="mb-2 inline-flex items-center gap-1.5 text-[0.71875rem] text-[var(--color-text-lo)] transition-colors hover:text-[var(--color-text-hi)]"
          >
            <ArrowLeft size={13} strokeWidth={1.8} />
            Pending cases
          </button>
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">
            {pendingCase.subjectName ?? "Unnamed subject"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
              {pendingCase.claimNumber ?? "no claim number"} · received {fmtDateTime(pendingCase.receivedAt)}
            </span>
            <CaseTypePill caseType={pendingCase.ingestorCaseType} />
            <IngestorStatusPill status={pendingCase.ingestorStatus} />
          </div>
        </div>
        <ReviewStatusPill status={pendingCase.status} />
      </header>

      {error && <ErrorBanner message={error} />}
      {decided && <DecidedBanner view={view} />}

      <div className="flex flex-wrap items-start gap-4">
        <main className="flex min-w-[26rem] flex-1 flex-col gap-4">
          <Card title="Subject">
            <div className="anim-stagger anim-stagger-tight grid grid-cols-2 gap-3">
              {SUBJECT_FIELDS.map((field) => (
                <Gap key={field.key} empty={!subject[field.key]} editing={editing}>
                  <EditableField
                    label={field.label}
                    value={subject[field.key]}
                    editing={editing}
                    mono={field.mono}
                    onChange={(value) => actions.setSubject({ [field.key]: value })}
                  />
                </Gap>
              ))}
            </div>
            <div className="hairline my-4" />
            <div className="grid grid-cols-2 gap-4">
              <StringListEditor
                label="Addresses"
                values={subject.addresses}
                editing={editing}
                placeholder="Street, city, state ZIP"
                onChange={(addresses) => actions.setSubject({ addresses })}
              />
              <StringListEditor
                label="Phones"
                values={subject.phones}
                editing={editing}
                placeholder="(555) 555-5555"
                onChange={(phones) => actions.setSubject({ phones })}
              />
            </div>
          </Card>

          <Card title="Assignment">
            <div className="anim-stagger anim-stagger-tight grid grid-cols-3 gap-3">
              {ASSIGNMENT_FIELDS.map((field) => (
                <Gap key={field.key} empty={!assignment[field.key]} editing={editing}>
                  <EditableField
                    label={field.label}
                    value={assignment[field.key]}
                    editing={editing}
                    mono={field.mono}
                    onChange={(value) => actions.setAssignment({ [field.key]: value })}
                  />
                </Gap>
              ))}
            </div>
            <div className="hairline my-4" />
            <div className="anim-stagger anim-stagger-tight flex flex-col gap-3">
              {NARRATIVE_FIELDS.map((field) => (
                <EditableField
                  key={field.key}
                  label={field.label}
                  value={assignment[field.key]}
                  editing={editing}
                  multiline
                  onChange={(value) => actions.setAssignment({ [field.key]: value })}
                />
              ))}
            </div>
          </Card>

          <Card
            title={`Vehicles (${vehicles.length})`}
            action={
              editing ? (
                <button
                  type="button"
                  onClick={actions.addVehicle}
                  className="text-[0.65625rem] text-[var(--color-accent-2)]"
                >
                  + Add
                </button>
              ) : undefined
            }
          >
            {vehicles.length === 0 ? (
              <p className="text-[0.78125rem] text-[var(--color-text-lo)]">No vehicles in this payload.</p>
            ) : (
              <div className="anim-stagger anim-stagger-tight flex flex-col gap-2">
                {vehicles.map((vehicle, index) =>
                  editing ? (
                    <VehicleEditor
                      key={index}
                      vehicle={vehicle}
                      onChange={(patch) => actions.setVehicle(index, patch)}
                      onRemove={() => actions.removeVehicle(index)}
                    />
                  ) : (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 px-3 py-2"
                    >
                      <Car size={14} strokeWidth={1.6} className="shrink-0 text-[var(--color-text-lo)]" />
                      <span className="min-w-0 flex-1 truncate text-[0.78125rem] text-[var(--color-text-hi)]">
                        {vehicleHeadline(vehicle)}
                      </span>
                      <span className="shrink-0 rounded-[0.3125rem] bg-[var(--color-ink-3)] px-1.5 py-0.5 font-mono text-[0.625rem] tracking-wider text-[var(--color-text-mid)]">
                        {vehicle.plate ?? "no plate"}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </Card>

          <Card title="Email source">
            <dl className="grid grid-cols-3 gap-3">
              <Field label="From" value={proposal.emailSource.from} mono />
              <Field label="Received" value={proposal.emailSource.receivedAt} mono />
              <Field label="Classified as" value={proposal.emailSource.classification} />
            </dl>
            {proposal.emailSource.subject && (
              <>
                <div className="hairline my-3" />
                <p className="text-[0.75rem] leading-relaxed text-[var(--color-text-mid)]">
                  {proposal.emailSource.subject}
                </p>
              </>
            )}
          </Card>

          <RawPayload json={rawJson} />
        </main>

        {/* Decision rail */}
        <aside className="sticky top-0 flex w-[19rem] shrink-0 flex-col gap-4">
          <div className="surface overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-5">
              <ReadinessRing percent={readiness} />
              <div className="min-w-0">
                <div className="eyebrow">Readiness</div>
                <div className="editorial text-[1.5rem] leading-tight text-[var(--color-text-hi)]">
                  {met} of {checklist.length}
                </div>
                <p className="mt-0.5 text-[0.65625rem] leading-snug text-[var(--color-text-lo)]">
                  {blocker ? `${blocker.label} is required` : "Everything required is present"}
                </p>
              </div>
            </div>

            <ul className="anim-stagger anim-stagger-tight border-t border-[var(--color-line)]">
              {checklist.map((entry) => (
                <li
                  key={entry.label}
                  className="flex items-start gap-2.5 border-b border-[var(--color-line)] px-5 py-2.5 last:border-b-0"
                >
                  <span
                    className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full"
                    style={{
                      background: entry.ok
                        ? "rgba(74,222,128,0.16)"
                        : entry.advisory
                          ? "rgba(245,158,11,0.14)"
                          : "rgba(248,113,113,0.16)",
                      color: entry.ok ? "#4ade80" : entry.advisory ? "var(--color-warn)" : "var(--color-neg)",
                    }}
                  >
                    {entry.ok ? <Check size={9} strokeWidth={3} /> : <Minus size={9} strokeWidth={3} />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[0.71875rem] text-[var(--color-text-hi)]">{entry.label}</div>
                    <div className="truncate text-[0.625rem] text-[var(--color-text-lo)]" title={entry.detail}>
                      {entry.detail}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {specs.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-[var(--color-line)] p-4">
                {specs
                  .filter((spec) => spec.primary)
                  .map((spec) => (
                    <button
                      key={spec.key}
                      type="button"
                      disabled={spec.disabled}
                      onClick={spec.onClick}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[0.625rem] border text-[0.8125rem] font-medium text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)] disabled:opacity-50"
                      style={{ borderColor: TONE_RING[spec.tone], background: TONE_FILL[spec.tone] }}
                    >
                      {spec.loading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <spec.icon size={14} strokeWidth={1.8} />
                      )}
                      {spec.label}
                    </button>
                  ))}
                <div className="flex gap-2">
                  {specs
                    .filter((spec) => !spec.primary)
                    .map((spec) => (
                      <button
                        key={spec.key}
                        type="button"
                        disabled={spec.disabled}
                        onClick={spec.onClick}
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[0.5rem] border text-[0.71875rem] transition-colors disabled:opacity-50"
                        style={{ borderColor: TONE_RING[spec.tone], color: TONE_TEXT[spec.tone] }}
                      >
                        {spec.loading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <spec.icon size={12} strokeWidth={1.8} />
                        )}
                        {spec.label}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">Files</span>
              <FilesPill status={pendingCase.filesStatus} />
            </div>
            {pendingCase.filesError && (
              <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--color-neg)]">{pendingCase.filesError}</p>
            )}
            <div className="anim-stagger anim-stagger-tight mt-3 flex flex-col gap-2">
              {pendingCase.files.length === 0 ? (
                <p className="text-[0.71875rem] leading-relaxed text-[var(--color-text-lo)]">
                  {proposal.attachments.length > 0
                    ? `${proposal.attachments.length} listed, none stored yet.`
                    : "No attachments sent."}
                </p>
              ) : (
                pendingCase.files.map((file) => (
                  <div key={file.id} className="flex items-start gap-2">
                    <Paperclip size={11} className="mt-1 shrink-0 text-[var(--color-text-lo)]" />
                    <div className="min-w-0">
                      <div className="truncate text-[0.71875rem] text-[var(--color-text-hi)]">{file.filename}</div>
                      <div className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
                        {fmtBytes(file.sizeBytes)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              disabled={busy !== null || !pendingCase.caseIngestorCode}
              onClick={actions.fetchFiles}
              title={pendingCase.caseIngestorCode ? undefined : "This proposal has no ingestor case code"}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] py-1.5 text-[0.65625rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] disabled:opacity-40"
            >
              {busy === "files" ? <Loader2 size={11} className="animate-spin" /> : <DownloadCloud size={11} />}
              Fetch from ingestor
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReadinessRing({ percent }: { percent: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  return (
    <div className="relative grid h-[3.5rem] w-[3.5rem] shrink-0 place-items-center">
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="var(--color-line-2)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="url(#readiness)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
        <defs>
          <linearGradient id="readiness" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute font-mono text-[0.71875rem] text-[var(--color-text-hi)]">{percent}%</span>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-2.5">
        <span className="eyebrow">{title}</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Highlights a blank field while reviewing so gaps are obvious at a glance. */
function Gap({ empty, editing, children }: { empty: boolean; editing: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[0.375rem]",
        empty && !editing && "border border-dashed border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.04)] p-1.5",
      )}
    >
      {children}
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</dt>
      <dd
        className={cn(
          "break-words text-[0.78125rem] text-[var(--color-text-hi)]",
          mono && "font-mono text-[0.71875rem]",
          !value && "text-[var(--color-text-lo)]",
        )}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

/**
 * Dossier — editorial. Serif headline, numbered sections separated by hairlines
 * rather than boxes, and a sticky rail that tells the provenance story.
 */
import { ArrowLeft, Car, DownloadCloud, Loader2, Mail, Paperclip } from "lucide-react";
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
  vehicleHeadline,
  type PendingCaseView,
} from "../design-kit";

export default function DossierDesign({ view }: { view: PendingCaseView }) {
  const { pendingCase, proposal, subject, assignment, vehicles, editing, decided, busy, error, rawJson, actions } =
    view;
  const specs = reviewActions(view);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pb-4">
      {/* Hero */}
      <header className="surface relative shrink-0 overflow-hidden px-7 py-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full opacity-70"
          style={{ background: "radial-gradient(circle, var(--color-accent-soft), transparent 68%)" }}
        />
        <div
          aria-hidden
          className="absolute left-0 top-0 h-full w-[0.1875rem]"
          style={{ background: "linear-gradient(180deg, var(--color-accent), transparent)" }}
        />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="eyebrow text-[var(--color-accent-2)]">Case proposal</span>
              <span className="h-px w-10 bg-[var(--color-line-2)]" />
              <ReviewStatusPill status={pendingCase.status} />
            </div>

            <h1 className="editorial mt-3 text-[3rem] leading-[0.95] text-[var(--color-text-hi)]">
              {pendingCase.subjectName ?? "Unnamed subject"}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
              <span className="rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 font-mono text-[0.6875rem] tracking-wide text-[var(--color-text-hi)]">
                {pendingCase.claimNumber ?? "no claim number"}
              </span>
              <CaseTypePill caseType={pendingCase.ingestorCaseType} />
              <IngestorStatusPill status={pendingCase.ingestorStatus} />
              {pendingCase.caseIngestorCode && (
                <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
                  ingestor #{pendingCase.caseIngestorCode}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-3">
            <button
              type="button"
              onClick={actions.back}
              className="inline-flex items-center gap-1.5 text-[0.71875rem] text-[var(--color-text-lo)] transition-colors hover:text-[var(--color-text-hi)]"
            >
              <ArrowLeft size={13} strokeWidth={1.8} />
              Pending cases
            </button>

            {specs.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {specs.map((spec) => (
                  <button
                    key={spec.key}
                    type="button"
                    disabled={spec.disabled}
                    onClick={spec.onClick}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-[0.625rem] border px-3.5 text-[0.75rem] transition-colors disabled:opacity-50",
                      spec.primary && "font-medium",
                    )}
                    style={{
                      borderColor: TONE_RING[spec.tone],
                      background: TONE_FILL[spec.tone],
                      color: spec.primary ? "var(--color-text-hi)" : TONE_TEXT[spec.tone],
                    }}
                  >
                    {spec.loading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <spec.icon size={13} strokeWidth={1.8} />
                    )}
                    {spec.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {error && <ErrorBanner message={error} />}
      {decided && <DecidedBanner view={view} />}

      <div className="flex flex-wrap items-start gap-6">
        {/* Narrative column */}
        <main className="min-w-[28rem] flex-1">
          <Section index="01" title="The subject">
            <div className="anim-stagger anim-stagger-tight grid grid-cols-2 gap-x-8 gap-y-4">
              {SUBJECT_FIELDS.map((field) => (
                <EditableField
                  key={field.key}
                  label={field.label}
                  value={subject[field.key]}
                  editing={editing}
                  mono={field.mono}
                  onChange={(value) => actions.setSubject({ [field.key]: value })}
                />
              ))}
            </div>

            <div className="hairline my-5" />

            <div className="grid grid-cols-2 gap-8">
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
          </Section>

          <Section index="02" title="The assignment">
            <div className="anim-stagger anim-stagger-tight grid grid-cols-3 gap-x-8 gap-y-4">
              {ASSIGNMENT_FIELDS.map((field) => (
                <EditableField
                  key={field.key}
                  label={field.label}
                  value={assignment[field.key]}
                  editing={editing}
                  mono={field.mono}
                  onChange={(value) => actions.setAssignment({ [field.key]: value })}
                />
              ))}
            </div>
          </Section>

          <Section index="03" title="In their words">
            <div className="anim-stagger flex flex-col gap-5">
              {NARRATIVE_FIELDS.map((field) => {
                const value = assignment[field.key];
                if (editing) {
                  return (
                    <EditableField
                      key={field.key}
                      label={field.label}
                      value={value}
                      editing
                      multiline
                      onChange={(next) => actions.setAssignment({ [field.key]: next })}
                    />
                  );
                }
                return (
                  <figure key={field.key} className="border-l-2 border-[var(--color-line-2)] pl-4">
                    <figcaption className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                      {field.label}
                    </figcaption>
                    <p
                      className={cn(
                        "mt-1.5 text-[0.84375rem] leading-relaxed",
                        value ? "text-[var(--color-text-mid)]" : "text-[var(--color-text-lo)]",
                      )}
                    >
                      {value ?? "Nothing recorded."}
                    </p>
                  </figure>
                );
              })}
            </div>
          </Section>

          <Section
            index="04"
            title={`Vehicles (${vehicles.length})`}
            action={
              editing ? (
                <button
                  type="button"
                  onClick={actions.addVehicle}
                  className="text-[0.65625rem] text-[var(--color-accent-2)]"
                >
                  + Add vehicle
                </button>
              ) : undefined
            }
          >
            {vehicles.length === 0 ? (
              <p className="text-[0.78125rem] text-[var(--color-text-lo)]">No vehicles in this payload.</p>
            ) : (
              <div className="anim-stagger flex flex-col gap-2.5">
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
                      className="flex items-center gap-4 rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/30 px-4 py-3"
                    >
                      <Car size={16} strokeWidth={1.6} className="shrink-0 text-[var(--color-text-lo)]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[0.84375rem] text-[var(--color-text-hi)]">
                          {vehicleHeadline(vehicle)}
                        </div>
                        <div className="truncate font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                          {vehicle.registeredOwner ? `owner: ${vehicle.registeredOwner}` : "owner unknown"}
                          {vehicle.source ? ` · ${vehicle.source}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-[0.3125rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 font-mono text-[0.6875rem] tracking-[0.12em] text-[var(--color-text-hi)]">
                        {vehicle.plate ?? "no plate"}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </Section>

          <RawPayload json={rawJson} className="mt-8" />
        </main>

        {/* Provenance rail */}
        <aside className="sticky top-0 flex w-[19rem] shrink-0 flex-col gap-5">
          <div className="surface p-5">
            <span className="eyebrow">Provenance</span>
            <ol className="mt-4 flex flex-col">
              <TimelineStep
                icon={<Mail size={11} strokeWidth={2} />}
                label="Email received"
                value={proposal.emailSource.receivedAt ?? "unknown"}
                caption={proposal.emailSource.from}
              />
              <TimelineStep
                icon={<span className="text-[0.5rem]">◆</span>}
                label="Classified"
                value={proposal.emailSource.classification ?? "unclassified"}
                caption={proposal.emailSource.subject}
              />
              <TimelineStep
                icon={<span className="text-[0.5rem]">↑</span>}
                label="Pushed by ingestor"
                value={proposal.pushedAt ?? "—"}
              />
              <TimelineStep
                icon={<span className="text-[0.5rem]">●</span>}
                label="Received by CRM"
                value={fmtDateTime(pendingCase.receivedAt)}
                accent
                last={!pendingCase.reviewedAt}
              />
              {pendingCase.reviewedAt && (
                <TimelineStep
                  icon={<span className="text-[0.5rem]">✓</span>}
                  label="Reviewed"
                  value={fmtDateTime(pendingCase.reviewedAt)}
                  caption={pendingCase.reviewedBy?.name ?? null}
                  last
                />
              )}
            </ol>
          </div>

          <div className="surface p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">Files</span>
              <FilesPill status={pendingCase.filesStatus} />
            </div>

            {pendingCase.filesError && (
              <p className="mt-3 text-[0.6875rem] leading-relaxed text-[var(--color-neg)]">{pendingCase.filesError}</p>
            )}

            <div className="anim-stagger anim-stagger-tight mt-3 flex flex-col gap-2">
              {pendingCase.files.length === 0 ? (
                <p className="text-[0.75rem] leading-relaxed text-[var(--color-text-lo)]">
                  {proposal.attachments.length > 0
                    ? `${proposal.attachments.length} attachment(s) listed, none stored yet.`
                    : "No attachments were sent with this case."}
                </p>
              ) : (
                pendingCase.files.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => actions.openFile(file.id)}
                    className="flex w-full items-start gap-2 rounded-[0.375rem] px-1 py-1 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <Paperclip size={11} className="mt-1 shrink-0 text-[var(--color-text-lo)]" />
                    <div className="min-w-0">
                      <div className="truncate text-[0.75rem] text-[var(--color-text-hi)]">{file.filename}</div>
                      <div className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
                        {fmtBytes(file.sizeBytes)} · {file.storage}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <button
              type="button"
              disabled={busy !== null || !pendingCase.caseIngestorCode}
              onClick={actions.fetchFiles}
              title={pendingCase.caseIngestorCode ? undefined : "This proposal has no ingestor case code"}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] py-2 text-[0.6875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] disabled:opacity-40"
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

function Section({
  index,
  title,
  action,
  children,
}: {
  index: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="eyebrow text-[var(--color-text-lo)]">{index}</span>
        <h2 className="editorial text-[1.375rem] text-[var(--color-text-hi)]">{title}</h2>
        <span className="h-px flex-1 bg-[var(--color-line)]" />
        {action}
      </div>
      {children}
    </section>
  );
}

function TimelineStep({
  icon,
  label,
  value,
  caption,
  accent = false,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption?: string | null;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex shrink-0 flex-col items-center">
        <span
          className="grid h-5 w-5 place-items-center rounded-full border text-[var(--color-text-lo)]"
          style={{
            borderColor: accent ? "rgba(74,127,255,0.45)" : "var(--color-line-2)",
            background: accent ? "var(--color-accent-soft)" : "var(--color-ink-3)",
            color: accent ? "var(--color-accent-2)" : undefined,
          }}
        >
          {icon}
        </span>
        {!last && <span className="w-px flex-1 bg-[var(--color-line-2)]" />}
      </div>
      <div className={cn("min-w-0", last ? "pb-0" : "pb-4")}>
        <div className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</div>
        <div className="break-words text-[0.75rem] text-[var(--color-text-hi)]">{value}</div>
        {caption && <div className="mt-0.5 line-clamp-2 text-[0.65625rem] text-[var(--color-text-lo)]">{caption}</div>}
      </div>
    </li>
  );
}

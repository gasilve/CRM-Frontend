/**
 * Atlas — bento. Asymmetric tiles with watermark icons, so the whole proposal is
 * scannable in one view without scrolling through stacked panels.
 */
import type { ReactNode } from "react";
import { ArrowLeft, Car, DownloadCloud, FileText, Loader2, Mail, Paperclip, ShieldAlert, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { CaseTypePill, FilesPill, IngestorStatusPill, ReviewStatusPill } from "@/components/cases/PendingCasePills";
import {
  DecidedBanner,
  EditableField,
  ErrorBanner,
  NARRATIVE_FIELDS,
  RawPayload,
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

export default function AtlasDesign({ view }: { view: PendingCaseView }) {
  const { pendingCase, proposal, subject, assignment, vehicles, editing, decided, busy, error, rawJson, actions } =
    view;
  const specs = reviewActions(view);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pb-4">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={actions.back}
          className="inline-flex items-center gap-1.5 rounded-[0.625rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          Pending cases
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {specs.map((spec) => (
            <button
              key={spec.key}
              type="button"
              disabled={spec.disabled}
              onClick={spec.onClick}
              className="inline-flex h-9 items-center gap-2 rounded-[0.625rem] border px-3.5 text-[0.75rem] transition-shadow hover:shadow-[0_0_0_0.1875rem_rgba(74,127,255,0.10)] disabled:opacity-50"
              style={{
                borderColor: TONE_RING[spec.tone],
                background: TONE_FILL[spec.tone],
                color: spec.primary ? "var(--color-text-hi)" : TONE_TEXT[spec.tone],
              }}
            >
              {spec.loading ? <Loader2 size={13} className="animate-spin" /> : <spec.icon size={13} strokeWidth={1.8} />}
              {spec.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {decided && <DecidedBanner view={view} />}

      <div className="grid grid-cols-12 gap-3">
        {/* Hero */}
        <Tile span="col-span-12 xl:col-span-8" glow>
          <div className="relative">
            <span className="eyebrow text-[var(--color-accent-2)]">Incoming proposal</span>
            <h1 className="editorial mt-2 text-[2.75rem] leading-[0.95] text-[var(--color-text-hi)]">
              {pendingCase.subjectName ?? "Unnamed subject"}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 font-mono text-[0.6875rem] text-[var(--color-text-hi)]">
                {pendingCase.claimNumber ?? "no claim number"}
              </span>
              <CaseTypePill caseType={pendingCase.ingestorCaseType} />
              <IngestorStatusPill status={pendingCase.ingestorStatus} />
              <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
                received {fmtDateTime(pendingCase.receivedAt)}
              </span>
            </div>
          </div>
        </Tile>

        {/* Status */}
        <Tile span="col-span-12 xl:col-span-4" icon={ShieldAlert} label="Status">
          <div className="mt-2 flex flex-col gap-3">
            <ReviewStatusPill status={pendingCase.status} className="self-start" />
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Insurer" value={assignment.insurer} />
              <Stat label="Adjuster" value={assignment.adjusterName} />
              <Stat label="Date of loss" value={assignment.dateOfLoss} mono />
              <Stat label="Report due" value={assignment.reportDueDate} mono />
            </div>
          </div>
        </Tile>

        {/* Subject */}
        <Tile span="col-span-12 lg:col-span-5" icon={User} label="Subject">
          <div className="mt-3 grid grid-cols-2 gap-3">
            <EditableField
              label="Name"
              value={subject.name}
              editing={editing}
              onChange={(v) => actions.setSubject({ name: v })}
            />
            <EditableField
              label="Date of birth"
              value={subject.dob}
              editing={editing}
              mono
              onChange={(v) => actions.setSubject({ dob: v })}
            />
            <EditableField
              label="SSN (last 4)"
              value={subject.ssnLast4}
              editing={editing}
              mono
              onChange={(v) => actions.setSubject({ ssnLast4: v })}
            />
            <EditableField
              label="Job title"
              value={subject.job}
              editing={editing}
              onChange={(v) => actions.setSubject({ job: v })}
            />
            <EditableField
              label="Employer"
              value={subject.employer}
              editing={editing}
              onChange={(v) => actions.setSubject({ employer: v })}
            />
            <EditableField
              label="Employer phone"
              value={subject.employerPhone}
              editing={editing}
              mono
              onChange={(v) => actions.setSubject({ employerPhone: v })}
            />
            <EditableField
              className="col-span-2"
              label="Physical description"
              value={subject.physical}
              editing={editing}
              onChange={(v) => actions.setSubject({ physical: v })}
            />
          </div>

          <div className="hairline my-4" />

          <StringListEditor
            label="Addresses"
            values={subject.addresses}
            editing={editing}
            placeholder="Street, city, state ZIP"
            onChange={(addresses) => actions.setSubject({ addresses })}
          />
          <div className="mt-3">
            <StringListEditor
              label="Phones"
              values={subject.phones}
              editing={editing}
              placeholder="(555) 555-5555"
              onChange={(phones) => actions.setSubject({ phones })}
            />
          </div>
        </Tile>

        {/* Narrative */}
        <Tile span="col-span-12 lg:col-span-7" icon={FileText} label="Assignment detail">
          <div className="mt-3 grid grid-cols-2 gap-3">
            <EditableField
              label="Assignment type"
              value={assignment.type}
              editing={editing}
              onChange={(v) => actions.setAssignment({ type: v })}
            />
            <EditableField
              label="Surveillance days"
              value={assignment.surveillanceDays}
              editing={editing}
              mono
              onChange={(v) => actions.setAssignment({ surveillanceDays: v })}
            />
            <EditableField
              label="Claim type"
              value={assignment.typeOfClaim}
              editing={editing}
              onChange={(v) => actions.setAssignment({ typeOfClaim: v })}
            />
            <EditableField
              label="Represented"
              value={assignment.isRepresented}
              editing={editing}
              onChange={(v) => actions.setAssignment({ isRepresented: v })}
            />
          </div>

          <div className="hairline my-4" />

          <div className="anim-stagger flex flex-col gap-3">
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
        </Tile>

        {/* Vehicles */}
        <Tile
          span="col-span-12 lg:col-span-6"
          icon={Car}
          label={`Vehicles (${vehicles.length})`}
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
          <div className="anim-stagger mt-3 flex flex-col gap-2">
            {vehicles.length === 0 ? (
              <p className="text-[0.78125rem] text-[var(--color-text-lo)]">No vehicles in this payload.</p>
            ) : (
              vehicles.map((vehicle, index) =>
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
                    className="flex items-center gap-3 rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.78125rem] text-[var(--color-text-hi)]">
                        {vehicleHeadline(vehicle)}
                      </div>
                      <div className="truncate font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
                        {vehicle.registeredOwner ? `owner: ${vehicle.registeredOwner}` : "owner unknown"}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-[0.3125rem] bg-[var(--color-ink-4)] px-1.5 py-0.5 font-mono text-[0.625rem] tracking-wider text-[var(--color-text-hi)]">
                      {vehicle.plate ?? "no plate"}
                    </span>
                  </div>
                ),
              )
            )}
          </div>
        </Tile>

        {/* Files */}
        <Tile
          span="col-span-12 lg:col-span-6"
          icon={Paperclip}
          label="Files"
          action={<FilesPill status={pendingCase.filesStatus} />}
        >
          {pendingCase.filesError && (
            <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--color-neg)]">{pendingCase.filesError}</p>
          )}
          <div className="anim-stagger mt-3 flex flex-col gap-2">
            {pendingCase.files.length === 0 ? (
              <p className="text-[0.78125rem] leading-relaxed text-[var(--color-text-lo)]">
                {proposal.attachments.length > 0
                  ? `The ingestor listed ${proposal.attachments.length} attachment(s) but none are stored yet.`
                  : "The ingestor sent no attachments."}
              </p>
            ) : (
              pendingCase.files.map((file) => (
                <div
                  key={file.id}
                  className="rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 px-3 py-2"
                >
                  <div className="truncate text-[0.75rem] text-[var(--color-text-hi)]">{file.filename}</div>
                  <div className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
                    {fmtBytes(file.sizeBytes)} · {file.storage}
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
            className="mt-3 inline-flex items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] px-2.5 py-1.5 text-[0.65625rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] disabled:opacity-40"
          >
            {busy === "files" ? <Loader2 size={11} className="animate-spin" /> : <DownloadCloud size={11} />}
            Fetch from ingestor
          </button>
        </Tile>

        {/* Email */}
        <Tile span="col-span-12" icon={Mail} label="Email source">
          <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="From" value={proposal.emailSource.from} mono />
            <Stat label="Received" value={proposal.emailSource.receivedAt} mono />
            <Stat label="Classified as" value={proposal.emailSource.classification} />
            <Stat label="Pushed at" value={proposal.pushedAt} mono />
          </div>
          {proposal.emailSource.subject && (
            <>
              <div className="hairline my-3" />
              <p className="text-[0.78125rem] leading-relaxed text-[var(--color-text-mid)]">
                {proposal.emailSource.subject}
              </p>
            </>
          )}
        </Tile>
      </div>

      <RawPayload json={rawJson} />
    </div>
  );
}

function Tile({
  span,
  icon: Icon,
  label,
  action,
  glow = false,
  children,
}: {
  span: string;
  icon?: typeof User;
  label?: string;
  action?: ReactNode;
  glow?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn("surface surface-hover relative overflow-hidden p-5", span)}>
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full"
          style={{ background: "radial-gradient(circle, var(--color-accent-soft), transparent 70%)" }}
        />
      )}
      {Icon && (
        <Icon
          aria-hidden
          size={92}
          strokeWidth={0.6}
          className="pointer-events-none absolute -bottom-6 -right-5 text-[var(--color-text-hi)] opacity-[0.025]"
        />
      )}
      {label && (
        <div className="relative flex items-center gap-2">
          {Icon && <Icon size={12} strokeWidth={1.8} className="text-[var(--color-text-lo)]" />}
          <span className="eyebrow">{label}</span>
          {action && <span className="ml-auto">{action}</span>}
        </div>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</div>
      <div
        className={cn(
          "mt-0.5 break-words text-[0.8125rem] text-[var(--color-text-hi)]",
          mono && "font-mono text-[0.71875rem]",
          !value && "text-[var(--color-text-lo)]",
        )}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

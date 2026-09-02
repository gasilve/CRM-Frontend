/**
 * Grid — regular case layout. Read-only surface panels arranged like the
 * CaseDetail widget grid, previewing how the proposal would look after accept.
 */
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Briefcase,
  Car,
  DownloadCloud,
  FileText,
  LayoutGrid,
  Loader2,
  MapPin,
  Paperclip,
  ScrollText,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CaseTypePill, FilesPill, IngestorStatusPill, ReviewStatusPill } from "@/components/cases/PendingCasePills";
import { Field } from "@/pages/case-detail-panels";
import {
  DecidedBanner,
  ErrorBanner,
  TONE_FILL,
  TONE_RING,
  TONE_TEXT,
  fmtBytes,
  fmtDateTime,
  reviewActions,
  vehicleHeadline,
  type PendingCaseView,
} from "../design-kit";

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
    <div className={cn("surface flex h-full min-h-[10rem] flex-col overflow-hidden", className)}>
      <div className="eyebrow flex shrink-0 items-center gap-2 border-b border-[var(--color-line)] px-4 py-2.5">
        {icon}
        {title}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}

const dash = (value: string | null | undefined): string => (value?.trim() ? value.trim() : "—");

export default function GridDesign({ view }: { view: PendingCaseView }) {
  const { pendingCase, proposal, claimNumber, subject, assignment, vehicles, decided, busy, error, actions } = view;
  const specs = reviewActions(view);

  const narrative = [
    assignment.injuryDescription && { label: "Injury", value: assignment.injuryDescription },
    assignment.bodyParts && { label: "Body parts", value: assignment.bodyParts },
    assignment.restrictions && { label: "Restrictions", value: assignment.restrictions },
    assignment.suspicion && { label: "Reason for case", value: assignment.suspicion },
    assignment.instructions && { label: "Instructions", value: assignment.instructions },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <header className="surface shrink-0 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={actions.back}
            aria-label="Back to pending cases"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-lo)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            <ArrowLeft size={14} strokeWidth={1.8} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <LayoutGrid size={13} strokeWidth={1.8} className="text-[var(--color-accent-2)]" />
              <span className="eyebrow">Case layout preview</span>
              <ReviewStatusPill status={pendingCase.status} />
              <CaseTypePill caseType={pendingCase.ingestorCaseType} />
              <IngestorStatusPill status={pendingCase.ingestorStatus} />
            </div>
            <h1 className="mt-1 truncate text-[1.125rem] font-medium text-[var(--color-text-hi)]">
              {pendingCase.subjectName ?? "Unnamed subject"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {specs.map((spec) => (
              <button
                key={spec.key}
                type="button"
                disabled={spec.disabled}
                onClick={spec.onClick}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[0.5rem] px-3 py-1.5 text-[0.71875rem] transition-colors disabled:opacity-40",
                  spec.primary
                    ? cn(TONE_FILL[spec.tone], TONE_TEXT[spec.tone], TONE_RING[spec.tone], "border")
                    : "border border-[var(--color-line)] text-[var(--color-text-mid)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]",
                )}
              >
                {spec.loading ? <Loader2 size={12} className="animate-spin" /> : <spec.icon size={12} strokeWidth={1.8} />}
                {spec.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && <ErrorBanner message={error} />}
      {decided && <DecidedBanner view={view} />}

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <div className="grid grid-cols-12 gap-2">
          {/* Assignment details — spans top-left like case-info */}
          <PanelShell title="Assignment details" icon={<Briefcase size={11} strokeWidth={1.8} />} className="col-span-12 lg:col-span-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div className="space-y-3">
                <Field label="Client" value={dash(assignment.insurer)} mono={false} />
                <Field label="Claim #" value={dash(claimNumber)} />
                <Field label="Assignment type" value={dash(assignment.type)} mono={false} />
                <Field label="Claim type" value={dash(assignment.typeOfClaim)} mono={false} />
              </div>
              <div className="space-y-3">
                <Field label="Date of loss" value={dash(assignment.dateOfLoss)} />
                <Field label="Report due" value={dash(assignment.reportDueDate)} />
                <Field label="Surveillance days" value={dash(assignment.surveillanceDays)} />
                <Field label="Represented" value={dash(assignment.isRepresented)} mono={false} />
              </div>
            </div>
          </PanelShell>

          {/* Addresses */}
          <PanelShell title="Addresses" icon={<MapPin size={11} strokeWidth={1.8} />} className="col-span-12 lg:col-span-3">
            {subject.addresses.length === 0 ? (
              <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">No addresses in the proposal.</span>
            ) : (
              <div className="anim-stagger anim-stagger-tight flex flex-col gap-1.5">
                {subject.addresses.map((line, index) => (
                  <div
                    key={`${line}-${index}`}
                    className="flex items-start gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] px-2.5 py-2"
                  >
                    <MapPin size={11} className="mt-0.5 shrink-0 text-[var(--color-text-lo)]" />
                    <div className="min-w-0 text-[0.71875rem] text-[var(--color-text-hi)]">{line}</div>
                  </div>
                ))}
              </div>
            )}
          </PanelShell>

          {/* Post-accept placeholder */}
          <PanelShell title="After accept" icon={<User size={11} strokeWidth={1.8} />} className="col-span-12 lg:col-span-3">
            <p className="text-[0.75rem] leading-relaxed text-[var(--color-text-lo)]">
              Investigators, tags, subject photo, and the activity journal appear once this proposal becomes a case.
            </p>
            {pendingCase.reviewedAt && (
              <div className="mt-3 border-t border-[var(--color-line)] pt-3">
                <Field label="Reviewed" value={fmtDateTime(pendingCase.reviewedAt)} />
              </div>
            )}
          </PanelShell>

          {/* Identity */}
          <PanelShell title="Identity" icon={<User size={11} strokeWidth={1.8} />} className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className="space-y-2.5">
              <Field label="Name" value={dash(subject.name)} mono={false} />
              <Field label="Date of birth" value={dash(subject.dob)} />
              <Field label="SSN (last 4)" value={subject.ssnLast4 ? `•••-••-${subject.ssnLast4}` : "—"} />
              {subject.physical && (
                <div>
                  <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                    Description
                  </div>
                  <div className="text-[0.71875rem] leading-relaxed text-[var(--color-text-mid)]">{subject.physical}</div>
                </div>
              )}
              {subject.phones.length > 0 && (
                <div>
                  <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Phones</div>
                  <ul className="space-y-0.5">
                    {subject.phones.map((phone, index) => (
                      <li key={`${phone}-${index}`} className="font-mono text-[0.71875rem] text-[var(--color-text-hi)]">
                        {phone}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </PanelShell>

          {/* Work */}
          <PanelShell title="Work" icon={<Briefcase size={11} strokeWidth={1.8} />} className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className="space-y-2.5">
              <Field label="Job title" value={dash(subject.job)} mono={false} />
              <Field label="Employer" value={dash(subject.employer)} mono={false} />
              <Field label="Employer contact" value={dash(subject.employerContact)} mono={false} />
              <Field label="Employer phone" value={dash(subject.employerPhone)} />
            </div>
          </PanelShell>

          {/* Client & adjuster */}
          <PanelShell title="Client & adjuster" icon={<FileText size={11} strokeWidth={1.8} />} className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className="space-y-2.5">
              <Field label="Client" value={dash(assignment.insurer)} mono={false} />
              <Field label="Adjuster" value={dash(assignment.adjusterName)} mono={false} />
              <Field label="Adjuster email" value={dash(assignment.adjusterEmail)} />
              <Field label="Adjuster phone" value={dash(assignment.adjusterPhone)} />
            </div>
          </PanelShell>

          {/* Description / narrative */}
          <PanelShell title="Description" icon={<ScrollText size={11} strokeWidth={1.8} />} className="col-span-12 sm:col-span-6 lg:col-span-3">
            {narrative.length === 0 ? (
              <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-lo)]">No narrative fields in the proposal.</p>
            ) : (
              <div className="anim-stagger anim-stagger-tight space-y-3">
                {narrative.map((entry) => (
                  <div key={entry.label}>
                    <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                      {entry.label}
                    </div>
                    <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">{entry.value}</p>
                  </div>
                ))}
              </div>
            )}
            {(assignment.defenseAttorney || assignment.defenseLawFirm) && (
              <div className="mt-4 space-y-2.5 border-t border-[var(--color-line)] pt-3">
                <Field label="Defense attorney" value={dash(assignment.defenseAttorney)} mono={false} />
                <Field label="Defense firm" value={dash(assignment.defenseLawFirm)} mono={false} />
                <Field label="Defense phone" value={dash(assignment.defensePhone)} />
              </div>
            )}
          </PanelShell>

          {/* Vehicles — full width row */}
          <PanelShell title="Vehicles" icon={<Car size={11} strokeWidth={1.8} />} className="col-span-12 lg:col-span-8">
            {vehicles.length === 0 ? (
              <div className="grid h-full min-h-[5rem] place-items-center">
                <span className="font-mono text-[0.71875rem] text-[var(--color-text-lo)]">No vehicles in the proposal.</span>
              </div>
            ) : (
              <div className="anim-stagger anim-stagger-tight grid grid-cols-2 gap-2.5 lg:grid-cols-3">
                {vehicles.map((vehicle, index) => (
                  <div key={index} className="overflow-hidden rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]">
                    <div className="px-2.5 py-2">
                      <div className="truncate text-[0.71875rem] font-medium text-[var(--color-text-hi)]">
                        {vehicleHeadline(vehicle)}
                      </div>
                      {vehicle.plate && (
                        <div className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">{vehicle.plate}</div>
                      )}
                      {vehicle.registeredOwner && (
                        <div className="mt-1 truncate text-[0.625rem] text-[var(--color-text-lo)]">
                          Owner: {vehicle.registeredOwner}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelShell>

          {/* Files */}
          <PanelShell
            title="Files"
            icon={<Paperclip size={11} strokeWidth={1.8} />}
            className="col-span-12 lg:col-span-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <FilesPill status={pendingCase.filesStatus} />
              {pendingCase.filesError && (
                <span className="text-[0.625rem] text-[var(--color-neg)]">{pendingCase.filesError}</span>
              )}
            </div>

            {pendingCase.files.length === 0 ? (
              <p className="text-[0.75rem] leading-relaxed text-[var(--color-text-lo)]">
                {proposal.attachments.length > 0
                  ? `${proposal.attachments.length} attachment(s) listed, none stored yet.`
                  : "No attachments were sent with this case."}
              </p>
            ) : (
              <ul className="anim-stagger anim-stagger-tight space-y-2">
                {pendingCase.files.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => actions.openFile(file.id)}
                      className="flex w-full items-start gap-2 rounded-[0.375rem] px-1 py-1 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <Paperclip size={11} className="mt-1 shrink-0 text-[var(--color-text-lo)]" />
                      <div className="min-w-0">
                        <div className="truncate text-[0.75rem] text-[var(--color-text-hi)]">{file.filename}</div>
                        <div className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">
                          {fmtBytes(file.sizeBytes)}
                          {file.contentType ? ` · ${file.contentType}` : ""}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!decided && (
              <button
                type="button"
                disabled={busy === "files" || !pendingCase.caseIngestorCode}
                onClick={actions.fetchFiles}
                title={pendingCase.caseIngestorCode ? undefined : "This proposal has no ingestor case code"}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] py-2 text-[0.6875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] disabled:opacity-40"
              >
                {busy === "files" ? <Loader2 size={12} className="animate-spin" /> : <DownloadCloud size={12} />}
                Fetch from ingestor
              </button>
            )}
          </PanelShell>
        </div>
      </div>
    </div>
  );
}

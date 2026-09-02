/**
 * Ledger — the proposal typeset as a formal document. Centred sheet, letterhead,
 * roman-numbered articles and dotted-leader rows. Calm and print-like.
 */
import type { ReactNode } from "react";
import { ArrowLeft, DownloadCloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { FilesPill, ReviewStatusPill } from "@/components/cases/PendingCasePills";
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

export default function LedgerDesign({ view }: { view: PendingCaseView }) {
  const { pendingCase, proposal, subject, assignment, vehicles, editing, decided, busy, error, rawJson, actions } =
    view;
  const specs = reviewActions(view);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-6">
      {/* Toolbar sits outside the sheet so the document stays clean */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={actions.back}
          className="inline-flex items-center gap-1.5 text-[0.71875rem] text-[var(--color-text-lo)] transition-colors hover:text-[var(--color-text-hi)]"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          Pending cases
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ReviewStatusPill status={pendingCase.status} />
          {specs.map((spec) => (
            <button
              key={spec.key}
              type="button"
              disabled={spec.disabled}
              onClick={spec.onClick}
              className="inline-flex h-9 items-center gap-2 rounded-[0.625rem] border px-3.5 text-[0.75rem] transition-colors disabled:opacity-50"
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

      {/* The sheet */}
      <article className="surface mx-auto w-full max-w-[58rem] px-10 py-9">
        {/* Letterhead */}
        <header>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow text-[0.6875rem] tracking-[0.42em] text-[var(--color-text-hi)]">True Cognition</div>
              <div className="mt-1 font-mono text-[0.59375rem] uppercase tracking-[0.2em] text-[var(--color-text-lo)]">
                Investigative services
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[0.59375rem] uppercase tracking-[0.2em] text-[var(--color-text-lo)]">
                Case proposal
              </div>
              <div className="font-mono text-[0.8125rem] text-[var(--color-text-hi)]">
                {pendingCase.claimNumber ?? "no claim number"}
              </div>
            </div>
          </div>

          <div className="mt-4 h-px bg-[var(--color-line-3)]" />
          <div className="mt-1 h-px bg-[var(--color-line)]" />

          <div className="mt-7 text-center">
            <div className="eyebrow text-[var(--color-text-lo)]">In the matter of</div>
            <h1 className="editorial mt-2 text-[2.5rem] leading-tight text-[var(--color-text-hi)]">
              {pendingCase.subjectName ?? "Unnamed subject"}
            </h1>
            <p className="mt-2 font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
              Received {fmtDateTime(pendingCase.receivedAt)}
              {pendingCase.caseIngestorCode && ` · ingestor #${pendingCase.caseIngestorCode}`}
            </p>
          </div>

          <div className="mx-auto mt-6 h-px w-24 bg-[var(--color-line-2)]" />
        </header>

        <Article numeral="I" title="The subject">
          {editing ? (
            <div className="anim-stagger anim-stagger-tight grid grid-cols-2 gap-x-8 gap-y-3">
              {SUBJECT_FIELDS.map((field) => (
                <EditableField
                  key={field.key}
                  label={field.label}
                  value={subject[field.key]}
                  editing
                  mono={field.mono}
                  onChange={(value) => actions.setSubject({ [field.key]: value })}
                />
              ))}
            </div>
          ) : (
            <dl className="anim-stagger anim-stagger-tight grid grid-cols-2 gap-x-10">
              {SUBJECT_FIELDS.map((field) => (
                <LeaderRow key={field.key} label={field.label} value={subject[field.key]} mono={field.mono} />
              ))}
            </dl>
          )}

          <div className="mt-5 grid grid-cols-2 gap-8">
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
        </Article>

        <Article numeral="II" title="The assignment">
          {editing ? (
            <div className="anim-stagger anim-stagger-tight grid grid-cols-2 gap-x-8 gap-y-3">
              {ASSIGNMENT_FIELDS.map((field) => (
                <EditableField
                  key={field.key}
                  label={field.label}
                  value={assignment[field.key]}
                  editing
                  mono={field.mono}
                  onChange={(value) => actions.setAssignment({ [field.key]: value })}
                />
              ))}
            </div>
          ) : (
            <dl className="anim-stagger anim-stagger-tight grid grid-cols-2 gap-x-10">
              {ASSIGNMENT_FIELDS.map((field) => (
                <LeaderRow key={field.key} label={field.label} value={assignment[field.key]} mono={field.mono} />
              ))}
            </dl>
          )}
        </Article>

        <Article numeral="III" title="Particulars">
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
                <div key={field.key}>
                  <div className="eyebrow text-[0.5625rem] tracking-[0.24em] text-[var(--color-text-lo)]">
                    {field.label}
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 max-w-[46rem] indent-6 text-[0.84375rem] leading-[1.75]",
                      value ? "text-[var(--color-text-mid)]" : "italic text-[var(--color-text-lo)]",
                    )}
                  >
                    {value ?? "Nothing recorded."}
                  </p>
                </div>
              );
            })}
          </div>
        </Article>

        <Article
          numeral="IV"
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
            <p className="text-[0.8125rem] italic text-[var(--color-text-lo)]">None listed in this payload.</p>
          ) : editing ? (
            <div className="anim-stagger flex flex-col gap-2">
              {vehicles.map((vehicle, index) => (
                <VehicleEditor
                  key={index}
                  vehicle={vehicle}
                  onChange={(patch) => actions.setVehicle(index, patch)}
                  onRemove={() => actions.removeVehicle(index)}
                />
              ))}
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--color-line-2)]">
                  <Th>Vehicle</Th>
                  <Th>Registered owner</Th>
                  <Th>Source</Th>
                  <Th align="right">Plate</Th>
                </tr>
              </thead>
              <tbody className="anim-stagger anim-stagger-tight">
                {vehicles.map((vehicle, index) => (
                  <tr key={index} className="border-b border-[var(--color-line)] last:border-b-0">
                    <Td>{vehicleHeadline(vehicle)}</Td>
                    <Td muted>{vehicle.registeredOwner ?? "—"}</Td>
                    <Td muted>{vehicle.source ?? "—"}</Td>
                    <Td align="right" mono>
                      {vehicle.plate ?? "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Article>

        <Article numeral="V" title="Provenance and files">
          <dl className="grid grid-cols-2 gap-x-10">
            <LeaderRow label="From" value={proposal.emailSource.from} mono />
            <LeaderRow label="Received" value={proposal.emailSource.receivedAt} mono />
            <LeaderRow label="Classified as" value={proposal.emailSource.classification} />
            <LeaderRow label="Pushed at" value={proposal.pushedAt} mono />
          </dl>

          {proposal.emailSource.subject && (
            <p className="mt-4 border-l-2 border-[var(--color-line-2)] pl-4 text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">
              {proposal.emailSource.subject}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <span className="eyebrow text-[0.5625rem] tracking-[0.24em] text-[var(--color-text-lo)]">Files</span>
            <FilesPill status={pendingCase.filesStatus} />
            <button
              type="button"
              disabled={busy !== null || !pendingCase.caseIngestorCode}
              onClick={actions.fetchFiles}
              title={pendingCase.caseIngestorCode ? undefined : "This proposal has no ingestor case code"}
              className="ml-auto inline-flex items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] px-2.5 py-1.5 text-[0.65625rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] disabled:opacity-40"
            >
              {busy === "files" ? <Loader2 size={11} className="animate-spin" /> : <DownloadCloud size={11} />}
              Fetch from ingestor
            </button>
          </div>

          {pendingCase.filesError && (
            <p className="mt-2 text-[0.71875rem] text-[var(--color-neg)]">{pendingCase.filesError}</p>
          )}

          <div className="mt-3">
            {pendingCase.files.length === 0 ? (
              <p className="text-[0.8125rem] italic text-[var(--color-text-lo)]">
                {proposal.attachments.length > 0
                  ? `${proposal.attachments.length} attachment(s) listed by the ingestor; none stored yet.`
                  : "No attachments accompanied this proposal."}
              </p>
            ) : (
              <dl className="anim-stagger anim-stagger-tight">
                {pendingCase.files.map((file) => (
                  <LeaderRow
                    key={file.id}
                    label={file.filename}
                    value={`${fmtBytes(file.sizeBytes)} · ${file.storage}`}
                    mono
                  />
                ))}
              </dl>
            )}
          </div>
        </Article>

        <footer className="mt-10 border-t border-[var(--color-line)] pt-4 text-center">
          <p className="font-mono text-[0.59375rem] uppercase tracking-[0.2em] text-[var(--color-text-lo)]">
            Nothing becomes a case until an administrator accepts this proposal
          </p>
        </footer>
      </article>

      <div className="mx-auto w-full max-w-[58rem]">
        <RawPayload json={rawJson} />
      </div>
    </div>
  );
}

function Article({
  numeral,
  title,
  action,
  children,
}: {
  numeral: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="editorial text-[1rem] text-[var(--color-text-lo)]">{numeral}.</span>
        <h2 className="eyebrow text-[0.6875rem] tracking-[0.3em] text-[var(--color-text-hi)]">{title}</h2>
        <span className="h-px flex-1 bg-[var(--color-line)]" />
        {action}
      </div>
      {children}
    </section>
  );
}

/** Label and value joined by a dotted leader, the way a printed schedule reads. */
function LeaderRow({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-dotted border-[var(--color-line-2)] py-2 last:border-b-0">
      <dt className="shrink-0 text-[0.75rem] text-[var(--color-text-lo)]">{label}</dt>
      <span className="min-w-4 flex-1" />
      <dd
        className={cn(
          "min-w-0 break-words text-right text-[0.8125rem] text-[var(--color-text-hi)]",
          mono && "font-mono text-[0.71875rem]",
          !value && "italic text-[var(--color-text-lo)]",
        )}
      >
        {value ?? "not stated"}
      </dd>
    </div>
  );
}

function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={cn(
        "pb-2 font-mono text-[0.5625rem] font-normal uppercase tracking-wider text-[var(--color-text-lo)]",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono = false,
  muted = false,
}: {
  children: ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={cn(
        "py-2.5 text-[0.8125rem] text-[var(--color-text-hi)]",
        align === "right" && "text-right",
        mono && "font-mono text-[0.71875rem] tracking-wider",
        muted && "text-[var(--color-text-mid)]",
      )}
    >
      {children}
    </td>
  );
}

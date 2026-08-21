/**
 * Command — operator console. Monospace-led, a metrics strip across the top and
 * tabbed panes so a reviewer sees one dense surface at a time.
 */
import { useState } from "react";
import { ArrowLeft, Car, DownloadCloud, FileJson, FileText, Loader2, Mail, Paperclip, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { FilesPill, ReviewStatusPill } from "@/components/cases/PendingCasePills";
import {
  ASSIGNMENT_FIELDS,
  DecidedBanner,
  EditableField,
  ErrorBanner,
  NARRATIVE_FIELDS,
  SUBJECT_FIELDS,
  StringListEditor,
  TONE_RING,
  TONE_TEXT,
  VehicleEditor,
  fmtBytes,
  fmtDateTime,
  reviewActions,
  vehicleHeadline,
  type PendingCaseView,
} from "../design-kit";

type Pane = "subject" | "assignment" | "narrative" | "vehicles" | "files" | "raw";

const PANES: { id: Pane; label: string; icon: typeof User }[] = [
  { id: "subject", label: "Subject", icon: User },
  { id: "assignment", label: "Assignment", icon: FileText },
  { id: "narrative", label: "Narrative", icon: Mail },
  { id: "vehicles", label: "Vehicles", icon: Car },
  { id: "files", label: "Files", icon: Paperclip },
  { id: "raw", label: "Raw", icon: FileJson },
];

export default function CommandDesign({ view }: { view: PendingCaseView }) {
  const { pendingCase, proposal, subject, assignment, vehicles, editing, decided, busy, error, rawJson, actions } =
    view;
  const [pane, setPane] = useState<Pane>("subject");
  const specs = reviewActions(view);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      {/* Command bar */}
      <header className="surface relative shrink-0 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-line) 0.0625rem, transparent 0.0625rem), linear-gradient(90deg, var(--color-line) 0.0625rem, transparent 0.0625rem)",
            backgroundSize: "1.5rem 1.5rem",
            maskImage: "linear-gradient(180deg, rgba(0,0,0,0.9), transparent)",
          }}
        />

        <div className="relative flex flex-wrap items-center gap-4 px-4 py-3">
          <button
            type="button"
            onClick={actions.back}
            aria-label="Back to pending cases"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-lo)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            <ArrowLeft size={14} strokeWidth={1.8} />
          </button>

          <div className="min-w-0">
            <div className="font-mono text-[0.5625rem] uppercase tracking-[0.28em] text-[var(--color-text-lo)]">
              Pending case · {pendingCase.caseIngestorCode ? `#${pendingCase.caseIngestorCode}` : "no ingestor id"}
            </div>
            <div className="truncate font-mono text-[1.0625rem] tracking-tight text-[var(--color-text-hi)]">
              {pendingCase.claimNumber ?? "NO-CLAIM-NUMBER"}
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ReviewStatusPill status={pendingCase.status} />
            {specs.map((spec) => (
              <button
                key={spec.key}
                type="button"
                disabled={spec.disabled}
                onClick={spec.onClick}
                className="inline-flex h-8 items-center gap-1.5 rounded-[0.375rem] border bg-[var(--color-ink-1)]/60 px-2.5 font-mono text-[0.65625rem] uppercase tracking-wider transition-colors disabled:opacity-40"
                style={{ borderColor: TONE_RING[spec.tone], color: TONE_TEXT[spec.tone] }}
              >
                {spec.loading ? <Loader2 size={11} className="animate-spin" /> : <spec.icon size={11} strokeWidth={2} />}
                {spec.label}
              </button>
            ))}
          </div>
        </div>

        {/* Metrics strip */}
        <div className="relative grid grid-cols-6 border-t border-[var(--color-line)]">
          <Metric label="Subject" value={pendingCase.subjectName ?? "—"} />
          <Metric label="Insurer" value={assignment.insurer ?? "—"} />
          <Metric label="Type" value={pendingCase.ingestorCaseType ?? "—"} />
          <Metric label="Date of loss" value={assignment.dateOfLoss ?? "—"} />
          <Metric label="Report due" value={assignment.reportDueDate ?? "—"} warn={Boolean(assignment.reportDueDate)} />
          <Metric label="Received" value={fmtDateTime(pendingCase.receivedAt)} last />
        </div>
      </header>

      {error && <ErrorBanner message={error} />}
      {decided && <DecidedBanner view={view} />}

      {/* Pane switcher */}
      <nav className="flex shrink-0 items-center gap-1 overflow-x-auto">
        {PANES.map((entry) => {
          const active = pane === entry.id;
          const count =
            entry.id === "vehicles" ? vehicles.length : entry.id === "files" ? pendingCase.files.length : undefined;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setPane(entry.id)}
              className={cn(
                "anim-toggle tap inline-flex shrink-0 items-center gap-1.5 rounded-[0.5rem] border px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider",
                active
                  ? "border-[rgba(74,127,255,0.45)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                  : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-mid)]",
              )}
            >
              <entry.icon size={11} strokeWidth={2} />
              {entry.label}
              {count !== undefined && count > 0 && (
                <span className="rounded-[0.1875rem] bg-[var(--color-ink-4)] px-1 text-[0.5625rem] text-[var(--color-text-mid)]">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Active pane */}
      <div className="surface min-h-0 flex-1 overflow-y-auto p-4">
        {pane === "subject" && (
          <div className="flex flex-col gap-4">
            <CellGrid>
              {SUBJECT_FIELDS.map((field) => (
                <Cell key={field.key}>
                  <EditableField
                    label={field.label}
                    value={subject[field.key]}
                    editing={editing}
                    mono={field.mono}
                    onChange={(value) => actions.setSubject({ [field.key]: value })}
                  />
                </Cell>
              ))}
            </CellGrid>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[0.5rem] border border-[var(--color-line)] p-3">
                <StringListEditor
                  label="Addresses"
                  values={subject.addresses}
                  editing={editing}
                  placeholder="Street, city, state ZIP"
                  onChange={(addresses) => actions.setSubject({ addresses })}
                />
              </div>
              <div className="rounded-[0.5rem] border border-[var(--color-line)] p-3">
                <StringListEditor
                  label="Phones"
                  values={subject.phones}
                  editing={editing}
                  placeholder="(555) 555-5555"
                  onChange={(phones) => actions.setSubject({ phones })}
                />
              </div>
            </div>
          </div>
        )}

        {pane === "assignment" && (
          <CellGrid>
            {ASSIGNMENT_FIELDS.map((field) => (
              <Cell key={field.key}>
                <EditableField
                  label={field.label}
                  value={assignment[field.key]}
                  editing={editing}
                  mono={field.mono}
                  onChange={(value) => actions.setAssignment({ [field.key]: value })}
                />
              </Cell>
            ))}
          </CellGrid>
        )}

        {pane === "narrative" && (
          <div className="flex flex-col gap-3">
            {NARRATIVE_FIELDS.map((field) => (
              <div key={field.key} className="rounded-[0.5rem] border border-[var(--color-line)] p-3">
                <EditableField
                  label={field.label}
                  value={assignment[field.key]}
                  editing={editing}
                  multiline
                  onChange={(value) => actions.setAssignment({ [field.key]: value })}
                />
              </div>
            ))}
            <div className="rounded-[0.5rem] border border-[var(--color-line)] p-3">
              <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                Email subject
              </div>
              <p className="text-[0.75rem] leading-relaxed text-[var(--color-text-mid)]">
                {proposal.emailSource.subject ?? "—"}
              </p>
            </div>
          </div>
        )}

        {pane === "vehicles" && (
          <div className="flex flex-col gap-2">
            {editing && (
              <button
                type="button"
                onClick={actions.addVehicle}
                className="self-start rounded-[0.375rem] border border-[var(--color-line-2)] px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-accent-2)]"
              >
                + Add vehicle
              </button>
            )}
            {vehicles.length === 0 ? (
              <p className="font-mono text-[0.71875rem] text-[var(--color-text-lo)]">NO VEHICLES IN PAYLOAD</p>
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
                    className="grid grid-cols-[1fr_8rem_7rem] items-center gap-3 rounded-[0.375rem] border border-[var(--color-line)] px-3 py-2 font-mono text-[0.71875rem]"
                  >
                    <span className="truncate text-[var(--color-text-hi)]">{vehicleHeadline(vehicle)}</span>
                    <span className="truncate text-[var(--color-text-lo)]">{vehicle.registeredOwner ?? "—"}</span>
                    <span className="justify-self-end rounded-[0.1875rem] bg-[var(--color-ink-4)] px-1.5 py-0.5 tracking-[0.14em] text-[var(--color-text-hi)]">
                      {vehicle.plate ?? "—"}
                    </span>
                  </div>
                ),
              )
            )}
          </div>
        )}

        {pane === "files" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <FilesPill status={pendingCase.filesStatus} />
              <button
                type="button"
                disabled={busy !== null || !pendingCase.caseIngestorCode}
                onClick={actions.fetchFiles}
                title={pendingCase.caseIngestorCode ? undefined : "This proposal has no ingestor case code"}
                className="ml-auto inline-flex items-center gap-1.5 rounded-[0.375rem] border border-[var(--color-line-2)] px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-mid)] transition-colors hover:text-[var(--color-text-hi)] disabled:opacity-40"
              >
                {busy === "files" ? <Loader2 size={11} className="animate-spin" /> : <DownloadCloud size={11} />}
                Fetch
              </button>
            </div>

            {pendingCase.filesError && (
              <p className="font-mono text-[0.6875rem] text-[var(--color-neg)]">{pendingCase.filesError}</p>
            )}

            {pendingCase.files.length === 0 && proposal.attachments.length === 0 && (
              <p className="font-mono text-[0.71875rem] text-[var(--color-text-lo)]">NO ATTACHMENTS</p>
            )}

            {pendingCase.files.map((file) => (
              <div key={file.id} className="rounded-[0.375rem] border border-[var(--color-line)] px-3 py-2">
                <div className="truncate font-mono text-[0.71875rem] text-[var(--color-text-hi)]">{file.filename}</div>
                <div className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
                  {fmtBytes(file.sizeBytes)} · {file.storage}
                  {file.contentType ? ` · ${file.contentType}` : ""}
                </div>
                {file.error && <div className="font-mono text-[0.59375rem] text-[var(--color-neg)]">{file.error}</div>}
              </div>
            ))}

            {proposal.attachments.length > 0 && (
              <>
                <div className="mt-2 font-mono text-[0.5625rem] uppercase tracking-[0.28em] text-[var(--color-text-lo)]">
                  Listed by ingestor
                </div>
                {proposal.attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="rounded-[0.375rem] border border-dashed border-[var(--color-line)] px-3 py-2"
                  >
                    <div className="truncate font-mono text-[0.71875rem] text-[var(--color-text-mid)]">
                      {attachment.filename ?? "unnamed"}
                    </div>
                    <div className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
                      {fmtBytes(attachment.sizeBytes)}
                      {attachment.hasInlineContent ? " · sent inline" : " · fetch required"}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {pane === "raw" && (
          <pre className="overflow-auto font-mono text-[0.65625rem] leading-relaxed text-[var(--color-text-mid)]">
            {rawJson}
          </pre>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, warn = false, last = false }: { label: string; value: string; warn?: boolean; last?: boolean }) {
  return (
    <div className={cn("min-w-0 px-3 py-2", !last && "border-r border-[var(--color-line)]")}>
      <div className="font-mono text-[0.5rem] uppercase tracking-[0.24em] text-[var(--color-text-lo)]">{label}</div>
      <div
        className={cn(
          "truncate font-mono text-[0.71875rem]",
          warn ? "text-[var(--color-warn)]" : "text-[var(--color-text-hi)]",
        )}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function CellGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="anim-stagger anim-stagger-tight grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-px overflow-hidden rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-line)]">
      {children}
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <div className="bg-[var(--color-ink-2)] p-3">{children}</div>;
}

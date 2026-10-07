import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Inbox, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { PanelLoader } from "@/components/ui/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingIntake } from "@/contexts/PendingIntakeContext";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { ConfirmModal } from "@/components/dashboard/ConfirmModal";
import { CaseSubjectHeader } from "@/components/case/CaseSubjectHeader";
import { useGridLayout } from "@/hooks/useGridLayout";
import { invalidateQueries, useQuery } from "@/lib/query-cache";
import { proposalToCaseDetail } from "@/lib/pending-case-view";
import { KindPill, LanePill } from "@/components/cases/PendingCasePills";
import {
  pendingCasesApi,
  pendingCaseFilePath,
  fileDownloadUrl,
  ApiError,
  REGION_LABELS,
  type AcceptPendingCasePayload,
  type CasePriority,
  type CaseService,
  type PendingCaseDetail as PendingCase,
  type PendingCaseFile,
  type PendingCaseFilesStatus,
  type PriorCaseRef,
  type ProposalVehicle,
  type Region,
} from "@/lib/crm-api";
import type { Subject } from "@/lib/mock-data";
import {
  CASE_DEFAULT_LAYOUT,
  CASE_DEFAULT_PAGES,
  CASE_DEFAULT_WIDGETS,
  normalizeCaseDocument,
  normalizeCaseLayout,
  type CaseLayoutItem,
  type CasePanelCtx,
  type CustomCaseWidgetDef,
} from "./case-detail-widgets";
import { CaseDetailGrid, type CaseDetailGridHandle } from "./CaseDetailGrid";
import { CaseDetailPageNav } from "./CaseDetailPageNav";
import { CasePageArrows } from "@/components/case/CasePageArrows";

const fieldClass =
  "w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 py-1.5 text-[0.78125rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]";

const SERVICES: CaseService[] = ["SURV", "WC", "FMLA", "BG", "DOM", "SOC", "DIS", "LOC", "PS", "LIA"];
const PRIORITIES: CasePriority[] = ["standard", "rush"];
const REGIONS: Region[] = ["ca", "tristate", "texas"];

const STATUS_PILL: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending_review: { label: "Pending review", bg: "rgba(245,158,11,0.16)", text: "#f59e0b", dot: "#f59e0b" },
  accepted: { label: "Accepted", bg: "rgba(74,222,128,0.15)", text: "#4ade80", dot: "#4ade80" },
  rejected: { label: "Rejected", bg: "rgba(248,113,113,0.15)", text: "#f87171", dot: "#f87171" },
};

/** Empty inputs mean "no value", not an empty string. */
const clean = (value: string): string | null => (value.trim() ? value.trim() : null);

/** Multi-value proposal fields (addresses, phones) are edited one per line. */
const splitLines = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Renders an intake proposal through the SAME widget grid as a live case —
 * same house layout, same panels — with a compact pending-review strip beside
 * the page tabs (Fetch / Edit / Reject / Accept). Missing proposal data simply
 * shows as blank fields; everything is read-only until accepted into a real case.
 */
export default function PendingCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, can, canSee } = useAuth();
  const { refresh: refreshIntakeBadge } = usePendingIntake();
  const canReview = can("intake.view");

  const [busy, setBusy] = useState<"accept" | "reject" | "save" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activePageId, setActivePageId] = useState<string>(CASE_DEFAULT_PAGES[0].id);

  const query = useQuery(
    id && canReview ? `pending-case:${id}` : null,
    () =>
      pendingCasesApi
        .get(id!)
        .then((res): PendingCase | null => res.pendingCase)
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }),
    { enabled: !!id && canReview },
  );
  const pendingCase = query.data ?? null;

  // Same shared house layout as the live case view, strictly read-only here.
  const { layout, pages, widgets, revision: layoutRevision } = useGridLayout<CaseLayoutItem>({
    surface: "case-detail",
    defaultLayout: CASE_DEFAULT_LAYOUT,
    normalize: normalizeCaseLayout,
    normalizeDocument: (items, savedPages, savedWidgets, phase) =>
      normalizeCaseDocument(items, savedPages, savedWidgets as CustomCaseWidgetDef[] | null, phase),
    defaultPages: CASE_DEFAULT_PAGES,
    defaultWidgets: CASE_DEFAULT_WIDGETS,
    editable: false,
  });
  const gridHandleRef = useRef<CaseDetailGridHandle | null>(null);
  const widgetsRef = useRef(widgets);
  widgetsRef.current = widgets;
  const resolvedPages = pages ?? CASE_DEFAULT_PAGES;

  const kase = useMemo(() => (pendingCase ? proposalToCaseDetail(pendingCase) : null), [pendingCase]);

  const loadFileBlob = useCallback(
    (fileId: string, signal?: AbortSignal) => pendingCasesApi.fileBlob(id!, fileId, signal),
    [id],
  );
  const fileDownloadHref = useCallback((fileId: string) => fileDownloadUrl(pendingCaseFilePath(id!, fileId)), [id]);

  const accept = async (payload: AcceptPendingCasePayload) => {
    if (!pendingCase) return;
    setBusy("accept");
    setActionError(null);
    try {
      const result = await pendingCasesApi.accept(pendingCase.id, payload);
      setAcceptOpen(false);
      invalidateQueries("pending-case");
      invalidateQueries("cases:list");
      refreshIntakeBadge();
      navigate(`/cases/${result.case.id}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not accept the proposal.");
      setAcceptOpen(false);
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!pendingCase) return;
    setBusy("reject");
    setActionError(null);
    try {
      await pendingCasesApi.reject(pendingCase.id);
      invalidateQueries("pending-case");
      refreshIntakeBadge();
      navigate("/pending-cases", {
        state: { pendingNotice: `Rejected the proposal for ${pendingCase.subjectName ?? "an unnamed subject"}.` },
      });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not reject the proposal.");
      setRejectOpen(false);
    } finally {
      setBusy(null);
    }
  };

  const saveEdits = async (edits: ProposalEdits) => {
    if (!pendingCase) return;
    setBusy("save");
    setActionError(null);
    try {
      const { pendingCase: updated } = await pendingCasesApi.update(pendingCase.id, {
        claimNumber: clean(edits.claimNumber),
        caseType: clean(edits.caseType),
        clientCompany: clean(edits.clientCompany),
        subject: {
          name: clean(edits.name),
          dob: clean(edits.dob),
          ssnLast4: clean(edits.ssnLast4),
          addresses: splitLines(edits.addresses),
          phones: splitLines(edits.phones),
          vehicle: clean(edits.vehicle),
          physical: clean(edits.physical),
          job: clean(edits.job),
          employer: clean(edits.employer),
          employerContact: clean(edits.employerContact),
          employerPhone: clean(edits.employerPhone),
        },
        assignment: {
          insurer: clean(edits.insurer),
          adjusterName: clean(edits.adjusterName),
          adjusterEmail: clean(edits.adjusterEmail),
          adjusterPhone: clean(edits.adjusterPhone),
          type: clean(edits.type),
          surveillanceDays: clean(edits.surveillanceDays),
          previousDays: clean(edits.previousDays),
          reportDueDate: clean(edits.reportDueDate),
          dateOfLoss: clean(edits.dateOfLoss),
          typeOfClaim: clean(edits.typeOfClaim),
          bodyParts: clean(edits.bodyParts),
          restrictions: clean(edits.restrictions),
          injuryDescription: clean(edits.injuryDescription),
          claimSummary: clean(edits.claimSummary),
          goal: clean(edits.goal),
          instructions: clean(edits.instructions),
          suspicion: clean(edits.suspicion),
          isRepresented: clean(edits.isRepresented),
          defenseAttorney: clean(edits.defenseAttorney),
          defenseLawFirm: clean(edits.defenseLawFirm),
          defensePhone: clean(edits.defensePhone),
        },
        vehicles: edits.vehicles
          .filter((v) => Object.values(v).some((value) => (value ?? "").trim()))
          .map((v) => ({
            year: clean(v.year),
            color: clean(v.color),
            makeModel: clean(v.makeModel),
            plate: clean(v.plate),
            registeredOwner: clean(v.registeredOwner),
            source: clean(v.source),
          })),
      });
      query.mutate(updated);
      invalidateQueries("pending-cases:list");
      setEditOpen(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not save the changes.");
    } finally {
      setBusy(null);
    }
  };

  if (!canReview) {
    return (
      <div className="surface flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="font-mono text-[0.75rem] text-[var(--color-text-lo)]">RESTRICTED</div>
        <div className="editorial text-[1.5rem] text-[var(--color-text-hi)]">Case review is restricted</div>
      </div>
    );
  }

  if (query.data === null) {
    return (
      <div className="surface flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="font-mono text-[0.75rem] text-[var(--color-text-lo)]">PROPOSAL NOT FOUND</div>
        <div className="editorial text-[2rem] text-[var(--color-text-hi)]">404</div>
        <button onClick={() => navigate("/pending-cases")} className="eyebrow text-[var(--color-accent)]">
          ← Back to pending cases
        </button>
      </div>
    );
  }

  if (!pendingCase || !kase) {
    return <PanelLoader message="Loading proposal" />;
  }

  const decided = pendingCase.status !== "pending_review";
  const pill = STATUS_PILL[pendingCase.status] ?? STATUS_PILL.pending_review;

  const primaryAddress = kase.addresses.find((a) => a.isPrimary) ?? kase.addresses[0];
  const subject: Subject = {
    name: kase.subjectName,
    dob: kase.subjectDob ? kase.subjectDob.slice(0, 10) : undefined,
    address: primaryAddress?.line1,
    description: kase.subjectDescription ?? undefined,
  };

  const panelCtx: CasePanelCtx = {
    case: kase,
    currentUserId: user?.id ?? "",
    investigatorOptions: [],
    onRefresh: () => void query.refresh(),
    // A proposal is not a case yet — every widget renders in read-only mode.
    canEdit: false,
    canAssign: false,
    canPostJournal: false,
    canModerateJournal: false,
    canSee,
    canEditField: () => false,
    getCustomWidget: (widgetId) => (widgetsRef.current ?? []).find((w) => w.id === widgetId) ?? null,
    loadFileBlob,
    fileDownloadHref,
  };

  return (
    <div className="case-detail-page">
      <CaseSubjectHeader
        className="mb-4 shrink-0"
        subject={subject}
        claimNumber={kase.claimNumber ?? kase.caseNumber}
        aliases={[]}
        showMeta={false}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate("/pending-cases")}
              className="inline-flex items-center gap-1.5 rounded-[0.625rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            >
              <ArrowLeft size={13} strokeWidth={1.8} />
              Pending cases
            </button>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.71875rem] font-medium"
              style={{ background: pill.bg, color: pill.text }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: pill.dot }} />
              {pill.label}
            </span>
          </>
        }
      />

      {actionError && (
        <div className="anim-banner surface mb-2 shrink-0 rounded-[0.875rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-4 py-2.5 text-[0.8125rem] text-[var(--color-neg)]">
          {actionError}
        </div>
      )}

      <ProposalNotices pendingCase={pendingCase} onOpenCase={(caseId) => navigate(`/cases/${caseId}`)} />

      {layout ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <CaseDetailPageNav
            pages={resolvedPages}
            activePageId={activePageId}
            editable={false}
            onSelect={setActivePageId}
            onRename={() => {}}
            trailing={
              <PendingReviewStrip
                decided={decided}
                status={pendingCase.status}
                acceptedCaseId={pendingCase.acceptedCaseId}
                busy={busy}
                files={pendingCase.files}
                filesStatus={pendingCase.filesStatus}
                onEdit={() => setEditOpen(true)}
                onReject={() => setRejectOpen(true)}
                onAccept={() => setAcceptOpen(true)}
                onOpenCase={(caseId) => navigate(`/cases/${caseId}`)}
              />
            }
          />
          <div className="min-h-0 flex-1">
            <CaseDetailGrid
              pages={resolvedPages}
              activePageId={activePageId}
              onActivePageChange={setActivePageId}
              layout={layout}
              mountKey={`pending:${pendingCase.id}:${layoutRevision}`}
              ctx={panelCtx}
              gridRef={gridHandleRef}
              onLayoutPersist={() => {}}
              editable={false}
            />
          </div>
        </div>
      ) : (
        <PanelLoader message="Loading layout" />
      )}

      {layout && <CasePageArrows pages={resolvedPages} activePageId={activePageId} onSelect={setActivePageId} />}

      {acceptOpen && (
        <AcceptModal
          subjectName={pendingCase.subjectName}
          client={pendingCase.proposal.clientCompany ?? pendingCase.proposal.assignment.insurer}
          reopens={pendingCase.priorCase}
          busy={busy === "accept"}
          onCancel={() => setAcceptOpen(false)}
          onConfirm={accept}
        />
      )}

      {editOpen && (
        <EditProposalModal
          pendingCase={pendingCase}
          busy={busy === "save"}
          onCancel={() => setEditOpen(false)}
          onSave={saveEdits}
        />
      )}

      <ConfirmModal
        open={rejectOpen}
        title="Reject this proposal?"
        description={
          <p className="dashboard-modal__text">
            It leaves the review queue but stays on record internally. No case is created.
          </p>
        }
        confirmLabel={busy === "reject" ? "Rejecting…" : "Reject"}
        danger
        onCancel={() => setRejectOpen(false)}
        onConfirm={reject}
      />
    </div>
  );
}

const fmtWhen = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

/**
 * Things a reviewer should know before deciding: whether this continues earlier
 * work, whether the client wrote again since the referral (especially a cancel),
 * and how much of the draft came from free text.
 */
function ProposalNotices({ pendingCase, onOpenCase }: { pendingCase: PendingCase; onOpenCase: (id: string) => void }) {
  const { kind, lane, priorCase, proposal } = pendingCase;
  const updates = proposal.updates ?? [];
  const cancelled = updates.some((u) => u.kind === "cancel");
  const context = proposal.context;
  const reopen = kind === "reopen";

  if (!reopen && lane !== "review" && updates.length === 0 && !context) return null;

  return (
    <div className="mb-2 flex max-h-[6.5rem] shrink-0 flex-col gap-1.5 overflow-y-auto">
      {cancelled && (
        <div className="surface rounded-[0.75rem] border border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.07)] px-4 py-2 text-[0.78125rem] text-[var(--color-text-mid)]">
          <span className="font-medium text-[#f87171]">The client asked to cancel this.</span> Check the email below before
          accepting.
        </div>
      )}

      {(reopen || lane === "review") && (
        <div className="surface flex flex-wrap items-center gap-2 rounded-[0.75rem] px-4 py-2 text-[0.78125rem] text-[var(--color-text-mid)]">
          <KindPill kind={kind} caseType={proposal.caseType} />
          <LanePill lane={lane} />
          {reopen &&
            (priorCase ? (
              <span>
                Continues{" "}
                <button
                  type="button"
                  onClick={() => onOpenCase(priorCase.id)}
                  className="font-mono text-[var(--color-accent)] hover:underline"
                >
                  {priorCase.caseNumber}
                </button>{" "}
                ({priorCase.subjectName}, opened {new Date(priorCase.dateOpened).toLocaleDateString()}). Open it to see what
                was done before.
              </span>
            ) : (
              <span>This claim was worked before, but that work is not in the CRM, so prior history is unknown.</span>
            ))}
          {lane === "review" && (
            <span>Written in free text. Check the name, claim number and instructions against the email.</span>
          )}
        </div>
      )}

      {updates.length > 0 && (
        <div className="surface rounded-[0.75rem] px-4 py-2 text-[0.75rem] text-[var(--color-text-mid)]">
          <div className="eyebrow mb-1">Later emails about this referral</div>
          <ul className="flex flex-col gap-1">
            {updates.map((u, index) => (
              <li key={`${u.messageId ?? index}`} className="leading-snug">
                <span className="font-mono text-[0.625rem] uppercase text-[var(--color-text-lo)]">
                  {fmtWhen(u.receivedAt)} · {u.kind}
                </span>{" "}
                {u.text ? u.text.slice(0, 220) : u.subject}
              </li>
            ))}
          </ul>
        </div>
      )}

      {context && (context.phones.length > 0 || context.addressHistory.length > 0 || context.relatives.length > 0) && (
        <div className="surface rounded-[0.75rem] px-4 py-2 text-[0.75rem] text-[var(--color-text-mid)]">
          <span className="eyebrow mr-2">Background searches</span>
          {context.phones.length} phone{context.phones.length === 1 ? "" : "s"}, {context.addressHistory.length} address
          {context.addressHistory.length === 1 ? "" : "es"}, {context.relatives.length} relative
          {context.relatives.length === 1 ? "" : "s"} read from {context.sources.length} attached report
          {context.sources.length === 1 ? "" : "s"}.
        </div>
      )}
    </div>
  );
}

function PendingReviewStrip({
  decided,
  status,
  acceptedCaseId,
  busy,
  files,
  filesStatus,
  onEdit,
  onReject,
  onAccept,
  onOpenCase,
}: {
  decided: boolean;
  status: string;
  acceptedCaseId: string | null;
  busy: "accept" | "reject" | "save" | null;
  files: PendingCaseFile[];
  filesStatus: PendingCaseFilesStatus;
  onEdit: () => void;
  onReject: () => void;
  onAccept: () => void;
  onOpenCase: (caseId: string) => void;
}) {
  return (
    <div
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-[0.625rem] border px-1.5 pl-2.5"
      style={{
        borderColor: "rgba(245,158,11,0.4)",
        background: "rgba(245,158,11,0.10)",
      }}
      title={
        decided
          ? status === "accepted"
            ? "This proposal was accepted and a case was created from it."
            : "This proposal was rejected. It stays on record but no case was created."
          : "Intake proposal — review, then accept as a case or reject it."
      }
    >
      <Inbox size={12} strokeWidth={1.8} style={{ color: "#f59e0b" }} className="shrink-0" />
      <span className="whitespace-nowrap font-mono text-[0.5625rem] uppercase tracking-wider" style={{ color: "#f59e0b" }}>
        {decided ? status.replace("_", " ") : "Pending review"}
      </span>
      <span className="mx-0.5 h-3.5 w-px shrink-0" style={{ background: "rgba(245,158,11,0.35)" }} />
      <FilesChip files={files} filesStatus={filesStatus} />
      {!decided ? (
        <>
          <StripBtn onClick={onEdit} disabled={busy !== null} title="Edit proposal details">
            <Pencil size={11} strokeWidth={1.8} />
            Edit
          </StripBtn>
          <StripBtn onClick={onReject} disabled={busy !== null} tone="danger" title="Reject">
            Reject
          </StripBtn>
          <StripBtn onClick={onAccept} disabled={busy !== null} tone="accent" title="Accept as case">
            Accept
            <ArrowRight size={11} strokeWidth={1.8} />
          </StripBtn>
        </>
      ) : acceptedCaseId ? (
        <StripBtn onClick={() => onOpenCase(acceptedCaseId)} tone="accent" title="Open the created case">
          Open case
          <ArrowRight size={11} strokeWidth={1.8} />
        </StripBtn>
      ) : null}
    </div>
  );
}

/** Read-only badge: whether this proposal actually carries documents. */
function FilesChip({ files, filesStatus }: { files: PendingCaseFile[]; filesStatus: PendingCaseFilesStatus }) {
  const stored = files.filter((f) => f.storageKey).length;
  const label =
    files.length === 0
      ? filesStatus === "pending"
        ? "Files pending"
        : "No files"
      : stored === files.length
        ? `${files.length} file${files.length === 1 ? "" : "s"}`
        : `${stored}/${files.length} files`;
  const muted = files.length === 0;

  return (
    <span
      title={
        files.length === 0
          ? "No documents came with this referral."
          : `${stored} of ${files.length} document(s) stored — open the Files widget to preview them.`
      }
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-[0.4375rem] px-2 text-[0.625rem] font-medium ${
        muted ? "text-[var(--color-text-lo)]" : "text-[var(--color-text-mid)]"
      }`}
    >
      <Paperclip size={11} strokeWidth={1.8} />
      {label}
    </span>
  );
}

function StripBtn({
  children,
  onClick,
  disabled,
  tone = "plain",
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "plain" | "danger" | "accent";
  title?: string;
}) {
  const toneClass =
    tone === "accent"
      ? "border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
      : tone === "danger"
        ? "border-transparent text-[#f87171] hover:bg-[rgba(248,113,113,0.12)]"
        : "border-transparent text-[var(--color-text-mid)] hover:bg-white/[0.06] hover:text-[var(--color-text-hi)]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-6 items-center gap-1 rounded-[0.4375rem] border px-2 text-[0.625rem] font-medium transition-colors disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  );
}

// ─── Edit proposal — every field the mailbox intake fills in ─────────────────

type VehicleEdits = {
  year: string;
  color: string;
  makeModel: string;
  plate: string;
  registeredOwner: string;
  source: string;
};

type ProposalEdits = {
  claimNumber: string;
  caseType: string;
  clientCompany: string;
  // Subject
  name: string;
  dob: string;
  ssnLast4: string;
  addresses: string;
  phones: string;
  vehicle: string;
  physical: string;
  job: string;
  employer: string;
  employerContact: string;
  employerPhone: string;
  // Assignment
  insurer: string;
  adjusterName: string;
  adjusterEmail: string;
  adjusterPhone: string;
  type: string;
  surveillanceDays: string;
  previousDays: string;
  reportDueDate: string;
  dateOfLoss: string;
  typeOfClaim: string;
  bodyParts: string;
  restrictions: string;
  injuryDescription: string;
  claimSummary: string;
  goal: string;
  instructions: string;
  suspicion: string;
  isRepresented: string;
  defenseAttorney: string;
  defenseLawFirm: string;
  defensePhone: string;
  vehicles: VehicleEdits[];
};

const EMPTY_VEHICLE: VehicleEdits = {
  year: "",
  color: "",
  makeModel: "",
  plate: "",
  registeredOwner: "",
  source: "",
};

const vehicleEdits = (v: ProposalVehicle): VehicleEdits => ({
  year: v.year ?? "",
  color: v.color ?? "",
  makeModel: v.makeModel ?? "",
  plate: v.plate ?? "",
  registeredOwner: v.registeredOwner ?? "",
  source: v.source ?? "",
});

function EditProposalModal({
  pendingCase,
  busy,
  onCancel,
  onSave,
}: {
  pendingCase: PendingCase;
  busy: boolean;
  onCancel: () => void;
  onSave: (edits: ProposalEdits) => void;
}) {
  const { proposal } = pendingCase;
  const [edits, setEdits] = useState<ProposalEdits>(() => ({
    claimNumber: proposal.claimNumber ?? "",
    caseType: proposal.caseType ?? "",
    clientCompany: proposal.clientCompany ?? "",
    name: proposal.subject.name ?? "",
    dob: proposal.subject.dob ?? "",
    ssnLast4: proposal.subject.ssnLast4 ?? "",
    addresses: proposal.subject.addresses.join("\n"),
    phones: proposal.subject.phones.join("\n"),
    vehicle: proposal.subject.vehicle ?? "",
    physical: proposal.subject.physical ?? "",
    job: proposal.subject.job ?? "",
    employer: proposal.subject.employer ?? "",
    employerContact: proposal.subject.employerContact ?? "",
    employerPhone: proposal.subject.employerPhone ?? "",
    insurer: proposal.assignment.insurer ?? "",
    adjusterName: proposal.assignment.adjusterName ?? "",
    adjusterEmail: proposal.assignment.adjusterEmail ?? "",
    adjusterPhone: proposal.assignment.adjusterPhone ?? "",
    type: proposal.assignment.type ?? "",
    surveillanceDays: proposal.assignment.surveillanceDays ?? "",
    previousDays: proposal.assignment.previousDays ?? "",
    reportDueDate: proposal.assignment.reportDueDate ?? "",
    dateOfLoss: proposal.assignment.dateOfLoss ?? "",
    typeOfClaim: proposal.assignment.typeOfClaim ?? "",
    bodyParts: proposal.assignment.bodyParts ?? "",
    restrictions: proposal.assignment.restrictions ?? "",
    injuryDescription: proposal.assignment.injuryDescription ?? "",
    claimSummary: proposal.assignment.claimSummary ?? "",
    goal: proposal.assignment.goal ?? "",
    instructions: proposal.assignment.instructions ?? "",
    suspicion: proposal.assignment.suspicion ?? "",
    isRepresented: proposal.assignment.isRepresented ?? "",
    defenseAttorney: proposal.assignment.defenseAttorney ?? "",
    defenseLawFirm: proposal.assignment.defenseLawFirm ?? "",
    defensePhone: proposal.assignment.defensePhone ?? "",
    vehicles: proposal.vehicles.map(vehicleEdits),
  }));

  type TextKey = Exclude<keyof ProposalEdits, "vehicles">;

  const set = (key: TextKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEdits((prev) => ({ ...prev, [key]: e.target.value }));

  const field = (label: string, key: TextKey, placeholder?: string) => (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      <input value={edits[key]} onChange={set(key)} placeholder={placeholder} className={fieldClass} />
    </label>
  );

  const area = (label: string, key: TextKey, placeholder?: string, rows = 3) => (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      <textarea
        value={edits[key]}
        onChange={set(key)}
        placeholder={placeholder}
        rows={rows}
        className={`${fieldClass} resize-y leading-relaxed`}
      />
    </label>
  );

  const setVehicle = (index: number, key: keyof VehicleEdits, value: string) =>
    setEdits((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v, i) => (i === index ? { ...v, [key]: value } : v)),
    }));

  return (
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dashboard-modal dashboard-modal--wide surface"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="dashboard-modal__title">Edit proposal details</h2>
        <p className="dashboard-modal__text mt-1">
          Corrects what was read from the email. The original email and its attachments stay as they arrived.
        </p>
        <div className="hairline my-5" />

        <div className="dashboard-modal__body flex max-h-[62vh] flex-col gap-6 overflow-y-auto pr-1">
          <Section title="Case">
            <div className="grid grid-cols-3 gap-3">
              {field("Claim number", "claimNumber")}
              {field("Case type", "caseType", "e.g. Surveillance")}
              {field("Client company", "clientCompany", "Who sent the work")}
            </div>
          </Section>

          <Section title="Subject">
            <div className="grid grid-cols-3 gap-3">
              {field("Full name", "name", "Required to accept")}
              {field("Date of birth", "dob", "YYYY-MM-DD")}
              {field("SSN (last 4)", "ssnLast4")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {area("Addresses", "addresses", "One address per line", 2)}
              {area("Phones", "phones", "One number per line", 2)}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {field("Job title", "job")}
              {field("Employer", "employer")}
              {field("Employer phone", "employerPhone")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("Employer contact", "employerContact")}
              {field("Vehicle (as reported)", "vehicle")}
            </div>
            {area("Physical description", "physical", undefined, 2)}
          </Section>

          <Section title="Client & adjuster">
            <div className="grid grid-cols-2 gap-3">
              {field("Insurer / client", "insurer")}
              {field("Adjuster", "adjusterName")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("Adjuster email", "adjusterEmail")}
              {field("Adjuster phone", "adjusterPhone")}
            </div>
          </Section>

          <Section title="Assignment">
            <div className="grid grid-cols-3 gap-3">
              {field("Assignment type", "type")}
              {field("Surveillance days", "surveillanceDays")}
              {field("Report due", "reportDueDate", "YYYY-MM-DD")}
            </div>
            <div className="grid grid-cols-3 gap-3">{field("Days already worked", "previousDays")}</div>
            <div className="grid grid-cols-3 gap-3">
              {field("Date of loss", "dateOfLoss", "YYYY-MM-DD")}
              {field("Type of claim", "typeOfClaim")}
              {field("Body parts", "bodyParts")}
            </div>
            {area("Summary of the claim", "claimSummary", undefined, 4)}
            {area("Goal of the assignment", "goal", undefined, 2)}
            {area("Injury description", "injuryDescription")}
            {area("Restrictions", "restrictions", undefined, 2)}
            {area("Special instructions", "instructions")}
            {area("Reason for suspicion", "suspicion", undefined, 2)}
          </Section>

          <Section title="Representation">
            <div className="grid grid-cols-2 gap-3">
              {field("Represented?", "isRepresented", "yes / no")}
              {field("Defense attorney", "defenseAttorney")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("Defense law firm", "defenseLawFirm")}
              {field("Defense phone", "defensePhone")}
            </div>
          </Section>

          <Section
            title="Vehicles"
            action={
              <button
                type="button"
                onClick={() => setEdits((prev) => ({ ...prev, vehicles: [...prev.vehicles, { ...EMPTY_VEHICLE }] }))}
                className="inline-flex items-center gap-1 rounded-[0.4375rem] border border-[var(--color-line)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
              >
                <Plus size={11} strokeWidth={2} />
                Add vehicle
              </button>
            }
          >
            {edits.vehicles.length === 0 ? (
              <p className="text-[0.8125rem] text-[var(--color-text-lo)]">No vehicles on this proposal.</p>
            ) : (
              edits.vehicles.map((v, index) => (
                <div key={index} className="rounded-[0.625rem] border border-[var(--color-line)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="eyebrow">Vehicle {index + 1}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setEdits((prev) => ({ ...prev, vehicles: prev.vehicles.filter((_, i) => i !== index) }))
                      }
                      title="Remove this vehicle"
                      className="rounded-[0.375rem] p-1 text-[var(--color-text-lo)] transition-colors hover:bg-[rgba(248,113,113,0.12)] hover:text-[#f87171]"
                    >
                      <Trash2 size={12} strokeWidth={1.8} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <VehicleField label="Year" value={v.year} onChange={(val) => setVehicle(index, "year", val)} />
                    <VehicleField label="Color" value={v.color} onChange={(val) => setVehicle(index, "color", val)} />
                    <VehicleField
                      label="Make / model"
                      value={v.makeModel}
                      onChange={(val) => setVehicle(index, "makeModel", val)}
                    />
                    <VehicleField label="Plate" value={v.plate} onChange={(val) => setVehicle(index, "plate", val)} />
                    <VehicleField
                      label="Registered owner"
                      value={v.registeredOwner}
                      onChange={(val) => setVehicle(index, "registeredOwner", val)}
                    />
                    <VehicleField label="Source" value={v.source} onChange={(val) => setVehicle(index, "source", val)} />
                  </div>
                </div>
              ))
            )}
          </Section>
        </div>

        <div className="dashboard-modal__actions">
          <button type="button" className="dashboard-modal-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="dashboard-modal-btn" disabled={busy} onClick={() => onSave(edits)}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow text-[var(--color-text-mid)]">{title}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

function VehicleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
    </label>
  );
}

// ─── Accept dialog ────────────────────────────────────────────────────────────

function AcceptModal({
  subjectName,
  client,
  reopens,
  busy,
  onCancel,
  onConfirm,
}: {
  subjectName: string | null;
  client: string | null;
  reopens: PriorCaseRef | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (payload: AcceptPendingCasePayload) => void;
}) {
  const [service, setService] = useState<CaseService | "">("");
  const [priority, setPriority] = useState<CasePriority>("standard");
  const [region, setRegion] = useState<Region | "">("");
  const [note, setNote] = useState("");

  return (
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onCancel}>
      <div className="dashboard-modal surface" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 className="dashboard-modal__title">Accept as a case</h2>
        <div className="hairline my-5" />

        <div className="dashboard-modal__body flex flex-col gap-3">
          <p className="dashboard-modal__text">
            Creates a case for <span className="text-[var(--color-text-hi)]">{subjectName ?? "this subject"}</span>
            {client ? (
              <>
                {" "}
                and links it to <span className="text-[var(--color-text-hi)]">{client}</span>, creating that client if
                it does not exist yet.
              </>
            ) : (
              " with no client attached."
            )}
            {reopens && (
              <>
                {" "}
                It is linked to the earlier case <span className="text-[var(--color-text-hi)]">{reopens.caseNumber}</span>{" "}
                for this claim.
              </>
            )}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="eyebrow mb-1 block">Service</span>
              <select value={service} onChange={(e) => setService(e.target.value as CaseService | "")} className={fieldClass}>
                <option value="">Infer from the payload</option>
                {SERVICES.map((code) => (
                  <option key={code} value={code}>
                    {SERVICE_LABELS[code]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="eyebrow mb-1 block">Priority</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as CasePriority)} className={fieldClass}>
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="eyebrow mb-1 block">Region</span>
            <select value={region} onChange={(e) => setRegion(e.target.value as Region | "")} className={fieldClass}>
              <option value="">Not set</option>
              {REGIONS.map((value) => (
                <option key={value} value={value}>
                  {REGION_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="eyebrow mb-1 block">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this was accepted, anything worth recording"
              className={fieldClass}
            />
          </label>
        </div>

        <div className="dashboard-modal__actions">
          <button type="button" className="dashboard-modal-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="dashboard-modal-btn"
            disabled={busy}
            onClick={() =>
              onConfirm({
                ...(service && { service }),
                priority,
                region: region || null,
                ...(note.trim() && { note: note.trim() }),
              })
            }
          >
            {busy ? "Creating…" : "Create case"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, FileDown, Inbox, Loader2, Pencil } from "lucide-react";
import { PanelLoader } from "@/components/ui/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingIntake } from "@/contexts/PendingIntakeContext";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { ConfirmModal } from "@/components/dashboard/ConfirmModal";
import { CaseSubjectHeader } from "@/components/case/CaseSubjectHeader";
import { useGridLayout } from "@/hooks/useGridLayout";
import { invalidateQueries, useQuery } from "@/lib/query-cache";
import { proposalToCaseDetail } from "@/lib/pending-case-view";
import { fieldClass } from "@/components/pending-cases/design-kit";
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
  type Region,
} from "@/lib/crm-api";
import type { Subject } from "@/lib/mock-data";
import {
  CASE_DEFAULT_LAYOUT,
  CASE_DEFAULT_PAGES,
  normalizeCaseDocument,
  normalizeCaseLayout,
  type CaseLayoutItem,
  type CasePanelCtx,
  type CustomCaseWidgetDef,
} from "./case-detail-widgets";
import { CaseDetailGrid, type CaseDetailGridHandle } from "./CaseDetailGrid";
import { CaseDetailPageNav } from "./CaseDetailPageNav";
import { CasePageArrows } from "@/components/case/CasePageArrows";

const SERVICES: CaseService[] = ["SURV", "WC", "FMLA", "BG", "DOM", "SOC", "DIS", "LOC", "PS", "LIA"];
const PRIORITIES: CasePriority[] = ["standard", "asap", "rush"];
const REGIONS: Region[] = ["ca", "tristate", "texas"];

const STATUS_PILL: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending_review: { label: "Pending review", bg: "rgba(245,158,11,0.16)", text: "#f59e0b", dot: "#f59e0b" },
  accepted: { label: "Accepted", bg: "rgba(74,222,128,0.15)", text: "#4ade80", dot: "#4ade80" },
  rejected: { label: "Rejected", bg: "rgba(248,113,113,0.15)", text: "#f87171", dot: "#f87171" },
};

/** Empty inputs mean "no value", not an empty string. */
const clean = (value: string): string | null => (value.trim() ? value.trim() : null);

/**
 * Renders an intake proposal through the SAME widget grid as a live case —
 * same house layout, same panels — with a colored "pending review" banner and
 * the review actions (fetch files / edit / reject / accept) on top. Missing
 * proposal data simply shows as blank fields; everything is read-only until
 * the proposal is accepted into a real case.
 */
export default function PendingCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, can, canSee } = useAuth();
  const { refresh: refreshIntakeBadge } = usePendingIntake();
  const canReview = can("intake.view");

  const [busy, setBusy] = useState<"accept" | "reject" | "files" | "save" | null>(null);
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
    editable: false,
  });
  const gridHandleRef = useRef<CaseDetailGridHandle | null>(null);
  const widgetsRef = useRef(widgets);
  widgetsRef.current = widgets;
  const resolvedPages = pages ?? CASE_DEFAULT_PAGES;

  const kase = useMemo(() => (pendingCase ? proposalToCaseDetail(pendingCase) : null), [pendingCase]);

  const loadFileBlob = useCallback((fileId: string) => pendingCasesApi.fileBlob(id!, fileId), [id]);
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

  const fetchFiles = async () => {
    if (!pendingCase) return;
    setBusy("files");
    setActionError(null);
    try {
      const { pendingCase: updated } = await pendingCasesApi.retryFiles(pendingCase.id);
      query.mutate(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not fetch the files.");
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
        subject: {
          name: clean(edits.subjectName),
          dob: clean(edits.subjectDob),
        },
        assignment: {
          insurer: clean(edits.insurer),
          adjusterName: clean(edits.adjusterName),
          adjusterEmail: clean(edits.adjusterEmail),
          adjusterPhone: clean(edits.adjusterPhone),
        },
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
        className="mb-3 shrink-0"
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

      {/* Review banner — the one loud visual cue that this is not a live case. */}
      <div
        className="mb-3 flex shrink-0 flex-wrap items-center gap-3 rounded-[0.875rem] border px-4 py-2.5"
        style={{
          borderColor: "rgba(245,158,11,0.35)",
          background: "linear-gradient(90deg, rgba(245,158,11,0.10), rgba(245,158,11,0.03))",
        }}
      >
        <Inbox size={15} strokeWidth={1.8} style={{ color: "#f59e0b" }} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[0.625rem] uppercase tracking-widest" style={{ color: "#f59e0b" }}>
            {decided ? `Proposal ${pendingCase.status}` : "Intake proposal — pending review"}
          </span>
          <p className="truncate text-[0.71875rem] text-[var(--color-text-mid)]">
            {decided
              ? pendingCase.status === "accepted"
                ? "This proposal was accepted and a case was created from it."
                : "This proposal was rejected. It stays on record but no case was created."
              : "Pushed by the case ingestor. Review the details below, then accept it as a case or reject it."}
          </p>
        </div>

        {!decided && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <BannerBtn onClick={fetchFiles} disabled={busy !== null}>
              {busy === "files" ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} strokeWidth={1.8} />}
              Fetch files
            </BannerBtn>
            <BannerBtn onClick={() => setEditOpen(true)} disabled={busy !== null}>
              <Pencil size={12} strokeWidth={1.8} />
              Edit details
            </BannerBtn>
            <BannerBtn onClick={() => setRejectOpen(true)} disabled={busy !== null} tone="danger">
              Reject
            </BannerBtn>
            <BannerBtn onClick={() => setAcceptOpen(true)} disabled={busy !== null} tone="accent">
              Accept as case
              <ArrowRight size={12} strokeWidth={1.8} />
            </BannerBtn>
          </div>
        )}
        {decided && pendingCase.acceptedCaseId && (
          <BannerBtn onClick={() => navigate(`/cases/${pendingCase.acceptedCaseId}`)} tone="accent">
            Open the created case
            <ArrowRight size={12} strokeWidth={1.8} />
          </BannerBtn>
        )}
      </div>

      {actionError && (
        <div className="anim-banner surface mb-3 shrink-0 rounded-[0.875rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-4 py-2.5 text-[0.8125rem] text-[var(--color-neg)]">
          {actionError}
        </div>
      )}

      {layout ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <CaseDetailPageNav
            pages={resolvedPages}
            activePageId={activePageId}
            editable={false}
            onSelect={setActivePageId}
            onRename={() => {}}
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
          insurer={pendingCase.proposal.assignment.insurer}
          ingestorStatus={pendingCase.ingestorStatus}
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

function BannerBtn({
  children,
  onClick,
  disabled,
  tone = "plain",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "plain" | "danger" | "accent";
}) {
  const toneClass =
    tone === "accent"
      ? "border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)] hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)]"
      : tone === "danger"
        ? "border-[rgba(248,113,113,0.35)] text-[#f87171] hover:bg-[rgba(248,113,113,0.08)]"
        : "border-[var(--color-line)] text-[var(--color-text-mid)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-[0.625rem] border px-3 py-1.5 text-[0.71875rem] transition-all disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  );
}

// ─── Edit proposal (the fields that matter before accepting) ─────────────────

type ProposalEdits = {
  claimNumber: string;
  subjectName: string;
  subjectDob: string;
  insurer: string;
  adjusterName: string;
  adjusterEmail: string;
  adjusterPhone: string;
};

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
  const [edits, setEdits] = useState<ProposalEdits>({
    claimNumber: pendingCase.proposal.claimNumber ?? "",
    subjectName: pendingCase.proposal.subject.name ?? "",
    subjectDob: pendingCase.proposal.subject.dob ?? "",
    insurer: pendingCase.proposal.assignment.insurer ?? "",
    adjusterName: pendingCase.proposal.assignment.adjusterName ?? "",
    adjusterEmail: pendingCase.proposal.assignment.adjusterEmail ?? "",
    adjusterPhone: pendingCase.proposal.assignment.adjusterPhone ?? "",
  });

  const set = (key: keyof ProposalEdits) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEdits((prev) => ({ ...prev, [key]: e.target.value }));

  const field = (label: string, key: keyof ProposalEdits, placeholder?: string) => (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      <input value={edits[key]} onChange={set(key)} placeholder={placeholder} className={fieldClass} />
    </label>
  );

  return (
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onCancel}>
      <div className="dashboard-modal surface" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 className="dashboard-modal__title">Edit proposal details</h2>
        <div className="hairline my-5" />

        <div className="dashboard-modal__body flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {field("Subject name", "subjectName", "Required to accept")}
            {field("Date of birth", "subjectDob", "YYYY-MM-DD")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Claim number", "claimNumber")}
            {field("Insurer", "insurer")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Adjuster", "adjusterName")}
            {field("Adjuster phone", "adjusterPhone")}
          </div>
          {field("Adjuster email", "adjusterEmail")}
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

// ─── Accept dialog ────────────────────────────────────────────────────────────

function AcceptModal({
  subjectName,
  insurer,
  ingestorStatus,
  busy,
  onCancel,
  onConfirm,
}: {
  subjectName: string | null;
  insurer: string | null;
  ingestorStatus: string | null;
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
            {insurer ? (
              <>
                {" "}
                and links it to <span className="text-[var(--color-text-hi)]">{insurer}</span>, creating that client if
                it does not exist yet.
              </>
            ) : (
              " with no client attached."
            )}
            {ingestorStatus && ` The ingestor reports this case as "${ingestorStatus}", which carries over.`}
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

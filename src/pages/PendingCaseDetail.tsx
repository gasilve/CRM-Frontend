import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PanelLoader } from "@/components/ui/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { ConfirmModal } from "@/components/dashboard/ConfirmModal";
import { DesignSwitcher, loadDesign, saveDesign } from "@/components/pending-cases/DesignSwitcher";
import { PENDING_CASE_DESIGNS, type DesignId } from "@/components/pending-cases/designs";
import {
  EMPTY_VEHICLE,
  fieldClass,
  type BusyAction,
  type PendingCaseView,
} from "@/components/pending-cases/design-kit";
import {
  pendingCasesApi,
  ApiError,
  REGION_LABELS,
  type AcceptPendingCasePayload,
  type CasePriority,
  type CaseService,
  type PendingCaseDetail as PendingCase,
  type ProposalAssignment,
  type ProposalSubject,
  type ProposalVehicle,
  type Region,
} from "@/lib/crm-api";

const SERVICES: CaseService[] = ["SURV", "WC", "FMLA", "BG", "DOM", "SOC", "DIS", "LOC", "PS", "LIA"];
const PRIORITIES: CasePriority[] = ["standard", "asap", "rush"];
const REGIONS: Region[] = ["ca", "tristate", "texas"];

type Draft = {
  claimNumber: string;
  subject: ProposalSubject;
  assignment: ProposalAssignment;
  vehicles: ProposalVehicle[];
};

const toDraft = (pendingCase: PendingCase): Draft => ({
  claimNumber: pendingCase.proposal.claimNumber ?? "",
  subject: { ...pendingCase.proposal.subject },
  assignment: { ...pendingCase.proposal.assignment },
  vehicles: pendingCase.proposal.vehicles.map((vehicle) => ({ ...vehicle })),
});

/** Empty inputs mean "no value", not an empty string. */
const clean = (value: string): string | null => (value.trim() ? value.trim() : null);

export default function PendingCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [pendingCase, setPendingCase] = useState<PendingCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const [design, setDesign] = useState<DesignId>(loadDesign);
  const pickDesign = useCallback((next: DesignId) => {
    setDesign(next);
    saveDesign(next);
  }, []);

  useEffect(() => {
    if (!id || !isAdmin) return;
    let cancelled = false;
    setLoading(true);
    pendingCasesApi
      .get(id)
      .then((res) => {
        if (cancelled) return;
        setPendingCase(res.pendingCase);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load the proposal.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isAdmin]);

  const proposal = pendingCase?.proposal;
  const editing = draft !== null;
  const decided = pendingCase ? pendingCase.status !== "pending_review" : false;

  const rawJson = useMemo(
    () => (pendingCase ? JSON.stringify(pendingCase.rawPayload, null, 2) : ""),
    [pendingCase],
  );

  const save = async () => {
    if (!pendingCase || !draft) return;
    setBusy("save");
    setError(null);
    try {
      const { pendingCase: updated } = await pendingCasesApi.update(pendingCase.id, {
        claimNumber: clean(draft.claimNumber),
        subject: {
          ...draft.subject,
          addresses: draft.subject.addresses.map((line) => line.trim()).filter(Boolean),
          phones: draft.subject.phones.map((line) => line.trim()).filter(Boolean),
        },
        assignment: draft.assignment,
        vehicles: draft.vehicles,
      });
      setPendingCase(updated);
      setDraft(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the changes.");
    } finally {
      setBusy(null);
    }
  };

  const accept = async (payload: AcceptPendingCasePayload) => {
    if (!pendingCase) return;
    setBusy("accept");
    setError(null);
    try {
      const result = await pendingCasesApi.accept(pendingCase.id, payload);
      setAcceptOpen(false);
      navigate(`/cases/${result.case.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept the proposal.");
      setAcceptOpen(false);
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!pendingCase) return;
    setBusy("reject");
    setError(null);
    try {
      await pendingCasesApi.reject(pendingCase.id);
      navigate("/cases", {
        state: { pendingNotice: `Rejected the proposal for ${pendingCase.subjectName ?? "an unnamed subject"}.` },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reject the proposal.");
      setRejectOpen(false);
    } finally {
      setBusy(null);
    }
  };

  const fetchFiles = async () => {
    if (!pendingCase) return;
    setBusy("files");
    setError(null);
    try {
      const { pendingCase: updated } = await pendingCasesApi.retryFiles(pendingCase.id);
      setPendingCase(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not fetch the files.");
    } finally {
      setBusy(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="surface flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="font-mono text-[0.75rem] text-[var(--color-text-lo)]">ADMINS ONLY</div>
        <div className="editorial text-[1.5rem] text-[var(--color-text-hi)]">Case review is restricted</div>
      </div>
    );
  }

  if (loading) {
    return <PanelLoader message="Loading proposal" />;
  }

  if (!pendingCase || !proposal) {
    return (
      <div className="surface flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="font-mono text-[0.75rem] text-[var(--color-text-lo)]">PROPOSAL NOT FOUND</div>
        <div className="editorial text-[2rem] text-[var(--color-text-hi)]">404</div>
        <button onClick={() => navigate("/cases")} className="eyebrow text-[var(--color-accent)]">
          ← Back to cases
        </button>
      </div>
    );
  }

  const subject = editing ? draft!.subject : proposal.subject;
  const assignment = editing ? draft!.assignment : proposal.assignment;
  const vehicles = editing ? draft!.vehicles : proposal.vehicles;

  const view: PendingCaseView = {
    pendingCase,
    proposal,
    claimNumber: editing ? draft!.claimNumber : pendingCase.claimNumber,
    subject,
    assignment,
    vehicles,
    editing,
    decided,
    busy,
    error,
    rawJson,
    actions: {
      back: () => navigate("/cases"),
      startEdit: () => setDraft(toDraft(pendingCase)),
      cancelEdit: () => setDraft(null),
      save,
      openAccept: () => setAcceptOpen(true),
      openReject: () => setRejectOpen(true),
      fetchFiles,
      openAcceptedCase: () => navigate(`/cases/${pendingCase.acceptedCaseId}`),
      setSubject: (patch) => setDraft((prev) => (prev ? { ...prev, subject: { ...prev.subject, ...patch } } : prev)),
      setAssignment: (patch) =>
        setDraft((prev) => (prev ? { ...prev, assignment: { ...prev.assignment, ...patch } } : prev)),
      setVehicle: (index, patch) =>
        setDraft((prev) =>
          prev
            ? { ...prev, vehicles: prev.vehicles.map((vehicle, i) => (i === index ? { ...vehicle, ...patch } : vehicle)) }
            : prev,
        ),
      addVehicle: () => setDraft((prev) => (prev ? { ...prev, vehicles: [...prev.vehicles, EMPTY_VEHICLE] } : prev)),
      removeVehicle: (index) =>
        setDraft((prev) => (prev ? { ...prev, vehicles: prev.vehicles.filter((_, i) => i !== index) } : prev)),
    },
  };

  const entry = PENDING_CASE_DESIGNS.find((candidate) => candidate.id === design) ?? PENDING_CASE_DESIGNS[0];
  const Design = entry.Component;

  return (
    <>
      <Design view={view} />

      <DesignSwitcher value={entry.id} onChange={pickDesign} />

      {acceptOpen && (
        <AcceptModal
          subjectName={pendingCase.subjectName}
          insurer={assignment.insurer}
          ingestorStatus={pendingCase.ingestorStatus}
          busy={busy === "accept"}
          onCancel={() => setAcceptOpen(false)}
          onConfirm={accept}
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
    </>
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

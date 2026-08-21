import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { CaseDetailSkeleton, PanelLoader } from "@/components/ui/LoadingState";
import { casesApi, investigatorsApi, ApiError, type CaseDetail as CaseDetailType, type CaseStatus } from "@/lib/crm-api";
import { useAuth } from "@/contexts/AuthContext";
import { useGridLayout } from "@/hooks/useGridLayout";
import { CaseSubjectHeader } from "@/components/case/CaseSubjectHeader";
import type { Subject } from "@/lib/mock-data";
import {
  CASE_DEFAULT_LAYOUT,
  CASE_LEGACY_LS_KEY,
  normalizeCaseLayout,
  type CaseLayoutItem,
  type CasePanelCtx,
} from "./case-detail-widgets";
import { CaseDetailGrid, type CaseDetailGridHandle } from "./CaseDetailGrid";
import { CaseJournalFolder } from "./case-detail-panels";

const STATUS_CONFIG: Record<CaseStatus, { label: string; dot: string; pill: string; text: string }> = {
  open: { label: "Open", dot: "#4ade80", pill: "rgba(74,222,128,0.15)", text: "#4ade80" },
  suspended: { label: "Suspended", dot: "#f59e0b", pill: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  closed: { label: "Closed", dot: "#5b6680", pill: "rgba(91,102,128,0.15)", text: "#7a8499" },
};

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [kase, setKase] = useState<CaseDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [investigatorOptions, setInvestigatorOptions] = useState<{ id: string; name: string }[]>([]);

  // Layout is per user, not per case — every case detail shares one arrangement.
  const { layout, persist: persistLayout, revision: layoutRevision } = useGridLayout<CaseLayoutItem>({
    surface: "case-detail",
    defaultLayout: CASE_DEFAULT_LAYOUT,
    normalize: normalizeCaseLayout,
    legacyStorageKey: CASE_LEGACY_LS_KEY,
  });
  const gridHandleRef = useRef<CaseDetailGridHandle | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    casesApi
      .get(id)
      .then((res) => {
        setKase(res.case);
        setNotFound(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          return;
        }
        setError(err instanceof ApiError ? err.message : "Could not load case.");
      });
  }, [id]);

  useEffect(load, [load]);
  useEffect(() => {
    investigatorsApi
      .list()
      .then((res) => setInvestigatorOptions(res.investigators.map((i) => ({ id: i.id, name: i.name }))))
      .catch(() => {});
  }, []);

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="font-mono text-[0.75rem] text-[var(--color-text-lo)]">CASE NOT FOUND</div>
        <div className="editorial text-[2rem] text-[var(--color-text-hi)]">404</div>
        <button onClick={() => navigate("/cases")} className="eyebrow text-[var(--color-accent)]">
          ← Back to Cases
        </button>
      </div>
    );
  }

  if (!kase) {
    return (
      <div className="flex h-full flex-col">
        {error ? (
          <div className="surface grid flex-1 place-items-center text-[0.8125rem] text-[var(--color-neg)]">{error}</div>
        ) : (
          <CaseDetailSkeleton />
        )}
      </div>
    );
  }

  const cfg = STATUS_CONFIG[kase.status];
  const primaryAddress = kase.addresses.find((a) => a.isPrimary) ?? kase.addresses[0];
  const subject: Subject = {
    name: kase.subjectName,
    dob: kase.subjectDob ? kase.subjectDob.slice(0, 10) : undefined,
    address: primaryAddress?.line1,
    city: primaryAddress?.city ?? undefined,
    state: primaryAddress?.state ?? kase.state ?? undefined,
    zip: primaryAddress?.zip ?? undefined,
    description: kase.subjectDescription ?? undefined,
  };

  const panelCtx: CasePanelCtx = {
    case: kase,
    isAdmin,
    currentUserId: user?.id ?? "",
    investigatorOptions,
    onRefresh: load,
  };

  return (
    <div className="relative pb-10">
      <CaseSubjectHeader
        className="mb-5"
        subject={subject}
        claimNumber={kase.claimNumber ?? kase.caseNumber}
        aliases={kase.subjectAliases}
        showMeta={false}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate("/cases")}
              className="inline-flex items-center gap-1.5 rounded-[0.625rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            >
              <ArrowLeft size={13} strokeWidth={1.8} />
              Cases
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate(`/schedule?case=${kase.id}`)}
                className="inline-flex items-center gap-1.5 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)]"
              >
                <CalendarPlus size={13} strokeWidth={1.8} />
                Schedule
              </button>
            )}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.71875rem] font-medium"
              style={{ background: cfg.pill, color: cfg.text }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: cfg.dot }} />
              {cfg.label}
            </span>
          </>
        }
      />

      {layout ? (
        <CaseDetailGrid
          layout={layout}
          mountKey={`${kase.id}:${layoutRevision}`}
          ctx={panelCtx}
          gridRef={gridHandleRef}
          onLayoutPersist={persistLayout}
        />
      ) : (
        <PanelLoader message="Loading your layout" />
      )}

      <div className="mt-8">
        <CaseJournalFolder ctx={panelCtx} />
      </div>
    </div>
  );
}

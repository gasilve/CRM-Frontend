import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clapperboard } from "lucide-react";
import {
  caseVideos,
  invCases,
  investigators,
  timeEntries,
  type CaseStatus,
} from "@/lib/mock-data";
import { CaseSubjectHeader } from "@/components/case/CaseSubjectHeader";
import {
  CASE_LS_KEY,
  loadCaseLayout,
  normalizeCaseLayout,
  type CaseLayoutItem,
  type CasePanelCtx,
} from "./case-detail-widgets";
import { CaseDetailGrid, type CaseDetailGridHandle } from "./CaseDetailGrid";

const STATUS_CONFIG: Record<
  CaseStatus,
  { label: string; dot: string; pill: string; text: string }
> = {
  open: { label: "Open", dot: "#4ade80", pill: "rgba(74,222,128,0.15)", text: "#4ade80" },
  suspended: {
    label: "Suspended",
    dot: "#f59e0b",
    pill: "rgba(245,158,11,0.15)",
    text: "#f59e0b",
  },
  closed: {
    label: "Closed",
    dot: "#5b6680",
    pill: "rgba(91,102,128,0.15)",
    text: "#7a8499",
  },
};

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const c = invCases.find((x) => x.id === id);

  const [layout] = useState<CaseLayoutItem[]>(() => loadCaseLayout());
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const gridHandleRef = useRef<CaseDetailGridHandle | null>(null);

  const persistLayout = useCallback((items: CaseLayoutItem[]) => {
    const normalized = normalizeCaseLayout(items);
    layoutRef.current = normalized;
    // Persist only — avoid setState during GridStack drag (re-render mid-drag crashes).
    try {
      localStorage.setItem(CASE_LS_KEY, JSON.stringify(normalized));
    } catch {
      /* ignore */
    }
  }, []);

  const assignedInvestigators = useMemo(() => {
    if (!c) return [];
    return c.assignedTo
      .map((invId) => investigators.find((i) => i.id === invId))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [c]);

  const caseTimeEntries = useMemo(() => {
    if (!c) return [];
    return timeEntries.filter((t) => t.caseId === c.id);
  }, [c]);

  const panelCtx: CasePanelCtx | null = useMemo(() => {
    if (!c) return null;
    return {
      case: c,
      investigators: assignedInvestigators,
      timeEntries: caseTimeEntries,
    };
  }, [c, assignedInvestigators, caseTimeEntries]);

  if (!c || !panelCtx) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="font-mono text-[12px] text-[var(--color-text-lo)]">CASE NOT FOUND</div>
        <div className="editorial text-[32px] text-[var(--color-text-hi)]">404</div>
        <button
          onClick={() => navigate("/cases")}
          className="eyebrow text-[var(--color-accent)]"
        >
          ← Back to Cases
        </button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[c.status];
  const mountKey = c.id;
  const evidenceCount = caseVideos.filter((v) => v.caseId === c.id).length;

  return (
    <div className="relative pb-10">
      <CaseSubjectHeader
        className="mb-5"
        subject={c.subject}
        claimNumber={c.clientFileNum}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate("/cases")}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--color-line)] px-3 py-1.5 text-[11.5px] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            >
              <ArrowLeft size={13} strokeWidth={1.8} />
              Cases
            </button>
            {evidenceCount > 0 && (
              <button
                type="button"
                onClick={() => navigate(`/video?case=${c.id}`)}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--color-line-2)] bg-[var(--color-ink-2)] px-3 py-1.5 text-[11.5px] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-3)] hover:text-[var(--color-text-hi)]"
              >
                <Clapperboard size={13} strokeWidth={1.8} />
                Evidence video
                <span className="font-mono text-[10px] text-[var(--color-text-lo)]">
                  {evidenceCount}
                </span>
              </button>
            )}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium"
              style={{ background: cfg.pill, color: cfg.text }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: cfg.dot }} />
              {cfg.label}
            </span>
          </>
        }
      />

      <p className="mb-3 font-mono text-[10px] text-[var(--color-text-lo)]">
        Drag panels to rearrange · resize from edges — layout saves automatically
      </p>

      <CaseDetailGrid
        layout={layout}
        mountKey={mountKey}
        ctx={panelCtx}
        gridRef={gridHandleRef}
        onLayoutPersist={persistLayout}
      />
    </div>
  );
}

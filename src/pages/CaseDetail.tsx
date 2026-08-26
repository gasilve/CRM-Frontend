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
  CASE_DEFAULT_PAGES,
  CASE_LEGACY_LS_KEY,
  CASE_PAGE_ROWS,
  createCasePage,
  normalizeCaseDocument,
  normalizeCaseLayout,
  type CaseLayoutItem,
  type CasePanelCtx,
} from "./case-detail-widgets";
import { CaseDetailGrid, type CaseDetailGridHandle } from "./CaseDetailGrid";
import { CaseDetailPageNav } from "./CaseDetailPageNav";
import { CaseJournalFolder } from "./case-detail-panels";

const STATUS_CONFIG: Record<CaseStatus, { label: string; dot: string; pill: string; text: string }> = {
  open: { label: "Open", dot: "#4ade80", pill: "rgba(74,222,128,0.15)", text: "#4ade80" },
  suspended: { label: "Suspended", dot: "#f59e0b", pill: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  closed: { label: "Closed", dot: "#5b6680", pill: "rgba(91,102,128,0.15)", text: "#7a8499" },
};

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, can, canSee, canEdit, isSuperadmin, isPending: authPending } = useAuth();
  const canEditCase = can("cases.edit");
  const canEditLayout = !authPending && isSuperadmin;

  const [kase, setKase] = useState<CaseDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [investigatorOptions, setInvestigatorOptions] = useState<{ id: string; name: string }[]>([]);
  const [activePageId, setActivePageId] = useState<string>(CASE_DEFAULT_PAGES[0].id);
  /** Bumped when the layout changes outside of the grids themselves (page delete). */
  const [gridToken, setGridToken] = useState(0);

  const {
    layout,
    pages,
    persist: persistLayout,
    revision: layoutRevision,
  } = useGridLayout<CaseLayoutItem>({
    surface: "case-detail",
    defaultLayout: CASE_DEFAULT_LAYOUT,
    normalize: normalizeCaseLayout,
    normalizeDocument: (items, savedPages) => normalizeCaseDocument(items, savedPages),
    defaultPages: CASE_DEFAULT_PAGES,
    legacyStorageKey: CASE_LEGACY_LS_KEY,
    editable: canEditLayout,
  });
  const gridHandleRef = useRef<CaseDetailGridHandle | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const resolvedPages = pages ?? CASE_DEFAULT_PAGES;

  useEffect(() => {
    if (!pages?.length) return;
    if (!pages.some((p) => p.id === activePageId)) {
      setActivePageId(pages[0].id);
    }
  }, [pages, activePageId]);

  const persistAllItems = useCallback(
    (items: CaseLayoutItem[]) => {
      persistLayout(items, pagesRef.current ?? undefined);
    },
    [persistLayout],
  );

  const renamePage = useCallback(
    (pageId: string, name: string) => {
      const current = pagesRef.current ?? CASE_DEFAULT_PAGES;
      const next = current.map((p) => (p.id === pageId ? { ...p, name } : p));
      persistLayout(layoutRef.current ?? CASE_DEFAULT_LAYOUT, next);
    },
    [persistLayout],
  );

  const addPage = useCallback(() => {
    const current = pagesRef.current ?? CASE_DEFAULT_PAGES;
    const page = createCasePage(`Page ${current.length + 1}`);
    const next = [...current, page];
    persistLayout(layoutRef.current ?? CASE_DEFAULT_LAYOUT, next);
    setActivePageId(page.id);
  }, [persistLayout]);

  const deletePage = useCallback((pageId: string) => {
    const current = pagesRef.current ?? CASE_DEFAULT_PAGES;
    if (current.length <= 1) return;
    const next = current.filter((p) => p.id !== pageId);

    // Rehome the deleted page's widgets onto whichever remaining page still
    // has room at the bottom, so nothing is squeezed past the row cap.
    const all = layoutRef.current ?? CASE_DEFAULT_LAYOUT;
    const bottoms = new Map(
      next.map((p) => [
        p.id,
        all.filter((i) => i.pageId === p.id).reduce((m, i) => Math.max(m, i.y + i.h), 0),
      ]),
    );
    const items = all.map((item) => {
      if (item.pageId !== pageId) return item;
      const host =
        next.find((p) => (bottoms.get(p.id) ?? 0) + item.h <= CASE_PAGE_ROWS) ?? next[0];
      const y = bottoms.get(host.id) ?? 0;
      bottoms.set(host.id, y + item.h);
      return { ...item, pageId: host.id, y };
    });

    persistLayout(items, next);
    setActivePageId((cur) => (cur === pageId ? next[0].id : cur));
    // Live grids own their own state, so a data-only move needs a rebuild.
    setGridToken((t) => t + 1);
  }, [persistLayout]);

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
    currentUserId: user?.id ?? "",
    investigatorOptions,
    onRefresh: load,
    canEdit: canEditCase,
    canAssign: can("cases.assign"),
    canPostJournal: can("cases.journal.write"),
    canModerateJournal: can("cases.journal.moderate"),
    canSee,
    canEditField: (field) => canEditCase && canEdit(field),
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
            {can("schedule.manage") && (
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
        <>
          <CaseDetailPageNav
            pages={resolvedPages}
            activePageId={activePageId}
            editable={canEditLayout}
            onSelect={setActivePageId}
            onRename={renamePage}
            onAddPage={canEditLayout ? addPage : undefined}
            onDeletePage={canEditLayout ? deletePage : undefined}
          />
          <CaseDetailGrid
            pages={resolvedPages}
            activePageId={activePageId}
            onActivePageChange={setActivePageId}
            layout={layout}
            mountKey={`${kase.id}:${layoutRevision}:${gridToken}:${canEditLayout ? "edit" : "view"}`}
            ctx={panelCtx}
            gridRef={gridHandleRef}
            onLayoutPersist={persistAllItems}
            editable={canEditLayout}
          />
        </>
      ) : (
        <PanelLoader message="Loading layout" />
      )}

      <div className="mt-8">
        <CaseJournalFolder ctx={panelCtx} />
      </div>
    </div>
  );
}

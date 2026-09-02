import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { pendingCasesApi } from "@/lib/crm-api";
import { PendingCasesTable } from "@/components/cases/PendingCasesTable";
import { TableSkeleton } from "@/components/ui/LoadingState";
import { useQuery } from "@/lib/query-cache";
import { usePendingIntake } from "@/contexts/PendingIntakeContext";

const PER_PAGE = 8;

const PENDING_COLS =
  "grid grid-cols-[5.5rem_minmax(8rem,0.95fr)_minmax(9.5rem,1.3fr)_minmax(8.5rem,1.05fr)_minmax(6.5rem,0.8fr)_5.5rem_minmax(5.5rem,0.7fr)_5.25rem] items-center gap-x-2 px-5";

/** Intake inbox — proposals pushed by the case ingestor, awaiting review. */
export default function PendingCases() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setPendingReview } = usePendingIntake();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => setPage(1), [search]);

  // Accept/reject flows land back here with a one-shot confirmation message.
  useEffect(() => {
    const handoff = (location.state as { pendingNotice?: string } | null)?.pendingNotice;
    if (!handoff) return;
    setNotice(handoff);
    window.history.replaceState({}, "");
  }, [location.state]);

  const query = useQuery(`pending-cases:list:${search}:${page}`, () =>
    pendingCasesApi.list({ status: "pending_review", search: search || undefined, page, pageSize: PER_PAGE }),
  );

  const items = query.data?.pendingCases ?? null;
  const total = query.data?.total ?? 0;

  // Keep the sidebar badge in sync with what the inbox actually shows.
  useEffect(() => {
    if (query.data && !search) setPendingReview(query.data.total);
  }, [query.data, search, setPendingReview]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Pending cases</h1>
          <p className="mt-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            {items ? `${total} proposal${total === 1 ? "" : "s"} pending review` : "Loading proposals…"}
          </p>
        </div>
        <span className="mt-2 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
          Pushed by the case ingestor
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, claim #, insurer…"
            className="w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] py-1.5 pl-8 pr-3 text-[0.75rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
      </div>

      {notice && (
        <div className="surface flex shrink-0 items-center gap-3 rounded-[0.875rem] border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.06)] px-4 py-3">
          <p className="text-[0.78125rem] text-[var(--color-text-mid)]">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-auto shrink-0 text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {query.error && (
        <div className="anim-banner surface shrink-0 rounded-[0.875rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-4 py-3 text-[0.8125rem] text-[var(--color-neg)]">
          {query.error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1 overflow-hidden">
          {query.loading ? (
            <TableSkeleton
              colClass={PENDING_COLS}
              headers={["Received", "Claim", "Subject", "Insurer / Adjuster", "Type", "Payload", "Files", "Due"]}
            />
          ) : (
            /* Keyed on the page so paging replays the row stagger. */
            <PendingCasesTable
              key={`pending-${page}`}
              items={items ?? []}
              hasSearch={search !== ""}
              onRowClick={(id) => navigate(`/pending-cases/${id}`)}
            />
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between pb-0.5">
            <span className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total} proposals
            </span>
            <div className="flex items-center gap-1">
              <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page">
                <ChevronLeft size={13} strokeWidth={1.8} />
              </PageBtn>
              <span className="px-1 font-mono text-[0.6875rem] text-[var(--color-text-mid)]">
                {page} / {totalPages}
              </span>
              <PageBtn
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={13} strokeWidth={1.8} />
              </PageBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "grid h-7 min-w-[1.75rem] place-items-center rounded-[0.4375rem] px-1.5 font-mono text-[0.6875rem] text-[var(--color-text-mid)] transition-colors hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]",
        disabled && "pointer-events-none opacity-30",
      )}
    >
      {children}
    </button>
  );
}

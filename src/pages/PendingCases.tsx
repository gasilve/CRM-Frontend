import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { intakeApi, pendingCasesApi } from "@/lib/crm-api";
import { PendingCasesTable } from "@/components/cases/PendingCasesTable";
import { TableSkeleton } from "@/components/ui/LoadingState";
import { useQuery } from "@/lib/query-cache";
import { usePendingIntake } from "@/contexts/PendingIntakeContext";

const PER_PAGE = 8;

const PENDING_COLS =
  "grid grid-cols-[5.5rem_minmax(8rem,0.95fr)_minmax(9.5rem,1.3fr)_minmax(8.5rem,1.05fr)_minmax(6.5rem,0.8fr)_5.5rem_minmax(5.5rem,0.7fr)_5.25rem] items-center gap-x-2 px-5";

const minutesAgo = (iso: string | null): string => {
  if (!iso) return "never";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
};

/** Tells staff the mailbox job is alive, so an empty inbox can be trusted. */
function MailboxStatus() {
  const status = useQuery("intake:status", () => intakeApi.status(), { staleMs: 30_000 });
  const data = status.data;
  if (!data) return null;

  const healthy = data.configured && !data.lastError;
  const text = !data.configured
    ? "Mailbox not connected"
    : data.lastError
      ? `Mailbox check failing since ${minutesAgo(data.lastOkAt)}`
      : `Mailbox checked ${minutesAgo(data.lastOkAt)}`;

  return (
    <span
      className="mt-2 inline-flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]"
      title={data.lastError ?? "The case mailbox is read automatically every few minutes."}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: healthy ? "#4ade80" : "#f87171" }} />
      {text}
    </span>
  );
}

/** Intake inbox — referrals read from the case mailbox, awaiting review. */
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
        <MailboxStatus />

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
              headers={["Received", "Claim", "Subject", "Insurer / Adjuster", "Type", "Contents", "Files", "Due"]}
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

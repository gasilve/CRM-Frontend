import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/format";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { casesApi, ApiError, type CaseListItem, type CaseStatus, type CaseService } from "@/lib/crm-api";
import { WeatherStrip } from "@/components/cases/WeatherStrip";

// ─── Status / priority / service config ──────────────────────────────────────

const STATUS_CONFIG: Record<CaseStatus, { label: string; dot: string; pill: string; pillText: string }> = {
  open:      { label: "Open",      dot: "#4ade80", pill: "rgba(74,222,128,0.15)",  pillText: "#4ade80" },
  suspended: { label: "Suspended", dot: "#f59e0b", pill: "rgba(245,158,11,0.15)", pillText: "#f59e0b" },
  closed:    { label: "Closed",    dot: "#5b6680", pill: "rgba(91,102,128,0.15)", pillText: "#7a8499" },
};

const PRIORITY_CONFIG = {
  rush:     { label: "RUSH", bg: "rgba(248,113,113,0.16)", text: "#f87171" },
  asap:     { label: "ASAP", bg: "rgba(251,146,60,0.16)",  text: "#fb923c" },
  standard: { label: "STD",  bg: "var(--color-ink-3)",      text: "var(--color-text-lo)" },
} as const;

const SERVICE_COLORS: Record<CaseService, { bg: string; text: string }> = {
  SURV: { bg: "rgba(74,127,255,0.16)",  text: "#7aa1ff" },
  WC:   { bg: "rgba(167,139,250,0.16)", text: "#a78bfa" },
  FMLA: { bg: "rgba(45,212,191,0.16)",  text: "#2dd4bf" },
  BG:   { bg: "rgba(148,163,184,0.16)", text: "#94a3b8" },
  DOM:  { bg: "rgba(251,113,133,0.16)", text: "#fb7185" },
  SOC:  { bg: "rgba(192,132,252,0.16)", text: "#c084fc" },
  DIS:  { bg: "rgba(251,191,36,0.16)",  text: "#fbbf24" },
  LOC:  { bg: "rgba(74,222,128,0.16)",  text: "#4ade80" },
  PS:   { bg: "rgba(34,211,238,0.16)",  text: "#22d3ee" },
  LIA:  { bg: "rgba(244,114,182,0.16)", text: "#f472b6" },
};

const PER_PAGE = 8;
const DAY_MS = 86_400_000;

const fmtShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "2-digit" });

/** Signed whole days until `iso` (negative = past). */
const daysUntil = (iso: string): number => {
  const due = new Date(iso);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / DAY_MS);
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Cases() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<CaseListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPage(1), [search, dueFrom, dueTo]);

  useEffect(() => {
    let cancelled = false;
    casesApi
      .list({
        search: search || undefined,
        dueFrom: dueFrom || undefined,
        dueTo: dueTo || undefined,
        page,
        pageSize: PER_PAGE,
      })
      .then((res) => {
        if (cancelled) return;
        setItems(res.cases);
        setTotal(res.total);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load cases.");
      });
    return () => {
      cancelled = true;
    };
  }, [search, dueFrom, dueTo, page]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const hasDateFilter = dueFrom !== "" || dueTo !== "";

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">
            Cases
          </h1>
          <p className="mt-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            {total} matching cases
          </p>
        </div>
        <WeatherStrip />
      </div>

      {/* Filters: search on the left, due-date range on the right */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects, claim #..."
            className="w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] py-1.5 pl-8 pr-3 text-[0.75rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Due</span>
          <input
            type="date"
            value={dueFrom}
            onChange={(e) => setDueFrom(e.target.value)}
            aria-label="Due from"
            className="rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1.5 text-[0.71875rem] text-[var(--color-text-hi)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <span className="text-[0.71875rem] text-[var(--color-text-lo)]">–</span>
          <input
            type="date"
            value={dueTo}
            onChange={(e) => setDueTo(e.target.value)}
            aria-label="Due to"
            className="rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1.5 text-[0.71875rem] text-[var(--color-text-hi)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          {hasDateFilter && (
            <button
              type="button"
              onClick={() => { setDueFrom(""); setDueTo(""); }}
              aria-label="Clear date filter"
              className="grid h-7 w-7 place-items-center rounded-[0.5rem] text-[var(--color-text-lo)] transition-colors hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]"
            >
              <X size={12} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="surface shrink-0 rounded-[0.875rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-4 py-3 text-[0.8125rem] text-[var(--color-neg)]">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1 overflow-hidden">
          {!items ? (
            <div className="surface flex h-full items-center justify-center">
              <Loader2 size={22} className="animate-spin text-[var(--color-text-lo)]" />
            </div>
          ) : (
            <CasesTable items={items} onRowClick={(id) => navigate(`/cases/${id}`)} />
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between pb-0.5">
            <span className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total} cases
            </span>
            <div className="flex items-center gap-1">
              <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page">
                <ChevronLeft size={13} strokeWidth={1.8} />
              </PageBtn>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .reduce<(number | "…")[]>((acc, n, idx, arr) => {
                  if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(n);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "…" ? (
                    <span key={`ellipsis-${idx}`} className="px-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">…</span>
                  ) : (
                    <PageBtn key={item} onClick={() => setPage(item as number)} active={page === item}>
                      {item}
                    </PageBtn>
                  ),
                )}
              <PageBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page">
                <ChevronRight size={13} strokeWidth={1.8} />
              </PageBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Table view ───────────────────────────────────────────────────────────────

const CASES_COLS =
  "grid grid-cols-[5.25rem_3.25rem_minmax(9.5rem,1.25fr)_minmax(7rem,0.9fr)_5rem_minmax(7.5rem,0.95fr)_minmax(8.5rem,1.05fr)_3rem_minmax(6.5rem,0.85fr)_5.25rem] items-center gap-x-2 px-5";

function CasesTable({ items, onRowClick }: { items: CaseListItem[]; onRowClick: (id: string) => void }) {
  const slots = Array.from({ length: PER_PAGE }, (_, i) => items[i] ?? null);

  return (
    <div className="surface flex h-full min-h-0 flex-col overflow-hidden p-0">
      <div className={cn(CASES_COLS, "shrink-0 border-b border-[var(--color-line)] py-2.5")}>
        <span className="eyebrow">Due</span>
        <span className="eyebrow">!</span>
        <span className="eyebrow">Subject</span>
        <span className="eyebrow">Type</span>
        <span className="eyebrow">Claim</span>
        <span className="eyebrow">Location</span>
        <span className="eyebrow">Client / Adjuster</span>
        <span className="eyebrow text-center">Days</span>
        <span className="eyebrow">Investigator</span>
        <span className="eyebrow">Status</span>
      </div>

      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center px-6 py-12 font-mono text-[0.71875rem] text-[var(--color-text-lo)]">
          No cases match the current filter.
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden" style={{ gridTemplateRows: `repeat(${PER_PAGE}, minmax(0, 1fr))` }}>
          {slots.map((c, i) =>
            c ? (
              <TableRow key={c.id} c={c} onClick={() => onRowClick(c.id)} showDivider={i < PER_PAGE - 1} />
            ) : (
              <div key={`pad-${i}`} aria-hidden className={cn(i < PER_PAGE - 1 && "border-b border-[var(--color-line)]")} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function DueCell({ c }: { c: CaseListItem }) {
  if (!c.dueDate) {
    return <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">—</span>;
  }
  const left = daysUntil(c.dueDate);
  const closed = c.status === "closed";
  const overdue = !closed && left < 0;
  const soon = !closed && left >= 0 && left <= 7;
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "font-mono text-[0.71875rem] font-medium leading-tight",
          overdue ? "text-[var(--color-neg)]" : soon ? "text-[#fb923c]" : "text-[var(--color-text-hi)]",
        )}
      >
        {fmtShortDate(c.dueDate)}
      </div>
      <div
        className={cn(
          "font-mono text-[0.5625rem] uppercase tracking-wide leading-tight",
          overdue ? "text-[var(--color-neg)]" : soon ? "text-[#fb923c]" : "text-[var(--color-text-lo)]",
        )}
      >
        {closed ? "closed" : overdue ? "overdue" : `${left}d left`}
      </div>
    </div>
  );
}

function TableRow({ c, onClick, showDivider }: { c: CaseListItem; onClick: () => void; showDivider: boolean }) {
  const cfg = STATUS_CONFIG[c.status];
  const pri = PRIORITY_CONFIG[c.priority];
  const primaryAddress = c.addresses[0];
  const location = [primaryAddress?.city, primaryAddress?.state ?? c.state].filter(Boolean).join(", ");
  const inv = c.assignments[0]?.user ?? null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        CASES_COLS,
        "h-full min-h-0 cursor-pointer overflow-hidden transition-colors hover:bg-white/[0.022]",
        showDivider && "border-b border-[var(--color-line)]",
      )}
    >
      {/* Due */}
      <DueCell c={c} />

      {/* Priority */}
      <div>
        <span
          className="inline-block rounded-[0.3125rem] px-1.5 py-0.5 font-mono text-[0.53125rem] font-semibold tracking-wider"
          style={{ background: pri.bg, color: pri.text }}
        >
          {pri.label}
        </span>
      </div>

      {/* Subject */}
      <div className="min-w-0">
        <div className="truncate text-[0.8125rem] font-medium leading-tight text-[var(--color-text-hi)]">
          {c.subjectName}
        </div>
        <div className="truncate font-mono text-[0.625rem] leading-tight text-[var(--color-text-lo)]">
          {c.subjectDob ? `DOB ${c.subjectDob.slice(0, 10)}` : c.caseNumber}
        </div>
      </div>

      {/* Type */}
      <div className="flex min-w-0 flex-wrap items-center gap-1 overflow-hidden">
        <ServicePill service={c.service} />
        {c.reopened && (
          <span className="inline-block rounded-full border border-[var(--color-line-2)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--color-text-lo)]">
            Reopen
          </span>
        )}
      </div>

      {/* Claim */}
      <div className="truncate font-mono text-[0.6875rem] text-[var(--color-text-mid)]">
        {c.claimNumber ?? "—"}
      </div>

      {/* Location */}
      <div className="flex min-w-0 items-center gap-1">
        {location ? (
          <>
            <MapPin size={10} strokeWidth={1.8} className="shrink-0 text-[var(--color-text-lo)]" />
            <span className="truncate text-[0.71875rem] text-[var(--color-text-mid)]">{location}</span>
          </>
        ) : (
          <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">—</span>
        )}
      </div>

      {/* Client / adjuster */}
      <div className="min-w-0">
        <div className="truncate text-[0.75rem] leading-tight text-[var(--color-text-hi)]">{c.client?.company ?? "—"}</div>
        <div className="truncate text-[0.65625rem] leading-tight text-[var(--color-text-lo)]">{c.adjusterName ?? ""}</div>
      </div>

      {/* Days */}
      <div className="text-center font-mono text-[0.8125rem] font-semibold text-[var(--color-accent-2)]">
        {c.daysAllotted ?? "—"}
      </div>

      {/* Investigator */}
      <div className="flex min-w-0 items-center gap-1.5">
        {inv ? (
          <>
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.5625rem] font-medium text-white"
              style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
              title={inv.name}
            >
              {getInitials(inv.name)}
            </span>
            <span className="truncate text-[0.71875rem] text-[var(--color-text-mid)]">{inv.name.split(" ")[0]}</span>
            {c.assignments.length > 1 && (
              <span className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">+{c.assignments.length - 1}</span>
            )}
          </>
        ) : (
          <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">—</span>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cfg.dot }} />
        <span className="text-[0.71875rem] text-[var(--color-text-mid)]">{cfg.label}</span>
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function ServicePill({ service }: { service: CaseService }) {
  const colors = SERVICE_COLORS[service];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[0.59375rem] font-medium tracking-wide"
      style={{ background: colors.bg, color: colors.text }}
      title={SERVICE_LABELS[service]}
    >
      {SERVICE_LABELS[service]}
    </span>
  );
}

function PageBtn({ children, onClick, disabled, active, "aria-label": ariaLabel }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean; "aria-label"?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "grid h-7 min-w-[1.75rem] place-items-center rounded-[0.4375rem] px-1.5 font-mono text-[0.6875rem] transition-colors",
        active ? "bg-[var(--color-accent-soft)] text-[var(--color-text-hi)] shadow-[inset_0_0_0_0.0625rem_rgba(74,127,255,0.4)]" : "text-[var(--color-text-mid)] hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]",
        disabled && "pointer-events-none opacity-30",
      )}
    >
      {children}
    </button>
  );
}

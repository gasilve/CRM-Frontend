import { cn } from "@/lib/cn";
import { CaseTypePill, FilesPill, IngestorStatusPill } from "@/components/cases/PendingCasePills";
import type { PendingCaseListItem } from "@/lib/crm-api";

const PER_PAGE = 8;

const fmtShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "2-digit" });

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const PENDING_COLS =
  "grid grid-cols-[5.5rem_minmax(8rem,0.95fr)_minmax(9.5rem,1.3fr)_minmax(8.5rem,1.05fr)_minmax(6.5rem,0.8fr)_5.5rem_minmax(5.5rem,0.7fr)_5.25rem] items-center gap-x-2 px-5";

export function PendingCasesTable({
  items,
  hasSearch,
  onRowClick,
}: {
  items: PendingCaseListItem[];
  hasSearch: boolean;
  onRowClick: (id: string) => void;
}) {
  const slots = Array.from({ length: PER_PAGE }, (_, i) => items[i] ?? null);

  return (
    <div className="surface flex h-full min-h-0 flex-col overflow-hidden p-0">
      <div className={cn(PENDING_COLS, "shrink-0 border-b border-[var(--color-line)] py-2.5")}>
        <span className="eyebrow">Received</span>
        <span className="eyebrow">Claim</span>
        <span className="eyebrow">Subject</span>
        <span className="eyebrow">Insurer / Adjuster</span>
        <span className="eyebrow">Type</span>
        <span className="eyebrow">Payload</span>
        <span className="eyebrow">Files</span>
        <span className="eyebrow text-right">Due</span>
      </div>

      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center px-6 py-12 text-center">
          <div>
            <div className="editorial text-[1.25rem] text-[var(--color-text-mid)]">
              {hasSearch ? "No matches" : "Nothing waiting"}
            </div>
            <p className="mx-auto mt-2 max-w-[20rem] text-[0.8125rem] leading-relaxed text-[var(--color-text-lo)]">
              {hasSearch
                ? "No proposals match the current search."
                : "Proposals pushed by the case ingestor land here for review before they become cases."}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="anim-stagger anim-stagger-tight grid min-h-0 flex-1 overflow-hidden"
          style={{ gridTemplateRows: `repeat(${PER_PAGE}, minmax(0, 1fr))` }}
        >
          {slots.map((item, i) =>
            item ? (
              <PendingRow key={item.id} item={item} onClick={() => onRowClick(item.id)} showDivider={i < PER_PAGE - 1} />
            ) : (
              <div key={`pad-${i}`} aria-hidden className={cn(i < PER_PAGE - 1 && "border-b border-[var(--color-line)]")} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function PendingRow({
  item,
  onClick,
  showDivider,
}: {
  item: PendingCaseListItem;
  onClick: () => void;
  showDivider: boolean;
}) {
  const vehicles = item.proposal?.vehicles?.length ?? 0;
  const attachments = item.proposal?.attachments?.length ?? 0;

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
        PENDING_COLS,
        "h-full min-h-0 cursor-pointer overflow-hidden transition-colors hover:bg-white/[0.022]",
        showDivider && "border-b border-[var(--color-line)]",
      )}
    >
      <div className="min-w-0">
        <div className="font-mono text-[0.71875rem] font-medium leading-tight text-[var(--color-text-hi)]">
          {fmtShortDate(item.receivedAt)}
        </div>
        <div className="font-mono text-[0.5625rem] uppercase leading-tight tracking-wide text-[var(--color-text-lo)]">
          {fmtTime(item.receivedAt)}
        </div>
      </div>

      <div className="min-w-0">
        <div className="truncate font-mono text-[0.6875rem] leading-tight text-[var(--color-text-mid)]">
          {item.claimNumber ?? "—"}
        </div>
        {item.caseIngestorCode && (
          <div className="truncate font-mono text-[0.5625rem] leading-tight text-[var(--color-text-lo)]">
            ingestor #{item.caseIngestorCode}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="truncate text-[0.8125rem] font-medium leading-tight text-[var(--color-text-hi)]">
          {item.subjectName ?? "Unnamed subject"}
        </div>
        <div className="truncate font-mono text-[0.625rem] leading-tight text-[var(--color-text-lo)]">
          {item.proposal?.subject?.addresses?.[0] ?? "no address"}
        </div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-[0.75rem] leading-tight text-[var(--color-text-hi)]">{item.insurer ?? "—"}</div>
        <div className="truncate text-[0.625rem] leading-tight text-[var(--color-text-lo)]">
          {item.proposal?.assignment?.adjusterEmail ?? ""}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1 overflow-hidden">
        <CaseTypePill caseType={item.ingestorCaseType} />
        <IngestorStatusPill status={item.ingestorStatus} />
      </div>

      <div className="font-mono text-[0.625rem] leading-tight text-[var(--color-text-mid)]">
        <div>{vehicles} vehicle{vehicles === 1 ? "" : "s"}</div>
        <div className="text-[var(--color-text-lo)]">
          {attachments} file{attachments === 1 ? "" : "s"}
        </div>
      </div>

      <div className="min-w-0">
        <FilesPill status={item.filesStatus} />
      </div>

      <div className="text-right font-mono text-[0.6875rem] text-[var(--color-text-mid)]">
        {item.dueDate ? fmtShortDate(item.dueDate) : "—"}
      </div>
    </div>
  );
}

export { PER_PAGE as PENDING_PER_PAGE };

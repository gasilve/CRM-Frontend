import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  LayoutGrid,
  Rows3,
  Plus,
  User,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  invCases,
  investigators,
  TAG_COLORS,
  SERVICE_LABELS,
  daysOpenLabel,
  type InvCase,
  type CaseStatus,
  type InvTag,
} from "@/lib/mock-data";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CaseStatus, { label: string; dot: string; pill: string; pillText: string }> = {
  open:      { label: "Open",      dot: "#4ade80", pill: "rgba(74,222,128,0.15)",  pillText: "#4ade80" },
  suspended: { label: "Suspended", dot: "#f59e0b", pill: "rgba(245,158,11,0.15)", pillText: "#f59e0b" },
  closed:    { label: "Closed",    dot: "#5b6680", pill: "rgba(91,102,128,0.15)", pillText: "#7a8499" },
};

const ALL_TAGS: InvTag[] = [
  "Work Comp","FMLA","Surveillance","Background","Social Media",
  "Domestic","Disability","Locate","Process Serving","Rush","Liability",
];

const PER_PAGE = 10;

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Cases() {
  const [items, setItems] = useState<InvCase[]>(invCases);
  const [view, setView] = useState<"table" | "board">("table");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");
  const [tagFilter, setTagFilter] = useState<InvTag | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    if (tagFilter) list = list.filter((c) => c.tags.includes(tagFilter));
    return list;
  }, [items, statusFilter, tagFilter]);

  // Reset to page 1 whenever the filter changes
  useEffect(() => { setPage(1); }, [statusFilter, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const grouped = useMemo(() => {
    const map: Record<CaseStatus, InvCase[]> = { open: [], suspended: [], closed: [] };
    for (const c of paginated) map[c.status].push(c);
    return map;
  }, [paginated]);

  const onDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    if (!e.over) return;
    const newStatus = String(e.over.id) as CaseStatus;
    const id = String(e.active.id);
    setItems((prev) =>
      prev.map((c) => (c.id === id && c.status !== newStatus ? { ...c, status: newStatus } : c)),
    );
  };

  const dragging = items.find((c) => c.id === draggingId) ?? null;

  const openCount = items.filter((c) => c.status === "open").length;
  const suspendedCount = items.filter((c) => c.status === "suspended").length;

  return (
    // h-full + overflow-hidden keeps the page within the viewport; pagination replaces scroll
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[36px] leading-none text-[var(--color-text-hi)]">
            Cases
          </h1>
          <p className="mt-1 font-mono text-[11px] text-[var(--color-text-lo)]">
            {openCount} open · {suspendedCount} suspended · {items.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-ink-2)]/40 p-1">
            <ViewToggle active={view === "table"} onClick={() => setView("table")} icon={<Rows3 size={13} strokeWidth={1.8} />} label="Table" />
            <ViewToggle active={view === "board"} onClick={() => setView("board")} icon={<LayoutGrid size={13} strokeWidth={1.8} />} label="Board" />
          </div>
          <button className="flex h-9 items-center gap-2 rounded-[10px] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-3.5 text-[12px] text-[var(--color-text-hi)] hover:shadow-[0_0_0_3px_var(--color-accent-soft)] transition-shadow">
            <Plus size={13} strokeWidth={1.8} />
            New case
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex shrink-0 flex-col gap-3">
        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "open", "suspended", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-medium transition-all",
                statusFilter === s
                  ? "border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                  : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)] hover:border-[var(--color-line-2)]",
              )}
            >
              {s !== "all" && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: STATUS_CONFIG[s].dot }}
                />
              )}
              {s === "all" ? "All cases" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
        {/* Tag chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ALL_TAGS.map((tag) => {
            const colors = TAG_COLORS[tag];
            const active = tagFilter === tag;
            return (
              <button
                key={tag}
                onClick={() => setTagFilter(active ? null : tag)}
                className="rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium tracking-wide transition-all"
                style={
                  active
                    ? { background: colors.bg, color: colors.text, borderColor: colors.text + "60" }
                    : { background: "transparent", color: "var(--color-text-lo)", borderColor: "var(--color-line)" }
                }
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content — flex-1 min-h-0 clips to remaining viewport height */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {view === "table" ? (
          <CasesTable items={paginated} onRowClick={(id) => navigate(`/cases/${id}`)} />
        ) : (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="-mx-1 flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
              {(["open", "suspended", "closed"] as CaseStatus[]).map((status) => (
                <BoardColumn
                  key={status}
                  status={status}
                  cases={grouped[status]}
                  onCardClick={(id) => navigate(`/cases/${id}`)}
                />
              ))}
            </div>
            <DragOverlay>
              {dragging && (
                <div className="w-[280px] rotate-1 opacity-95">
                  <BoardCard c={dragging} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between border-t border-[var(--color-line)] pt-3">
            <span className="font-mono text-[11px] text-[var(--color-text-lo)]">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} cases
            </span>
            <div className="flex items-center gap-1">
              <PageBtn
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
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
                    <span key={`ellipsis-${idx}`} className="px-1 font-mono text-[11px] text-[var(--color-text-lo)]">…</span>
                  ) : (
                    <PageBtn
                      key={item}
                      onClick={() => setPage(item as number)}
                      active={page === item}
                    >
                      {item}
                    </PageBtn>
                  ),
                )}
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

// ─── Table view ───────────────────────────────────────────────────────────────

function CasesTable({ items, onRowClick }: { items: InvCase[]; onRowClick: (id: string) => void }) {
  return (
    <div className="surface overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-[var(--color-line)]">
              <Th>Subject</Th>
              <Th>Client</Th>
              <Th>Service</Th>
              <Th>Tags</Th>
              <Th>Assigned</Th>
              <Th align="center">Status</Th>
              <Th align="right">Opened</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <TableRow key={c.id} c={c} onClick={() => onRowClick(c.id)} />
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center font-mono text-[11.5px] text-[var(--color-text-lo)]">
                  No cases match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableRow({ c, onClick }: { c: InvCase; onClick: () => void }) {
  const cfg = STATUS_CONFIG[c.status];
  const assigned = c.assignedTo
    .map((id) => investigators.find((i) => i.id === id)?.name ?? id)
    .join(", ");

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-[var(--color-line)] last:border-0 transition-colors hover:bg-white/[0.022]"
    >
      {/* Subject */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]">
            <User size={13} strokeWidth={1.5} className="text-[var(--color-text-lo)]" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-[var(--color-text-hi)]">{c.subject.name}</div>
            <div className="font-mono text-[10px] text-[var(--color-text-lo)]">{c.id}</div>
          </div>
        </div>
      </td>

      {/* Client */}
      <td className="px-5 py-3.5">
        <div className="max-w-[160px] truncate text-[12.5px] text-[var(--color-text-mid)]">{c.client}</div>
        <div className="font-mono text-[10px] text-[var(--color-text-lo)]">{c.state}</div>
      </td>

      {/* Service */}
      <td className="px-5 py-3.5">
        <ServicePill service={c.service} />
      </td>

      {/* Tags */}
      <td className="px-5 py-3.5">
        <div className="flex flex-wrap gap-1">
          {c.tags.slice(0, 2).map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
          {c.tags.length > 2 && (
            <span className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[9.5px] text-[var(--color-text-lo)]">
              +{c.tags.length - 2}
            </span>
          )}
        </div>
      </td>

      {/* Assigned */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          {c.assignedTo.slice(0, 2).map((id) => {
            const inv = investigators.find((i) => i.id === id);
            if (!inv) return null;
            return (
              <span
                key={id}
                className="grid h-6 w-6 place-items-center rounded-full text-[9px] font-medium text-white"
                style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
                title={inv.name}
              >
                {inv.initials}
              </span>
            );
          })}
          {c.assignedTo.length > 2 && (
            <span className="font-mono text-[9.5px] text-[var(--color-text-lo)]">+{c.assignedTo.length - 2}</span>
          )}
          {c.assignedTo.length === 0 && (
            <span className="font-mono text-[10.5px] text-[var(--color-text-lo)]">—</span>
          )}
        </div>
        {c.assignedTo.length <= 2 && (
          <div className="mt-0.5 truncate text-[10.5px] text-[var(--color-text-lo)]">{assigned}</div>
        )}
      </td>

      {/* Status */}
      <td className="px-5 py-3.5 text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium"
          style={{ background: cfg.pill, color: cfg.pillText }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
          {cfg.label}
        </span>
      </td>

      {/* Opened */}
      <td className="px-5 py-3.5 text-right">
        <div className="font-mono text-[11.5px] text-[var(--color-text-hi)]">{daysOpenLabel(c.daysOpen)}</div>
        <div className="font-mono text-[10px] text-[var(--color-text-lo)]">{c.dateOpened}</div>
      </td>
    </tr>
  );
}

// ─── Board view ───────────────────────────────────────────────────────────────

function BoardColumn({
  status,
  cases,
  onCardClick,
}: {
  status: CaseStatus;
  cases: InvCase[];
  onCardClick: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  const cfg = STATUS_CONFIG[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[290px] shrink-0 flex-col rounded-[14px] border transition-colors",
        isOver
          ? "border-[rgba(74,127,255,0.45)] bg-[var(--color-accent-soft)]"
          : "border-[var(--color-line)] bg-[var(--color-ink-1)]/50",
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}80` }} />
          <span className="eyebrow text-[var(--color-text-hi)]">{cfg.label}</span>
          <span className="font-mono text-[10.5px] text-[var(--color-text-lo)]">{cases.length}</span>
        </div>
      </div>
      {/* overflow-y-auto: columns scroll internally, not the whole page */}
      <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {cases.map((c) => (
          <DraggableBoardCard key={c.id} c={c} onClick={() => onCardClick(c.id)} />
        ))}
        {cases.length === 0 && (
          <div className="grid place-items-center rounded-md border border-dashed border-[var(--color-line)] py-8 text-[11px] text-[var(--color-text-lo)]">
            No {cfg.label.toLowerCase()} cases
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableBoardCard({ c, onClick }: { c: InvCase; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-20")}
    >
      <BoardCard c={c} />
    </div>
  );
}

function BoardCard({ c }: { c: InvCase }) {
  const cfg = STATUS_CONFIG[c.status];
  const inv = investigators.find((i) => i.id === c.assignedTo[0]);

  return (
    <div className="surface surface-hover group rounded-[12px] p-3.5">
      {/* Top row: case ID + status dot */}
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-mono text-[10px] text-[var(--color-text-lo)]">{c.id}</span>
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}80` }}
        />
      </div>

      {/* Subject name — prominent */}
      <div className="text-[13.5px] font-semibold leading-snug text-[var(--color-text-hi)]">
        {c.subject.name}
      </div>
      <div className="mt-0.5 text-[11.5px] text-[var(--color-text-mid)]">{c.client}</div>

      {/* Service + Rush tag */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        <ServicePill service={c.service} />
        {c.tags.includes("Rush") && <TagPill tag="Rush" />}
      </div>

      {/* Footer: investigator + days open */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-line)] pt-2.5">
        <div className="flex items-center gap-1.5">
          {inv && (
            <>
              <span
                className="grid h-5 w-5 place-items-center rounded-full text-[8.5px] font-medium text-white"
                style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
              >
                {inv.initials}
              </span>
              <span className="text-[10.5px] text-[var(--color-text-mid)]">{inv.name.split(" ")[0]}</span>
            </>
          )}
          {!inv && <span className="text-[10.5px] text-[var(--color-text-lo)]">Unassigned</span>}
        </div>
        <div className="flex items-center gap-1 font-mono text-[10px] text-[var(--color-text-lo)]">
          <Clock size={9} strokeWidth={1.8} />
          {daysOpenLabel(c.daysOpen)}
        </div>
      </div>

      {/* Location if available */}
      {c.subject.city && (
        <div className="mt-1.5 flex items-center gap-1 font-mono text-[9.5px] text-[var(--color-text-lo)]">
          <MapPin size={8} strokeWidth={1.8} />
          {c.subject.city}, {c.subject.state}
        </div>
      )}
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function ServicePill({ service }: { service: InvCase["service"] }) {
  return (
    <span className="inline-block rounded-full border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-0.5 font-mono text-[9.5px] tracking-wider text-[var(--color-text-mid)]">
      {service}
    </span>
  );
}

function TagPill({ tag }: { tag: InvTag }) {
  const colors = TAG_COLORS[tag];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[9.5px] font-medium tracking-wide"
      style={{ background: colors.bg, color: colors.text }}
    >
      {tag}
    </span>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "center" | "right" }) {
  return (
    <th className={cn("px-5 py-3", align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left")}>
      <span className="eyebrow">{children}</span>
    </th>
  );
}

function ViewToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] transition-colors",
        active
          ? "bg-[var(--color-ink-3)] text-[var(--color-text-hi)] shadow-[inset_0_0_0_1px_var(--color-line-2)]"
          : "text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]",
      )}
    >
      {icon} {label}
    </button>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
  active,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "grid h-7 min-w-[28px] place-items-center rounded-[7px] px-1.5 font-mono text-[11px] transition-colors",
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-text-hi)] shadow-[inset_0_0_0_1px_rgba(74,127,255,0.4)]"
          : "text-[var(--color-text-mid)] hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]",
        disabled && "pointer-events-none opacity-30",
      )}
    >
      {children}
    </button>
  );
}

// re-export for SERVICE_LABELS usage in other components
export { SERVICE_LABELS };

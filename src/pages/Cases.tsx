import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Columns3,
  GripVertical,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import { SERVICE_LABELS } from "@/lib/mock-data";
import {
  ApiError,
  casesApi,
  gridLayoutsApi,
  REGION_LABELS,
  type CaseListItem,
  type CasePriority,
  type CaseService,
  type CaseSortField,
  type CaseStatus,
  type Region,
} from "@/lib/crm-api";
import { WeatherStrip } from "@/components/cases/WeatherStrip";
import { TableSkeleton } from "@/components/ui/LoadingState";
import { useQuery } from "@/lib/query-cache";
import { useAuth } from "@/contexts/AuthContext";
import {
  CASE_COLUMNS,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  columnsFromLayout,
  defaultColumnSettings,
  getColumnDef,
  layoutFromColumns,
  widthOf,
  type CaseColumnDef,
  type CaseColumnId,
  type CaseColumnSetting,
} from "@/components/cases/case-table-columns";

const PER_PAGE = 8;

const ROW_BASE = "grid items-center gap-x-2 px-5";

type SortState = { key: CaseSortField; dir: "asc" | "desc" } | null;

type Filters = {
  status: CaseStatus | "";
  priority: CasePriority | "";
  service: CaseService | "";
  region: Region | "";
  dueFrom: string;
  dueTo: string;
};

const EMPTY_FILTERS: Filters = { status: "", priority: "", service: "", region: "", dueFrom: "", dueTo: "" };

const countActiveFilters = (f: Filters): number =>
  [f.status, f.priority, f.service, f.region, f.dueFrom || f.dueTo ? "due" : ""].filter(Boolean).length;

/** A configured column resolved against the catalog (renamed headers, resolved width applied). */
type ResolvedColumn = { def: CaseColumnDef; label: string; width: number };

const resolveColumns = (settings: CaseColumnSetting[]): ResolvedColumn[] =>
  settings
    .map((s) => {
      const def = getColumnDef(s.id);
      return def ? { def, label: s.label?.trim() || def.label, width: widthOf(s) } : null;
    })
    .filter((c): c is ResolvedColumn => c !== null);

const trackStyle = (columns: { width: number }[]): CSSProperties => ({
  gridTemplateColumns: columns.map((c) => `minmax(2.75rem, ${c.width}fr)`).join(" "),
});

/** Outside-click / Escape dismissal for lightweight popovers. */
function useDismiss<T extends HTMLElement>(open: boolean, onDismiss: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onDismiss]);
  return ref;
}

export default function Cases() {
  const navigate = useNavigate();
  const { isSuperadmin } = useAuth();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [search, filters, sort]);

  // Shared column configuration (house layout, SuperAdmin-editable in place — no modal).
  const layoutQuery = useQuery("cases-table:columns", async () => (await gridLayoutsApi.get("cases-table")).layout, {
    staleMs: 5 * 60_000,
  });
  const savedSettings = useMemo(() => columnsFromLayout(layoutQuery.data?.items), [layoutQuery.data]);

  const [editingColumns, setEditingColumns] = useState(false);
  const [draft, setDraft] = useState<CaseColumnSetting[]>(savedSettings);
  const [savingColumns, setSavingColumns] = useState(false);
  const [columnsError, setColumnsError] = useState<string | null>(null);

  const activeSettings = editingColumns ? draft : savedSettings;
  const columns = useMemo(() => resolveColumns(activeSettings), [activeSettings]);
  const rowStyle = useMemo(() => trackStyle(columns), [columns]);

  const startEditingColumns = () => {
    setDraft(savedSettings);
    setColumnsError(null);
    setEditingColumns(true);
  };
  const cancelEditingColumns = () => {
    setEditingColumns(false);
    setColumnsError(null);
  };
  const saveColumns = async () => {
    setSavingColumns(true);
    setColumnsError(null);
    try {
      const { layout } = await gridLayoutsApi.save("cases-table", layoutFromColumns(draft));
      layoutQuery.mutate(layout);
      setEditingColumns(false);
    } catch (err) {
      setColumnsError(err instanceof ApiError ? err.message : "Could not save the column layout.");
    } finally {
      setSavingColumns(false);
    }
  };

  // Cached per filter combination: revisiting the page (or paging back and
  // forth) renders instantly from cache while a background fetch refreshes it.
  const queryKey = [
    "cases:list",
    search,
    filters.status,
    filters.priority,
    filters.service,
    filters.region,
    filters.dueFrom,
    filters.dueTo,
    sort ? `${sort.key}.${sort.dir}` : "",
    page,
  ].join(":");
  const query = useQuery(queryKey, () =>
    casesApi.list({
      search: search || undefined,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      service: filters.service || undefined,
      region: filters.region || undefined,
      dueFrom: filters.dueFrom || undefined,
      dueTo: filters.dueTo || undefined,
      sortBy: sort?.key,
      sortDir: sort?.dir,
      page,
      pageSize: PER_PAGE,
    }),
  );

  const items = query.data?.cases ?? null;
  const total = query.data?.total ?? 0;
  const loading = query.loading;
  const error = query.error;

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const toggleSort = (key: CaseSortField) =>
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Cases</h1>
          <p className="mt-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            {items ? `${total} matching case${total === 1 ? "" : "s"}` : "Loading cases…"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <WeatherStrip />
        </div>
      </div>

      {editingColumns ? (
        <ColumnEditorToolbar
          draft={draft}
          onAdd={(id) => setDraft((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, { id }]))}
          onReset={() => setDraft(defaultColumnSettings())}
          onCancel={cancelEditingColumns}
          onSave={saveColumns}
          saving={savingColumns}
          error={columnsError}
        />
      ) : (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subjects, claim #…"
              className="w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] py-1.5 pl-8 pr-3 text-[0.75rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <FiltersButton filters={filters} onChange={setFilters} />
            {isSuperadmin && (
              <button
                type="button"
                onClick={startEditingColumns}
                title="Customize columns"
                aria-label="Customize columns"
                className="grid h-8 w-8 place-items-center rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] text-[var(--color-text-lo)] transition-colors hover:border-[var(--color-accent-soft)] hover:text-[var(--color-text-hi)]"
              >
                <Columns3 size={13} strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="anim-banner surface shrink-0 rounded-[0.875rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-4 py-3 text-[0.8125rem] text-[var(--color-neg)]">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <TableSkeleton colClass={ROW_BASE} colStyle={rowStyle} headers={columns.map((c) => c.label)} />
          ) : (
            <CasesTable
              key={`cases-${page}`}
              items={items ?? []}
              columns={columns}
              rowStyle={rowStyle}
              sort={sort}
              onSort={toggleSort}
              onRowClick={(id) => navigate(`/cases/${id}`)}
              editing={editingColumns}
              draft={draft}
              onDraftChange={setDraft}
            />
          )}
        </div>

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
                    <span key={`ellipsis-${idx}`} className="px-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                      …
                    </span>
                  ) : (
                    <PageBtn key={item} onClick={() => setPage(item as number)} active={page === item}>
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

// ─── Column editor toolbar (replaces the search/filter row while editing) ───

function ColumnEditorToolbar({
  draft,
  onAdd,
  onReset,
  onCancel,
  onSave,
  saving,
  error,
}: {
  draft: CaseColumnSetting[];
  onAdd: (id: CaseColumnId) => void;
  onReset: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 rounded-[0.625rem] border border-[var(--color-accent-soft)] bg-[rgba(74,127,255,0.08)] px-3 py-2">
        <GripVertical size={13} strokeWidth={1.8} className="shrink-0 text-[var(--color-accent-2)]" />
        <span className="text-[0.71875rem] text-[var(--color-text-mid)]">
          Drag headers to reorder, drag an edge to resize, click × to remove.
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <AddColumnMenu draft={draft} onAdd={onAdd} />
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-[0.5rem] px-2 py-1.5 text-[0.71875rem] text-[var(--color-text-lo)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-text-hi)]"
          >
            <RotateCcw size={11} strokeWidth={1.8} />
            Reset
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[0.5rem] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-text-hi)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[0.5rem] bg-[var(--color-accent)] px-3.5 py-1.5 text-[0.71875rem] font-medium text-white transition-opacity",
              saving && "pointer-events-none opacity-60",
            )}
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
      {error && <span className="px-1 text-[0.6875rem] text-[var(--color-neg)]">{error}</span>}
    </div>
  );
}

function AddColumnMenu({ draft, onAdd }: { draft: CaseColumnSetting[]; onAdd: (id: CaseColumnId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const available = CASE_COLUMNS.filter((col) => !draft.some((d) => d.id === col.id));

  if (available.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-[0.5rem] px-2 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-text-hi)]"
      >
        <Plus size={12} strokeWidth={1.8} />
        Add column
      </button>
      {open && (
        <div className="surface anim-modal absolute right-0 top-full z-30 mt-2 w-48 rounded-[0.625rem] border border-[var(--color-line-2)] p-1.5 shadow-[0_1rem_2.5rem_rgba(0,0,0,0.45)]">
          {available.map((col) => (
            <button
              key={col.id}
              type="button"
              onClick={() => {
                onAdd(col.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-[0.4375rem] px-2 py-1.5 text-left text-[0.75rem] text-[var(--color-text-mid)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text-hi)]"
            >
              {col.label === "!" ? "Priority" : col.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filters popover ─────────────────────────────────────────────────────────

const filterSelectClass =
  "w-full min-w-0 rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] focus:outline-none focus:border-[var(--color-accent)]";
const filterLabelClass = "mb-1 block text-[0.5625rem] font-medium uppercase tracking-wider text-[var(--color-text-lo)]";

function FiltersButton({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));

  const active = countActiveFilters(filters);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-[0.5rem] border px-3 text-[0.75rem] transition-colors",
          active > 0 || open
            ? "border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
            : "border-[var(--color-line-2)] bg-[var(--color-ink-3)] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]",
        )}
      >
        <SlidersHorizontal size={12} strokeWidth={1.8} />
        Filters
        {active > 0 && (
          <span className="grid h-4 min-w-[1rem] place-items-center rounded-full bg-[var(--color-accent)] px-1 font-mono text-[0.5625rem] font-semibold text-white">
            {active}
          </span>
        )}
      </button>

      {open && (
        <div className="surface anim-modal absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-[0.75rem] border border-[var(--color-line-2)] p-4 shadow-[0_1rem_2.5rem_rgba(0,0,0,0.45)]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={filterLabelClass}>Region</label>
              <select className={filterSelectClass} value={filters.region} onChange={(e) => set("region", e.target.value as Region | "")}>
                <option value="">All</option>
                {(Object.entries(REGION_LABELS) as [Region, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={filterLabelClass}>Status</label>
              <select className={filterSelectClass} value={filters.status} onChange={(e) => set("status", e.target.value as CaseStatus | "")}>
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="suspended">Suspended</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className={filterLabelClass}>Priority</label>
              <select className={filterSelectClass} value={filters.priority} onChange={(e) => set("priority", e.target.value as CasePriority | "")}>
                <option value="">All</option>
                <option value="rush">Rush</option>
                <option value="asap">ASAP</option>
                <option value="standard">Standard</option>
              </select>
            </div>
            <div>
              <label className={filterLabelClass}>Type</label>
              <select className={filterSelectClass} value={filters.service} onChange={(e) => set("service", e.target.value as CaseService | "")}>
                <option value="">All</option>
                {(Object.entries(SERVICE_LABELS) as [CaseService, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={filterLabelClass}>Due from</label>
              <input type="date" value={filters.dueFrom} onChange={(e) => set("dueFrom", e.target.value)} aria-label="Due from" className={filterSelectClass} />
            </div>
            <div>
              <label className={filterLabelClass}>Due to</label>
              <input type="date" value={filters.dueTo} onChange={(e) => set("dueTo", e.target.value)} aria-label="Due to" className={filterSelectClass} />
            </div>
          </div>

          {active > 0 && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="mt-3 inline-flex items-center gap-1 text-[0.6875rem] text-[var(--color-text-lo)] transition-colors hover:text-[var(--color-text-hi)]"
            >
              <X size={11} strokeWidth={1.8} />
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

function CasesTable({
  items,
  columns,
  rowStyle,
  sort,
  onSort,
  onRowClick,
  editing,
  draft,
  onDraftChange,
}: {
  items: CaseListItem[];
  columns: ResolvedColumn[];
  rowStyle: CSSProperties;
  sort: SortState;
  onSort: (key: CaseSortField) => void;
  onRowClick: (id: string) => void;
  editing: boolean;
  draft: CaseColumnSetting[];
  onDraftChange: (next: CaseColumnSetting[]) => void;
}) {
  const slots = Array.from({ length: PER_PAGE }, (_, i) => items[i] ?? null);

  return (
    <div className="surface flex h-full min-h-0 flex-col overflow-hidden p-0">
      {editing ? (
        <EditableHeaderRow draft={draft} onDraftChange={onDraftChange} rowStyle={rowStyle} />
      ) : (
        <div className={cn(ROW_BASE, "shrink-0 border-b border-[var(--color-line)] py-2.5")} style={rowStyle}>
          {columns.map(({ def, label }) =>
            def.sortKey ? (
              <button
                key={def.id}
                type="button"
                onClick={() => onSort(def.sortKey!)}
                title={`Sort by ${label}`}
                className={cn(
                  "eyebrow flex items-center gap-1 text-left transition-colors hover:text-[var(--color-text-hi)]",
                  def.center && "justify-center",
                  sort?.key === def.sortKey && "text-[var(--color-text-hi)]",
                )}
              >
                <span className="truncate">{label}</span>
                {sort?.key === def.sortKey &&
                  (sort.dir === "asc" ? (
                    <ArrowUp size={10} strokeWidth={2} className="shrink-0 text-[var(--color-accent-2)]" />
                  ) : (
                    <ArrowDown size={10} strokeWidth={2} className="shrink-0 text-[var(--color-accent-2)]" />
                  ))}
              </button>
            ) : (
              <span key={def.id} className={cn("eyebrow truncate", def.center && "text-center")}>
                {label}
              </span>
            ),
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center px-6 py-12 font-mono text-[0.71875rem] text-[var(--color-text-lo)]">
          No cases match the current filter.
        </div>
      ) : (
        <div
          className="anim-stagger anim-stagger-tight grid min-h-0 flex-1 overflow-hidden"
          style={{ gridTemplateRows: `repeat(${PER_PAGE}, minmax(0, 1fr))` }}
        >
          {slots.map((c, i) =>
            c ? (
              <TableRow
                key={c.id}
                c={c}
                columns={columns}
                rowStyle={rowStyle}
                onClick={() => onRowClick(c.id)}
                showDivider={i < PER_PAGE - 1}
              />
            ) : (
              <div key={`pad-${i}`} aria-hidden className={cn(i < PER_PAGE - 1 && "border-b border-[var(--color-line)]")} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ─── Draggable / resizable header row (SuperAdmin edit mode) ────────────────

function EditableHeaderRow({
  draft,
  onDraftChange,
  rowStyle,
}: {
  draft: CaseColumnSetting[];
  onDraftChange: (next: CaseColumnSetting[]) => void;
  rowStyle: CSSProperties;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = draft.findIndex((c) => c.id === active.id);
    const newIndex = draft.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onDraftChange(arrayMove(draft, oldIndex, newIndex));
  };

  // Drag-to-resize: transfers weight between the two columns straddling the
  // dragged edge, so the row always keeps filling the same total width.
  const dragState = useRef<{ index: number; startX: number; pairSum: number; weightPerPx: number } | null>(null);

  const startResize = (index: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const row = rowRef.current;
    if (!row) return;
    const cells = Array.from(row.children) as HTMLElement[];
    const totalTrackPx = cells.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
    const totalWeight = draft.reduce((sum, c) => sum + widthOf(c), 0);
    if (totalTrackPx <= 0 || totalWeight <= 0) return;

    const wLeft = widthOf(draft[index]);
    const wRight = widthOf(draft[index + 1]);
    dragState.current = { index, startX: e.clientX, pairSum: wLeft + wRight, weightPerPx: totalWeight / totalTrackPx };

    const onMove = (ev: PointerEvent) => {
      const state = dragState.current;
      if (!state) return;
      const deltaWeight = (ev.clientX - state.startX) * state.weightPerPx;
      let newLeft = wLeft + deltaWeight;
      let newRight = state.pairSum - newLeft;
      if (newLeft < MIN_COLUMN_WIDTH) {
        newLeft = MIN_COLUMN_WIDTH;
        newRight = state.pairSum - newLeft;
      } else if (newRight < MIN_COLUMN_WIDTH) {
        newRight = MIN_COLUMN_WIDTH;
        newLeft = state.pairSum - newRight;
      }
      newLeft = Math.min(MAX_COLUMN_WIDTH, newLeft);
      onDraftChange(
        draft.map((c, i) => (i === state.index ? { ...c, width: newLeft } : i === state.index + 1 ? { ...c, width: newRight } : c)),
      );
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={rowRef}
      className={cn(ROW_BASE, "shrink-0 border-b border-[var(--color-accent-soft)] bg-[rgba(74,127,255,0.04)] py-2")}
      style={rowStyle}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={draft.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
          {draft.map((col, index) => {
            const def = getColumnDef(col.id);
            if (!def) return null;
            return (
              <EditableHeaderCell
                key={col.id}
                id={col.id}
                label={col.label ?? ""}
                placeholder={def.label}
                onRename={(label) => onDraftChange(draft.map((c, i) => (i === index ? { ...c, label: label || undefined } : c)))}
                onRemove={() => onDraftChange(draft.filter((_, i) => i !== index))}
                removeDisabled={draft.length === 1}
                showResizeHandle={index < draft.length - 1}
                onResizeStart={startResize(index)}
              />
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function EditableHeaderCell({
  id,
  label,
  placeholder,
  onRename,
  onRemove,
  removeDisabled,
  showResizeHandle,
  onResizeStart,
}: {
  id: string;
  label: string;
  placeholder: string;
  onRename: (label: string) => void;
  onRemove: () => void;
  removeDisabled: boolean;
  showResizeHandle: boolean;
  onResizeStart: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/col relative flex min-w-0 items-center gap-1 rounded-[0.375rem]",
        isDragging && "z-10 bg-[var(--color-ink-3)] opacity-70",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${placeholder}`}
        title="Drag to reorder"
        className="shrink-0 cursor-grab touch-none text-[var(--color-text-lo)] transition-colors hover:text-[var(--color-text-hi)] active:cursor-grabbing"
      >
        <GripVertical size={12} strokeWidth={1.8} />
      </button>
      <input
        value={label}
        onChange={(e) => onRename(e.target.value)}
        placeholder={placeholder === "!" ? "Priority" : placeholder}
        aria-label={`Header label for ${placeholder}`}
        className="eyebrow min-w-0 flex-1 truncate bg-transparent placeholder:text-[var(--color-text-lo)] focus:outline-none focus:text-[var(--color-text-hi)]"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={removeDisabled}
        aria-label={`Remove ${placeholder}`}
        title="Remove column"
        className="shrink-0 text-[var(--color-text-lo)] opacity-0 transition-opacity hover:text-[var(--color-neg)] group-hover/col:opacity-100 disabled:pointer-events-none disabled:opacity-0"
      >
        <X size={11} strokeWidth={1.8} />
      </button>
      {showResizeHandle && (
        <div
          onPointerDown={onResizeStart}
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize"
          className="absolute -right-[0.5625rem] top-[-0.5rem] bottom-[-0.5rem] z-10 flex w-3 cursor-col-resize touch-none justify-center"
        >
          <div className="h-full w-px bg-[var(--color-line-2)] transition-colors group-hover/col:bg-[var(--color-accent-soft)]" />
        </div>
      )}
    </div>
  );
}

function TableRow({
  c,
  columns,
  rowStyle,
  onClick,
  showDivider,
}: {
  c: CaseListItem;
  columns: ResolvedColumn[];
  rowStyle: CSSProperties;
  onClick: () => void;
  showDivider: boolean;
}) {
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
        ROW_BASE,
        "h-full min-h-0 cursor-pointer overflow-hidden transition-colors hover:bg-white/[0.022]",
        showDivider && "border-b border-[var(--color-line)]",
      )}
      style={rowStyle}
    >
      {columns.map(({ def }) => (
        <div key={def.id} className="min-w-0">
          {def.render(c)}
        </div>
      ))}
    </div>
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
        "grid h-7 min-w-[1.75rem] place-items-center rounded-[0.4375rem] px-1.5 font-mono text-[0.6875rem] transition-colors",
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-text-hi)] shadow-[inset_0_0_0_0.0625rem_rgba(74,127,255,0.4)]"
          : "text-[var(--color-text-mid)] hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]",
        disabled && "pointer-events-none opacity-30",
      )}
    >
      {children}
    </button>
  );
}

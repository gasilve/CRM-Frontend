import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Lock, Pencil, Puzzle, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CaseDetail } from "@/lib/crm-api";
import { designPx } from "@/lib/rem";
import { getCustomCaseFields, subscribeCustomCaseFields } from "@/lib/custom-case-fields";
import { caseFieldEntry, caseFieldGroups } from "./case-field-catalog";
import {
  CASE_COLUMNS,
  CASE_GRID_MARGIN,
  CUSTOM_WIDGET_MAX_FIELDS,
  normalizeWidgetColumns,
  type CasePanelCtx,
  type CustomCaseWidgetDef,
  type CustomWidgetColumns,
} from "./case-detail-widgets";
import { Field, PanelShell } from "./case-detail-panels";

// ─── Layout preview icons (builder display picker) ───────────────────────────

function LayoutIconList({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 18" fill="none" className={cn("h-[1.125rem] w-7", className)} aria-hidden>
      <rect x="2" y="2" width="24" height="3" rx="1" fill="currentColor" />
      <rect x="2" y="7.5" width="24" height="3" rx="1" fill="currentColor" />
      <rect x="2" y="13" width="24" height="3" rx="1" fill="currentColor" />
    </svg>
  );
}

function LayoutIconGrid({ cols, className }: { cols: 2 | 3; className?: string }) {
  const rows = 2;
  const gap = 2;
  const pad = 2;
  const totalW = 28;
  const totalH = 18;
  const cellW = (totalW - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = (totalH - pad * 2 - gap * (rows - 1)) / rows;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={pad + c * (cellW + gap)}
          y={pad + r * (cellH + gap)}
          width={cellW}
          height={cellH}
          rx="0.75"
          fill="currentColor"
        />,
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} fill="none" className={cn("h-[1.125rem] w-7", className)} aria-hidden>
      {cells}
    </svg>
  );
}

function customWidgetFieldLayoutClass(columns: CustomWidgetColumns): string {
  if (columns === 2) return "grid grid-cols-2 gap-x-4 gap-y-2.5";
  if (columns === 3) return "grid grid-cols-3 gap-x-4 gap-y-2.5";
  return "space-y-2.5";
}

type PreviewField = { key: string; label: string };

/** Shared field body used by the grid widget (non-sortable). */
function CustomWidgetFields({
  fields,
  columns,
  caseDetail,
  canSee,
  emptyHint,
}: {
  fields: PreviewField[];
  columns: CustomWidgetColumns;
  caseDetail: CaseDetail;
  canSee: (field: string) => boolean;
  emptyHint?: string;
}) {
  if (fields.length === 0) {
    return (
      <div className="grid h-full min-h-[4.5rem] place-items-center gap-1 text-center">
        <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
          {emptyHint ?? "Empty widget."}
        </span>
      </div>
    );
  }

  return (
    <div className={customWidgetFieldLayoutClass(normalizeWidgetColumns(columns))}>
      {fields.map((f, i) => {
        const entry = caseFieldEntry(f.key);
        if (!entry) return null;
        if (entry.rbacField && !canSee(entry.rbacField)) {
          return (
            <div key={`${f.key}-${i}`}>
              <div className="mb-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                {f.label}
              </div>
              <div
                className="inline-flex items-center gap-1 font-mono text-[0.71875rem] text-[var(--color-text-lo)]"
                title="Hidden by your role's privacy settings"
              >
                <Lock size={9} strokeWidth={2} />
                Restricted
              </div>
            </div>
          );
        }
        return <Field key={`${f.key}-${i}`} label={f.label} value={entry.resolve(caseDetail)} mono={false} />;
      })}
    </div>
  );
}

function renderPreviewFieldContent(
  f: PreviewField,
  caseDetail: CaseDetail,
  canSee: (field: string) => boolean,
): ReactNode {
  const entry = caseFieldEntry(f.key);
  if (!entry) return null;
  if (entry.rbacField && !canSee(entry.rbacField)) {
    return (
      <div>
        <div className="mb-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
          {f.label}
        </div>
        <div
          className="inline-flex items-center gap-1 font-mono text-[0.71875rem] text-[var(--color-text-lo)]"
          title="Hidden by your role's privacy settings"
        >
          <Lock size={9} strokeWidth={2} />
          Restricted
        </div>
      </div>
    );
  }
  return <Field label={f.label} value={entry.resolve(caseDetail)} mono={false} />;
}

/** Prefix so preview sortables don't collide with editor-row sortables. */
const previewSortId = (dragId: string) => `pv-${dragId}`;
const stripSortId = (id: string) => (id.startsWith("pv-") ? id.slice(3) : id);

function SortablePreviewField({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: previewSortId(id),
    animateLayoutChanges: () => false,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? transition : undefined,
      }}
      className={cn("widget-builder-preview-field", isDragging && "is-dragging")}
      title="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

// ─── Renderer (lives inside a grid item) ─────────────────────────────────────

export function CustomCaseWidget({ ctx, id }: { ctx: CasePanelCtx; id: string }) {
  const def = ctx.getCustomWidget(id);

  const action = ctx.onEditCustomWidget ? (
    <div className="flex items-center gap-1.5">
      {def && !def.persisted && (
        <span
          className="rounded-full bg-[var(--color-ink-3)] px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]"
          title="Draft — removing this widget deletes it. Drag it onto the bookmark to keep it for reuse."
        >
          draft
        </span>
      )}
      <button
        type="button"
        onClick={() => ctx.onEditCustomWidget?.(id)}
        className="text-[var(--color-text-lo)] transition-colors hover:text-[var(--color-accent-2)]"
        title="Edit widget"
      >
        <Pencil size={12} strokeWidth={1.8} />
      </button>
    </div>
  ) : undefined;

  if (!def) {
    return (
      <PanelShell title="Widget" icon={<Puzzle size={11} strokeWidth={1.8} />} action={action}>
        <div className="grid h-full place-items-center font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
          This widget was deleted.
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell title={def.title} icon={<Puzzle size={11} strokeWidth={1.8} />} action={action}>
      <CustomWidgetFields
        fields={def.fields}
        columns={normalizeWidgetColumns(def.columns)}
        caseDetail={ctx.case}
        canSee={ctx.canSee}
        emptyHint={
          ctx.onEditCustomWidget ? "Empty widget — use the pencil to add fields." : "Empty widget."
        }
      />
    </PanelShell>
  );
}

// ─── Builder modal (SuperAdmin only, rendered at page level) ─────────────────

/** Stable row id for dnd-kit — survives reorders without remounting / bounce-back. */
type BuilderFieldRow = { dragId: string; key: string; label: string };

function newBuilderFieldRow(key: string, label: string): BuilderFieldRow {
  return { dragId: crypto.randomUUID(), key, label };
}

function toPersistedFields(rows: BuilderFieldRow[]): { key: string; label: string }[] {
  return rows.map(({ key, label }) => ({ key, label }));
}

function BuilderSelect({
  className,
  children,
  ...props
}: ComponentProps<"select">) {
  return (
    <div className="relative min-w-0">
      <select {...props} className={cn("widget-builder-select", className)}>
        {children}
      </select>
      <ChevronDown
        size={13}
        strokeWidth={2.5}
        className="widget-builder-select-chevron"
        aria-hidden
      />
    </div>
  );
}

type SortableFieldRowProps = {
  id: string;
  label: string;
  fieldKey: string;
  inputCls: string;
  valueOptions: ReactNode;
  onLabelChange: (value: string) => void;
  onKeyChange: (value: string) => void;
  onRemove: () => void;
};

function SortableFieldRow({
  id,
  label,
  fieldKey,
  inputCls,
  valueOptions,
  onLabelChange,
  onKeyChange,
  onRemove,
}: SortableFieldRowProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
    animateLayoutChanges: () => false,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? transition : undefined,
      }}
      className={cn("widget-builder-field-row", isDragging && "widget-builder-field-row--dragging")}
    >
      <div className="widget-builder-field-row__aside">
        <button
          type="button"
          className="widget-builder-field-row__drag"
          aria-label="Drag to reorder"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="widget-builder-field-row__main">
        <input
          value={label}
          maxLength={80}
          onChange={(e) => onLabelChange(e.target.value)}
          className={inputCls}
          placeholder="Field name"
        />
        <BuilderSelect value={fieldKey} onChange={(e) => onKeyChange(e.target.value)} className={inputCls}>
          {valueOptions}
        </BuilderSelect>
      </div>
      <div className="widget-builder-field-row__aside">
        <button
          type="button"
          onClick={onRemove}
          className="text-[var(--color-text-lo)] hover:text-[var(--color-neg)]"
          title="Remove field"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

type BuilderProps = {
  open: boolean;
  def: CustomCaseWidgetDef | null;
  /** Live case used to resolve field values in the preview pane. */
  caseDetail: CaseDetail;
  /** RBAC visibility for the signed-in admin — hides catalog entries they cannot see. */
  canSee: (field: string) => boolean;
  /** Saves to the board on every edit — the builder never holds unsaved state. */
  onChange: (def: CustomCaseWidgetDef) => void;
  onClose: () => void;
};

const PREVIEW_REF_GRID_W = 1104;

function measureCaseGridWidth(): number {
  const el = document.querySelector(".case-detail-grid .grid-stack") as HTMLElement | null;
  const w = el?.clientWidth ?? 0;
  return w > 0 ? w : designPx(PREVIEW_REF_GRID_W);
}

/** Board-col width that comfortably fits a 1/2/3-column field layout. */
function previewBoardCols(columns: CustomWidgetColumns): number {
  if (columns === 3) return 6;
  if (columns === 2) return 5;
  return 3;
}

function previewWidthPx(columns: CustomWidgetColumns, gridWidth: number): number {
  const margin = designPx(CASE_GRID_MARGIN);
  const colUnit = gridWidth / CASE_COLUMNS;
  const raw = Math.round(previewBoardCols(columns) * colUnit - margin);
  // Keep a usable footprint even if the live board width can't be measured.
  return Math.max(designPx(240), raw);
}

function BuilderFloatingPreview({
  title,
  fields,
  columns,
  caseDetail,
  canSee,
  onColumnsChange,
}: {
  title: string;
  fields: BuilderFieldRow[];
  columns: CustomWidgetColumns;
  caseDetail: CaseDetail;
  canSee: (field: string) => boolean;
  onColumnsChange: (columns: CustomWidgetColumns) => void;
}) {
  const [gridWidth, setGridWidth] = useState(() =>
    typeof document === "undefined" ? designPx(PREVIEW_REF_GRID_W) : measureCaseGridWidth(),
  );

  useEffect(() => {
    const sync = () => setGridWidth(measureCaseGridWidth());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const width = previewWidthPx(columns, gridWidth);
  const previewSortIds = useMemo(() => fields.map((f) => previewSortId(f.dragId)), [fields]);

  return (
    <div className="widget-builder-live-preview" style={{ width }} aria-label="Widget preview">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[0.59375rem] uppercase tracking-wider text-[var(--color-text-lo)]">
          Display
        </span>
        <div className="widget-builder-layout-picker flex overflow-hidden rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-2)]">
          {(
            [
              { value: 1 as const, label: "List", icon: <LayoutIconList /> },
              { value: 2 as const, label: "2 columns", icon: <LayoutIconGrid cols={2} /> },
              { value: 3 as const, label: "3 columns", icon: <LayoutIconGrid cols={3} /> },
            ] as const
          ).map(({ value, label, icon }, index) => (
            <button
              key={value}
              type="button"
              onClick={() => onColumnsChange(value)}
              aria-pressed={columns === value}
              aria-label={label}
              title={label}
              className={cn(
                "anim-toggle tap grid h-10 flex-1 place-items-center",
                index > 0 && "border-l border-[var(--color-line-2)]",
                columns === value
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]"
                  : "text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]",
              )}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <div className="widget-builder-live-preview__meta">
        <span className="font-mono text-[0.59375rem] uppercase tracking-wider text-[var(--color-text-lo)]">
          Preview
        </span>
        {fields.length > 0 && (
          <span className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">Drag fields to reorder</span>
        )}
      </div>
      <div className="widget-builder-live-preview__frame">
        <PanelShell
          title={title.trim() || "Widget"}
          icon={<Puzzle size={11} strokeWidth={1.8} />}
          className="widget-builder-live-preview__shell !h-auto"
        >
          {fields.length === 0 ? (
            <div className="grid min-h-[4.5rem] place-items-center">
              <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
                Add fields to preview this widget.
              </span>
            </div>
          ) : (
            <SortableContext items={previewSortIds} strategy={rectSortingStrategy}>
              <div className={customWidgetFieldLayoutClass(normalizeWidgetColumns(columns))}>
                {fields.map((f) => (
                  <SortablePreviewField key={f.dragId} id={f.dragId}>
                    {renderPreviewFieldContent(f, caseDetail, canSee)}
                  </SortablePreviewField>
                ))}
              </div>
            </SortableContext>
          )}
        </PanelShell>
      </div>
    </div>
  );
}

export function CustomWidgetBuilderModal({ open, def, caseDetail, canSee, onChange, onClose }: BuilderProps) {
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<BuilderFieldRow[]>([]);
  const [columns, setColumns] = useState<CustomWidgetColumns>(1);
  const [persisted, setPersisted] = useState(false);
  /** The next, not-yet-committed row — becomes a real field once both sides are filled. */
  const [draftLabel, setDraftLabel] = useState("");
  const [draftKey, setDraftKey] = useState("");

  // Snapshot the widget as it was when this editing session began, so
  // "Cancel changes" can undo every auto-saved edit made since — not just
  // reset the form to whatever the board currently holds.
  const sessionIdRef = useRef<string | null>(null);
  const initialDefRef = useRef<CustomCaseWidgetDef | null>(null);

  useEffect(() => {
    if (!open || !def) {
      sessionIdRef.current = null;
      return;
    }
    if (sessionIdRef.current === def.id) return;
    sessionIdRef.current = def.id;
    initialDefRef.current = def;
    setTitle(def.title);
    setFields(def.fields.filter((f) => caseFieldEntry(f.key)).map((f) => newBuilderFieldRow(f.key, f.label)));
    setColumns(normalizeWidgetColumns(def.columns));
    setPersisted(def.persisted === true);
    setDraftLabel("");
    setDraftKey("");
  }, [open, def]);

  /** Pushes the current draft to the board immediately — no explicit save needed. */
  const emitChange = (
    nextTitle: string,
    nextFields: BuilderFieldRow[],
    nextColumns: CustomWidgetColumns = columns,
  ) => {
    if (!def) return;
    onChange({
      id: def.id,
      type: "custom",
      title: nextTitle.length > 0 ? nextTitle : "Widget",
      fields: toPersistedFields(nextFields),
      columns: nextColumns,
      persisted,
    });
  };

  const setColumnsAndEmit = (nextColumns: CustomWidgetColumns) => {
    setColumns(nextColumns);
    emitChange(title, fields, nextColumns);
  };

  // Re-read catalog when notebook fields change so new keys appear live.
  const notebookFields = useSyncExternalStore(
    subscribeCustomCaseFields,
    getCustomCaseFields,
    getCustomCaseFields,
  );

  const groups = useMemo(
    () =>
      caseFieldGroups()
        .map(({ group, fields: entries }) => ({
          group,
          fields: entries.filter((e) => !e.rbacField || canSee(e.rbacField)),
        }))
        .filter((g) => g.fields.length > 0),
    [canSee, notebookFields],
  );

  const fieldSortIds = useMemo(() => fields.map((f) => f.dragId), [fields]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onFieldDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = stripSortId(String(active.id));
    const overId = stripSortId(String(over.id));
    const oldIndex = fields.findIndex((f) => f.dragId === activeId);
    const newIndex = fields.findIndex((f) => f.dragId === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    const next = arrayMove(fields, oldIndex, newIndex);
    setFields(next);
    emitChange(title, next);
  };

  const cancelChanges = () => {
    if (initialDefRef.current) onChange(initialDefRef.current);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelChanges();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !def) return null;

  const updateField = (index: number, patch: Partial<{ key: string; label: string }>) => {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    setFields(next);
    emitChange(title, next);
  };

  const removeField = (index: number) => {
    const next = fields.filter((_, i) => i !== index);
    setFields(next);
    emitChange(title, next);
  };

  /** Commits the draft row into `fields` once both sides are filled, then clears it. */
  const commitDraftIfReady = (label: string, key: string) => {
    if (!label.trim() || !key || !caseFieldEntry(key)) return;
    const next = [...fields, newBuilderFieldRow(key, label.trim().slice(0, 80))];
    setFields(next);
    emitChange(title, next);
    setDraftLabel("");
    setDraftKey("");
  };

  const onDraftLabelChange = (v: string) => {
    setDraftLabel(v);
    commitDraftIfReady(v, draftKey);
  };

  const onDraftKeyChange = (v: string) => {
    setDraftKey(v);
    commitDraftIfReady(draftLabel, v);
  };

  const saveAndClose = () => {
    emitChange(title, fields);
    onClose();
  };

  const inputCls =
    "rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 py-1.5 text-[0.78125rem] text-[var(--color-text-hi)] focus:outline-none focus:border-[var(--color-accent-soft)]";

  const valueOptions = (
    <>
      <option value="">Select data…</option>
      {groups.map(({ group, fields: entries }) => (
        <optgroup key={group} label={group}>
          {entries.map((e) => (
            <option key={e.key} value={e.key}>
              {e.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );

  return createPortal(
    // Backdrop is intentionally inert — this modal only closes via the footer
    // buttons (or Escape), never an accidental click outside it.
    <div className="dashboard-modal-backdrop dashboard-modal-backdrop--builder">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onFieldDragEnd}>
        <div className="widget-builder-stage">
          <div className="dashboard-modal dashboard-modal--builder surface flex max-h-[min(92vh,52rem)] flex-col gap-5 rounded-[0.875rem]">
            <div className="flex shrink-0 items-center justify-between">
              <h2 className="dashboard-modal__title">Custom widget</h2>
              <button
                type="button"
                onClick={cancelChanges}
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-text-lo)] transition-colors hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]"
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[0.59375rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                  Widget title
                </span>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTitle(v);
                    emitChange(v, fields);
                  }}
                  maxLength={80}
                  placeholder="e.g. Quick facts"
                  className={inputCls}
                />
              </label>

              <div className="widget-builder-fields flex flex-col gap-2">
                <span className="font-mono text-[0.59375rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                  Fields · {fields.length}/{CUSTOM_WIDGET_MAX_FIELDS}
                </span>

                {fields.length > 0 && (
                  <div className="widget-builder-field-row widget-builder-field-row--head font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                    <span aria-hidden />
                    <div className="widget-builder-field-row__main">
                      <span>Name</span>
                      <span>Value</span>
                    </div>
                    <span aria-hidden />
                  </div>
                )}

                {fields.length > 0 && (
                  <SortableContext items={fieldSortIds} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-2">
                      {fields.map((f, i) => (
                        <SortableFieldRow
                          key={f.dragId}
                          id={f.dragId}
                          label={f.label}
                          fieldKey={f.key}
                          inputCls={inputCls}
                          valueOptions={valueOptions}
                          onLabelChange={(v) => updateField(i, { label: v })}
                          onKeyChange={(v) => updateField(i, { key: v })}
                          onRemove={() => removeField(i)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                )}

                {fields.length < CUSTOM_WIDGET_MAX_FIELDS && (
                  <div className="widget-builder-field-row">
                    <span aria-hidden />
                    <div className="widget-builder-field-row__main">
                      <input
                        value={draftLabel}
                        maxLength={80}
                        onChange={(e) => onDraftLabelChange(e.target.value)}
                        className={inputCls}
                        placeholder="Field name"
                      />
                      <BuilderSelect value={draftKey} onChange={(e) => onDraftKeyChange(e.target.value)} className={inputCls}>
                        {valueOptions}
                      </BuilderSelect>
                    </div>
                    <span aria-hidden />
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-modal__footer shrink-0">
              <div className="dashboard-modal__actions">
                <button
                  type="button"
                  onClick={cancelChanges}
                  className="dashboard-modal-btn dashboard-modal-btn--danger"
                >
                  Cancel changes
                </button>
                <button type="button" onClick={saveAndClose} className="dashboard-modal-btn dashboard-modal-btn--primary">
                  Save widget
                </button>
              </div>
            </div>
          </div>

          <BuilderFloatingPreview
            title={title}
            fields={fields}
            columns={columns}
            caseDetail={caseDetail}
            canSee={canSee}
            onColumnsChange={setColumnsAndEmit}
          />
        </div>
      </DndContext>
    </div>,
    document.body,
  );
}

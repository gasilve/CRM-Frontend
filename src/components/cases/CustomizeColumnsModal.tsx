import { useEffect, useState } from "react";
import { X, Loader2, Columns3, ChevronUp, ChevronDown, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { ApiError, gridLayoutsApi, type GridLayoutRecord } from "@/lib/crm-api";
import {
  CASE_COLUMNS,
  defaultColumnSettings,
  getColumnDef,
  layoutFromColumns,
  type CaseColumnSetting,
} from "./case-table-columns";

/**
 * SuperAdmin-only editor for the shared cases-table column set. Saves to the
 * `cases-table` grid surface, so the configuration applies to every user.
 */
export function CustomizeColumnsModal({
  open,
  columns,
  onClose,
  onSaved,
}: {
  open: boolean;
  columns: CaseColumnSetting[];
  onClose: () => void;
  onSaved: (layout: GridLayoutRecord) => void;
}) {
  const [draft, setDraft] = useState<CaseColumnSetting[]>(columns);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(columns);
      setError(null);
    }
  }, [open, columns]);

  if (!open) return null;

  const available = CASE_COLUMNS.filter((col) => !draft.some((d) => d.id === col.id));

  const move = (index: number, delta: -1 | 1) => {
    setDraft((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const remove = (index: number) => setDraft((prev) => prev.filter((_, i) => i !== index));

  const rename = (index: number, label: string) =>
    setDraft((prev) => prev.map((col, i) => (i === index ? { ...col, label: label || undefined } : col)));

  const add = (id: CaseColumnSetting["id"]) => setDraft((prev) => [...prev, { id }]);

  const save = async () => {
    if (draft.length === 0) {
      setError("Keep at least one column.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { layout } = await gridLayoutsApi.save("cases-table", layoutFromColumns(draft));
      onSaved(layout);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the column layout.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="anim-backdrop fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(30rem,92vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="surface anim-modal flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-[0.875rem] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Columns3 size={16} strokeWidth={1.8} className="text-[var(--color-accent-2)]" />
              <h2 className="editorial text-[1.375rem] text-[var(--color-text-hi)]">Table columns</h2>
            </div>
            <button type="button" onClick={onClose} className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
              <X size={16} />
            </button>
          </div>

          <p className="text-[0.71875rem] leading-relaxed text-[var(--color-text-lo)]">
            Reorder, rename or remove columns. This layout is shared — it changes the cases table for everyone.
          </p>

          {error && (
            <div className="anim-banner rounded-[0.5rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-3.5 py-2.5 text-[0.78125rem] text-[var(--color-neg)]">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {draft.map((col, index) => {
              const def = getColumnDef(col.id);
              if (!def) return null;
              return (
                <div
                  key={col.id}
                  className="flex items-center gap-2 rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-3)] px-2.5 py-1.5"
                >
                  <span className="w-5 shrink-0 text-center font-mono text-[0.625rem] text-[var(--color-text-lo)]">{index + 1}</span>
                  <input
                    value={col.label ?? ""}
                    onChange={(e) => rename(index, e.target.value)}
                    placeholder={def.label}
                    aria-label={`Header label for ${def.label}`}
                    className="min-w-0 flex-1 bg-transparent text-[0.78125rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-mid)] focus:outline-none"
                  />
                  {col.label && col.label !== def.label && (
                    <span className="shrink-0 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                      {def.label}
                    </span>
                  )}
                  <div className="flex shrink-0 items-center">
                    <IconBtn label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ChevronUp size={13} strokeWidth={1.8} />
                    </IconBtn>
                    <IconBtn label="Move down" disabled={index === draft.length - 1} onClick={() => move(index, 1)}>
                      <ChevronDown size={13} strokeWidth={1.8} />
                    </IconBtn>
                    <IconBtn label={`Remove ${def.label}`} disabled={draft.length === 1} onClick={() => remove(index)}>
                      <X size={12} strokeWidth={1.8} />
                    </IconBtn>
                  </div>
                </div>
              );
            })}
          </div>

          {available.length > 0 && (
            <div>
              <div className="mb-1.5 text-[0.625rem] font-medium uppercase tracking-wider text-[var(--color-text-lo)]">
                Add column
              </div>
              <div className="flex flex-wrap gap-1.5">
                {available.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => add(col.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line-2)] px-2.5 py-1 text-[0.6875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-accent-soft)] hover:text-[var(--color-text-hi)]"
                  >
                    <Plus size={11} strokeWidth={1.8} />
                    {col.label === "!" ? "Priority" : col.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-1 flex items-center justify-between border-t border-[var(--color-line)] pt-4">
            <button
              type="button"
              onClick={() => setDraft(defaultColumnSettings())}
              className="inline-flex items-center gap-1.5 text-[0.71875rem] text-[var(--color-text-lo)] transition-colors hover:text-[var(--color-text-hi)]"
            >
              <RotateCcw size={12} strokeWidth={1.8} />
              Reset to default
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[0.5rem] px-3.5 py-2 text-[0.75rem] text-[var(--color-text-mid)] transition-colors hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[0.5rem] bg-[var(--color-accent)] px-4 py-2 text-[0.75rem] font-medium text-white transition-opacity",
                  saving && "pointer-events-none opacity-60",
                )}
              >
                {saving && <Loader2 size={12} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function IconBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-6 w-6 place-items-center rounded-[0.375rem] text-[var(--color-text-lo)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text-hi)]",
        disabled && "pointer-events-none opacity-25",
      )}
    >
      {children}
    </button>
  );
}

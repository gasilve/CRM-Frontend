import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteCustomCaseField,
  ensureAtLeastOneCustomCaseField,
  getCustomCaseFields,
  subscribeCustomCaseFields,
  upsertCustomCaseField,
  type CustomCaseFieldDef,
} from "@/lib/custom-case-fields";

type Props = {
  /** SuperAdmin — can create / edit / delete definitions. */
  canEdit: boolean;
};

function useCustomFields(): CustomCaseFieldDef[] {
  return useSyncExternalStore(subscribeCustomCaseFields, getCustomCaseFields, getCustomCaseFields);
}

const inputCls =
  "w-full min-w-0 rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent-soft)] disabled:opacity-70";

const textareaCls = `${inputCls} min-h-[2.75rem] resize-y leading-snug`;

type Draft = {
  label: string;
  description: string;
  dataSource: string;
  placeholderValue: string;
};

const emptyDraft = (): Draft => ({
  label: "",
  description: "",
  dataSource: "",
  placeholderValue: "",
});

function draftFromField(f: CustomCaseFieldDef): Draft {
  return {
    label: f.label,
    description: f.description,
    dataSource: f.dataSource,
    placeholderValue: f.placeholderValue,
  };
}

const ROW_COLS =
  "grid-cols-[minmax(6.5rem,0.85fr)_minmax(10rem,1.7fr)_minmax(7rem,1fr)_minmax(6.5rem,0.9fr)_1.75rem]";

/**
 * Global field notebook body — lives inside CaseDrawer like Vehicles / People.
 * Rows: name · description · where it comes from · placeholder value · trash.
 * Always keeps at least one row; trash on the last row clears it instead of removing.
 */
export function CustomFieldsNotebook({ canEdit }: Props) {
  const fields = useCustomFields();
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const focusIdRef = useRef<string | null>(null);
  const nameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useLayoutEffect(() => {
    ensureAtLeastOneCustomCaseField();
  }, []);

  useEffect(() => {
    setEdits((prev) => {
      const next: Record<string, Draft> = {};
      for (const f of fields) {
        next[f.id] = prev[f.id] ?? draftFromField(f);
      }
      return next;
    });
  }, [fields]);

  useEffect(() => {
    const id = focusIdRef.current;
    if (!id) return;
    const el = nameInputRefs.current[id];
    if (el) {
      el.focus();
      el.select();
    }
    focusIdRef.current = null;
  }, [fields]);

  const patchEdit = (id: string, patch: Partial<Draft>) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyDraft()), ...patch },
    }));
  };

  const flushField = (f: CustomCaseFieldDef) => {
    if (!canEdit) return;
    const edit = edits[f.id];
    if (!edit) return;
    if (
      edit.label.trim() === f.label &&
      edit.description.trim() === f.description &&
      edit.dataSource.trim() === f.dataSource &&
      edit.placeholderValue.trim() === f.placeholderValue
    ) {
      return;
    }
    upsertCustomCaseField({
      id: f.id,
      label: edit.label,
      description: edit.description,
      dataSource: edit.dataSource,
      placeholderValue: edit.placeholderValue,
    });
  };

  const onTrash = (f: CustomCaseFieldDef) => {
    if (!canEdit) return;
    deleteCustomCaseField(f.id);
    // Last-row clear keeps the same id — reset local draft so inputs go blank immediately.
    if (fields.length <= 1) {
      setEdits((prev) => ({ ...prev, [f.id]: emptyDraft() }));
    }
  };

  const addField = () => {
    if (!canEdit) return;
    const created = upsertCustomCaseField({
      label: "New field",
      description: "",
      dataSource: "",
      placeholderValue: "",
    });
    focusIdRef.current = created.id;
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.78125rem] leading-relaxed text-[var(--color-text-mid)]">
        Define extra fields you can drop into custom widgets. Until they&apos;re connected to real case
        data, widgets show the <span className="text-[var(--color-text-hi)]">placeholder value</span> you
        set here.
      </p>

      <div className="flex flex-col gap-2.5">
        <div
          className={`grid ${ROW_COLS} items-end gap-2 px-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]`}
        >
          <span>Name</span>
          <span>Description</span>
          <span>Where it comes from</span>
          <span>Placeholder value</span>
          <span aria-hidden />
        </div>

        {fields.map((f) => {
          const edit = edits[f.id] ?? draftFromField(f);
          return (
            <div key={f.id} className={`grid ${ROW_COLS} items-start gap-2`}>
              <input
                ref={(el) => {
                  nameInputRefs.current[f.id] = el;
                }}
                value={edit.label}
                disabled={!canEdit}
                maxLength={80}
                onChange={(e) => patchEdit(f.id, { label: e.target.value })}
                onBlur={() => flushField(f)}
                className={inputCls}
                placeholder="Field name"
                aria-label="Name"
              />
              <textarea
                value={edit.description}
                disabled={!canEdit}
                maxLength={2000}
                rows={2}
                onChange={(e) => patchEdit(f.id, { description: e.target.value })}
                onBlur={() => flushField(f)}
                className={textareaCls}
                placeholder="What this field is for"
                aria-label="Description"
              />
              <input
                value={edit.dataSource}
                disabled={!canEdit}
                maxLength={500}
                onChange={(e) => patchEdit(f.id, { dataSource: e.target.value })}
                onBlur={() => flushField(f)}
                className={`${inputCls} mt-0.5`}
                placeholder="e.g. intake form, DMV"
                aria-label="Where it comes from"
              />
              <input
                value={edit.placeholderValue}
                disabled={!canEdit}
                maxLength={200}
                onChange={(e) => patchEdit(f.id, { placeholderValue: e.target.value })}
                onBlur={() => flushField(f)}
                className={`${inputCls} mt-0.5`}
                placeholder="Sample text"
                aria-label="Placeholder value"
              />
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => onTrash(f)}
                  className="mt-1 grid h-8 w-8 place-items-center text-[var(--color-text-lo)] hover:text-[var(--color-neg)]"
                  title={fields.length <= 1 ? "Clear field" : "Remove field"}
                  aria-label={fields.length <= 1 ? `Clear ${f.label || "field"}` : `Remove ${f.label || "field"}`}
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                </button>
              ) : (
                <span aria-hidden />
              )}
            </div>
          );
        })}

        {canEdit && (
          <button
            type="button"
            onClick={addField}
            className="mt-1 flex min-h-[3.25rem] w-full items-center justify-center rounded-[0.625rem] border border-dashed border-[var(--color-line-2)] text-[var(--color-text-lo)] transition-colors hover:border-[var(--color-accent-soft)] hover:bg-[var(--color-ink-3)]/50 hover:text-[var(--color-accent-2)]"
            title="Add field"
            aria-label="Add field"
          >
            <Plus size={28} strokeWidth={1.6} />
          </button>
        )}
      </div>
    </div>
  );
}

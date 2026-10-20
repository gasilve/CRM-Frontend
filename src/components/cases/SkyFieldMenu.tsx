import { useCallback, useEffect, useLayoutEffect, useRef, useState, Fragment, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Images, Pencil, Plus } from "lucide-react";
import { clientsApi } from "@/lib/crm-api";

/** What the editor collects. Keys depend on `editor.kind`. */
export type SkyFields = Record<string, string>;

export type SkyEditor =
  | { kind: "text"; title: string; value: string; placeholder?: string; multiline?: boolean; required?: boolean }
  | { kind: "date"; title: string; value: string }
  | { kind: "time"; title: string; value: string }
  | { kind: "datetime"; title: string; value: string }
  | { kind: "choice"; title: string; value: string; options: { value: string; label: string }[]; emptyLabel?: string }
  | { kind: "checks"; title: string; value: string; options: { value: string; label: string }[] }
  | { kind: "address"; title: string; line1: string; city: string; state: string; zip: string }
  | { kind: "vehicle"; title: string; color: string; year: string; make: string; model: string; plate: string; plateState: string }
  | { kind: "place"; title: string; name: string; when: string; place: string }
  | { kind: "client"; title: string; value: string };

/** One row in a combined menu. It either opens an editor or runs immediately. */
export type SkyMenuAction = {
  id: string;
  label: string;
  quiet?: boolean;
  mark?: "new" | "image" | "compare";
  /** Draw a divider above this row. */
  ruleBefore?: boolean;
  editor?: SkyEditor;
  onSave?: (fields: SkyFields) => Promise<void>;
  onClear?: () => Promise<void>;
  onRun?: () => void | Promise<void>;
};

export type SkyFieldRequest = {
  title: string;
  editor?: SkyEditor;
  onSave?: (fields: SkyFields) => Promise<void>;
  onClear?: () => Promise<void>;
  /** Extra menu action. Kept for single-field menus that also add something. */
  onNew?: {
    title: string;
    editor: SkyEditor;
    onSave: (fields: SkyFields) => Promise<void>;
  };
  /** When set, the menu lists these instead of Edit / New / Clear. */
  actions?: SkyMenuAction[];
};

type SkyPopModel = SkyFieldRequest & {
  mode: "menu" | "edit";
  x: number;
  y: number;
  /** Remove lives on the editor when the row was opened from a combined menu. */
  showRemove?: boolean;
};

export function useSkyFieldPop() {
  const [pop, setPop] = useState<SkyPopModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const popRef = useRef(pop);
  popRef.current = pop;

  const open = useCallback((event: ReactMouseEvent, request: SkyFieldRequest, direct = false) => {
    event.preventDefault();
    event.stopPropagation();
    setFault(null);
    setPop({ ...request, mode: direct ? "edit" : "menu", x: event.clientX, y: event.clientY });
  }, []);

  const close = useCallback(() => {
    if (popRef.current && busy) return;
    setFault(null);
    setPop(null);
  }, [busy]);

  const toEdit = useCallback(() => {
    setFault(null);
    setPop((current) => (current ? { ...current, mode: "edit" } : current));
  }, []);

  const toNew = useCallback(() => {
    setFault(null);
    setPop((current) => {
      if (!current?.onNew) return current;
      return {
        ...current,
        mode: "edit",
        title: current.onNew.title,
        editor: current.onNew.editor,
        onSave: current.onNew.onSave,
        onClear: undefined,
        onNew: undefined,
        showRemove: false,
      };
    });
  }, []);

  const pick = useCallback((id: string) => {
    const current = popRef.current;
    const action = current?.actions?.find((item) => item.id === id);
    if (!current || !action) return;
    setFault(null);
    if (action.onRun) {
      const work = action.onRun;
      setPop(null);
      void work();
      return;
    }
    if (!action.editor || !action.onSave) return;
    setPop({
      ...current,
      mode: "edit",
      title: action.editor.title,
      editor: action.editor,
      onSave: action.onSave,
      onClear: action.onClear,
      onNew: undefined,
      showRemove: !!action.onClear,
    });
  }, []);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setFault(null);
    try {
      await work();
      setPop(null);
    } catch (err) {
      setFault(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }, []);

  const commit = useCallback(
    (fields: SkyFields) => {
      const current = popRef.current;
      if (!current?.onSave) return;
      void run(() => current.onSave!(fields));
    },
    [run],
  );

  const clear = useCallback(() => {
    const current = popRef.current;
    if (!current?.onClear) return;
    void run(() => current.onClear!());
  }, [run]);

  return { pop, busy, fault, open, close, toEdit, toNew, pick, commit, clear };
}

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : "Could not save that.";
}

export function SkyFieldPop({
  pop,
  busy,
  fault,
  onEdit,
  onNew,
  onPick,
  onClear,
  onCommit,
  onClose,
}: {
  pop: SkyPopModel | null;
  busy: boolean;
  fault: string | null;
  onEdit: () => void;
  onNew: () => void;
  onPick: (id: string) => void;
  onClear: () => void;
  onCommit: (fields: SkyFields) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const el = panel.current;
    if (!pop || !el) return;
    el.style.left = `${pop.x}px`;
    el.style.top = `${pop.y}px`;
    const rect = el.getBoundingClientRect();
    const pad = 10;
    let dx = 0;
    let dy = 0;
    if (rect.right > window.innerWidth - pad) dx = window.innerWidth - pad - rect.right;
    if (rect.bottom > window.innerHeight - pad) dy = window.innerHeight - pad - rect.bottom;
    if (rect.left + dx < pad) dx = pad - rect.left;
    if (rect.top + dy < pad) dy = pad - rect.top;
    setShift({ x: dx, y: dy });
  }, [pop]);

  useEffect(() => {
    if (!pop) return;
    const box = panel.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    const onDown = (event: MouseEvent) => {
      if (event.button === 2) return;
      if (box?.contains(event.target as Node)) return;
      if (busy) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    const onContext = (event: MouseEvent) => {
      event.preventDefault();
      if (box?.contains(event.target as Node)) return;
      if (!busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("contextmenu", onContext, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("contextmenu", onContext, true);
    };
  }, [pop, busy, onClose]);

  useEffect(() => {
    if (!pop) return;
    const focusable = panel.current?.querySelector<HTMLElement>("button, input, textarea");
    focusable?.focus();
  }, [pop]);

  if (!pop) return null;

  const wide =
    !!pop.editor &&
    (pop.editor.kind === "address" || pop.editor.kind === "vehicle" || pop.editor.kind === "place" || (pop.editor.kind === "text" && pop.editor.multiline));

  return createPortal(
    <div className="sky-pop-root">
      <div
        ref={panel}
        className={pop.mode === "edit" ? `sky-pop editor${wide ? " wide" : ""}` : `sky-pop${pop.actions ? " actions" : ""}`}
        role={pop.mode === "edit" ? "dialog" : "menu"}
        aria-label={pop.mode === "edit" ? pop.editor?.title ?? pop.title : pop.title}
        style={{ left: pop.x + shift.x, top: pop.y + shift.y }}
      >
        {pop.mode === "menu" ? (
          <>
            <div className="sky-pop-kicker">{pop.title}</div>
            {pop.actions ? (
              pop.actions.map((action) => (
                <Fragment key={action.id}>
                  {action.ruleBefore && <div className="sky-pop-rule" />}
                  <button
                    type="button"
                    className={action.quiet ? "sky-pop-item quiet" : "sky-pop-item"}
                    role="menuitem"
                    onClick={() => onPick(action.id)}
                    disabled={busy}
                  >
                    <ActionMark mark={action.mark} />
                    {action.label}
                  </button>
                </Fragment>
              ))
            ) : (
              <>
                <button type="button" className="sky-pop-item primary" role="menuitem" onClick={onEdit} disabled={busy}>
                  <Pencil size={14} strokeWidth={1.75} />
                  Edit
                </button>
                {pop.onNew && (
                  <button type="button" className="sky-pop-item" role="menuitem" onClick={onNew} disabled={busy}>
                    <Plus size={14} strokeWidth={1.75} />
                    New
                  </button>
                )}
                {pop.onClear && (
                  <>
                    <div className="sky-pop-rule" />
                    <button type="button" className="sky-pop-item quiet" role="menuitem" onClick={onClear} disabled={busy}>
                      Clear
                    </button>
                  </>
                )}
              </>
            )}
            {fault && <p className="sky-pop-fault">{fault}</p>}
          </>
        ) : (
          pop.editor && (
            <EditorBody
              editor={pop.editor}
              busy={busy}
              fault={fault}
              onCommit={onCommit}
              onClose={onClose}
              onClear={pop.showRemove ? onClear : undefined}
            />
          )
        )}
      </div>
    </div>,
    document.body,
  );
}

function ActionMark({ mark }: { mark?: SkyMenuAction["mark"] }) {
  if (mark === "new") return <Plus size={14} strokeWidth={1.75} />;
  if (mark === "image") return <ImagePlus size={14} strokeWidth={1.75} />;
  if (mark === "compare") return <Images size={14} strokeWidth={1.75} />;
  return null;
}

function ChecksEditor({
  editor,
  busy,
  fault,
  onCommit,
}: {
  editor: Extract<SkyEditor, { kind: "checks" }>;
  busy: boolean;
  fault: string | null;
  onCommit: (fields: SkyFields) => void;
}) {
  const [picked, setPicked] = useState(() => new Set(editor.value.split(",").filter(Boolean)));
  const toggle = (value: string) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };
  return (
    <>
      <div className="sky-pop-kicker">Edit</div>
      <h2 className="sky-pop-title">{editor.title}</h2>
      <div className="sky-pop-list">
        {editor.options.map((option) => (
          <button key={option.value} type="button" className={picked.has(option.value) ? "on" : ""} disabled={busy} onClick={() => toggle(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      {fault && <p className="sky-pop-fault">{fault}</p>}
      <div className="sky-pop-actions">
        <button type="button" className="sky-pop-btn save" disabled={busy} onClick={() => onCommit({ value: [...picked].join(",") })}>
          Save
        </button>
      </div>
    </>
  );
}

function EditorBody({
  editor,
  busy,
  fault,
  onCommit,
  onClose,
  onClear,
}: {
  editor: SkyEditor;
  busy: boolean;
  fault: string | null;
  onCommit: (fields: SkyFields) => void;
  onClose: () => void;
  onClear?: () => void;
}) {
  if (editor.kind === "choice") {
    return (
      <>
        <div className="sky-pop-kicker">Edit</div>
        <h2 className="sky-pop-title">{editor.title}</h2>
        <div className="sky-pop-list">
          {editor.emptyLabel && (
            <button type="button" className={editor.value ? "" : "on"} disabled={busy} onClick={() => onCommit({ value: "" })}>
              {editor.emptyLabel}
            </button>
          )}
          {editor.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === editor.value ? "on" : ""}
              disabled={busy}
              onClick={() => onCommit({ value: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
        {fault && <p className="sky-pop-fault">{fault}</p>}
      </>
    );
  }

  if (editor.kind === "checks") {
    return <ChecksEditor editor={editor} busy={busy} fault={fault} onCommit={onCommit} />;
  }

  if (editor.kind === "client") {
    return <ClientEditor editor={editor} busy={busy} fault={fault} onCommit={onCommit} />;
  }

  return <FieldForm editor={editor} busy={busy} fault={fault} onCommit={onCommit} onClose={onClose} onClear={onClear} />;
}

function FieldForm({
  editor,
  busy,
  fault,
  onCommit,
  onClose,
  onClear,
}: {
  editor: Exclude<SkyEditor, { kind: "choice" } | { kind: "client" }>;
  busy: boolean;
  fault: string | null;
  onCommit: (fields: SkyFields) => void;
  onClose: () => void;
  onClear?: () => void;
}) {
  const [fields, setFields] = useState<SkyFields>(() => initialFields(editor));
  const [localFault, setLocalFault] = useState<string | null>(null);
  const set = (key: string, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const shownFault = localFault || fault;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const problem = validate(editor, fields);
        if (problem) {
          setLocalFault(problem);
          return;
        }
        setLocalFault(null);
        onCommit(fields);
      }}
    >
      <div className="sky-pop-kicker">Edit</div>
      <h2 className="sky-pop-title">{editor.title}</h2>
      <div className="sky-pop-fields">
        {editor.kind === "text" &&
          (editor.multiline ? (
            <textarea
              value={fields.value}
              placeholder={editor.placeholder}
              rows={5}
              onChange={(event) => set("value", event.target.value)}
            />
          ) : (
            <input
              value={fields.value}
              placeholder={editor.placeholder}
              onChange={(event) => set("value", event.target.value)}
            />
          ))}
        {editor.kind === "date" && <input type="date" value={fields.value} onChange={(event) => set("value", event.target.value)} />}
        {editor.kind === "time" && (
          <input type="time" value={fields.value} onChange={(event) => set("value", event.target.value)} />
        )}
        {editor.kind === "datetime" && (
          <input type="datetime-local" value={fields.value} onChange={(event) => set("value", event.target.value)} />
        )}
        {editor.kind === "address" && (
          <>
            <label>
              Street
              <input value={fields.line1} onChange={(event) => set("line1", event.target.value)} />
            </label>
            <div className="sky-pop-split">
              <label>
                City
                <input value={fields.city} onChange={(event) => set("city", event.target.value)} />
              </label>
              <label>
                State
                <input value={fields.state} onChange={(event) => set("state", event.target.value)} />
              </label>
              <label>
                Zip
                <input value={fields.zip} onChange={(event) => set("zip", event.target.value)} />
              </label>
            </div>
          </>
        )}
        {editor.kind === "vehicle" && (
          <>
            <div className="sky-pop-split two">
              <label>
                Color
                <input value={fields.color} onChange={(event) => set("color", event.target.value)} />
              </label>
              <label>
                Year
                <input inputMode="numeric" value={fields.year} onChange={(event) => set("year", event.target.value)} />
              </label>
            </div>
            <div className="sky-pop-split two">
              <label>
                Make
                <input value={fields.make} onChange={(event) => set("make", event.target.value)} />
              </label>
              <label>
                Model
                <input value={fields.model} onChange={(event) => set("model", event.target.value)} />
              </label>
            </div>
            <div className="sky-pop-split two">
              <label>
                Plate
                <input value={fields.plate} onChange={(event) => set("plate", event.target.value)} />
              </label>
              <label>
                State
                <input value={fields.plateState} onChange={(event) => set("plateState", event.target.value)} />
              </label>
            </div>
          </>
        )}
        {editor.kind === "place" && (
          <>
            <label>
              Name
              <input value={fields.name} onChange={(event) => set("name", event.target.value)} />
            </label>
            <label>
              When
              <input value={fields.when} placeholder="Weekday mornings" onChange={(event) => set("when", event.target.value)} />
            </label>
            <label>
              Place
              <input value={fields.place} onChange={(event) => set("place", event.target.value)} />
            </label>
          </>
        )}
      </div>
      {shownFault && <p className="sky-pop-fault">{shownFault}</p>}
      <div className="sky-pop-actions">
        {onClear && (
          <button type="button" className="sky-pop-btn quiet" onClick={onClear} disabled={busy}>
            Remove
          </button>
        )}
        <button type="button" className="sky-pop-btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="sky-pop-btn save" disabled={busy}>
          {busy ? "Saving" : "Save"}
        </button>
      </div>
    </form>
  );
}

function ClientEditor({
  editor,
  busy,
  fault,
  onCommit,
}: {
  editor: Extract<SkyEditor, { kind: "client" }>;
  busy: boolean;
  fault: string | null;
  onCommit: (fields: SkyFields) => void;
}) {
  const [clients, setClients] = useState<{ id: string; company: string }[] | null>(null);
  const [query, setQuery] = useState("");
  const [loadFault, setLoadFault] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    clientsApi
      .list()
      .then((res) => {
        if (live) setClients(res.clients);
      })
      .catch((err) => {
        if (live) setLoadFault(messageOf(err));
      });
    return () => {
      live = false;
    };
  }, []);

  const needle = query.trim().toLowerCase();
  const shown = (clients ?? []).filter((client) => client.company.toLowerCase().includes(needle));

  return (
    <>
      <div className="sky-pop-kicker">Edit</div>
      <h2 className="sky-pop-title">{editor.title}</h2>
      <input value={query} placeholder="Search clients" onChange={(event) => setQuery(event.target.value)} />
      <div className="sky-pop-list">
        <button type="button" className={editor.value ? "" : "on"} disabled={busy} onClick={() => onCommit({ value: "" })}>
          No client
        </button>
        {clients == null && !loadFault && <p className="sky-pop-note">Loading clients</p>}
        {shown.map((client) => (
          <button
            key={client.id}
            type="button"
            className={client.id === editor.value ? "on" : ""}
            disabled={busy}
            onClick={() => onCommit({ value: client.id, label: client.company })}
          >
            {client.company}
          </button>
        ))}
      </div>
      {(fault || loadFault) && <p className="sky-pop-fault">{fault || loadFault}</p>}
    </>
  );
}

function initialFields(editor: Exclude<SkyEditor, { kind: "choice" } | { kind: "client" }>): SkyFields {
  if (editor.kind === "text" || editor.kind === "date" || editor.kind === "time" || editor.kind === "datetime") return { value: editor.value };
  if (editor.kind === "address") return { line1: editor.line1, city: editor.city, state: editor.state, zip: editor.zip };
  if (editor.kind === "vehicle") {
    return {
      color: editor.color,
      year: editor.year,
      make: editor.make,
      model: editor.model,
      plate: editor.plate,
      plateState: editor.plateState,
    };
  }
  if (editor.kind === "checks") return { value: editor.value };
  return { name: editor.name, when: editor.when, place: editor.place };
}

function validate(editor: SkyEditor, fields: SkyFields): string | null {
  if (editor.kind === "text" && editor.required && !fields.value.trim()) return "This needs a value.";
  if (editor.kind === "address" && !fields.line1.trim()) return "A street address is required.";
  if (editor.kind === "vehicle") {
    const any = [fields.color, fields.year, fields.make, fields.model, fields.plate].some((part) => part.trim());
    if (!any) return "Add a color, year, make, model, or plate.";
    if (fields.year.trim() && !Number.isInteger(Number(fields.year))) return "Year should be a number.";
  }
  if (editor.kind === "place") {
    if (!fields.name.trim()) return "Give the place a name.";
    if (!fields.when.trim()) return "Say when they return.";
  }
  return null;
}


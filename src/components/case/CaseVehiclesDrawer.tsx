import { useEffect, useMemo, useState } from "react";
import { Car, Link2, Loader2, Lock, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { placeholderPhotoFor } from "@/lib/mock-data";
import {
  casesApi,
  type CaseVehicle,
  type CaseVehicleInput,
  type PersonVehicleRole,
} from "@/lib/crm-api";
import type { CasePanelCtx } from "@/pages/case-detail-widgets";

const ROLE_LABELS: Record<PersonVehicleRole, string> = {
  owner: "Owner",
  driver: "Driver",
  passenger: "Passenger",
  observed_in: "Observed in",
};

const inputCls =
  "w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent-soft)]";

type FormState = {
  make: string;
  model: string;
  year: string;
  color: string;
  licensePlate: string;
  state: string;
  vin: string;
  registeredOwner: string;
  photoUrl: string;
  notes: string;
};

const emptyForm: FormState = {
  make: "", model: "", year: "", color: "", licensePlate: "",
  state: "", vin: "", registeredOwner: "", photoUrl: "", notes: "",
};

function toForm(v: CaseVehicle): FormState {
  return {
    make: v.make ?? "",
    model: v.model ?? "",
    year: v.year != null ? String(v.year) : "",
    color: v.color ?? "",
    licensePlate: v.licensePlate ?? "",
    state: v.state ?? "",
    vin: v.vin ?? "",
    registeredOwner: v.registeredOwner ?? "",
    photoUrl: v.photoUrl ?? "",
    notes: v.notes ?? "",
  };
}

function toPayload(f: FormState): CaseVehicleInput {
  const year = f.year.trim() === "" ? null : Number.parseInt(f.year, 10);
  return {
    make: f.make.trim(),
    model: f.model.trim(),
    year: Number.isNaN(year as number) ? null : year,
    color: f.color.trim(),
    licensePlate: f.licensePlate.trim(),
    state: f.state.trim(),
    vin: f.vin.trim(),
    registeredOwner: f.registeredOwner.trim() || null,
    photoUrl: f.photoUrl.trim() || null,
    notes: f.notes.trim(),
  };
}

export function CaseVehiclesDrawer({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  const canWrite = ctx.canEdit && ctx.canEditField("case.vehicles");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [linkPersonId, setLinkPersonId] = useState("");
  const [linkRole, setLinkRole] = useState<PersonVehicleRole>("driver");

  const selected = useMemo(
    () => c.vehicles.find((v) => v.id === selectedId) ?? null,
    [c.vehicles, selectedId],
  );

  useEffect(() => {
    if (selected) setForm(toForm(selected));
    else if (!creating) setForm(emptyForm);
  }, [selected, creating]);

  if (!ctx.canSee("case.vehicles")) {
    return (
      <div className="grid h-full place-items-center gap-1.5 text-center">
        <Lock size={16} strokeWidth={1.5} className="text-[var(--color-text-lo)]" />
        <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">Restricted by your role</span>
      </div>
    );
  }

  const openCreate = () => {
    setSelectedId(null);
    setCreating(true);
    setForm(emptyForm);
  };

  const save = async () => {
    setBusy(true);
    try {
      if (creating) {
        const { vehicle } = await casesApi.addVehicle(c.id, toPayload(form));
        setCreating(false);
        setSelectedId(vehicle.id);
      } else if (selected) {
        await casesApi.updateVehicle(c.id, selected.id, toPayload(form));
      }
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (vehicleId: string) => {
    setBusy(true);
    try {
      await casesApi.deleteVehicle(c.id, vehicleId);
      if (selectedId === vehicleId) setSelectedId(null);
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const addLink = async () => {
    if (!selected || !linkPersonId) return;
    setBusy(true);
    try {
      await casesApi.linkPersonVehicle(c.id, linkPersonId, selected.id, linkRole);
      setLinkPersonId("");
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const removeLink = async (personId: string, linkId: string) => {
    setBusy(true);
    try {
      await casesApi.unlinkPersonVehicle(c.id, personId, linkId);
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, key: keyof FormState, placeholder = "", props: Record<string, unknown> = {}) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</span>
      <input
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={inputCls}
        {...props}
      />
    </label>
  );

  const editorOpen = creating || selected !== null;

  return (
    <div className="flex flex-col gap-4">
      {/* Vehicle list */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
          {c.vehicles.length} vehicle{c.vehicles.length === 1 ? "" : "s"} on file
        </span>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 rounded-[0.5rem] bg-[var(--color-accent-soft)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--color-text-hi)]"
          >
            <Plus size={12} strokeWidth={2} />
            Add vehicle
          </button>
        )}
      </div>

      {c.vehicles.length === 0 && !creating && (
        <div className="grid place-items-center gap-1.5 rounded-[0.625rem] border border-dashed border-[var(--color-line)] py-10 text-center">
          <Car size={18} strokeWidth={1.5} className="text-[var(--color-text-lo)]" />
          <span className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">No vehicles on file.</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {c.vehicles.map((v) => {
          const title = [v.year, v.color, v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle";
          const active = v.id === selectedId;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setCreating(false);
                setSelectedId(active ? null : v.id);
              }}
              className={cn(
                "group flex items-center gap-3 rounded-[0.625rem] border px-2.5 py-2 text-left transition-colors",
                active
                  ? "border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)]/40"
                  : "border-[var(--color-line)] hover:border-[var(--color-line-2)]",
              )}
            >
              <img
                src={v.photoUrl || placeholderPhotoFor(v.id)}
                alt=""
                className="h-12 w-16 shrink-0 rounded-[0.5rem] border border-[var(--color-line-2)] object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.78125rem] font-medium text-[var(--color-text-hi)]">{title}</div>
                <div className="truncate font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                  {[v.licensePlate, v.state, v.registeredOwner && `Owner: ${v.registeredOwner}`]
                    .filter(Boolean)
                    .join(" · ") || "No plate on file"}
                </div>
                {(v.personLinks?.length ?? 0) > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {v.personLinks!.map((l) => (
                      <span
                        key={l.id}
                        className="rounded-full bg-[var(--color-ink-3)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--color-text-mid)]"
                      >
                        {l.person.name} · {ROLE_LABELS[l.role]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {canWrite && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(v.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      void remove(v.id);
                    }
                  }}
                  className="hidden shrink-0 text-[var(--color-text-lo)] hover:text-[var(--color-neg)] group-hover:block"
                  title="Delete vehicle"
                >
                  <Trash2 size={13} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      {editorOpen && (canWrite || selected) && (
        <div className="flex flex-col gap-3 rounded-[0.75rem] border border-[var(--color-line-2)] bg-[var(--color-ink-1)]/40 p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-mid)]">
              {creating ? "New vehicle" : "Vehicle details"}
            </span>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setSelectedId(null);
              }}
              className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]"
            >
              <X size={13} />
            </button>
          </div>

          {canWrite ? (
            <>
              <div className="flex gap-2">
                {field("Make", "make", "Honda")}
                {field("Model", "model", "Civic")}
                {field("Year", "year", "2021", { inputMode: "numeric", maxLength: 4 })}
              </div>
              <div className="flex gap-2">
                {field("Color", "color", "Gray")}
                {field("Plate", "licensePlate", "8ABC123")}
                {field("State", "state", "CA", { maxLength: 2 })}
              </div>
              <div className="flex gap-2">
                {field("VIN", "vin")}
                {field("Registered owner", "registeredOwner", "Name on registration")}
              </div>
              {field("Photo URL", "photoUrl", "https://…")}
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                  Notes
                </span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className={cn(inputCls, "min-h-[3.5rem] resize-none")}
                />
              </label>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 self-end rounded-[0.5rem] bg-[var(--color-accent-soft)] px-3.5 py-1.5 text-[0.71875rem] font-medium text-[var(--color-text-hi)] disabled:opacity-50"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : creating ? "Add vehicle" : "Save changes"}
              </button>
            </>
          ) : (
            <p className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
              Your role can view vehicles but not change them.
            </p>
          )}

          {/* People links */}
          {selected && (
            <div className="flex flex-col gap-2 border-t border-[var(--color-line)] pt-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                <Link2 size={10} strokeWidth={2} />
                Linked people
              </span>
              {(selected.personLinks?.length ?? 0) === 0 && (
                <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
                  Nobody linked yet{c.people?.length ? "" : " — add people from the People drawer first"}.
                </span>
              )}
              {selected.personLinks?.map((l) => (
                <div
                  key={l.id}
                  className="group flex items-center gap-2 rounded-[0.5rem] border border-[var(--color-line)] px-2.5 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-[0.71875rem] text-[var(--color-text-hi)]">
                    {l.person.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-[var(--color-ink-3)] px-2 py-0.5 text-[0.5625rem] text-[var(--color-text-mid)]">
                    {ROLE_LABELS[l.role]}
                  </span>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => removeLink(l.person.id, l.id)}
                      className="hidden shrink-0 text-[var(--color-text-lo)] hover:text-[var(--color-neg)] group-hover:block"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}
              {canWrite && (c.people?.length ?? 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={linkPersonId}
                    onChange={(e) => setLinkPersonId(e.target.value)}
                    className={cn(inputCls, "flex-1")}
                  >
                    <option value="">Link a person…</option>
                    {c.people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={linkRole}
                    onChange={(e) => setLinkRole(e.target.value as PersonVehicleRole)}
                    className={cn(inputCls, "w-32")}
                  >
                    {(Object.keys(ROLE_LABELS) as PersonVehicleRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addLink}
                    disabled={busy || !linkPersonId}
                    className="shrink-0 rounded-[0.5rem] bg-[var(--color-accent-soft)] px-2.5 py-1.5 text-[0.6875rem] text-[var(--color-text-hi)] disabled:opacity-40"
                  >
                    Link
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

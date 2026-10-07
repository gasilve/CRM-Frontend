import { useEffect, useMemo, useState } from "react";
import { Car, Loader2, Lock, Plus, Trash2, Users, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { placeholderPhotoFor } from "@/lib/mock-data";
import {
  casesApi,
  type CasePerson,
  type CasePersonInput,
  type CasePersonRelationship,
  type PersonVehicleRole,
} from "@/lib/crm-api";
import type { CasePanelCtx } from "@/pages/case-detail-widgets";
import { CasePhoto } from "@/components/case/EntityModal";

const RELATIONSHIP_LABELS: Record<CasePersonRelationship, string> = {
  cohabitant: "Cohabitant",
  neighbor: "Neighbor",
  family: "Family",
  coworker: "Coworker",
  visitor: "Visitor",
  passer_by: "Passer-by",
  other: "Other",
};

const ROLE_LABELS: Record<PersonVehicleRole, string> = {
  owner: "Owner",
  driver: "Driver",
  passenger: "Passenger",
  observed_in: "Observed in",
};

const inputCls =
  "w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent-soft)]";

type FormState = {
  name: string;
  relationship: CasePersonRelationship;
  photoUrl: string;
  phone: string;
  address: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "", relationship: "other", photoUrl: "", phone: "", address: "", notes: "",
};

function toForm(p: CasePerson): FormState {
  return {
    name: p.name,
    relationship: p.relationship,
    photoUrl: p.photoUrl ?? "",
    phone: p.phone ?? "",
    address: p.address ?? "",
    notes: p.notes ?? "",
  };
}

function toPayload(f: FormState): CasePersonInput {
  return {
    name: f.name.trim(),
    relationship: f.relationship,
    photoUrl: f.photoUrl.trim() || null,
    phone: f.phone.trim() || null,
    address: f.address.trim() || null,
    notes: f.notes.trim() || null,
  };
}

export function CasePeopleDrawer({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  const canWrite = ctx.canEdit && ctx.canEditField("case.associates");
  const canSeeVehicles = ctx.canSee("case.vehicles");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [linkVehicleId, setLinkVehicleId] = useState("");
  const [linkRole, setLinkRole] = useState<PersonVehicleRole>("driver");

  const people = c.people ?? [];
  const selected = useMemo(() => people.find((p) => p.id === selectedId) ?? null, [people, selectedId]);

  useEffect(() => {
    if (selected) setForm(toForm(selected));
    else if (!creating) setForm(emptyForm);
  }, [selected, creating]);

  if (!ctx.canSee("case.associates")) {
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
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      if (creating) {
        const { person } = await casesApi.addPerson(c.id, toPayload(form));
        setCreating(false);
        setSelectedId(person.id);
      } else if (selected) {
        await casesApi.updatePerson(c.id, selected.id, toPayload(form));
      }
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (personId: string) => {
    setBusy(true);
    try {
      await casesApi.deletePerson(c.id, personId);
      if (selectedId === personId) setSelectedId(null);
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const addLink = async () => {
    if (!selected || !linkVehicleId) return;
    setBusy(true);
    try {
      await casesApi.linkPersonVehicle(c.id, selected.id, linkVehicleId, linkRole);
      setLinkVehicleId("");
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

  const field = (label: string, key: Exclude<keyof FormState, "relationship">, placeholder = "") => (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</span>
      <input
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={inputCls}
      />
    </label>
  );

  const editorOpen = creating || selected !== null;

  return (
    <div className="flex flex-col gap-4">
      {/* Subject callout — the subject lives on the case itself, not in this list */}
      <div className="flex items-center gap-3 rounded-[0.625rem] border border-[var(--color-accent-soft)]/60 bg-[var(--color-accent-soft)]/20 px-2.5 py-2">
        {c.subjectPhotoUrl && !/^(https?:|data:|blob:)/.test(c.subjectPhotoUrl) ? (
          <CasePhoto
            caseId={c.id}
            photoUrl={c.subjectPhotoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full border border-[var(--color-line-2)]"
          />
        ) : c.subjectPhotoUrl || c.caseNumber !== "PENDING" ? (
          <img
            src={c.subjectPhotoUrl || placeholderPhotoFor(c.id)}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full border border-[var(--color-line-2)] object-cover"
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-full border border-[var(--color-line-2)] bg-[var(--color-ink-3)]" />
        )}
        <div className="min-w-0">
          <div className="truncate text-[0.78125rem] font-medium text-[var(--color-text-hi)]">
            {c.subjectName || "Subject"}
          </div>
          <div className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-accent-2)]">
            Subject
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
          {people.length} other {people.length === 1 ? "person" : "people"} logged
        </span>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 rounded-[0.5rem] bg-[var(--color-accent-soft)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--color-text-hi)]"
          >
            <Plus size={12} strokeWidth={2} />
            Add person
          </button>
        )}
      </div>

      {people.length === 0 && !creating && (
        <div className="grid place-items-center gap-1.5 rounded-[0.625rem] border border-dashed border-[var(--color-line)] py-10 text-center">
          <Users size={18} strokeWidth={1.5} className="text-[var(--color-text-lo)]" />
          <span className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            No people logged yet — cohabitants, neighbors, visitors…
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {people.map((p) => {
          const active = p.id === selectedId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setCreating(false);
                setSelectedId(active ? null : p.id);
              }}
              className={cn(
                "group flex items-center gap-3 rounded-[0.625rem] border px-2.5 py-2 text-left transition-colors",
                active
                  ? "border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)]/40"
                  : "border-[var(--color-line)] hover:border-[var(--color-line-2)]",
              )}
            >
              <img
                src={p.photoUrl || placeholderPhotoFor(p.id)}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full border border-[var(--color-line-2)] object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.78125rem] font-medium text-[var(--color-text-hi)]">{p.name}</div>
                <div className="truncate font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                  {[RELATIONSHIP_LABELS[p.relationship], p.phone].filter(Boolean).join(" · ")}
                </div>
                {p.vehicleLinks.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {p.vehicleLinks.map((l) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--color-ink-3)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--color-text-mid)]"
                      >
                        <Car size={9} strokeWidth={2} />
                        {[l.vehicle.year, l.vehicle.make, l.vehicle.model].filter(Boolean).join(" ") ||
                          l.vehicle.licensePlate ||
                          "Vehicle"}{" "}
                        · {ROLE_LABELS[l.role]}
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
                    void remove(p.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      void remove(p.id);
                    }
                  }}
                  className="hidden shrink-0 text-[var(--color-text-lo)] hover:text-[var(--color-neg)] group-hover:block"
                  title="Remove person"
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
              {creating ? "New person" : "Person details"}
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
                {field("Name", "name", "Full name")}
                <label className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                    Relationship
                  </span>
                  <select
                    value={form.relationship}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, relationship: e.target.value as CasePersonRelationship }))
                    }
                    className={inputCls}
                  >
                    {(Object.keys(RELATIONSHIP_LABELS) as CasePersonRelationship[]).map((r) => (
                      <option key={r} value={r}>
                        {RELATIONSHIP_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                {field("Phone", "phone")}
                {field("Photo URL", "photoUrl", "https://…")}
              </div>
              {field("Address", "address")}
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                  Notes
                </span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className={cn(inputCls, "min-h-[3.5rem] resize-none")}
                  placeholder="How they relate to the case, observed behavior…"
                />
              </label>
              <button
                type="button"
                onClick={save}
                disabled={busy || !form.name.trim()}
                className="inline-flex items-center justify-center gap-1.5 self-end rounded-[0.5rem] bg-[var(--color-accent-soft)] px-3.5 py-1.5 text-[0.71875rem] font-medium text-[var(--color-text-hi)] disabled:opacity-50"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : creating ? "Add person" : "Save changes"}
              </button>
            </>
          ) : (
            <p className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
              Your role can view people but not change them.
            </p>
          )}

          {/* Vehicle links */}
          {selected && canSeeVehicles && (
            <div className="flex flex-col gap-2 border-t border-[var(--color-line)] pt-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                <Car size={10} strokeWidth={2} />
                Linked vehicles
              </span>
              {selected.vehicleLinks.length === 0 && (
                <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
                  No vehicles linked yet{c.vehicles.length ? "" : " — add vehicles from the Vehicles drawer first"}.
                </span>
              )}
              {selected.vehicleLinks.map((l) => (
                <div
                  key={l.id}
                  className="group flex items-center gap-2 rounded-[0.5rem] border border-[var(--color-line)] px-2.5 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-[0.71875rem] text-[var(--color-text-hi)]">
                    {[l.vehicle.year, l.vehicle.color, l.vehicle.make, l.vehicle.model].filter(Boolean).join(" ") ||
                      "Unknown vehicle"}
                    {l.vehicle.licensePlate && (
                      <span className="ml-1.5 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                        {l.vehicle.licensePlate}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-full bg-[var(--color-ink-3)] px-2 py-0.5 text-[0.5625rem] text-[var(--color-text-mid)]">
                    {ROLE_LABELS[l.role]}
                  </span>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => removeLink(selected.id, l.id)}
                      className="hidden shrink-0 text-[var(--color-text-lo)] hover:text-[var(--color-neg)] group-hover:block"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}
              {canWrite && c.vehicles.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={linkVehicleId}
                    onChange={(e) => setLinkVehicleId(e.target.value)}
                    className={cn(inputCls, "flex-1")}
                  >
                    <option value="">Link a vehicle…</option>
                    {c.vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {[v.year, v.color, v.make, v.model].filter(Boolean).join(" ") || v.licensePlate || v.id}
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
                    disabled={busy || !linkVehicleId}
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

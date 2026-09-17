import { useEffect, useMemo, useState } from "react";
import { Car, Link2, Loader2, Lock, Plus, Trash2, User, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { placeholderPhotoFor } from "@/lib/mock-data";
import {
  casesApi,
  ApiError,
  VEHICLE_SEAT_COUNTS,
  type CaseVehicle,
  type CaseVehicleInput,
  type PersonVehicleRole,
  type VehicleKind,
  type VehicleOccupancyEvent,
} from "@/lib/crm-api";
import { VehicleChassis } from "@/components/case/VehicleChassis";
import { SteeringWheelIcon } from "@/components/case/SteeringWheelIcon";
import type { CasePanelCtx } from "@/pages/case-detail-widgets";

const ROLE_LABELS: Record<PersonVehicleRole, string> = {
  owner: "Owner",
  driver: "Driver",
  passenger: "Passenger",
  observed_in: "Observed in",
};

const fmtWhen = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

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
  seatCount: number;
  kind: VehicleKind;
};

const emptyForm: FormState = {
  make: "", model: "", year: "", color: "", licensePlate: "",
  state: "", vin: "", registeredOwner: "", photoUrl: "", notes: "",
  seatCount: 5, kind: "subject",
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
    seatCount: v.seatCount ?? 5,
    kind: v.kind ?? "subject",
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
    seatCount: f.seatCount,
    kind: f.kind,
  };
}

const KIND_LABELS: Record<VehicleKind, string> = { subject: "Household", neighbor: "Neighbor", unknown: "Unknown" };

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
                {v.kind !== "subject" && (
                  <span className="mt-0.5 inline-block rounded-full bg-[var(--color-ink-3)] px-1.5 py-0.5 text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                    {KIND_LABELS[v.kind]}
                  </span>
                )}
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
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Seats</span>
                <div className="flex gap-1.5">
                  {VEHICLE_SEAT_COUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, seatCount: n }))}
                      className={cn(
                        "flex-1 rounded-[0.5rem] border py-1.5 text-[0.71875rem] font-medium transition-colors",
                        form.seatCount === n
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                          : "border-[var(--color-line-2)] text-[var(--color-text-mid)] hover:border-[var(--color-line-3)]",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Whose car</span>
                <div className="flex gap-1.5">
                  {(Object.keys(KIND_LABELS) as VehicleKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, kind: k }))}
                      className={cn(
                        "flex-1 rounded-[0.5rem] border py-1.5 text-[0.6875rem] font-medium transition-colors",
                        form.kind === k
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                          : "border-[var(--color-line-2)] text-[var(--color-text-mid)] hover:border-[var(--color-line-3)]",
                      )}
                    >
                      {KIND_LABELS[k]}
                    </button>
                  ))}
                </div>
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

          {/* Seat-occupancy log — who was seen driving/riding, and when */}
          {selected && (
            <SeatOccupancy
              caseId={c.id}
              vehicle={selected}
              people={c.people ?? []}
              canWrite={canWrite}
              onChanged={ctx.onRefresh}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Seat-occupancy log ──────────────────────────────────────────────────────
// Exported so the case working-mode page can render the same seat-hover UI
// without depending on the drawer's CasePanelCtx.

export type SeatPerson = { id: string; name: string; photoUrl?: string | null; relationship?: string; isSubject?: boolean };

export function SeatOccupancy({
  caseId,
  vehicle,
  people,
  canWrite,
  onChanged,
  size = "md",
  bare = false,
}: {
  caseId: string;
  vehicle: CaseVehicle;
  people: SeatPerson[];
  canWrite: boolean;
  onChanged: () => void;
  /** The vehicle modal has room for a much larger diagram than the case-detail drawer. */
  size?: "md" | "lg";
  /** Drops the drawer's divider/heading chrome when the host already provides it. */
  bare?: boolean;
}) {
  const large = size === "lg";
  const events = vehicle.occupancyEvents ?? [];
  // Keyed per physical seat ("driver" / "passenger-0" / "passenger-1" …), not just role, so
  // the assign popover anchors to the exact seat that was clicked.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byRole = useMemo(() => {
    const map = new Map<PersonVehicleRole, VehicleOccupancyEvent[]>();
    for (const e of events) map.set(e.role, [...(map.get(e.role) ?? []), e]);
    return map;
  }, [events]);

  const seatCount = vehicle.seatCount ?? 5;

  const seats = useMemo(() => {
    // Drivers: show ALL unique people who were logged as driver (not just the latest).
    // Passengers: one slot each — fan the most recent N passenger events across seats.
    const driverEvents = byRole.get("driver") ?? [];
    const passengerEvents = byRole.get("passenger") ?? [];
    const passengerCount = Math.max(1, seatCount - 1);
    const passengerSeats = Array.from({ length: passengerCount }, (_, i) => passengerEvents[i] ?? null);
    return { drivers: driverEvents, passengers: passengerSeats };
  }, [byRole, seatCount]);

  const assign = async (role: PersonVehicleRole, personId: string, note: string) => {
    setBusy(true);
    setError(null);
    try {
      await casesApi.addVehicleEvent(caseId, vehicle.id, { personId, role, note: note.trim() || null });
      setOpenKey(null);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log that observation.");
    } finally {
      setBusy(false);
    }
  };

  const removeEvent = async (eventId: string) => {
    setBusy(true);
    try {
      await casesApi.deleteVehicleEvent(caseId, vehicle.id, eventId);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const passengerLabel = (i: number, total: number): string => {
    if (i === 0) return "Front";
    if (total === 2) return "Rear"; // 2-seat car has no rear; shouldn't hit here for i>0
    // Rear row(s): label by position, never invent a fake "Row 3" on a 5-seat layout.
    const rearIndex = i - 1;
    const rearCount = total - 1;
    if (rearCount === 1) return "Rear";
    if (rearCount === 2) return rearIndex === 0 ? "Rear L" : "Rear R";
    if (rearCount === 3) return rearIndex === 0 ? "Rear L" : rearIndex === 1 ? "Rear C" : "Rear R";
    return `Rear ${rearIndex + 1}`;
  };

  return (
    <div className={cn("flex flex-col gap-2.5", large && "min-h-0 flex-1", !bare && "border-t border-[var(--color-line)] pt-3")}>
      {!bare && (
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
          <Car size={10} strokeWidth={2} />
          Seat occupancy · {seatCount}-seat layout
        </span>
      )}

      <VehicleChassis
        maxWidth={large ? "22rem" : "17rem"}
        fill={large}
        seatCount={seatCount}
        driverSeat={
          <VehicleSeatSlot
            role="driver"
            events={seats.drivers}
            slotLabel="Driver"
            canWrite={canWrite}
            large={large}
            isOpen={openKey === "driver"}
            onToggleOpen={() => setOpenKey((k) => (k === "driver" ? null : "driver"))}
            people={people}
            onAssign={(personId, note) => assign("driver", personId, note)}
            assignBusy={busy}
            assignError={openKey === "driver" ? error : null}
            onRemove={removeEvent}
          />
        }
        passengerSeats={seats.passengers.map((event, i) => {
          const key = `passenger-${i}`;
          return (
            <VehicleSeatSlot
              key={i}
              role="passenger"
              events={event ? [event] : []}
              slotLabel={passengerLabel(i, seats.passengers.length)}
              canWrite={canWrite}
              large={large}
              isOpen={openKey === key}
              onToggleOpen={() => setOpenKey((k) => (k === key ? null : key))}
              people={people}
              onAssign={(personId, note) => assign("passenger", personId, note)}
              assignBusy={busy}
              assignError={openKey === key ? error : null}
              onRemove={removeEvent}
            />
          );
        })}
      />

      {!canWrite && seats.drivers.length === 0 && seats.passengers.every((s) => s == null) && (
        <p className="text-center font-mono text-[0.625rem] text-[var(--color-text-lo)]">No occupancy logged yet.</p>
      )}
      {canWrite && people.length === 0 && (
        <span className="text-center font-mono text-[0.625rem] text-[var(--color-text-lo)]">Add people from the People drawer first.</span>
      )}
    </div>
  );
}

/**
 * One seat's hover target — hoisted to module scope (not defined inside
 * `SeatOccupancy`'s render body) so it's a stable component type across
 * re-renders. Redefining a component inline on every render was making React
 * tear down and rebuild every seat (losing hover/tooltip state mid-interaction)
 * every time a vehicle was picked, which is what looked like a crash.
 */
function VehicleSeatSlot({
  role,
  events,
  slotLabel,
  canWrite,
  large,
  isOpen,
  onToggleOpen,
  people,
  onAssign,
  assignBusy,
  assignError,
  onRemove,
}: {
  role: PersonVehicleRole;
  /** All occupancy events for this seat — drivers can have several people shown stacked. */
  events: VehicleOccupancyEvent[];
  slotLabel: string;
  canWrite: boolean;
  large: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  people: SeatPerson[];
  onAssign: (personId: string, note: string) => void;
  assignBusy: boolean;
  assignError: string | null;
  onRemove: (eventId: string) => void;
}) {
  const [pickPersonId, setPickPersonId] = useState("");
  const [pickNote, setPickNote] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setPickPersonId("");
      setPickNote("");
    }
  }, [isOpen]);

  const primary = events[0] ?? null;
  const extras = events.slice(1);
  const ringColor = primary?.person.isSubject
    ? "#f87171"
    : primary?.person.relationship === "cohabitant"
      ? "#facc15"
      : null;

  const avatarSize = large ? "h-[3.75rem] w-[3.75rem]" : "h-12 w-12";

  return (
    <div className="relative">
      <div className="relative">
        <button
          type="button"
          onClick={() => canWrite && onToggleOpen()}
          title={
            primary
              ? `${events.map((e) => e.person.name).join(", ")} · ${slotLabel}`
              : `Assign ${slotLabel.toLowerCase()}`
          }
          style={ringColor ? { borderColor: ringColor, boxShadow: `0 0 0 2px ${ringColor}33` } : undefined}
          className={cn(
            "relative grid place-items-center overflow-visible rounded-full border-2 transition-colors",
            avatarSize,
            !ringColor && (primary ? "border-[var(--color-accent-soft)]" : "border-dashed border-[var(--color-line-2)]"),
            canWrite && "cursor-pointer hover:border-[var(--color-accent)]",
          )}
        >
          {primary ? (
            <div className="relative h-full w-full overflow-hidden rounded-full">
              <img
                src={primary.person.photoUrl || placeholderPhotoFor(primary.person.id)}
                alt=""
                className="h-full w-full object-cover"
              />
              {/* Stacked second face when more than one driver/occupant is logged */}
              {extras.length > 0 && (
                <img
                  src={extras[0].person.photoUrl || placeholderPhotoFor(extras[0].person.id)}
                  alt=""
                  className="absolute -right-0.5 -top-0.5 h-[55%] w-[55%] rounded-full border-2 border-[var(--color-ink-1)] object-cover"
                />
              )}
              {extras.length > 1 && (
                <span className="absolute -bottom-0.5 -right-0.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-[var(--color-ink-1)] px-1 font-mono text-[0.5625rem] font-bold text-[var(--color-text-hi)] ring-1 ring-[var(--color-line-2)]">
                  +{extras.length}
                </span>
              )}
            </div>
          ) : role === "driver" ? (
            <SteeringWheelIcon size={large ? 22 : 18} className="text-[var(--color-text-lo)]" />
          ) : (
            <User size={large ? 20 : 16} strokeWidth={1.6} className="text-[var(--color-text-lo)]" />
          )}
        </button>

        {/* Always-visible remove for the primary occupant — investigators need this when they mis-assign */}
        {canWrite && primary && (
          <button
            type="button"
            title={`Remove ${primary.person.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(primary.id);
            }}
            className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-[var(--color-line-2)] bg-[var(--color-ink-1)] text-[var(--color-text-lo)] shadow-sm transition-colors hover:border-[var(--color-neg)] hover:text-[var(--color-neg)]"
          >
            <X size={11} strokeWidth={2.2} />
          </button>
        )}
      </div>

      <span
        className={cn(
          "mt-1 block text-center font-mono uppercase tracking-wider",
          large ? "text-[0.625rem] text-[var(--color-text-mid)]" : "text-[0.5rem] text-[var(--color-text-lo)]",
        )}
      >
        {events.length > 1
          ? `${events.length} drivers`
          : primary
            ? primary.person.name.split(" ")[0]
            : slotLabel}
      </span>

      {/* Assign / manage popover */}
      {isOpen && canWrite && (
        <div className="absolute bottom-full left-1/2 z-20 mb-3 w-64 -translate-x-1/2 rounded-[0.75rem] border border-[var(--color-accent)] bg-[var(--color-ink-1)] p-3 text-left shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-mid)]">
              {events.length ? `Manage ${slotLabel.toLowerCase()}` : `Assign ${slotLabel.toLowerCase()}`}
            </span>
            <button type="button" onClick={onToggleOpen} className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
              <X size={12} />
            </button>
          </div>

          {events.length > 0 && (
            <div className="mb-2 flex max-h-36 flex-col gap-1.5 overflow-y-auto">
              {events.map((e) => (
                <div key={e.id} className="flex items-center gap-2 rounded-[0.5rem] border border-[var(--color-line)] px-2 py-1.5">
                  <img
                    src={e.person.photoUrl || placeholderPhotoFor(e.person.id)}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                    style={{
                      boxShadow: e.person.isSubject
                        ? "0 0 0 1.5px #f87171"
                        : e.person.relationship === "cohabitant"
                          ? "0 0 0 1.5px #facc15"
                          : undefined,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.75rem] text-[var(--color-text-hi)]">{e.person.name}</div>
                    <div className="truncate font-mono text-[0.5625rem] text-[var(--color-text-lo)]">{fmtWhen(e.at)}</div>
                  </div>
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => onRemove(e.id)}
                    className="shrink-0 rounded-[0.375rem] p-1 text-[var(--color-text-lo)] hover:bg-[rgba(248,113,113,0.12)] hover:text-[var(--color-neg)]"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <select value={pickPersonId} onChange={(e) => setPickPersonId(e.target.value)} className={inputCls}>
            <option value="">{events.length ? "Add another…" : "Who was it?"}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isSubject ? " (subject)" : ""}
              </option>
            ))}
          </select>
          <input
            value={pickNote}
            onChange={(e) => setPickNote(e.target.value)}
            placeholder="Note (optional)"
            className={cn(inputCls, "mt-1.5")}
          />
          {assignError && <span className="mt-1.5 block text-[0.6875rem] text-[var(--color-neg)]">{assignError}</span>}
          <button
            type="button"
            onClick={() => onAssign(pickPersonId, pickNote)}
            disabled={assignBusy || !pickPersonId}
            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-[0.5rem] bg-[var(--color-accent-soft)] px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--color-text-hi)] disabled:opacity-40"
          >
            {assignBusy ? <Loader2 size={12} className="animate-spin" /> : events.length ? "Add" : "Assign"}
          </button>
          <span
            aria-hidden
            className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-[var(--color-accent)] bg-[var(--color-ink-1)]"
          />
        </div>
      )}
    </div>
  );
}

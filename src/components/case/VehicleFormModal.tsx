import { useEffect, useRef, useState } from "react";
import { Car, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  casesApi,
  ApiError,
  VEHICLE_SEAT_COUNTS,
  type CasePerson,
  type CaseVehicle,
  type VehicleKind,
} from "@/lib/crm-api";
import { useCasePhoto } from "@/hooks/useCasePhoto";

const ACCENT = "#34d399";

const KIND_META: { key: VehicleKind; label: string; hint: string }[] = [
  { key: "subject", label: "Household", hint: "Belongs to the subject or someone living there" },
  { key: "neighbor", label: "Neighbor's", hint: "Parked nearby, not tied to the household" },
  { key: "unknown", label: "Unknown", hint: "Not sure yet" },
];

/**
 * In-modal add/edit for a vehicle — same overlay pattern as AddPhotoPanel so we
 * never stack a second dialog on the vehicles shell.
 */
export function VehicleFormModal({
  caseId,
  vehicle,
  people,
  onClose,
  onSaved,
  onError,
}: {
  caseId: string;
  /** Present in edit mode; omitted when creating a new vehicle. */
  vehicle?: CaseVehicle;
  people: CasePerson[];
  onClose: () => void;
  onSaved: (vehicle: CaseVehicle) => void;
  onError: (msg: string) => void;
}) {
  const editing = !!vehicle;
  const [make, setMake] = useState(vehicle?.make ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [color, setColor] = useState(vehicle?.color ?? "");
  const [licensePlate, setLicensePlate] = useState(vehicle?.licensePlate ?? "");
  const [state, setState] = useState(vehicle?.state ?? "");
  const [seatCount, setSeatCount] = useState<number>(vehicle?.seatCount ?? 5);
  const [kind, setKind] = useState<VehicleKind>(vehicle?.kind ?? "subject");
  const [ownerId, setOwnerId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [passengerIds, setPassengerIds] = useState<string[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const existingPhoto = useCasePhoto(caseId, vehicle?.photoUrl ?? null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const takeFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      onError("Please choose a photo (image file).");
      return;
    }
    setFile(f);
  };

  const togglePassenger = (id: string) =>
    setPassengerIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = async () => {
    setBusy(true);
    try {
      let photoUrl: string | null | undefined = vehicle?.photoUrl ?? undefined;
      if (file) {
        const uploaded = await casesApi.uploadCapturePhoto(caseId, file);
        photoUrl = uploaded.url;
      }

      const payload = {
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        color: color.trim() || undefined,
        licensePlate: licensePlate.trim() || undefined,
        state: state.trim() || undefined,
        photoUrl,
        seatCount,
        kind,
      };

      const res = editing
        ? await casesApi.updateVehicle(caseId, vehicle!.id, payload)
        : await casesApi.addVehicle(caseId, payload);
      const savedVehicle = res.vehicle;

      if (ownerId) {
        await casesApi.linkPersonVehicle(caseId, ownerId, savedVehicle.id, "owner").catch(() => {});
      }
      if (driverId) {
        await casesApi.addVehicleEvent(caseId, savedVehicle.id, { personId: driverId, role: "driver" }).catch(() => {});
      }
      for (const pid of passengerIds) {
        await casesApi.addVehicleEvent(caseId, savedVehicle.id, { personId: pid, role: "passenger" }).catch(() => {});
      }

      onSaved(savedVehicle);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Could not save the vehicle.");
    } finally {
      setBusy(false);
    }
  };

  const pickable = people.filter((p) => p.id !== driverId);

  return (
    <div className="absolute inset-0 z-10 flex flex-col overflow-hidden bg-[var(--color-ink-1)] p-4">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div>
          <div className="text-[0.9375rem] font-semibold text-[var(--color-text-hi)]">{editing ? "Edit vehicle" : "Add a vehicle"}</div>
          <div className="text-[0.6875rem]" style={{ color: ACCENT }}>
            Photo, plate, and who's usually in it
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
          <X size={18} />
        </button>
      </div>

      {/* Top: landscape photo + paperwork side-by-side, filling the width */}
      <div className="flex shrink-0 gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            takeFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "aspect-[4/3] w-[min(100%,16.5rem)] shrink-0 cursor-pointer place-items-center overflow-hidden rounded-[0.875rem] border-2 border-dashed transition-colors grid",
            dragOver ? "bg-[rgba(52,211,153,0.1)]" : "bg-[var(--color-ink-3)]",
          )}
          style={{ borderColor: dragOver ? ACCENT : "var(--color-line-2)" }}
        >
          {preview || existingPhoto ? (
            <img src={preview ?? existingPhoto ?? undefined} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-3 text-center text-[var(--color-text-mid)]">
              <Upload size={22} strokeWidth={1.5} style={{ color: ACCENT }} />
              <div className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">Drop photo</div>
              <div className="text-[0.6875rem]">or tap to capture</div>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => takeFile(e.target.files?.[0])} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 py-0.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
            <TextField label="Make" value={make} onChange={setMake} placeholder="Honda" />
            <TextField label="Model" value={model} onChange={setModel} placeholder="Civic" />
            <TextField label="Color" value={color} onChange={setColor} placeholder="Gray" />
            <TextField label="Plate" value={licensePlate} onChange={setLicensePlate} placeholder="8ABC123" />
            <TextField label="State" value={state} onChange={setState} placeholder="CA" maxLength={2} />
          </div>

          <div className="flex flex-wrap items-start gap-x-5 gap-y-2.5">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Seats</span>
              <div className="flex gap-1.5">
                {VEHICLE_SEAT_COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSeatCount(n)}
                    className={cn(
                      "h-8 min-w-[2.25rem] rounded-[0.5rem] border px-2 text-[0.8125rem] font-semibold transition-colors",
                      seatCount === n
                        ? "border-[rgba(52,211,153,0.6)] bg-[rgba(52,211,153,0.18)] text-[var(--color-text-hi)]"
                        : "border-[var(--color-line-2)] text-[var(--color-text-mid)] hover:border-[var(--color-line-3)]",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Whose car</span>
              <div className="flex flex-wrap gap-1.5">
                {KIND_META.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => setKind(k.key)}
                    title={k.hint}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[0.75rem] transition-colors",
                      kind === k.key
                        ? "border-[rgba(52,211,153,0.6)] bg-[rgba(52,211,153,0.18)] text-[var(--color-text-hi)]"
                        : "border-[var(--color-line)] text-[var(--color-text-mid)] hover:border-[var(--color-line-2)]",
                    )}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Occupants — full width under the photo/fields row */}
      {people.length > 0 && (
        <div className="mt-3 min-h-0 flex-1 rounded-[0.875rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3.5 py-3">
          <div className="mb-2.5 text-[0.8125rem] font-medium text-[var(--color-text-hi)]">
            Who's usually in it? <span className="font-normal text-[var(--color-text-lo)]">(optional)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <div className="mb-1.5 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Owner</div>
              <PersonPills people={people} selectedId={ownerId} onSelect={(id) => setOwnerId(id === ownerId ? "" : id)} tone="rgba(250,204,21,0.5)" />
            </div>
            <div className="min-w-0">
              <div className="mb-1.5 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Driver</div>
              <PersonPills people={people} selectedId={driverId} onSelect={(id) => setDriverId(id === driverId ? "" : id)} tone="rgba(52,211,153,0.5)" />
            </div>
            <div className="min-w-0">
              <div className="mb-1.5 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Passengers</div>
              <div className="flex flex-wrap gap-1.5">
                {pickable.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePassenger(p.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[0.75rem] transition-colors",
                      passengerIds.includes(p.id)
                        ? "border-[rgba(96,165,250,0.6)] bg-[rgba(96,165,250,0.18)] text-[var(--color-text-hi)]"
                        : "border-[var(--color-line)] text-[var(--color-text-mid)] hover:border-[var(--color-line-2)]",
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex shrink-0 justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-[0.625rem] border border-[var(--color-line)] px-3.5 py-2 text-[0.8125rem] text-[var(--color-text-mid)]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-[0.625rem] px-4 py-2 text-[0.8125rem] font-semibold text-[#04120c] disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Car size={14} />}
          {editing ? "Save changes" : "Add vehicle"}
        </button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1.5 text-[0.8125rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent-soft)]"
      />
    </label>
  );
}

function PersonPills({
  people,
  selectedId,
  onSelect,
  tone,
  compact,
}: {
  people: CasePerson[];
  selectedId: string;
  onSelect: (id: string) => void;
  tone: string;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {people.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          style={selectedId === p.id ? { borderColor: tone, background: `${tone.slice(0, -4)}0.18)` } : undefined}
          className={cn(
            "rounded-full border transition-colors",
            compact ? "px-2 py-0.5 text-[0.6875rem]" : "px-3 py-1.5 text-[0.75rem]",
            selectedId === p.id ? "text-[var(--color-text-hi)]" : "border-[var(--color-line)] text-[var(--color-text-mid)] hover:border-[var(--color-line-2)]",
          )}
        >
          {compact ? p.name.split(" ")[0] : p.name}
        </button>
      ))}
    </div>
  );
}

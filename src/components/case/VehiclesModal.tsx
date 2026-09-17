import { useState } from "react";
import { Car, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CaseDetail, CaseVehicle, VehicleKind } from "@/lib/crm-api";
import { EntityModal, CasePhoto, DetailField } from "@/components/case/EntityModal";
import { SeatOccupancy } from "@/components/case/CaseVehiclesDrawer";
import { VehicleFormModal } from "@/components/case/VehicleFormModal";

const ACCENT = "#34d399";
const SOFT = "rgba(52,211,153,0.12)";

const KIND_LABEL: Record<VehicleKind, string> = {
  subject: "Household",
  neighbor: "Neighbor's",
  unknown: "Unknown owner",
};

const vehicleName = (v: CaseVehicle): string =>
  [v.year, v.color, v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle";

/**
 * Every vehicle around the case: pick one from the rail and its photo, paperwork
 * and seating chart fill the panel — no scrolling to get from the plate to the
 * chassis. Add/edit is an in-modal overlay (same as subject photo capture).
 */
export function VehiclesModal({
  caseId,
  kase,
  canWrite,
  onClose,
  onChanged,
  onError,
}: {
  caseId: string;
  kase: CaseDetail;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(kase.vehicles[0]?.id ?? null);
  const [form, setForm] = useState<"new" | "edit" | null>(null);

  const selected = kase.vehicles.find((v) => v.id === selectedId) ?? kase.vehicles[0] ?? null;
  const owner = selected?.personLinks?.find((l) => l.role === "owner");
  const driver = selected?.occupancyEvents?.find((e) => e.role === "driver");

  return (
    <EntityModal
      accent="rgba(52,211,153,0.45)"
      soft={SOFT}
      eyebrow={`Vehicles · ${kase.vehicles.length}`}
      title={selected ? vehicleName(selected) : "No vehicles yet"}
      subtitle={
        selected
          ? [selected.licensePlate ? `${selected.licensePlate}${selected.state ? ` (${selected.state})` : ""}` : "No plate", KIND_LABEL[selected.kind]]
              .filter(Boolean)
              .join(" · ")
          : "Add the first vehicle you see on the street"
      }
      hero={
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[0.75rem]" style={{ background: "rgba(52,211,153,0.25)", color: ACCENT }}>
          <Car size={20} strokeWidth={1.8} />
        </span>
      }
      onClose={onClose}
    >
      <div className="relative flex min-h-0 flex-1">
        {/* Vehicle rail */}
        <div className="flex w-[13.5rem] shrink-0 flex-col overflow-y-auto border-r border-[var(--color-line)] p-2">
          <button
            type="button"
            onClick={canWrite ? () => setForm("new") : undefined}
            disabled={!canWrite}
            title={canWrite ? "Add vehicle" : "Start the clock to add a vehicle"}
            className={cn(
              "mb-2 flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-[0.75rem] border-2 border-dashed transition-colors hover:bg-[rgba(52,211,153,0.06)]",
              !canWrite && "cursor-not-allowed opacity-40 grayscale hover:bg-transparent",
            )}
            style={{ borderColor: "rgba(52,211,153,0.5)", color: ACCENT }}
          >
            <Plus size={16} strokeWidth={2.2} />
            <span className="text-[0.75rem] font-medium">Add vehicle</span>
          </button>

          {kase.vehicles.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id)}
              className={cn(
                "mb-2 block w-full overflow-hidden rounded-[0.75rem] border text-left transition-colors",
                selected?.id === v.id ? "border-[rgba(52,211,153,0.6)]" : "border-[var(--color-line)] hover:border-[var(--color-line-2)]",
              )}
            >
              <CasePhoto caseId={caseId} photoUrl={v.photoUrl} className="aspect-[4/3] w-full" />
              <span className="block p-1.5">
                <span className="block truncate text-[0.75rem] font-medium text-[var(--color-text-hi)]">{vehicleName(v)}</span>
                <span className="mt-0.5 flex items-center justify-between gap-1">
                  <span className="truncate font-mono text-[0.5625rem] text-[var(--color-text-lo)]">{v.licensePlate || "No plate"}</span>
                  <span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                    {v.seatCount} seat
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>

        {!selected ? (
          <div className="grid flex-1 place-items-center px-6 text-center text-[0.8125rem] text-[var(--color-text-lo)]">
            Nothing logged yet. Use “Add vehicle” to photograph one and note the plate.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-4 p-4">
            {/* Photo + paperwork */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-hidden rounded-[1rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]">
                <CasePhoto caseId={caseId} photoUrl={selected.photoUrl} alt={vehicleName(selected)} className="h-full w-full" />
              </div>

              <div className="mt-3 grid shrink-0 grid-cols-3 gap-x-4 gap-y-2.5">
                <DetailField label="Plate" value={selected.licensePlate ? `${selected.licensePlate}${selected.state ? ` · ${selected.state}` : ""}` : "—"} />
                <DetailField label="Make / model" value={[selected.make, selected.model].filter(Boolean).join(" ")} />
                <DetailField label="Year / colour" value={[selected.year, selected.color].filter(Boolean).join(" · ")} />
                <DetailField label="Registered owner" value={selected.registeredOwner ?? owner?.person.name ?? null} />
                <DetailField label="Whose car" value={KIND_LABEL[selected.kind]} />
                <DetailField label="Last seen driving" value={driver?.person.name ?? "Not observed"} />
              </div>

              {selected.notes && (
                <p className="mt-2.5 shrink-0 text-[0.75rem] leading-relaxed text-[var(--color-text-mid)]">{selected.notes}</p>
              )}

              <button
                type="button"
                onClick={canWrite ? () => setForm("edit") : undefined}
                disabled={!canWrite}
                title={canWrite ? "Edit details & photo" : "Start the clock to edit"}
                className={cn(
                  "mt-3 inline-flex shrink-0 items-center gap-1.5 self-start rounded-[0.625rem] border border-[var(--color-line-2)] px-3 py-2 text-[0.75rem] text-[var(--color-text-mid)] hover:border-[var(--color-line-3)] hover:text-[var(--color-text-hi)]",
                  !canWrite && "cursor-not-allowed opacity-40 grayscale hover:border-[var(--color-line-2)] hover:text-[var(--color-text-mid)]",
                )}
              >
                <Pencil size={13} strokeWidth={1.8} />
                Edit details &amp; photo
              </button>
            </div>

            {/* Seating chart */}
            <div className="flex min-h-0 w-[21rem] shrink-0 flex-col rounded-[1rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] p-3">
              <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                <span className="font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">
                  Seat occupancy · {selected.seatCount}-seat
                </span>
                <span className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">
                  {canWrite ? "Tap a seat to assign" : "Read-only"}
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <SeatOccupancy
                  caseId={caseId}
                  vehicle={selected}
                  people={kase.people}
                  canWrite={canWrite}
                  onChanged={onChanged}
                  size="lg"
                  bare
                />
              </div>
            </div>
          </div>
        )}

        {form && (
          <VehicleFormModal
            caseId={caseId}
            vehicle={form === "edit" && selected ? selected : undefined}
            people={kase.people}
            onClose={() => setForm(null)}
            onSaved={(v) => {
              setForm(null);
              setSelectedId(v.id);
              onChanged();
            }}
            onError={onError}
          />
        )}
      </div>
    </EntityModal>
  );
}

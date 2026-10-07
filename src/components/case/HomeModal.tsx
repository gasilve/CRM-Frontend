import { useEffect, useMemo, useState } from "react";
import { Camera, Home, MapPin, Navigation } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { cn } from "@/lib/cn";
import { casesApi, ApiError, type CaseAddress, type CaseDetail } from "@/lib/crm-api";
import { AddPhotoPanel, EntityModal, PhotoLibraryPane, type EntityTab, type LibraryPhoto } from "@/components/case/EntityModal";

const pinIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Flies the map to a new center whenever the selected address changes. */
function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.75 });
  }, [lat, lng, map]);
  return null;
}

const directionsUrl = (a: CaseAddress) =>
  a.lat != null && a.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([a.line1, a.city, a.state, a.zip].filter(Boolean).join(" "))}`;

const ACCENT = "#60a5fa";
const SOFT = "rgba(96,165,250,0.12)";

type Tab = "photos" | "location";

/** The residence file: every exterior still we hold, plus the addresses on the case. */
export function HomeModal({
  caseId,
  kase,
  canCapture,
  onClose,
  onChanged,
  onError,
}: {
  caseId: string;
  kase: CaseDetail;
  canCapture: boolean;
  onClose: () => void;
  onChanged: () => void;
  onError?: (msg: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("photos");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);

  const photos = useMemo<LibraryPhoto[]>(
    () =>
      kase.days
        .flatMap((d) => d.entries)
        .filter((e) => e.type === "photo_home" && e.photoUrl)
        .map((e) => ({
          id: e.id,
          url: e.photoUrl as string,
          label: e.body ?? "Residence photo",
          when: e.createdAt,
          author: e.author?.name ?? null,
          source: "field" as const,
        })),
    [kase.days],
  );

  const primary = kase.addresses.find((a) => a.isPrimary) ?? kase.addresses[0] ?? null;
  const geocoded = kase.addresses.filter((a): a is CaseAddress & { lat: number; lng: number } => a.lat != null && a.lng != null);
  const selectedAddr = kase.addresses.find((a) => a.id === selectedAddrId) ?? primary;
  const flyTarget = geocoded.find((a) => a.id === selectedAddr?.id) ?? geocoded[0] ?? null;

  const savePhoto = async (file: File, note: string) => {
    setBusy(true);
    try {
      const uploaded = await casesApi.uploadCapturePhoto(caseId, file);
      await casesApi.addDayEntry(caseId, {
        date: new Date().toISOString().slice(0, 10),
        type: "photo_home",
        body: note || "Residence photo",
        photoUrl: uploaded.url,
      });
      setAdding(false);
      onChanged();
    } catch (err) {
      onError?.(err instanceof ApiError ? err.message : "Could not save the photo.");
    } finally {
      setBusy(false);
    }
  };

  const tabs: EntityTab[] = [
    { key: "photos", label: "Photos", icon: Camera, badge: photos.length },
    { key: "location", label: "Addresses", icon: MapPin, badge: kase.addresses.length },
  ];

  return (
    <EntityModal
      accent="rgba(96,165,250,0.45)"
      soft={SOFT}
      eyebrow="Residence"
      title={primary ? primary.line1 : "No address on file"}
      subtitle={primary ? [primary.city, primary.state, primary.zip].filter(Boolean).join(", ") : undefined}
      hero={
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[0.75rem]" style={{ background: "rgba(96,165,250,0.25)", color: ACCENT }}>
          <Home size={20} strokeWidth={1.8} />
        </span>
      }
      tabs={tabs}
      activeTab={tab}
      onTabChange={(k) => setTab(k as Tab)}
      onClose={onClose}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        {tab === "photos" ? (
          <PhotoLibraryPane
            caseId={caseId}
            photos={photos}
            accent={ACCENT}
            canAdd={canCapture}
            onAdd={() => setAdding(true)}
            emptyHint="No residence stills yet — shoot the front, the driveway, and any side access."
          />
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Addresses — click one to fly the map to it */}
            <div className="w-[19rem] shrink-0 overflow-y-auto border-r border-[var(--color-line)] p-3">
              <div className="flex flex-col gap-2">
                {kase.addresses.map((a) => {
                  const on = (selectedAddr?.id ?? primary?.id) === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedAddrId(a.id)}
                      className={cn(
                        "rounded-[0.875rem] border p-3 text-left transition-colors",
                        on ? "border-[rgba(96,165,250,0.55)] bg-[rgba(96,165,250,0.1)]" : "border-[var(--color-line)] hover:border-[var(--color-line-2)]",
                      )}
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <MapPin size={13} className={on ? "" : "text-[var(--color-text-lo)]"} style={on ? { color: ACCENT } : undefined} />
                        <span className="min-w-0 flex-1 truncate text-[0.875rem] text-[var(--color-text-hi)]">{a.line1}</span>
                        {a.isPrimary && (
                          <span className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-wider" style={{ background: SOFT, color: ACCENT }}>
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[0.75rem] text-[var(--color-text-mid)]">
                        {[a.city, a.state, a.zip].filter(Boolean).join(", ") || "No city/state on file"}
                      </div>
                      {a.lat == null && <div className="mt-1 font-mono text-[0.625rem] text-[var(--color-text-lo)]">Not geocoded — directions use the address text</div>}
                      <a
                        href={directionsUrl(a)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line-2)] px-2.5 py-1.5 text-[0.75rem] font-medium text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-3)] hover:text-[var(--color-text-hi)]"
                      >
                        <Navigation size={12} strokeWidth={1.9} />
                        Get directions
                      </a>
                    </button>
                  );
                })}
                {kase.addresses.length === 0 && (
                  <p className="text-[0.8125rem] text-[var(--color-text-lo)]">No addresses on this case yet.</p>
                )}
              </div>
            </div>

            {/* Map */}
            <div className="min-h-0 flex-1 p-3">
              {flyTarget ? (
                <div className="h-full overflow-hidden rounded-[0.875rem] border border-[var(--color-line-2)]">
                  <MapContainer center={[flyTarget.lat, flyTarget.lng]} zoom={15} scrollWheelZoom className="h-full w-full">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {geocoded.map((a) => (
                      <Marker key={a.id} position={[a.lat, a.lng]} icon={pinIcon}>
                        <Popup>
                          {a.line1}
                          {a.city ? `, ${a.city}` : ""} {a.state ?? ""}
                        </Popup>
                      </Marker>
                    ))}
                    <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />
                  </MapContainer>
                </div>
              ) : (
                <div className="grid h-full place-items-center rounded-[0.875rem] border border-dashed border-[var(--color-line-2)] bg-[var(--color-ink-3)]">
                  <span className="font-mono text-[0.75rem] text-[var(--color-text-lo)]">No geocoded address yet</span>
                </div>
              )}
            </div>
          </div>
        )}

        {adding && (
          <AddPhotoPanel
            accent={ACCENT}
            title="Add a residence photo"
            hint="Front, driveway, side access — whatever helps the next investigator find it."
            busy={busy}
            onSubmit={(file, note) => void savePhoto(file, note)}
            onCancel={() => setAdding(false)}
          />
        )}
      </div>
    </EntityModal>
  );
}

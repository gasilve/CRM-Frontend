import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { CaseAddress, StakeoutPosition } from "@/lib/crm-api";

const STAKEOUT_COLOR = { proposed: "#ffc857", actual: "#3ee08a", nogo: "#ff5c63" } as const;

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitFrame() {
  const map = useMap();
  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(frame);
  }, [map]);
  return null;
}

function FlyToFocus({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.35 });
  }, [lat, lng, map]);
  return null;
}

/** Zooms in on the house and its stakeout spots: at city zoom they sit on top of each other. */
function FitStakeout({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 17 });
    // Refit only when the spots change.
  }, [key, map]);
  return null;
}

export function CaseMap({
  addresses,
  focusAddressId,
  frameClassName,
  stakeouts,
  suggestions,
  fitToStakeout = false,
}: {
  addresses: CaseAddress[];
  /** When set, the map flies to this geocoded address. */
  focusAddressId?: string | null;
  frameClassName?: string;
  /** Saved stakeout spots, drawn as small dots coloured by status. */
  stakeouts?: StakeoutPosition[];
  /** Planner suggestions, drawn as small blue dots. */
  suggestions?: { lat: number; lng: number; score: number }[];
  /** Frame the house and the stakeout spots instead of the whole city. */
  fitToStakeout?: boolean;
}) {
  const pinned = addresses.filter((a): a is CaseAddress & { lat: number; lng: number } => a.lat != null && a.lng != null);

  if (pinned.length === 0) {
    return (
      <div className={`grid h-full min-h-[9rem] place-items-center rounded-[0.625rem] border border-dashed border-[var(--color-line-2)] bg-[var(--color-ink-3)] ${frameClassName ?? ""}`}>
        <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">No geocoded address yet</span>
      </div>
    );
  }

  const primary = pinned.find((a) => a.isPrimary) ?? pinned[0];
  const focus = focusAddressId ? pinned.find((a) => a.id === focusAddressId) : null;

  return (
    <div className={`h-full min-h-[9rem] overflow-hidden rounded-[0.625rem] border border-[var(--color-line-2)] ${frameClassName ?? ""}`}>
      <MapContainer
        center={[primary.lat, primary.lng]}
        zoom={13}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitFrame />
        <ZoomControl position="topright" />
        {focus && <FlyToFocus lat={focus.lat} lng={focus.lng} />}
        {pinned.map((a) => (
          <Marker key={a.id} position={[a.lat, a.lng]} icon={defaultIcon}>
            <Popup>
              {a.line1}
              {a.city ? `, ${a.city}` : ""} {a.state ?? ""}
            </Popup>
          </Marker>
        ))}
        {fitToStakeout && (
          <FitStakeout
            points={[
              [primary.lat, primary.lng],
              ...(stakeouts ?? []).map((s): [number, number] => [s.lat, s.lng]),
              ...(suggestions ?? []).map((s): [number, number] => [s.lat, s.lng]),
            ]}
          />
        )}
        {suggestions?.map((s, i) => (
          <CircleMarker
            key={`suggestion-${s.lat},${s.lng}`}
            center={[s.lat, s.lng]}
            radius={5}
            pathOptions={{ color: "#0a0d16", weight: 1.5, fillColor: "#5aa9ff", fillOpacity: 0.95 }}
          >
            <Tooltip>
              Suggested spot {i + 1} · {s.score}/100
            </Tooltip>
          </CircleMarker>
        ))}
        {stakeouts?.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={6}
            pathOptions={{ color: "#0a0d16", weight: 2, fillColor: STAKEOUT_COLOR[s.status], fillOpacity: 1 }}
          >
            <Tooltip>
              {s.label}
              {s.score != null ? ` · ${s.score}/100` : ""}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { CaseAddress } from "@/lib/crm-api";

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FlyToFocus({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.35 });
  }, [lat, lng, map]);
  return null;
}

export function CaseMap({
  addresses,
  focusAddressId,
}: {
  addresses: CaseAddress[];
  /** When set, the map flies to this geocoded address. */
  focusAddressId?: string | null;
}) {
  const pinned = addresses.filter((a): a is CaseAddress & { lat: number; lng: number } => a.lat != null && a.lng != null);

  if (pinned.length === 0) {
    return (
      <div className="grid h-full min-h-[9rem] place-items-center rounded-[0.625rem] border border-dashed border-[var(--color-line-2)] bg-[var(--color-ink-3)]">
        <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">No geocoded address yet</span>
      </div>
    );
  }

  const primary = pinned.find((a) => a.isPrimary) ?? pinned[0];
  const focus = focusAddressId ? pinned.find((a) => a.id === focusAddressId) : null;

  return (
    <div className="h-full min-h-[9rem] overflow-hidden rounded-[0.625rem] border border-[var(--color-line-2)]">
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
      </MapContainer>
    </div>
  );
}

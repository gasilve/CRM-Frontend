import { useEffect } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { MedicalFacility } from "@/components/cases/medical/mock-data";

const pin = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const centerPin = L.divIcon({
  className: "sky-medical-map-center",
  html: `<span style="display:block;width:12px;height:12px;border-radius:50%;background:#f472b6;border:2px solid #fff;box-shadow:0 0 0 2px rgba(244,114,182,.45)"></span>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function Fit({
  center,
  radiusMi,
  facilities,
}: {
  center: { lat: number; lng: number };
  radiusMi: number;
  facilities: MedicalFacility[];
}) {
  const map = useMap();
  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(frame);
  }, [map]);

  useEffect(() => {
    const points: [number, number][] = [[center.lat, center.lng], ...facilities.map((f) => [f.lat, f.lng] as [number, number])];
    if (points.length === 1) {
      map.setView(points[0], 11);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 12 });
  }, [map, center.lat, center.lng, radiusMi, facilities]);

  return null;
}

export function MedicalCanvassMap({
  center,
  radiusMi,
  facilities,
}: {
  center: { lat: number; lng: number };
  radiusMi: number;
  facilities: MedicalFacility[];
}) {
  return (
    <div className="sky-medical-map">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={11}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", borderRadius: 14 }}
      >
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Fit center={center} radiusMi={radiusMi} facilities={facilities} />
        <Circle
          center={[center.lat, center.lng]}
          radius={radiusMi * 1609.34}
          pathOptions={{ color: "#f472b6", weight: 1.5, fillColor: "#f472b6", fillOpacity: 0.08 }}
        />
        <Marker position={[center.lat, center.lng]} icon={centerPin}>
          <Popup>Search center</Popup>
        </Marker>
        {facilities.map((f) => (
          <Marker key={f.id} position={[f.lat, f.lng]} icon={pin}>
            <Popup>
              <strong>{f.name}</strong>
              <br />
              {f.address}
              <br />
              {f.phone} · {f.distance_mi.toFixed(1)} mi
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <p className="sky-medical-map__cap">
        Pink circle ≈ {radiusMi} mi (product: driving / road distance; map ring is as-crow-flies preview)
      </p>
    </div>
  );
}

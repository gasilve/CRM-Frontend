import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useWidgetNavigate } from "@/lib/widget-bridge";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { MapPin } from "lucide-react";
import { casesApi, REGION_LABELS, type Region } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { WidgetHero, WidgetMedia } from "@/components/widgets/WidgetChrome";
import { Pill, WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [22, 36],
  iconAnchor: [11, 36],
  popupAnchor: [1, -30],
  shadowSize: [36, 36],
});

const REGION_CENTER: Record<Region, [number, number]> = {
  ca: [36.7783, -119.4179],
  tristate: [40.7128, -74.006],
  texas: [31.9686, -99.9018],
};

export function RegionalCaseMap() {
  const { density } = useWidgetLayout();
  const navigate = useWidgetNavigate();
  const [regionFilter, setRegionFilter] = useState<Region | "all">("all");

  const { data: summary, loading: sLoading, error: sError } = useQuery("dashboard:cases-summary", () => casesApi.summary(), {
    staleMs: 30_000,
  });
  const { data: list, loading: lLoading } = useQuery(
    "dashboard:cases-map-list",
    () => casesApi.list({ status: "open", pageSize: 80, sortBy: "dueDate", sortDir: "asc" }),
    { staleMs: 30_000, enabled: density !== "dense" },
  );

  const pins = useMemo(() => {
    const cases = list?.cases ?? [];
    const out: { case: (typeof cases)[number]; lat: number; lng: number }[] = [];
    for (const c of cases) {
      if (regionFilter !== "all" && c.region !== regionFilter) continue;
      const addr = c.addresses.find((a) => a.isPrimary) ?? c.addresses[0];
      if (addr?.lat == null || addr?.lng == null) continue;
      out.push({ case: c, lat: addr.lat, lng: addr.lng });
    }
    return out;
  }, [list, regionFilter]);

  const byRegion = (summary?.byRegion ?? []).filter((r) => r.region);
  const center: [number, number] = regionFilter !== "all" ? REGION_CENTER[regionFilter] : [37.5, -96];

  return (
    <WidgetShell title="Regional Case Map" icon={MapPin} eyebrow="Coverage" padded={density === "dense"} scroll={false}>
      {sLoading && !summary ? (
        <WidgetLoading />
      ) : sError || !summary ? (
        <WidgetErrorState />
      ) : density === "dense" ? (
        <WidgetHero>
          <div className="flex flex-wrap items-center gap-1.5">
            {byRegion.length === 0 ? (
              <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">No open cases.</span>
            ) : (
              byRegion.map((r) => (
                <Pill key={r.region} color="#38bdf8">
                  {r.region ? REGION_LABELS[r.region] : "Unassigned"} · {r.count}
                </Pill>
              ))
            )}
          </div>
        </WidgetHero>
      ) : lLoading && !list ? (
        <WidgetLoading />
      ) : pins.length === 0 ? (
        <WidgetEmpty icon={MapPin} label="No geocoded open cases." />
      ) : (
        <WidgetMedia>
          <div className="absolute right-2 top-2 z-[500] flex flex-wrap justify-end gap-1 rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-2)]/92 p-1.5 shadow-lg backdrop-blur">
            {(["all", "ca", "tristate", "texas"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegionFilter(r)}
                className={`rounded-[0.5rem] px-2.5 py-1.5 font-mono text-[0.625rem] uppercase tracking-wider transition-colors ${
                  regionFilter === r
                    ? "bg-[var(--color-accent)] text-[var(--color-ink-1)]"
                    : "text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]"
                }`}
              >
                {r === "all" ? "All" : r === "ca" ? "CA" : r === "texas" ? "TX" : "Tri-State"}
              </button>
            ))}
          </div>
          <MapContainer
            key={regionFilter}
            center={center}
            zoom={regionFilter !== "all" ? 6 : 4}
            scrollWheelZoom
            dragging
            zoomControl
            doubleClickZoom
            touchZoom
            className="h-full w-full"
          >
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {pins.map(({ case: c, lat, lng }) => (
              <Marker
                key={c.id}
                position={[lat, lng]}
                icon={defaultIcon}
                eventHandlers={{ click: () => navigate(`/cases/${c.id}`) }}
              >
                <Popup>
                  <div className="text-[0.75rem]">
                    <div className="font-medium">{c.subjectName}</div>
                    <div className="text-[var(--color-text-lo)]">
                      {c.caseNumber} · {c.priority}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </WidgetMedia>
      )}
    </WidgetShell>
  );
}


import { useEffect, useRef, useState } from "react";

interface ObsPoint {
  lat: number; lng: number; label: string;
  direction: string; advantages: string[];
  type: "parking_lot" | "street_corner" | "parallel_street" | "business" | "custom";
  distance_m: number;
  risk: "low" | "medium" | "high";
  source: "calculated" | "places_api" | "manual";
  place_name?: string;
}

interface Props {
  addresses: string[];
  subjectName: string;
  investigationId?: number;
  canvassFacilities?: Array<{ id:string; name:string; address:string; city:string; state:string; phone:string; type:string; status:string; lat?:number; lng?:number }>;
  canvassRadius?: number;
  canvassMode?: boolean;
}

// Realistic offsets — 150-300m, not symmetric, based on PI best practices
// Angles avoid direct front/back — always use diagonal or parallel positions
const CALC_OFFSETS = [
  {
    dir: "NE", dlat: 0.0013, dlng: 0.0018,
    type: "street_corner" as const,
    risk: "low" as const,
    advantages: [
      "Diagonal angle — subject won't notice straight on",
      "Clear view of front door and driveway",
      "Two exit routes: N or E",
      "Sun behind you in morning surveillance",
    ],
    notes: "Park 50-100ft past the corner. Don't block fire hydrants."
  },
  {
    dir: "SW", dlat:-0.0013, dlng:-0.0018,
    type: "parking_lot" as const,
    risk: "low" as const,
    advantages: [
      "Least expected surveillance position",
      "Covers south and west exits",
      "Residential area — blends with neighborhood traffic",
      "Good afternoon light for photography",
    ],
    notes: "Look for strip mall or church parking. Stay 2+ spots from entrance."
  },
  {
    dir: "N-parallel", dlat: 0.0000, dlng: 0.0020,
    type: "parallel_street" as const,
    risk: "medium" as const,
    advantages: [
      "Parallel street — not in direct line of sight",
      "Monitor side/rear entrance",
      "Less visible from subject's front windows",
      "Can reposition quickly",
    ],
    notes: "Look for residential parking. Avoid street cleaning zones."
  },
  {
    dir: "SE", dlat:-0.0008, dlng: 0.0018,
    type: "street_corner" as const,
    risk: "low" as const,
    advantages: [
      "Covers main exit and driveway",
      "Natural traffic flow — vehicles expected here",
      "Corner position allows wide angle view",
      "Quick exit onto main road",
    ],
    notes: "Best for morning surveillance when subject leaves for work."
  },
  {
    dir: "NW", dlat: 0.0013, dlng:-0.0018,
    type: "parking_lot" as const,
    risk: "medium" as const,
    advantages: [
      "Covers north and west exits",
      "Good backup position if primary is occupied",
      "Commercial area likely nearby",
    ],
    notes: "Check for pharmacy, grocery store parking nearby."
  },
  {
    dir: "E-parallel", dlat:-0.0004, dlng: 0.0026,
    type: "parallel_street" as const,
    risk: "low" as const,
    advantages: [
      "Two blocks east — very low detection risk",
      "Cover secondary addresses or employer commute route",
      "Mobile surveillance starting point",
    ],
    notes: "Use if subject has been surveillance-aware in prior cases."
  },
];

const TYPE_ICON: Record<string, string> = {
  parking_lot: "🅿️", street_corner: "🚗", parallel_street: "🔭", business: "🏪", custom: "📍"
};
const RISK_COLOR: Record<string, string> = {
  low: "#10b981", medium: "#f59e0b", high: "#ef4444"
};

function geoCache() {
  try { return JSON.parse(localStorage.getItem("accenty-geo-v1") || "{}"); } catch { return {}; }
}

async function geocodeFromBrowser(address: string, investigationId?: number) {
  const key = address.toLowerCase().trim();
  const cached = geoCache()[key];
  if (cached) return cached;
  const base = typeof window !== "undefined"
    ? (!["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000")
    : "";
  try {
    const r = await fetch(`${base}/api/investigations/${investigationId||0}/geocode?address=${encodeURIComponent(address)}`,
      { credentials: "include" });
    if (r.ok) {
      const d = await r.json();
      if (d.lat && d.lng) {
        const result = { lat: d.lat, lng: d.lng };
        const c = geoCache(); c[key] = result;
        try { localStorage.setItem("accenty-geo-v1", JSON.stringify(c)); } catch {}
        return result;
      }
    }
  } catch {}
  return null;
}

async function fetchNearbyPlaces(lat: number, lng: number, apiKey: string): Promise<ObsPoint[]> {
  // Google Places API — search for parking lots and businesses near the address
  const types = ["parking", "shopping_mall", "pharmacy", "supermarket", "church"];
  const radius = 400; // 400m radius
  const results: ObsPoint[] = [];

  for (const type of types.slice(0, 2)) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`
        + `?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const d = await r.json();
      for (const place of (d.results || []).slice(0, 2)) {
        const plat = place.geometry?.location?.lat;
        const plng = place.geometry?.location?.lng;
        if (!plat || !plng) continue;
        const dist = Math.round(Math.sqrt(
          Math.pow((plat - lat) * 111000, 2) +
          Math.pow((plng - lng) * 111000 * Math.cos(lat * Math.PI / 180), 2)
        ));
        results.push({
          lat: plat, lng: plng,
          label: place.name,
          direction: "",
          advantages: [
            `${place.name} — ${dist}m from subject`,
            type === "parking" ? "Designated parking — natural cover" : "Business parking — blend with customers",
            place.opening_hours?.open_now ? "Currently open" : "Check hours before use",
          ],
          type: type === "parking" ? "parking_lot" : "business",
          distance_m: dist,
          risk: dist > 300 ? "medium" : "low",
          source: "places_api",
          place_name: place.name,
        });
      }
    } catch {}
  }
  return results;
}

function loadLeaflet(): Promise<any> {
  return new Promise(resolve => {
    if ((window as any).L) { resolve((window as any).L); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve((window as any).L);
    document.head.appendChild(s);
  });
}

function distMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  return Math.round(Math.sqrt(
    Math.pow((lat2 - lat1) * 111000, 2) +
    Math.pow((lng2 - lng1) * 111000 * Math.cos(lat1 * Math.PI / 180), 2)
  ));
}

export function InvestigationMap({ addresses, subjectName, investigationId, canvassFacilities, canvassRadius, canvassMode }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null);
  const mapObj    = useRef<any>(null);
  const [coords,   setCoords]   = useState<{lat:number;lng:number}|null>(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<ObsPoint|null>(null);
  const [showObs,  setShowObs]  = useState(false);
  const [obsPoints, setObsPoints] = useState<ObsPoint[]>([]);
  const [placesKey, setPlacesKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const markersRef = useRef<any[]>([]);
  const canvassMarkersRef = useRef<any[]>([]);
  const canvassCircleRef  = useRef<any>(null);

  // Geocode on mount
  useEffect(() => {
    if (!addresses.length) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      for (const addr of addresses.slice(0, 3)) {
        const c = await geocodeFromBrowser(addr, investigationId);
        if (cancelled) return;
        if (c) { setCoords(c); setLoading(false); return; }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [addresses.join("|")]);

  // Build calculated obs points when coords available
  useEffect(() => {
    if (!coords) return;
    const pts: ObsPoint[] = CALC_OFFSETS.map(off => ({
      lat: coords.lat + off.dlat,
      lng: coords.lng + off.dlng,
      label: off.dir,
      direction: off.dir,
      advantages: off.advantages,
      type: off.type,
      distance_m: distMeters(coords.lat, coords.lng, coords.lat + off.dlat, coords.lng + off.dlng),
      risk: off.risk,
      source: "calculated" as const,
    }));
    setObsPoints(pts);
  }, [coords]);

  // Load Places API points
  async function loadPlaces() {
    if (!coords || !placesKey.trim()) return;
    setLoadingPlaces(true);
    try {
      const places = await fetchNearbyPlaces(coords.lat, coords.lng, placesKey.trim());
      setObsPoints(prev => {
        const existing = prev.filter(p => p.source === "calculated");
        return [...existing, ...places];
      });
    } finally {
      setLoadingPlaces(false);
    }
  }

  // Render map
  useEffect(() => {
    if (!coords || !mapRef.current) return;
    let cancelled = false;

    loadLeaflet().then(L => {
      if (cancelled || !mapRef.current) return;
      if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; }
      markersRef.current = [];

      const map = L.map(mapRef.current, {
        center: [coords.lat, coords.lng], zoom: 16, zoomControl: true
      });
      mapObj.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);

      // Subject marker — red pin
      const subjectIcon = L.divIcon({
        className: "",
        html: `<div style="position:relative;width:24px;height:24px">
          <div style="width:24px;height:24px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>
          <div style="position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #ef4444"></div>
        </div>`,
        iconAnchor: [12, 28],
      });

      L.marker([coords.lat, coords.lng], { icon: subjectIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindTooltip(`<div style="font-size:12px;font-weight:600">${subjectName}</div><div style="font-size:10px;color:#666">${addresses[0]}</div><div style="font-size:10px;color:#3b82f6;margin-top:3px">Click → Street View</div>`, { permanent: false })
        .on("click", () => window.open(`https://www.google.com/maps?layer=c&cbll=${coords.lat},${coords.lng}`, "_blank"));

      // Secondary address markers
      addresses.slice(1).forEach(addr => {
        geocodeFromBrowser(addr, investigationId).then(c2 => {
          if (!c2 || !mapObj.current) return;
          const icon2 = L.divIcon({
            className: "",
            html: `<div style="width:14px;height:14px;background:#f97316;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
            iconAnchor: [7, 7],
          });
          L.marker([c2.lat, c2.lng], { icon: icon2 })
            .addTo(mapObj.current)
            .bindTooltip(`<div style="font-size:11px">${addr}</div>`)
            .on("click", () => window.open(`https://www.google.com/maps?layer=c&cbll=${c2.lat},${c2.lng}`, "_blank"));
        });
      });

      // Observation point markers
      if (showObs) {
        // 100m radius circle around subject
        L.circle([coords.lat, coords.lng], {
          radius: 100, color: "#ef4444", fillColor: "#ef4444",
          fillOpacity: 0.05, weight: 1, dashArray: "4,4"
        }).addTo(map);

        obsPoints.forEach(pt => {
          const color = RISK_COLOR[pt.risk];
          const isPlaces = pt.source === "places_api";
          const icon = L.divIcon({
            className: "",
            html: `<div style="position:relative;text-align:center">
              <div style="width:${isPlaces?22:18}px;height:${isPlaces?22:18}px;background:${color};border:2px solid white;border-radius:${isPlaces?"4px":"50%"};box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:10px">
                ${isPlaces ? "🅿" : ""}
              </div>
              <div style="font-size:9px;color:${color};font-weight:700;white-space:nowrap;text-shadow:0 0 3px white;margin-top:1px">${pt.direction||"P"}</div>
            </div>`,
            iconAnchor: [10, 10],
          });
          const m = L.marker([pt.lat, pt.lng], { icon })
            .addTo(map)
            .bindTooltip(`<div style="font-size:11px;font-weight:600">${pt.place_name || pt.label}</div><div style="font-size:10px;color:#666">${pt.distance_m}m · Risk: ${pt.risk}</div>`)
            .on("click", () => setSelected(pt));
          markersRef.current.push(m);

          // Line from subject to obs point
          L.polyline([[coords.lat, coords.lng], [pt.lat, pt.lng]], {
            color, weight: 1, opacity: 0.3, dashArray: "3,5"
          }).addTo(map);
        });
      }

    });

    return () => { cancelled = true; if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; } };
  }, [coords, showObs, obsPoints]);

  // ── Separate effect: canvass facility markers (redraws without rebuilding map) ──
  useEffect(() => {
    if (!mapObj.current || !coords) return;
    let cancelled = false;
    loadLeaflet().then(L => {
      if (cancelled || !mapObj.current) return;
      // Clear previous canvass markers
      canvassMarkersRef.current.forEach(m => { try { mapObj.current.removeLayer(m); } catch(_){} });
      canvassMarkersRef.current = [];
      if (canvassCircleRef.current) { try { mapObj.current.removeLayer(canvassCircleRef.current); } catch(_){} }

      if (!canvassFacilities || canvassFacilities.length === 0) return;

      const FAC_COLORS: Record<string,string> = {
        hospital:'#e5484d', urgent_care:'#f76b15', pharmacy:'#1a9a6c',
        chiropractor:'#8b5cf6', primary_care:'#0ea5e9', orthopedic:'#f59e0b',
        physical_therapy:'#14b8a6', other:'#6b7280',
      };

      // Radius circle
      if (canvassRadius) {
        const circle = L.circle([coords.lat, coords.lng], {
          radius: canvassRadius * 1609.34,
          color: '#ff6a1a', fillColor: '#ff6a1a', fillOpacity: 0.04, weight: 1.5, dashArray: '5,6'
        }).addTo(mapObj.current);
        canvassCircleRef.current = circle;
        mapObj.current.fitBounds(circle.getBounds().pad(0.1));
      }

      // Facility markers — use lat/lng from cache directly (no geocoding needed)
      canvassFacilities.forEach((fac: any) => {
        const color = FAC_COLORS[fac.type] || '#6b7280';
        const isRecord = fac.status === 'with_record';

        const addMarker = (lat: number, lng: number) => {
          if (cancelled || !mapObj.current) return;
          const icon = L.divIcon({
            className: '',
            html: isRecord
              ? `<div style="width:16px;height:16px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.5)"><div style="width:5px;height:5px;background:white;border-radius:50%;margin:3px auto"></div></div>`
              : `<div style="width:10px;height:10px;background:${color};border:2px solid rgba(255,255,255,0.7);border-radius:50%;opacity:0.7;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
            iconAnchor: [isRecord?8:5, isRecord?8:5],
          });
          const marker = L.marker([lat, lng], { icon })
            .addTo(mapObj.current)
            .bindTooltip(
              `<div style="font-size:11px;font-weight:600">${fac.name}</div>`+
              `<div style="font-size:10px;color:#666">${fac.address||''} ${fac.city||''}</div>`+
              `<div style="font-size:10px;color:#888">${fac.phone||''}</div>`+
              (isRecord?`<div style="font-size:10px;color:#16a34a;font-weight:600">✓ Record</div>`:''),
              {permanent:false, direction:'top'}
            );
          canvassMarkersRef.current.push(marker);
        };

        // Use lat/lng from API response if available (stored in cache)
        if (fac.lat && fac.lng && fac.lat !== 0 && fac.lng !== 0) {
          addMarker(fac.lat, fac.lng);
        } else {
          // Fallback: geocode from address
          const fullAddr = [fac.address, fac.city, fac.state].filter(Boolean).join(', ').toLowerCase();
          geocodeFromBrowser(fullAddr, investigationId || 1).then(c => {
            if (c) addMarker(c.lat, c.lng);
          });
        }
      });
    });
    return () => { cancelled = true; };
  }, [coords, canvassFacilities, canvassRadius]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f1f5f9", borderRadius: 6 }}>
      <span style={{ fontSize: 11, color: "#94a3b8" }} className="animate-pulse">Loading map…</span>
    </div>
  );

  if (!coords) return (
    <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", background: "#f8fafc", borderRadius: 6, gap: 8 }}>
      <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", padding: "0 16px" }}>
        {addresses[0] || "No address"}
      </span>
      <a href={`https://www.google.com/maps/search/${encodeURIComponent(addresses[0] || "")}`}
        target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 11, color: "#3b82f6" }}>
        Open in Google Maps →
      </a>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Map */}
      <div style={{ position: "relative", height: 260 }}>
        <div ref={mapRef} style={{ height: "100%", width: "100%" }} />

        {/* Controls — hidden in canvass mode */}
        {!canvassMode && (
        <>
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 1000, display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => setShowObs(v => !v)}
            style={{ fontSize: 10, fontWeight: 600, padding: "5px 10px", borderRadius: 6,
              background: showObs ? "#f59e0b" : "white", color: showObs ? "white" : "#374151",
              border: "1px solid " + (showObs ? "#f59e0b" : "#e5e7eb"),
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)", cursor: "pointer", whiteSpace: "nowrap" }}>
            👁 {showObs ? "Hide" : "Obs. points"}
          </button>

          <a href={`https://www.google.com/maps/search/${encodeURIComponent(addresses[0] || "")}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 10, fontWeight: 600, padding: "5px 10px", borderRadius: 6,
              background: "white", color: "#374151", border: "1px solid #e5e7eb",
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)", textDecoration: "none", textAlign: "center" }}>
            🗺 Google Maps
          </a>

          <a href={`https://www.google.com/maps?layer=c&cbll=${coords.lat},${coords.lng}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 10, fontWeight: 600, padding: "5px 10px", borderRadius: 6,
              background: "white", color: "#374151", border: "1px solid #e5e7eb",
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)", textDecoration: "none", textAlign: "center" }}>
            📷 Street View
          </a>
        </div>

        {/* Legend */}
        {showObs && (
          <div style={{ position: "absolute", top: 8, left: 8, zIndex: 1000,
            background: "rgba(255,255,255,0.92)", borderRadius: 6, padding: "6px 8px",
            fontSize: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
            <p style={{ fontWeight: 700, margin: "0 0 4px", color: "#374151" }}>Risk level</p>
            {[["low","#10b981","Low risk"],["medium","#f59e0b","Medium"],["high","#ef4444","High"]].map(([r,c,l]) => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c as string }} />
                <span style={{ color: "#64748b" }}>{l}</span>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {/* Obs points panel */}
      {showObs && (
        <div style={{ border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 8px 8px",
          background: "#f8fafc", padding: "10px 12px" }}>

          {/* Places API section */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
              {obsPoints.filter(p => p.source === "places_api").length > 0
                ? `✅ ${obsPoints.filter(p => p.source === "places_api").length} real parking/businesses loaded`
                : "📍 Calculated positions only"}
            </span>
            <div style={{ flex: 1 }} />
            {!showKeyInput ? (
              <button onClick={() => setShowKeyInput(true)}
                style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, cursor: "pointer",
                  background: "#6366f1", color: "white", border: "none" }}>
                🏪 Load real places
              </button>
            ) : (
              <div style={{ display: "flex", gap: 4 }}>
                <input value={placesKey} onChange={e => setPlacesKey(e.target.value)}
                  placeholder="Google Places API key"
                  type="password"
                  style={{ fontSize: 11, padding: "4px 8px", border: "1px solid #e2e8f0",
                    borderRadius: 5, width: 180, outline: "none" }} />
                <button onClick={() => { loadPlaces(); setShowKeyInput(false); }}
                  disabled={loadingPlaces || !placesKey.trim()}
                  style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, cursor: "pointer",
                    background: "#6366f1", color: "white", border: "none" }}>
                  {loadingPlaces ? "Loading..." : "Load"}
                </button>
                <button onClick={() => setShowKeyInput(false)}
                  style={{ fontSize: 10, padding: "4px 8px", borderRadius: 5, cursor: "pointer",
                    background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" }}>✕</button>
              </div>
            )}
          </div>

          {/* Points list */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {obsPoints.sort((a,b) => a.risk === "low" ? -1 : 1).map((pt, i) => (
              <button key={i}
                onClick={() => {
                  setSelected(selected?.lat === pt.lat && selected?.lng === pt.lng ? null : pt);
                  if (mapObj.current) mapObj.current.setView([pt.lat, pt.lng], 17);
                }}
                style={{ textAlign: "left", padding: "7px 9px", borderRadius: 6, cursor: "pointer",
                  background: selected?.lat === pt.lat ? `${RISK_COLOR[pt.risk]}18` : "white",
                  border: `1px solid ${selected?.lat === pt.lat ? RISK_COLOR[pt.risk] : "#e2e8f0"}`,
                  transition: "all 0.1s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <span style={{ fontSize: 13 }}>{TYPE_ICON[pt.type]}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#1e293b" }}>
                    {pt.place_name || pt.label}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "1px 5px",
                    borderRadius: 20, background: `${RISK_COLOR[pt.risk]}22`, color: RISK_COLOR[pt.risk] }}>
                    {pt.risk}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                  {pt.distance_m}m · {pt.type.replace("_"," ")}
                  {pt.source === "places_api" && <span style={{ color: "#6366f1", marginLeft: 4 }}>● Places</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Selected point detail */}
          {selected && (
            <div style={{ marginTop: 8, border: `1px solid ${RISK_COLOR[selected.risk]}`,
              borderRadius: 8, padding: "10px 12px", background: "white" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", margin: 0 }}>
                  {TYPE_ICON[selected.type]} {selected.place_name || selected.label}
                  <span style={{ fontSize: 10, marginLeft: 6, color: RISK_COLOR[selected.risk], fontWeight: 600 }}>
                    {selected.risk.toUpperCase()} RISK
                  </span>
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <a href={`https://www.google.com/maps?layer=c&cbll=${selected.lat},${selected.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 10, color: "#3b82f6", textDecoration: "none" }}>
                    📷 Street View
                  </a>
                  <a href={`https://www.google.com/maps/dir/${coords.lat},${coords.lng}/${selected.lat},${selected.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 10, color: "#3b82f6", textDecoration: "none" }}>
                    🧭 Directions
                  </a>
                  <button onClick={() => setSelected(null)}
                    style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                </div>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {selected.advantages.map((a, i) => (
                  <li key={i} style={{ fontSize: 11, color: "#475569", marginBottom: 3,
                    display: "flex", gap: 5, alignItems: "flex-start" }}>
                    <span style={{ color: RISK_COLOR[selected.risk], flexShrink: 0 }}>✓</span>
                    {a}
                  </li>
                ))}
              </ul>
              {(selected as any).notes && (
                <p style={{ fontSize: 10, color: "#f59e0b", background: "#fffbeb",
                  border: "1px solid #fde68a", borderRadius: 4, padding: "4px 7px", margin: "6px 0 0" }}>
                  💡 {(selected as any).notes}
                </p>
              )}
            </div>
          )}

          {/* PI best practices tip */}
          <div style={{ marginTop: 8, padding: "7px 10px", background: "#eff6ff",
            border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 10, color: "#1e40af" }}>
            <strong>PI Best Practices:</strong> Never park directly in front. Use diagonal or parallel positions 150-300m away.
            Prefer business/commercial parking over residential. Always have two exit routes.
            Avoid facing east in morning (sun glare). For apartment complexes use visitor parking.
          </div>
        </div>
      )}
    </div>
  );
}

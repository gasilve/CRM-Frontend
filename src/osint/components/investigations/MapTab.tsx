
import React, { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type StakeoutStatus = "proposed" | "actual" | "nogo";

interface Position {
  id:         number;
  label:      string;
  lat:        number;
  lng:        number;
  status:     StakeoutStatus;
  notes:      string;
  added_by:   string;
  added_at:   string;
}

interface Props {
  inv:      any;
  meta:     any;
  isDark:   boolean;
  acc:      string;
  sec:      string;
  txt:      string;
  bg1:      string;
  bg2:      string;
  bdr:      string;
  mut:      string;
  userRole: string;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<StakeoutStatus,{label:string;color:string;bg:string;pin:string}> = {
  proposed: { label:"🟢 Proposed",  color:"#16a34a", bg:"#dcfce7", pin:"🟢" },
  actual:   { label:"🔵 Actual",    color:"#2563eb", bg:"#dbeafe", pin:"🔵" },
  nogo:     { label:"🔴 No-go",     color:"#dc2626", bg:"#fee2e2", pin:"🔴" },
};

// ── Main component ─────────────────────────────────────────────────────────────
export function MapTab({ inv, meta, isDark, acc, sec, txt, bg1, bg2, bdr, mut, userRole }: Props) {
  const mapRef          = useRef<HTMLDivElement>(null);
  const leafletMapRef   = useRef<any>(null);
  const markersRef      = useRef<any[]>([]);

  const [positions, setPositions]   = useState<Position[]>([]);
  const [loading, setLoading]       = useState(true);
  const [adding, setAdding]         = useState(false);
  const [addStatus, setAddStatus]   = useState<StakeoutStatus>("proposed");
  const [addLabel, setAddLabel]     = useState("");
  const [addNotes, setAddNotes]     = useState("");
  const [pendingLatLng, setPendingLatLng] = useState<{lat:number;lng:number}|null>(null);
  const [selected, setSelected]     = useState<Position|null>(null);
  const [mapReady, setMapReady]     = useState(false);
  const [mapView, setMapView]       = useState<"map"|"satellite">("map");
  const [showStreetView, setShowStreetView] = useState(false);

  // Subject address for initial center
  // subject_addresses can be array of strings or objects
  const rawAddr = inv?.subject_addresses?.[0];
  const subjectAddr = meta?.subject_address ||
    (typeof rawAddr === 'string' ? rawAddr :
     rawAddr?.address || rawAddr?.full_address || rawAddr?.street || "") || "";
  // Default center — try to parse from address or use LA
  const defaultCenter: [number,number] = [34.0522, -118.2437];

  // Load positions from backend
  const loadPositions = async () => {
    try {
      const r = await fetch(`/api/investigations/${inv.id}/stakeout`, { credentials:"include" });
      const d = await r.json();
      setPositions(d.positions || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadPositions(); }, [inv.id]);

  // Initialize Leaflet via CDN
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).L) { setMapReady(true); return; }

    // Load CSS
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement("script");
    script.src  = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
  }, []);

  // Init map once Leaflet is ready and div is mounted
  useEffect(() => {
    if (!mapReady || !mapRef.current || leafletMapRef.current) return;
    const L = (window as any).L;

    // Geocode subject address to center map
    const initMap = (center: [number,number]) => {
      const map = L.map(mapRef.current!, {
        center,
        zoom: 15,
        zoomControl: true,
      });

      // OSM tile layer
      const osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "© OpenStreetMap contributors", maxZoom: 19 }
      );
      const satLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "© Esri", maxZoom: 19 }
      );
      osmLayer.addTo(map);

      // Toggle satellite
      (window as any).__mapLayers = { osm: osmLayer, sat: satLayer, map };

      // Click to add position
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        setPendingLatLng({ lat: parseFloat(lat.toFixed(7)), lng: parseFloat(lng.toFixed(7)) });
        setAdding(true);
      });

      leafletMapRef.current = map;
    };

    // Try to geocode subject address and add marker
    if (subjectAddr) {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(subjectAddr)}&limit=1`)
        .then(r => r.json())
        .then(results => {
          if (results?.[0]) {
            const lat = parseFloat(results[0].lat);
            const lon = parseFloat(results[0].lon);
            initMap([lat, lon]);
            // Add subject address marker
            setTimeout(() => {
              const map = leafletMapRef.current;
              if (!map) return;
              const L2 = (window as any).L;
              const subjectIcon = L2.divIcon({
                className: "",
                html: `<div style="
                  background:#ff3d00;color:white;
                  border:3px solid white;border-radius:50% 50% 50% 0;
                  width:36px;height:36px;
                  display:flex;align-items:center;justify-content:center;
                  font-size:16px;transform:rotate(-45deg);
                  box-shadow:0 3px 12px rgba(255,61,0,0.6);
                "><span style="transform:rotate(45deg)">🏠</span></div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 36],
              });
              L2.marker([lat, lon], { icon: subjectIcon })
                .addTo(map)
                .bindPopup(`<div style="font-family:system-ui;min-width:160px">
                  <div style="font-weight:700;font-size:13px;color:#ff3d00;margin-bottom:3px">📍 Subject address</div>
                  <div style="font-size:11px">${subjectAddr}</div>
                </div>`)
                .openPopup();
              // Store coords for Street View
              (window as any).__subjectCoords = { lat, lng: lon };
            }, 200);
          } else {
            initMap(defaultCenter);
          }
        })
        .catch(() => initMap(defaultCenter));
    } else {
      initMap(defaultCenter);
    }
  }, [mapReady]);

  // Draw markers whenever positions change
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    positions.forEach(pos => {
      const cfg = STATUS_CFG[pos.status as StakeoutStatus] || STATUS_CFG.proposed;
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:32px;height:32px;border-radius:50% 50% 50% 0;
          background:${cfg.color};border:2px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;
        ">
          <div style="transform:rotate(45deg);font-size:13px;color:white;font-weight:700">
            ${pos.status === "proposed" ? "P" : pos.status === "actual" ? "A" : "✕"}
          </div>
        </div>`,
        iconSize: [32,32],
        iconAnchor: [16,32],
      });

      const marker = L.marker([pos.lat, pos.lng], { icon })
        .addTo(leafletMapRef.current)
        .bindPopup(`
          <div style="font-family:system-ui;min-width:180px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${pos.label || cfg.label}</div>
            <div style="font-size:11px;color:#64748b">${pos.notes || ""}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:4px">Added by ${pos.added_by}</div>
            <div style="display:flex;gap:6px;margin-top:8px">
              ${["proposed","actual","nogo"].map(s => `
                <button onclick="window.__changeStakeoutStatus(${pos.id},'${s}')"
                  style="padding:2px 8px;border-radius:20px;border:1px solid;font-size:10px;font-weight:600;cursor:pointer;
                    background:${pos.status===s ? STATUS_CFG[s as StakeoutStatus]?.color : "#f8fafc"};
                    color:${pos.status===s ? "white" : "#64748b"};
                    border-color:${STATUS_CFG[s as StakeoutStatus]?.color}">
                  ${STATUS_CFG[s as StakeoutStatus]?.label}
                </button>`).join("")}
              <button onclick="window.__deleteStakeout(${pos.id})"
                style="padding:2px 8px;border-radius:20px;border:1px solid #fecaca;font-size:10px;font-weight:600;cursor:pointer;background:#fef2f2;color:#dc2626">
                Delete
              </button>
            </div>
          </div>
        `);

      markersRef.current.push(marker);
    });

    // Also add subject address marker if we have coordinates
  }, [positions, leafletMapRef.current]);

  // Expose handlers to popup buttons
  useEffect(() => {
    (window as any).__changeStakeoutStatus = async (id: number, status: string) => {
      await fetch(`/api/investigations/${inv.id}/stakeout/${id}`, {
        method:"PATCH", credentials:"include",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ status }),
      });
      loadPositions();
      leafletMapRef.current?.closePopup();
    };
    (window as any).__deleteStakeout = async (id: number) => {
      if (!window.confirm("Delete this position?")) return;
      await fetch(`/api/investigations/${inv.id}/stakeout/${id}`,
        { method:"DELETE", credentials:"include" });
      loadPositions();
      leafletMapRef.current?.closePopup();
    };
  }, [inv.id]);

  // Toggle satellite/map
  const toggleSatellite = () => {
    const { osm, sat, map } = (window as any).__mapLayers || {};
    if (!map) return;
    if (mapView === "map") {
      map.removeLayer(osm); sat.addTo(map); setMapView("satellite");
    } else {
      map.removeLayer(sat); osm.addTo(map); setMapView("map");
    }
  };

  const savePosition = async () => {
    if (!pendingLatLng) return;
    await fetch(`/api/investigations/${inv.id}/stakeout`, {
      method:"POST", credentials:"include",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        lat: pendingLatLng.lat,
        lng: pendingLatLng.lng,
        status: addStatus,
        label: addLabel || STATUS_CFG[addStatus].label,
        notes: addNotes,
      }),
    });
    setAdding(false); setAddLabel(""); setAddNotes(""); setPendingLatLng(null);
    loadPositions();
  };

  // External map links
  const addr = encodeURIComponent(subjectAddr || (inv?.subject_name + " address"));
  // Get center coords if map is initialized
  const centerCoords = leafletMapRef.current?.getCenter();
  const lat = centerCoords?.lat?.toFixed(6) || "";
  const lng = centerCoords?.lng?.toFixed(6) || "";
  const hasCoords = !!(lat && lng);

  const mapLinks = [
    { label:"Google Maps",     icon:"🗺",  url:`https://www.google.com/maps/search/${addr}` },
    { label:"Street View",     icon:"👁",  url: hasCoords
        ? `https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t/data=!3m6!1e1`
        : `https://www.google.com/maps?q=${addr}&layer=c` },
    { label:"Walking",         icon:"🚶",  url: hasCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`
        : `https://www.google.com/maps/dir/?api=1&destination=${addr}&travelmode=walking` },
    { label:"Google Earth",    icon:"🌍",  url:`https://earth.google.com/web/search/${addr}` },
    { label:"Bing Bird Eye",   icon:"🦅",  url: hasCoords
        ? `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=19&style=b`
        : `https://www.bing.com/maps?q=${addr}&style=b` },
    { label:"Satellite.pro",   icon:"🛰",  url:`https://satellite.pro/#${addr}` },
    { label:"Historic photos", icon:"📷",  url: hasCoords
        ? `https://www.oldmapsonline.org/#bbox=${parseFloat(lng)-0.01},${parseFloat(lat)-0.01},${parseFloat(lng)+0.01},${parseFloat(lat)+0.01}`
        : `https://www.google.com/maps?q=${addr}` },
    { label:"Streetview Time", icon:"⏳",  url: hasCoords
        ? `https://timetravel.mementoweb.org/api/json/${encodeURIComponent(`https://maps.google.com/@${lat},${lng},3a`)}`
        : "" },
  ].filter(l => l.url);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* Map toolbar */}
      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as any }}>
        {/* Status legend */}
        {Object.entries(STATUS_CFG).map(([s,cfg]) => (
          <div key={s} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px",
            borderRadius:20, border:"1px solid "+cfg.color, background:cfg.bg }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:cfg.color, flexShrink:0 }}/>
            <span style={{ fontSize:11, fontWeight:600, color:cfg.color }}>{cfg.label}</span>
            <span style={{ fontSize:11, color:cfg.color }}>
              ({positions.filter(p=>p.status===s).length})
            </span>
          </div>
        ))}

        <div style={{ flex:1 }}/>

        {/* Satellite toggle */}
        <button onClick={toggleSatellite}
          style={{ padding:"5px 12px", borderRadius:7, border:"1px solid "+bdr,
            background: mapView==="satellite" ? acc : bg1,
            color: mapView==="satellite" ? "white" : sec,
            fontSize:12, fontWeight:500, cursor:"pointer" }}>
          🛰 {mapView==="satellite" ? "Map view" : "Satellite"}
        </button>
        <a
          href={(() => {
            const c = (window as any).__subjectCoords;
            if (c) return `https://www.google.com/maps/@${c.lat},${c.lng},3a,75y,0h,90t/data=!3m6!1e1`;
            return subjectAddr ? `https://www.google.com/maps?q=${encodeURIComponent(subjectAddr)}&layer=c` : "#";
          })()}
          target="_blank" rel="noreferrer"
          style={{ padding:"5px 12px", borderRadius:7, border:"1px solid "+bdr,
            background: bg1, color: sec,
            fontSize:12, fontWeight:500, cursor:"pointer",
            textDecoration:"none", display:"inline-flex", alignItems:"center", gap:4 }}>
          👁 Street View
        </a>
      </div>

      {/* Click hint */}
      <div style={{ fontSize:11, color:sec, padding:"6px 10px", background:bg2,
        borderRadius:6, border:"1px solid "+bdr }}>
        💡 Click anywhere on the map to add a stakeout position. Hover a marker to change its status or delete it.
      </div>



      {/* Add position form (appears when map is clicked) */}
      {adding && pendingLatLng && (
        <div style={{ border:"2px solid "+acc, borderRadius:10, padding:14, background:bg2 }}>
          <p style={{ fontSize:12, fontWeight:700, color:acc, textTransform:"uppercase" as any,
            letterSpacing:"0.07em", margin:"0 0 10px" }}>
            Add position at {pendingLatLng.lat.toFixed(5)}, {pendingLatLng.lng.toFixed(5)}
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
            <div>
              <p style={{ fontSize:10, color:sec, fontWeight:600, textTransform:"uppercase" as any,
                letterSpacing:"0.05em", margin:"0 0 3px" }}>Label</p>
              <input value={addLabel} onChange={e=>setAddLabel(e.target.value)}
                placeholder="e.g. Tree line north side..."
                style={{ width:"100%", padding:"6px 10px", border:"1px solid "+bdr,
                  borderRadius:6, fontSize:12, background:bg1, color:txt, outline:"none",
                  boxSizing:"border-box" as any }}/>
            </div>
            <div>
              <p style={{ fontSize:10, color:sec, fontWeight:600, textTransform:"uppercase" as any,
                letterSpacing:"0.05em", margin:"0 0 3px" }}>Status</p>
              <div style={{ display:"flex", gap:5 }}>
                {(Object.entries(STATUS_CFG) as [StakeoutStatus,any][]).map(([s,cfg]) => (
                  <button key={s} onClick={()=>setAddStatus(s)}
                    style={{ flex:1, padding:"5px 4px", borderRadius:6, fontSize:11, fontWeight:600,
                      cursor:"pointer", border:"1px solid",
                      background: addStatus===s ? cfg.color : bg1,
                      color: addStatus===s ? "white" : cfg.color,
                      borderColor: cfg.color }}>
                    {cfg.label.replace(" ⛔","")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <input value={addNotes} onChange={e=>setAddNotes(e.target.value)}
            placeholder="Notes (e.g. good tree cover, avoid front of house...)"
            style={{ width:"100%", padding:"6px 10px", border:"1px solid "+bdr, borderRadius:6,
              fontSize:12, background:bg1, color:txt, outline:"none",
              boxSizing:"border-box" as any, marginBottom:10 }}/>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={savePosition}
              style={{ padding:"7px 18px", background:STATUS_CFG[addStatus].color,
                color:"white", border:"none", borderRadius:7, fontSize:12,
                fontWeight:700, cursor:"pointer" }}>
              {STATUS_CFG[addStatus].pin} Save {STATUS_CFG[addStatus].label.replace(" ⛔","")} position
            </button>
            <button onClick={()=>{ setAdding(false); setPendingLatLng(null); }}
              style={{ padding:"7px 14px", background:"transparent", color:sec,
                border:"1px solid "+bdr, borderRadius:7, fontSize:12, cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* The actual map */}
      <div style={{ position:"relative", borderRadius:10, overflow:"hidden",
        border:"1px solid "+bdr, boxShadow:"0 2px 12px rgba(0,0,0,0.15)" }}>
        {!mapReady && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
            justifyContent:"center", background:bg2, zIndex:10 }}>
            <div style={{ fontSize:13, color:sec }}>Loading map...</div>
          </div>
        )}
        <div ref={mapRef} style={{ height:420, width:"100%" }}/>
      </div>

      {/* Positions list */}
      {positions.length > 0 && (
        <div style={{ border:"1px solid "+bdr, borderRadius:10, overflow:"hidden" }}>
          <div style={{ padding:"8px 14px", background:bg2, borderBottom:"1px solid "+bdr }}>
            <p style={{ fontSize:10, fontWeight:700, color:sec, textTransform:"uppercase" as any,
              letterSpacing:"0.07em", margin:0 }}>
              Stakeout positions ({positions.length})
            </p>
          </div>
          {positions.map((pos,i) => {
            const cfg = STATUS_CFG[pos.status as StakeoutStatus] || STATUS_CFG.proposed;
            return (
              <div key={pos.id} style={{ padding:"8px 14px", borderBottom:i<positions.length-1?"0.5px solid "+bdr:"none",
                display:"flex", alignItems:"center", gap:10,
                background: i%2===1 ? bg2 : bg1 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:cfg.color, flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:12.5, fontWeight:600, color:txt }}>
                    {pos.label || cfg.label}
                  </span>
                  {pos.notes && <span style={{ fontSize:11, color:sec, marginLeft:8 }}>{pos.notes}</span>}
                </div>
                <span style={{ fontSize:10, color:sec }}>{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</span>
                <span style={{ padding:"1px 7px", borderRadius:20, fontSize:10, fontWeight:600,
                  background:cfg.bg, color:cfg.color }}>
                  {cfg.label}
                </span>
                <button onClick={() => {
                  leafletMapRef.current?.flyTo([pos.lat, pos.lng], 17, { duration:1 });
                }}
                  style={{ padding:"2px 8px", background:"transparent", color:acc,
                    border:"1px solid "+acc, borderRadius:5, fontSize:10, cursor:"pointer" }}>
                  Fly to
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* External map links */}
      <div style={{ border:"1px solid "+bdr, borderRadius:10, padding:"12px 14px", background:bg2 }}>
        <p style={{ fontSize:10, fontWeight:700, color:sec, textTransform:"uppercase" as any,
          letterSpacing:"0.07em", margin:"0 0 10px" }}>
          External mapping tools
        </p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" as any }}>
          {mapLinks.map(link => (
            <a key={link.label} href={link.url} target="_blank" rel="noreferrer"
              style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 14px",
                borderRadius:8, border:"1px solid "+bdr, background:bg1, color:txt,
                fontSize:12, fontWeight:500, textDecoration:"none",
                transition:"all 0.15s" }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor=acc}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor=bdr}>
              <span>{link.icon}</span>
              <span>{link.label}</span>
              <span style={{ fontSize:10, color:sec }}>↗</span>
            </a>
          ))}
        </div>
        {subjectAddr && (
          <p style={{ fontSize:11, color:sec, marginTop:8 }}>
            Searching for: <em>{subjectAddr}</em>
          </p>
        )}
      </div>
    </div>
  );
}

// @ts-nocheck

import { useState, useEffect, useRef } from "react";
import { isGlassTheme } from "@/lib/theme";

const BASE = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";

function getFlowsintBase() {
  if (typeof window === "undefined") return "https://flowsint.proti.ai";
  return ["localhost","127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:5173"
    : "https://flowsint.proti.ai";
}

export function FlowsintTab({ invId, subjectName, isGL }: {
  invId: number; subjectName: string; isGL: boolean;
}) {
  const [sketch, setSketch]   = useState<any>(null);
  const [token, setToken]     = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string|null>(null);
  const gl = isGL || isGlassTheme();

  const bdr = gl ? "rgba(255,255,255,0.12)" : "#e2e8f0";
  const bg1 = gl ? "rgba(255,255,255,0.05)" : "#f8fafc";
  const txt = gl ? "rgba(218,234,255,0.95)" : "#0f172a";
  const sec = gl ? "rgba(160,185,240,0.70)" : "#64748b";
  const acc = gl ? "#6a8fff" : "#1e40af";

  useEffect(() => {
    if (invId > 0) init();
  }, [invId]);

  async function init() {
    setLoading(true);
    setError(null);
    try {
      // Get Flowsint token from Prodigy backend
      const tr = await fetch(`${BASE}/api/flowsint/token`, { credentials:"include" });
      if (!tr.ok) throw new Error("Could not get Flowsint token");
      const { token: t } = await tr.json();
      setToken(t);

      // Get or create sketch
      const sr = await fetch(`${BASE}/api/flowsint/sketch/${invId}`, { credentials:"include" });
      if (!sr.ok) throw new Error(`HTTP ${sr.status}`);
      const d = await sr.json();
      setSketch(d);
    } catch(e: any) {
      setError(e.message || "Failed to connect to Flowsint");
    }
    setLoading(false);
  }

  // Build iframe URL via autologin route
  const sketchUrl = sketch?.sketch_id && token
    ? `${getFlowsintBase()}/autologin?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(`/dashboard/sketches/${sketch.sketch_id}`)}`
    : null;

  const directUrl = sketch?.sketch_id
    ? `${getFlowsintBase()}/dashboard/sketches/${sketch.sketch_id}`
    : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10,
      height:"calc(100vh - 280px)", minHeight:520 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center",
        justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:18 }}>🔗</span>
          <div>
            <span style={{ fontSize:13, fontWeight:600, color:txt }}>Graph Investigation</span>
            <span style={{ fontSize:11, color:sec, marginLeft:8 }}>powered by Flowsint</span>
          </div>
          {sketch?.created && (
            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20,
              background:"rgba(80,220,150,0.15)", color:"rgba(80,220,150,0.9)",
              border:"1px solid rgba(80,220,150,0.25)" }}>
              ✓ {sketch.nodes_added} nodes preloaded
            </span>
          )}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {sketch && (
            <button onClick={() => { setSketch(null); setToken(null); init(); }}
              style={{ fontSize:11, padding:"4px 10px", borderRadius:7,
                background:"transparent", border:`1px solid ${bdr}`,
                color:sec, cursor:"pointer" }}>↻ Refresh</button>
          )}
          {directUrl && token && (
            <a href={sketchUrl || directUrl} target="_blank" rel="noreferrer"
              style={{ fontSize:11, padding:"4px 10px", borderRadius:7,
                background:`${acc}22`, border:`1px solid ${acc}44`,
                color:acc, textDecoration:"none", fontWeight:600 }}>
              Open full screen ↗
            </a>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:12,
          border:`1px solid ${bdr}`, borderRadius:10, background:bg1 }}>
          <div style={{ fontSize:28 }}>⏳</div>
          <div style={{ fontSize:13, color:sec }}>
            Preparing graph for <strong style={{color:txt}}>{subjectName}</strong>…
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:12,
          border:"1px solid rgba(255,80,80,0.3)", borderRadius:10,
          background:"rgba(255,80,80,0.05)" }}>
          <div style={{ fontSize:28 }}>⚠️</div>
          <div style={{ fontSize:13, color:txt, fontWeight:600 }}>Flowsint not available</div>
          <div style={{ fontSize:11, color:sec }}>{error}</div>
          <button onClick={init}
            style={{ padding:"6px 16px", borderRadius:8, cursor:"pointer",
              background:`${acc}22`, border:`1px solid ${acc}44`,
              color:acc, fontSize:12, fontWeight:600 }}>Retry</button>
        </div>
      )}

      {/* Initial state */}
      {!loading && !error && !sketch && (
        <div style={{ flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:12,
          border:`1px solid ${bdr}`, borderRadius:10, background:bg1 }}>
          <div style={{ fontSize:40 }}>🔗</div>
          <div style={{ fontSize:14, fontWeight:600, color:txt }}>Graph Investigation</div>
          <div style={{ fontSize:12, color:sec, textAlign:"center", maxWidth:320 }}>
            Creates a visual graph with the subject, addresses, employer
            and OSINT findings preloaded
          </div>
          <button onClick={init}
            style={{ padding:"8px 20px", borderRadius:9, cursor:"pointer",
              background:acc, border:"none", color:"white",
              fontSize:13, fontWeight:700 }}>
            🚀 Launch Graph
          </button>
        </div>
      )}

      {/* Iframe — loads autologin which redirects to sketch */}
      {!loading && !error && sketchUrl && (
        <div style={{ flex:1, border:`1px solid ${bdr}`, borderRadius:10,
          overflow:"hidden", position:"relative" }}>
          <iframe
            key={sketchUrl}
            src={sketchUrl}
            style={{ width:"100%", height:"100%", border:"none", display:"block" }}
            allow="clipboard-read; clipboard-write; storage-access"
            title="Flowsint Graph"
          />
        </div>
      )}
    </div>
  );
}

// @ts-nocheck

import { useState, useEffect } from "react";
import { isGlassTheme } from "@/lib/theme";

const BASE = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";

interface Selector {
  id: number;
  keyword: string;
  created_by: string;
  created_at: string;
}

export function SelectorsTab({ invId, subjectName, isGL }: {
  invId: number; subjectName?: string; isGL: boolean;
}) {
  const [selectors, setSelectors] = useState<Selector[]>([]);
  const [newKw, setNewKw]         = useState("");
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const gl = isGL || isGlassTheme();

  const bdr = gl ? "rgba(255,255,255,0.12)" : "#e2e8f0";
  const bg1 = gl ? "rgba(255,255,255,0.05)" : "#f8fafc";
  const bg2 = gl ? "rgba(255,255,255,0.09)" : "#ffffff";
  const txt = gl ? "rgba(218,234,255,0.95)" : "#0f172a";
  const sec = gl ? "rgba(160,185,240,0.70)" : "#64748b";
  const acc = gl ? "#6a8fff" : "#1e40af";

  useEffect(() => {
    if (invId > 0) load();
  }, [invId]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/settings/selectors/${invId}`, { credentials:"include" });
      const d = await r.json();
      setSelectors(d.selectors || []);
    } catch {}
    setLoading(false);
  }

  async function add() {
    if (!newKw.trim()) return;
    setAdding(true);
    await fetch(`${BASE}/api/settings/selectors/${invId}`, {
      method:"POST", credentials:"include",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ keyword: newKw.trim() }),
    });
    setNewKw("");
    setAdding(false);
    load();
  }

  async function remove(selectorId: number) {
    await fetch(`${BASE}/api/settings/selectors/${invId}/${selectorId}`, {
      method:"DELETE", credentials:"include"
    });
    setSelectors(prev => prev.filter(s => s.id !== selectorId));
  }

  async function autoGenerate() {
    await fetch(`${BASE}/api/settings/selectors/${invId}/bulk`, {
      method:"POST", credentials:"include",
    });
    load();
  }

  const card: React.CSSProperties = {
    background:bg2, border:`1px solid ${bdr}`, borderRadius:10, padding:"12px 14px",
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, maxWidth:600 }}>

      {/* Header + auto-generate */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div>
          <h3 style={{ fontSize:14, fontWeight:700, color:txt, margin:"0 0 4px" }}>
            🔍 Keyword Selectors
          </h3>
          <p style={{ fontSize:11.5, color:sec, margin:0, lineHeight:1.5 }}>
            Keywords the extension watches for when capturing pages.
            Captures containing these words are automatically flagged as relevant.
          </p>
        </div>
        <button onClick={autoGenerate}
          style={{ padding:"5px 12px", borderRadius:8, cursor:"pointer", flexShrink:0,
            background:"transparent", border:`1px solid ${bdr}`,
            color:sec, fontSize:11, fontWeight:600, whiteSpace:"nowrap" as any }}>
          ✨ Auto-generate
        </button>
      </div>

      {/* Add keyword */}
      <div style={{ display:"flex", gap:6 }}>
        <input
          value={newKw}
          onChange={e => setNewKw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          placeholder={`e.g. ${subjectName || "subject name"}, claim number, city...`}
          style={{ flex:1, padding:"7px 10px", borderRadius:8,
            background:bg1, border:`1px solid ${bdr}`,
            color:txt, fontSize:12, outline:"none" }} />
        <button onClick={add} disabled={adding || !newKw.trim()}
          style={{ padding:"7px 16px", borderRadius:8, cursor:"pointer",
            background:`${acc}22`, border:`1px solid ${acc}44`,
            color:acc, fontSize:12, fontWeight:600,
            opacity: !newKw.trim() ? 0.5 : 1 }}>
          {adding ? "…" : "+ Add"}
        </button>
      </div>

      {/* Selector list */}
      {loading ? (
        <div style={{ textAlign:"center", padding:20, color:sec, fontSize:12 }}>Loading…</div>
      ) : selectors.length === 0 ? (
        <div style={{ ...card, textAlign:"center", padding:24 }}>
          <div style={{ fontSize:24, marginBottom:8 }}>🔍</div>
          <div style={{ fontSize:13, fontWeight:600, color:txt, marginBottom:4 }}>
            No keywords yet
          </div>
          <div style={{ fontSize:11.5, color:sec, marginBottom:12 }}>
            Add keywords manually or click "Auto-generate" to create them from the case data.
          </div>
          <button onClick={autoGenerate}
            style={{ padding:"6px 16px", borderRadius:8, cursor:"pointer",
              background:`${acc}22`, border:`1px solid ${acc}44`,
              color:acc, fontSize:12, fontWeight:600 }}>
            ✨ Auto-generate from case
          </button>
        </div>
      ) : (
        <div style={card}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
            letterSpacing:"0.07em", color:sec, marginBottom:8 }}>
            {selectors.length} keyword{selectors.length !== 1 ? "s" : ""} — synced to extension
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {selectors.map(s => (
              <div key={s.id}
                style={{ display:"inline-flex", alignItems:"center", gap:6,
                  padding:"4px 10px 4px 12px", borderRadius:20,
                  background:`${acc}18`, border:`1px solid ${acc}30` }}>
                <span style={{ fontSize:12, fontWeight:600, color:acc }}>{s.keyword}</span>
                <button onClick={() => remove(s.id)}
                  style={{ background:"none", border:"none", cursor:"pointer",
                    color:sec, fontSize:13, padding:0, lineHeight:1,
                    display:"flex", alignItems:"center" }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ fontSize:10, color:sec, marginTop:8, paddingTop:8,
            borderTop:`1px solid ${bdr}` }}>
            💡 The extension automatically detects these keywords on every captured page.
            Pages with matches are flagged with an orange "keyword" badge.
          </div>
        </div>
      )}

      {/* How it works */}
      <div style={{ background:bg1, border:`1px solid ${bdr}`, borderRadius:9,
        padding:"10px 12px" }}>
        <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
          letterSpacing:"0.07em", color:sec, marginBottom:6 }}>
          How selectors work with the extension
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {[
            ["Select this case", "In the Prodigy Capture extension, choose this case"],
            ["Browse the subject", "Navigate to their social profiles, news articles, etc."],
            ["Auto-detection", "Extension scans each page for your keywords"],
            ["Flagged captures", "Matching pages get an orange ⚡ keyword badge"],
            ["Review in platform", "See keyword matches in the Web Captures tab"],
          ].map(([step,desc],i) => (
            <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
              <div style={{ width:18, height:18, borderRadius:"50%", flexShrink:0,
                background:`${acc}22`, border:`1px solid ${acc}44`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:9, fontWeight:700, color:acc }}>{i+1}</div>
              <div>
                <span style={{ fontSize:11.5, fontWeight:600, color:txt }}>{step}</span>
                <span style={{ fontSize:11, color:sec }}> — {desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

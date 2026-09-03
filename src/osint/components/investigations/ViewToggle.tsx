
import { useState, useEffect } from "react";

interface Props {
  inv:         any;
  meta:        any;
  sessionUser: any;
}

export function ViewToggle({ inv, meta, sessionUser }: Props) {
  const [view, setView]   = useState<"subject"|"map"|"summary">("subject");
  const [isDark, setIsDark] = useState(true);
  const [summaries, setSummaries] = useState<any[]>([]);

  useEffect(() => {
    setIsDark(!document.documentElement.classList.contains("theme-royal")
      && !document.documentElement.classList.contains("theme-slate"));
  }, []);

  useEffect(() => {
    if (view === "summary" && inv?.id) {
      fetch(`/api/investigations/${inv.id}/summaries`, { credentials: "include" })
        .then(r => r.json())
        .then(d => setSummaries(d.summaries || []))
        .catch(() => {});
    }
  }, [view, inv?.id]);

  const bg    = isDark ? "#0e0906" : "#f8fafc";
  const bg2   = isDark ? "#1a110c" : "white";
  const bdr   = isDark ? "rgba(255,106,26,0.2)" : "#e2e8f0";
  const txt   = isDark ? "#f5ede6" : "#0f172a";
  const sec   = isDark ? "#c4956a" : "#64748b";
  const acc   = isDark ? "#ff6a1a" : "#6366f1";
  const mut   = isDark ? "#7a5030" : "#94a3b8";

  const VIEWS = [
    { id: "subject", label: "Subject",  icon: "👤", desc: "Case details" },
    { id: "map",     label: "Map",      icon: "🗺",  desc: "Stakeout positions" },
    { id: "summary", label: "Summary",  icon: "📋", desc: "Investigator reports" },
  ];

  const subjectPhoto = inv?.photos?.find((p: any) => p.is_subject) || inv?.photos?.[0];

  return (
    <div style={{ marginBottom: 8 }}>
      {/* View toggle bar */}
      <div style={{ display: "flex", gap: 6, background: bg2,
        border: "1px solid " + bdr, borderRadius: 10,
        padding: "6px", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: sec, paddingLeft: 6, paddingRight: 2, fontWeight: 600 }}>View:</span>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id as any)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 14px",
              borderRadius: 7, border: "1px solid",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
              background: view === v.id ? acc : "transparent",
              color: view === v.id ? "white" : sec,
              borderColor: view === v.id ? acc : bdr,
              transition: "all 0.15s" }}>
            <span>{v.icon}</span>
            <span>{v.label}</span>
          </button>
        ))}
      </div>

      {/* Subject quick view */}
      {view === "subject" && null /* falls through to tabs below */}

      {/* Map quick view */}
      {view === "map" && (
        <div style={{ marginTop: 8, background: bg2, border: "1px solid " + bdr,
          borderRadius: 10, padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: txt, margin: "0 0 4px" }}>
            Map View — {inv?.subject_name}
          </p>
          <p style={{ fontSize: 11, color: sec, margin: "0 0 12px" }}>
            Go to the <strong style={{ color: acc }}>🗺 Map</strong> tab below to add and manage stakeout positions.
          </p>
          {/* Quick address + map links */}
          {(meta?.subject_address || inv?.subject_addresses?.[0]) && (() => {
            const addr = encodeURIComponent(meta?.subject_address || inv?.subject_addresses?.[0]);
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: 12, color: txt, padding: "6px 10px",
                  background: bg, borderRadius: 6, border: "1px solid " + bdr, margin: 0 }}>
                  📍 {decodeURIComponent(addr)}
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as any }}>
                  {[
                    { label: "Google Maps",   url: `https://www.google.com/maps/search/${addr}` },
                    { label: "Street View",   url: `https://www.google.com/maps?q=${addr}&layer=c` },
                    { label: "Google Earth",  url: `https://earth.google.com/web/search/${addr}` },
                    { label: "Bing Maps",     url: `https://www.bing.com/maps?q=${addr}` },
                  ].map(link => (
                    <a key={link.label} href={link.url} target="_blank" rel="noreferrer"
                      style={{ padding: "5px 12px", border: "1px solid " + bdr, borderRadius: 7,
                        fontSize: 11.5, fontWeight: 500, color: txt, textDecoration: "none",
                        background: bg, display: "flex", alignItems: "center", gap: 4 }}>
                      {link.label} <span style={{ fontSize: 10, color: sec }}>↗</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Summary quick view */}
      {view === "summary" && (
        <div style={{ marginTop: 8, background: bg2, border: "1px solid " + bdr,
          borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid " + bdr,
            background: isDark ? "rgba(99,102,241,0.1)" : "#eff6ff" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: acc, margin: 0 }}>
              Investigator Summaries — {inv?.subject_name}
            </p>
          </div>
          {summaries.length === 0 ? (
            <p style={{ fontSize: 12, color: sec, padding: "16px", margin: 0, fontStyle: "italic" }}>
              No summaries yet. They appear here automatically from email.
            </p>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto" as any }}>
              {summaries.map((s: any, i: number) => {
                const vehs: any[] = s.vehicles_extracted || [];
                return (
                  <div key={s.id} style={{ padding: "10px 16px",
                    borderBottom: i < summaries.length-1 ? "0.5px solid " + bdr : "none",
                    background: i%2===1 ? (isDark ? "rgba(255,255,255,0.02)" : "#fafafa") : "transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ minWidth: 80 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: txt }}>{s.summary_date || "—"}</div>
                        {s.investigator_name && <div style={{ fontSize: 10, color: sec }}>{s.investigator_name}</div>}
                      </div>
                      {(s.hours_start || s.hours_end) && (
                        <div style={{ fontSize: 11, color: sec }}>{s.hours_start} – {s.hours_end}</div>
                      )}
                      <div style={{ display: "flex", gap: 4, flex: 1, flexWrap: "wrap" as any }}>
                        {s.observed     && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#dcfce7", color: "#166534", fontWeight: 600 }}>Observed</span>}
                        {s.working      && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#dbeafe", color: "#1e40af", fontWeight: 600 }}>Working</span>}
                        {s.unrestricted && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#fef9c3", color: "#854d0e", fontWeight: 600 }}>Unrestricted</span>}
                        {s.burned       && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#fee2e2", color: "#991b1b", fontWeight: 700 }}>🔥 Burned</span>}
                      </div>
                      {vehs.length > 0 && (
                        <span style={{ fontSize: 10, color: acc }}>🚗 {vehs.length}</span>
                      )}
                    </div>
                    {/* Body preview */}
                    <p style={{ fontSize: 11, color: sec, margin: "4px 0 0",
                      lineHeight: 1.5, maxHeight: 48, overflow: "hidden",
                      WebkitLineClamp: 3, display: "-webkit-box",
                      WebkitBoxOrient: "vertical" as any }}>
                      {(s.body_text || "").substring(0, 200)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

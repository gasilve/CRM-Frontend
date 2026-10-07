// @ts-nocheck
import { useEffect, useRef, useState } from "react";

export function GlobePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  // Detect if gods-eye-view is reachable
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) setError(true);
    }, 15000);
    return () => clearTimeout(timeout);
  }, [loading]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100%",
      background: "#050708",
      position: "relative",
    }}>

      {/* Header bar — consistent with rest of Prodigy */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 20px",
        height: 52,
        borderBottom: "1px solid rgba(255,106,26,0.15)",
        background: "#0a0604",
        flexShrink: 0,
        zIndex: 10,
      }}>
        <span style={{ fontSize: 18 }}>🌐</span>
        <div>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f5ede6", letterSpacing: "0.02em" }}>
            Globe Intelligence
          </h1>
          <p style={{ margin: 0, fontSize: 10, color: "rgba(255,106,26,0.6)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
            Live flights · vessels · satellites · CCTV · fires
          </p>
        </div>
        <div style={{ flex: 1 }} />
        {/* Status dot */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: error ? "#ef4444" : loading ? "#f59e0b" : "#10b981",
            boxShadow: error ? "0 0 6px #ef4444" : loading ? "0 0 6px #f59e0b" : "0 0 6px #10b981",
          }} />
          <span style={{ fontSize: 11, color: "rgba(200,190,180,0.6)", fontWeight: 500 }}>
            {error ? "Unavailable" : loading ? "Connecting…" : "Live"}
          </span>
        </div>
        {/* Open in full tab */}
        <a
          href="http://localhost:4390"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11, color: "rgba(255,106,26,0.6)", textDecoration: "none",
            padding: "4px 10px", borderRadius: 6,
            border: "1px solid rgba(255,106,26,0.2)",
            transition: "all 0.15s",
            fontWeight: 500,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = "#ff6a1a";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,106,26,0.5)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,106,26,0.6)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,106,26,0.2)";
          }}
        >
          ↗ Full screen
        </a>
      </div>

      {/* Loading overlay */}
      {loading && !error && (
        <div style={{
          position: "absolute", inset: 52, zIndex: 5,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#050708",
          gap: 16,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "2px solid rgba(255,106,26,0.15)",
            borderTop: "2px solid #ff6a1a",
            animation: "spin 1s linear infinite",
          }} />
          <p style={{ color: "rgba(200,190,180,0.5)", fontSize: 13, margin: 0 }}>
            Loading globe…
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          position: "absolute", inset: 52, zIndex: 5,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#050708", gap: 12,
        }}>
          <span style={{ fontSize: 36 }}>🌐</span>
          <p style={{ color: "#f5ede6", fontSize: 14, fontWeight: 600, margin: 0 }}>Globe service unavailable</p>
          <p style={{ color: "rgba(200,190,180,0.5)", fontSize: 12, margin: 0 }}>
            Check that gods-eye-view is running on port 4390
          </p>
          <button
            onClick={() => { setError(false); setLoading(true); if (iframeRef.current) iframeRef.current.src += ""; }}
            style={{
              marginTop: 8, padding: "8px 18px", borderRadius: 8, fontSize: 12,
              background: "rgba(255,106,26,0.15)", border: "1px solid rgba(255,106,26,0.3)",
              color: "#ff6a1a", cursor: "pointer", fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* The globe iframe — fills the rest of the screen */}
      <iframe
        ref={iframeRef}
        src="http://localhost:4390"
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          display: "block",
          opacity: loading || error ? 0 : 1,
          transition: "opacity 0.4s ease",
        }}
        title="Gods Eye View — Geospatial Intelligence"
        allow="camera; microphone; geolocation; fullscreen"
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
      />
    </div>
  );
}

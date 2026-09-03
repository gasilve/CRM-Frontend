// @ts-nocheck

import React, { useState, useEffect, useRef } from "react";

const BASE = typeof window !== "undefined"
  ? (!["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000")
  : "";

function useTheme() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const check = () => setDark(
      !document.documentElement.classList.contains("theme-royal") &&
      !document.documentElement.classList.contains("theme-slate")
    );
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function getC(dark: boolean) {
  return {
    bdr: dark ? "#5c3019" : "#e2e8f0",
    bg1: dark ? "#2e1a0e" : "#f8fafc",
    bg2: dark ? "#1a0f08" : "#ffffff",
    txt: dark ? "#f5ede6" : "#1e293b",
    sec: dark ? "#c4956a" : "#64748b",
    mut: dark ? "#7a5030" : "#94a3b8",
    acc: dark ? "#ff6a1a" : "#6366f1",
    grn: "#10b981", yel: "#f59e0b", red: "#ef4444",
  };
}

const SC: Record<string, string> = {
  uploaded:"#3b82f6", timestamping:"#f59e0b", timestamped:"#8b5cf6",
  processing:"#f59e0b", ready:"#10b981", delivered:"#6366f1", error:"#ef4444",
};

const fmtBytes = (b: number) => !b ? "—" : b > 1e9 ? (b/1e9).toFixed(2)+" GB" : b > 1e6 ? (b/1e6).toFixed(1)+" MB" : (b/1e3).toFixed(0)+" KB";
const fmtDate  = (s: string | null) => !s ? "—" : new Date(s).toLocaleString("en-US", {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtDur   = (s: number | null) => !s ? "—" : Math.floor(s/60) > 0 ? `${Math.floor(s/60)}m ${Math.floor(s%60)}s` : `${Math.floor(s)}s`;

// ─── Expanded record panel — 4-step workflow ──────────────────────────────────
function ExpandedRecord({ r, c, BASE, selCase, fontFile, setFontFile, fontSize, setFontSize,
  outputFolder, setOutputFolder, fonts, availFolders, savePrefs, loadRecords }: any) {

  const initStep = () =>
    r.sent_to_attorney_at ? 4 :
    r.wasabi_pub_key ? 3 :
    r.sha256_final   ? 2 : 1;

  const [step, setStep]           = React.useState<1|2|3|4>(initStep());
  const [processing, setProcessing]   = React.useState(false);
  const [publishing, setPublishing]   = React.useState(false);
  const [delivering, setDelivering]   = React.useState(false);
  const [tsPosition, setTsPosition]   = React.useState("bottom-left");
  const [tsFontStyle, setTsFontStyle] = React.useState("duplex");
  const [tsColor, setTsColor]         = React.useState("#ffffff");
  const [tsOpacity, setTsOpacity]     = React.useState(0.45);
  const [tsFontScale, setTsFontScale] = React.useState(1.1);
  const [tsFormat, setTsFormat]       = React.useState("%m/%d/%Y  %I:%M:%S %p");
  const [tsExtras, setTsExtras]       = React.useState<string[]>([]);
  const [trailerPreview, setTrailerPreview] = React.useState<any>(null);
  const [trailerLoading, setTrailerLoading] = React.useState(false);
  const [stateOverride, setStateOverride]   = React.useState<string>("");

  // Video preview panel
  const [previewFrame, setPreviewFrame]   = React.useState<string|null>(null);
  const [previewDur,   setPreviewDur]     = React.useState<number>(30);
  const [previewSeek,  setPreviewSeek]    = React.useState<number>(3);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewMode,  setPreviewMode]    = React.useState<"raw"|"enhanced">("raw");
  const [previewOpen,  setPreviewOpen]    = React.useState(false);
  const [videoMode,    setVideoMode]      = React.useState<"frame"|"full">("frame");
  const [videoSrc,     setVideoSrc]       = React.useState<string|null>(null);
  const [videoLoading, setVideoLoading]   = React.useState(false);
  const [videoProgress, setVideoProgress] = React.useState(0);
  const [videoLoadMsg,  setVideoLoadMsg]  = React.useState("");

  // Color enhancement
  const [ceEnabled,    setCeEnabled]    = React.useState(true);
  const [ceBrightness, setCeBrightness] = React.useState(0.04);
  const [ceContrast,   setCeContrast]   = React.useState(1.08);
  const [ceSaturation, setCeSaturation] = React.useState(1.15);
  const [ceGamma,      setCeGamma]      = React.useState(0.95);
  const [ceSharpen,    setCeSharpen]    = React.useState(0.3);

  // Fetch a single frame from the raw video
  const fetchFrame = React.useCallback(async (seek?: number) => {
    setPreviewLoading(true);
    setPreviewOpen(true);   // show panel immediately so spinner is visible
    setVideoMode("frame");
    try {
      const s = seek ?? previewSeek;
      const res = await fetch(
        `${BASE}/api/video-custody/${r.id}/frame?t=${s}&width=640&which=raw`,
        { credentials: "include" }
      );
      if (res.ok) {
        const d = await res.json();
        setPreviewFrame(d.frame_b64);
        setPreviewDur(d.duration || 30);
        setPreviewSeek(s);
      }
    } catch(e) { console.warn("frame fetch", e); }
    finally { setPreviewLoading(false); }
  }, [r.id, previewSeek]);

  // Build a streaming video URL for the full video player
  // Revoke previous blob URL to free memory
  const blobUrlRef = React.useRef<string|null>(null);

  const openFullVideo = React.useCallback(async (which: "raw"|"output" = "raw") => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setVideoSrc(null);
    setVideoLoading(true);
    setPreviewOpen(true);
    setVideoMode("full");
    setVideoProgress(0);

    const isMov = ["mov","avi","wmv","mkv"].some(
      x => (r.original_filename||"").toLowerCase().endsWith("."+x)
    );
    setVideoLoadMsg(which === "raw" && isMov
      ? "⏳ Transcoding MOV → MP4 for playback…"
      : "⏳ Downloading video…");

    const endpoint = which === "output" && r.sha256_final
      ? `${BASE}/api/video-custody/${r.id}/download`
      : `${BASE}/api/video-custody/${r.id}/stream`;

    try {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) {
        setVideoLoadMsg("❌ Could not load video (status " + res.status + ")");
        setVideoLoading(false);
        return;
      }
      const contentLength = Number(res.headers.get("content-length") || 0);
      const reader = res.body!.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        setVideoProgress(contentLength > 0
          ? Math.round(received / contentLength * 100)
          : -1);
      }
      const blob = new Blob(chunks, { type: "video/mp4" });
      const url  = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setVideoProgress(100);
      setVideoLoadMsg("");
      setVideoSrc(url);
    } catch(e) {
      setVideoLoadMsg("❌ Load error — check network");
      console.warn("video load error", e);
    } finally {
      setVideoLoading(false);
    }
  }, [r.id, r.sha256_final]);

  // Fetch trailer preview from backend
  const fetchTrailerPreview = React.useCallback(async (override?: string) => {
    setTrailerLoading(true);
    try {
      const qs = override ? `?state_override=${override}` : "";
      const res = await fetch(`${BASE}/api/video-custody/${r.id}/trailer-preview${qs}`,
        { credentials: "include" });
      if (res.ok) setTrailerPreview(await res.json());
    } catch(e) { console.warn("trailer preview", e); }
    finally { setTrailerLoading(false); }
  }, [r.id]);

  React.useEffect(() => {
    if (step === 2 && !trailerPreview) fetchTrailerPreview();
  }, [step]);
  const [delivRecipient, setDelivRecipient] = React.useState(r.deliver_recipient || "");
  const [delivEmail, setDelivEmail]         = React.useState(r.deliver_recipient_email || r.sent_to_attorney_email || "");
  const [delivDays, setDelivDays]           = React.useState(7);
  const [delivNote, setDelivNote]           = React.useState("");
  const [delivLink, setDelivLink]           = React.useState(r.deliver_link || "");

  let notes: any = {};
  try { notes = JSON.parse(r.notes || "{}"); } catch {}
  const subjName = notes.subject_name_override || selCase?.subject_name || "";
  const caseNum  = notes.case_number_override  || selCase?.claim_number || "";

  const FORMATS = [
    { v:"%m/%d/%Y  %I:%M:%S %p", l:"07/12/2026  06:24:35 PM" },
    { v:"%Y-%m-%d  %H:%M:%S",    l:"2026-07-12  18:24:35"    },
    { v:"%m/%d/%Y %H:%M:%S",     l:"07/12/2026 18:24:35"     },
    { v:"%b %d %Y  %I:%M %p",    l:"Jul 12 2026  06:24 PM"   },
  ];

  const stepDone = (n: number) =>
    n===1 ? true : n===2 ? !!r.sha256_final :
    n===3 ? !!r.wasabi_pub_key : !!(r.sent_to_attorney_at);

  const stepColor = (n: number) => stepDone(n) ? c.grn : step===n ? c.acc : c.mut;
  const inp = { width:"100%", boxSizing:"border-box" as any, padding:"6px 9px",
    fontSize:12, border:`1px solid ${c.bdr}`, borderRadius:5, background:c.bg2, color:c.txt, outline:"none" };
  const lbl = { fontSize:10, color:c.sec, margin:"0 0 3px", display:"block" as any };
  const sec = { fontSize:9, textTransform:"uppercase" as any, letterSpacing:"0.07em",
    color:c.mut, fontWeight:700, margin:"0 0 10px" };

  return (
    <div style={{ border:`1px solid ${c.acc}`, borderTop:"none",
      borderRadius:"0 0 8px 8px", background:c.bg1, overflow:"hidden" }}>

      {/* Step tabs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderBottom:`1px solid ${c.bdr}` }}>
        {([
          [1,"📤 Upload",  r.upload_method==="platform"?"Authenticated":"Folder watch"],
          [2,"🎬 Process", r.sha256_final?"Done":"Pending"],
          [3,"☁️ Publish", r.wasabi_pub_key?"Uploaded":r.sha256_final?"Ready":"Locked"],
          [4,"📨 Deliver", r.sent_to_attorney_at?"Sent":r.wasabi_pub_key?"Ready":"Locked"],
        ] as [number,string,string][]).map(([n,label,sub])=>(
          <button key={n} onClick={()=>setStep(n as any)}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px",
              background: step===n ? `${c.acc}15` : "transparent",
              border:"none", borderRight:`1px solid ${c.bdr}`, cursor:"pointer", textAlign:"left" }}>
            <div style={{ width:24,height:24,borderRadius:"50%",flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,
              background:`${stepColor(n)}22`,border:`2px solid ${stepColor(n)}`,color:stepColor(n) }}>
              {stepDone(n)?"✓":n}
            </div>
            <div>
              <p style={{ fontSize:11,fontWeight:700,color:step===n?c.acc:c.txt,margin:0 }}>{label}</p>
              <p style={{ fontSize:10,color:c.sec,margin:0 }}>{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── STEP 1: Chain of custody ── */}
      {step===1 && (
        <div style={{ padding:"14px 16px" }}>
          <p style={sec}>Chain of custody timeline</p>
          {[
            {icon:"🎥",label:"Camera recorded",done:!!r.media_created_at,
              detail:r.media_created_at?new Date(r.media_created_at).toLocaleString():"⚠️ Not in file metadata"},
            {icon:"📤",label:"Uploaded",done:true,
              detail:`${r.uploaded_by_name} · ${r.upload_method==="platform"?"🔐 authenticated":"📁 folder"} · ${r.uploaded_at?.slice(0,10)}`},
            {icon:"✅",label:"Authorship confirmed",done:!!(r.confirmed_at||r.upload_method==="platform"),
              detail:r.upload_method==="platform"?"Implicit (authenticated)":r.confirmed_at?`Confirmed by ${r.confirmed_by_name}`:"⚠️ Pending"},
            {icon:"🎬",label:"Processed",done:!!r.sha256_final,
              detail:r.sha256_final?"Timestamp burned + trailer added":"Pending"},
            {icon:"☁️",label:"Published to Wasabi",done:!!r.wasabi_pub_key,
              detail:r.wasabi_pub_key?`${r.wasabi_pub_bucket}/${(r.wasabi_pub_key||"").split("/").pop()}`:"Pending"},
            {icon:"📨",label:"Delivered",done:!!r.sent_to_attorney_at,
              detail:r.sent_to_attorney_at?`Sent to ${r.sent_to_attorney_email}`:"Not delivered"},
          ].map((s,i)=>(
            <div key={i} style={{ display:"flex",gap:10,marginBottom:10,position:"relative" }}>
              {i<5 && <div style={{ position:"absolute",left:12,top:26,bottom:-10,width:1,
                background:s.done?c.acc:c.bdr,zIndex:0 }}/>}
              <div style={{ width:24,height:24,borderRadius:"50%",zIndex:1,flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,
                background:s.done?`${c.acc}22`:c.bg1,border:`2px solid ${s.done?c.acc:c.bdr}` }}>
                {s.icon}
              </div>
              <div style={{ paddingTop:2 }}>
                <p style={{ fontSize:12,fontWeight:600,color:c.txt,margin:0 }}>{s.label}</p>
                <p style={{ fontSize:11,color:c.sec,margin:0 }}>{s.detail}</p>
              </div>
            </div>
          ))}
          <div style={{ marginTop:10,padding:"8px 10px",background:c.bg2,borderRadius:6,border:`1px solid ${c.bdr}` }}>
            <p style={sec}>SHA-256 chain</p>
            {[["Raw",r.sha256_raw],["Stamped",r.sha256_timestamped],["Final",r.sha256_final],["Published",r.sha256_published]].map(([l,v])=>(
              <div key={l} style={{ marginBottom:5 }}>
                <p style={{ fontSize:9,textTransform:"uppercase",color:c.mut,margin:"0 0 1px",fontWeight:700 }}>{l}</p>
                <p style={{ fontSize:10,fontFamily:"monospace",color:v?c.acc:c.mut,margin:0,wordBreak:"break-all" }}>{v||"—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: Process ── */}
      {step===2 && (
        <div style={{ padding:"14px 16px" }}>
          <p style={sec}>Title card</p>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12 }}>
            <div><label style={lbl}>Subject name</label>
              <input id={`subj-${r.id}`} defaultValue={subjName} placeholder="e.g. Joanna Marquez" style={inp}/></div>
            <div><label style={lbl}>Case / Claim #</label>
              <input id={`case-${r.id}`} defaultValue={caseNum} placeholder="e.g. 27000700" style={inp}/></div>
          </div>
          {!r.media_created_at && (
            <div style={{ marginBottom:12 }}>
              <label style={{ ...lbl,color:"#f59e0b" }}>⚠️ No camera date — enter manually</label>
              <input id={`dt-${r.id}`} type="datetime-local" style={{ ...inp,border:`1px solid #f59e0b` }}/>
            </div>
          )}

          <p style={{ ...sec,marginTop:6 }}>Timestamp overlay</p>
          {/* ── Video preview panel ── */}
          <div style={{ marginBottom:12,borderRadius:8,overflow:"hidden",
            border:`1px solid ${c.bdr}`,background:"#000" }}>

            {/* Header bar */}
            <div style={{ display:"flex",gap:6,padding:"7px 10px",
              background:c.bg2,borderBottom:previewOpen?`1px solid ${c.bdr}`:"none",
              flexWrap:"wrap" }}>
              <button onClick={()=>fetchFrame()}
                disabled={previewLoading}
                style={{ padding:"4px 11px",fontSize:11,fontWeight:600,cursor:"pointer",
                  background:videoMode==="frame"&&previewOpen?c.acc:"transparent",
                  color:videoMode==="frame"&&previewOpen?"white":c.sec,
                  border:`1px solid ${videoMode==="frame"&&previewOpen?c.acc:c.bdr}`,borderRadius:5 }}>
                {previewLoading&&videoMode==="frame" ? "⏳ Loading…" : "🖼 Frame preview"}
              </button>
              <button onClick={()=>openFullVideo("raw")}
                disabled={videoLoading}
                style={{ padding:"4px 11px",fontSize:11,fontWeight:600,cursor:"pointer",
                  background:videoMode==="full"&&previewOpen&&!videoSrc?.includes("download")?"#7c3aed":"transparent",
                  color:videoMode==="full"&&previewOpen&&!videoSrc?.includes("download")?"white":c.sec,
                  border:`1px solid ${videoMode==="full"&&previewOpen&&!videoSrc?.includes("download")?"#7c3aed":c.bdr}`,borderRadius:5 }}>
                {videoLoading&&videoMode==="full"&&!videoSrc?.includes("download") ? "⏳ Loading…" : "▶ Play raw video"}
              </button>
              {r.sha256_final && (
                <button onClick={()=>openFullVideo("output")}
                  disabled={videoLoading}
                  style={{ padding:"4px 11px",fontSize:11,fontWeight:600,cursor:"pointer",
                    background:videoMode==="full"&&previewOpen&&videoSrc?.includes("download")?"#10b981":"transparent",
                    color:videoMode==="full"&&previewOpen&&videoSrc?.includes("download")?"white":c.sec,
                    border:`1px solid ${videoMode==="full"&&previewOpen&&videoSrc?.includes("download")?"#10b981":c.bdr}`,borderRadius:5 }}>
                  {videoLoading&&videoSrc?.includes("download") ? "⏳ Loading…" : "▶ Play processed"}
                </button>
              )}
              {previewOpen && (
                <button onClick={()=>{setPreviewOpen(false);setVideoSrc(null);}}
                  style={{ marginLeft:"auto",padding:"4px 10px",fontSize:11,cursor:"pointer",
                    background:"transparent",border:`1px solid ${c.bdr}`,
                    borderRadius:5,color:c.mut }}>
                  ✕ Close
                </button>
              )}
            </div>

            {/* Content area */}
            {previewOpen && (
              <div>
                {/* Full video player */}
                {videoMode==="full" && (
                  <div style={{ background:"#000",lineHeight:0 }}>
                    {videoSrc ? (
                      <video
                        key={videoSrc}
                        src={videoSrc}
                        controls
                        autoPlay={false}
                        style={{ width:"100%",maxHeight:400,display:"block",background:"#000" }}
                      />
                    ) : (
                      <div style={{ height:180,display:"flex",flexDirection:"column",
                        alignItems:"center",justifyContent:"center",
                        gap:10,padding:"0 30px",background:"#111" }}>
                        <p style={{ fontSize:12,color:c.sec,margin:0,textAlign:"center" }}>
                          {videoLoadMsg||"⏳ Loading…"}
                        </p>
                        {videoProgress >= 0 ? (
                          <div style={{ width:"100%",height:5,background:"#222",
                            borderRadius:3,overflow:"hidden" }}>
                            <div style={{ height:"100%",borderRadius:3,
                              width:`${Math.max(3,videoProgress)}%`,
                              transition:"width 0.2s",
                              background:`linear-gradient(90deg,${c.acc},#a855f7)` }}/>
                          </div>
                        ) : (
                          <div style={{ width:26,height:26,borderRadius:"50%",
                            border:`3px solid #333`,borderTopColor:c.acc,
                            animation:"vcSpin 0.8s linear infinite" }}/>
                        )}
                        {videoProgress > 0 && videoProgress < 100 && (
                          <p style={{ fontSize:10,color:c.mut,margin:0 }}>{videoProgress}%</p>
                        )}
                        <style>{`@keyframes vcSpin{to{transform:rotate(360deg)}}`}</style>
                      </div>
                    )}
                  </div>
                )}

                {/* Frame preview with enhancement simulation */}
                {videoMode==="frame" && (
                  <div style={{ position:"relative" }}>
                    {previewLoading ? (
                      <div style={{ height:160,display:"flex",alignItems:"center",
                        justifyContent:"center",color:c.mut,fontSize:12,background:"#111" }}>
                        ⏳ Extracting frame…
                      </div>
                    ) : previewFrame ? (
                      <div style={{ position:"relative",lineHeight:0 }}>
                        {/* Toggle raw/enhanced */}
                        <div style={{ position:"absolute",top:8,left:8,zIndex:10,
                          display:"flex",gap:4 }}>
                          {(["raw","enhanced"] as const).map(m=>(
                            <button key={m} onClick={()=>setPreviewMode(m)}
                              style={{ padding:"3px 9px",fontSize:10,fontWeight:700,cursor:"pointer",
                                background:previewMode===m?"rgba(0,0,0,0.8)":"rgba(0,0,0,0.4)",
                                color:previewMode===m?c.acc:"rgba(255,255,255,0.6)",
                                border:`1px solid ${previewMode===m?c.acc:"rgba(255,255,255,0.2)"}`,
                                borderRadius:4 }}>
                              {m==="raw"?"Original":"✨ Enhanced"}
                            </button>
                          ))}
                        </div>
                        {/* Frame image with CSS filter simulation */}
                        <img
                          src={`data:image/jpeg;base64,${previewFrame}`}
                          alt="video frame"
                          style={{
                            width:"100%",display:"block",
                            filter: previewMode==="enhanced" && ceEnabled ? [
                              `brightness(${(1 + ceBrightness * 2).toFixed(2)})`,
                              `contrast(${ceContrast.toFixed(2)})`,
                              `saturate(${ceSaturation.toFixed(2)})`,
                              `gamma(${ceGamma.toFixed(2)})`,
                            ].join(" ") : "none",
                            transition:"filter 0.12s ease",
                          }}
                        />
                        {/* Sharpen badge */}
                        {previewMode==="enhanced" && ceEnabled && ceSharpen > 0 && (
                          <div style={{ position:"absolute",top:8,right:8,
                            background:"rgba(0,0,0,0.7)",borderRadius:4,
                            padding:"2px 8px",fontSize:10,color:"#a3e635",fontWeight:600 }}>
                            sharpen ×{ceSharpen.toFixed(1)}
                          </div>
                        )}
                        {/* Simulated timestamp */}
                        <div style={{
                          position:"absolute",fontSize:10,fontFamily:"monospace",fontWeight:700,
                          color:tsColor,padding:"3px 7px",lineHeight:1.6,pointerEvents:"none",
                          background:`rgba(0,0,0,${tsOpacity})`,borderRadius:3,
                          ...(tsPosition==="bottom-left" ?{bottom:44,left:8}:
                              tsPosition==="bottom-right"?{bottom:44,right:8}:
                              tsPosition==="top-left"   ?{top:8,left:8}:{top:8,right:8})
                        }}>
                          08/15/2026<br/>09:30:22 AM
                          {tsExtras.includes("investigator")&&<div>INV: Investigator</div>}
                          {tsExtras.includes("claim")&&<div>CLM: {caseNum||"—"}</div>}
                        </div>
                        {/* Seek scrubber */}
                        <div style={{ padding:"7px 10px",background:"rgba(0,0,0,0.85)",
                          display:"flex",gap:8,alignItems:"center" }}>
                          <span style={{ fontSize:10,color:"rgba(255,255,255,0.5)",
                            flexShrink:0,minWidth:60 }}>
                            {previewSeek.toFixed(0)}s / {previewDur.toFixed(0)}s
                          </span>
                          <input type="range"
                            min={0.5} max={Math.max(1, previewDur - 0.5)} step={1}
                            value={previewSeek}
                            onChange={e=>setPreviewSeek(Number(e.target.value))}
                            onMouseUp={e=>fetchFrame(Number((e.target as HTMLInputElement).value))}
                            onTouchEnd={e=>fetchFrame(Number((e.target as HTMLInputElement).value))}
                            style={{ flex:1,accentColor:c.acc }}/>
                        </div>
                      </div>
                    ) : (
                      <div style={{ height:120,display:"flex",alignItems:"center",
                        justifyContent:"center",color:c.mut,fontSize:12,background:"#111" }}>
                        Click "Frame preview" to load
                      </div>
                    )}
                  </div>
                )}

                {/* Trailer strip at bottom */}
                {trailerPreview?.thumbnail_b64 && (
                  <div style={{ padding:"8px 10px",background:c.bg2,
                    borderTop:`1px solid ${c.bdr}`,display:"flex",gap:10,alignItems:"center" }}>
                    <img src={`data:image/jpeg;base64,${trailerPreview.thumbnail_b64}`}
                      alt="trailer" style={{ width:90,borderRadius:4,flexShrink:0,
                        border:`1px solid ${c.bdr}` }}/>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:11,fontWeight:700,color:c.txt,margin:"0 0 2px" }}>
                        🎬 {trailerPreview.state_name}
                        <span style={{ fontSize:10,fontWeight:400,color:
                          trailerPreview.trailer_match==="exact"?c.grn:"#f59e0b",marginLeft:6 }}>
                          {trailerPreview.trailer_match==="exact"?"✓ exact match":"⚠ fallback"}
                        </span>
                      </p>
                      <p style={{ fontSize:10,color:c.mut,margin:"0 0 4px",wordBreak:"break-all" }}>
                        {trailerPreview.trailer_filename}
                      </p>
                      <p style={{ fontSize:10,color:c.sec,margin:0 }}>
                        Final = trailer (13.9s) + processed footage
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live preview (timestamp position mock) */}
          <div style={{ position:"relative",width:"100%",height:58,background:"#0f0f1a",
            borderRadius:6,marginBottom:10,overflow:"hidden",border:`1px solid ${c.bdr}` }}>
            <p style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",
              justifyContent:"center",color:"rgba(255,255,255,0.1)",fontSize:11,margin:0 }}>
              Video preview
            </p>
            <div style={{ position:"absolute",fontSize:10,fontFamily:"monospace",fontWeight:600,
              color:tsColor,padding:"3px 6px",lineHeight:1.5,
              background:`rgba(0,0,0,${tsOpacity})`,borderRadius:3,
              ...(tsPosition==="bottom-left"?{bottom:5,left:5}:
                  tsPosition==="bottom-right"?{bottom:5,right:5}:
                  tsPosition==="top-left"?{top:5,left:5}:{top:5,right:5}) }}>
              07/12/2026&nbsp;&nbsp;06:24:35 PM
              {tsExtras.includes("investigator")&&<div>INV: Frank Tapia</div>}
              {tsExtras.includes("claim")&&<div>CLM: {caseNum||"27000700"}</div>}
            </div>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
            <div><label style={lbl}>Position</label>
              <select value={tsPosition} onChange={e=>setTsPosition(e.target.value)} style={inp}>
                {["bottom-left","bottom-right","top-left","top-right"].map(p=>(
                  <option key={p} value={p}>{p.replace(/-/g," ").replace(/\b\w/g,x=>x.toUpperCase())}</option>
                ))}
              </select></div>
            <div><label style={lbl}>Font style</label>
              <select value={tsFontStyle} onChange={e=>setTsFontStyle(e.target.value)} style={inp}>
                {["duplex","simplex","triplex","plain"].map(s=>(
                  <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
                ))}
              </select></div>
            <div><label style={lbl}>Text color</label>
              <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                <input type="color" value={tsColor} onChange={e=>setTsColor(e.target.value)}
                  style={{ width:36,height:28,border:`1px solid ${c.bdr}`,borderRadius:4,cursor:"pointer",padding:2 }}/>
                <span style={{ fontSize:11,color:c.sec,fontFamily:"monospace" }}>{tsColor}</span>
              </div></div>
            <div><label style={lbl}>Box opacity: <strong style={{color:c.txt}}>{Math.round(tsOpacity*100)}%</strong></label>
              <input type="range" min={0} max={1} step={0.05} value={tsOpacity}
                onChange={e=>setTsOpacity(Number(e.target.value))} style={{ width:"100%",marginTop:6 }}/></div>
            <div><label style={lbl}>Font scale: <strong style={{color:c.txt}}>{tsFontScale}</strong></label>
              <input type="range" min={0.5} max={2.5} step={0.1} value={tsFontScale}
                onChange={e=>setTsFontScale(Number(e.target.value))} style={{ width:"100%",marginTop:6 }}/></div>
            <div><label style={lbl}>Date/time format</label>
              <select value={tsFormat} onChange={e=>setTsFormat(e.target.value)} style={inp}>
                {FORMATS.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
              </select></div>
          </div>

          <div style={{ marginBottom:10 }}>
            <label style={lbl}>Extra overlay fields</label>
            <div style={{ display:"flex",gap:12 }}>
              {(["investigator","claim"] as string[]).map(ex=>(
                <label key={ex} style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:c.txt,cursor:"pointer" }}>
                  <input type="checkbox" checked={tsExtras.includes(ex)}
                    onChange={e=>setTsExtras(p=>e.target.checked?[...p,ex]:p.filter(x=>x!==ex))}/>
                  {ex==="investigator"?"Investigator name":"Claim #"}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
            <div><label style={lbl}>Title card font</label>
              <select value={fontFile} onChange={e=>setFontFile(e.target.value)} style={inp}>
                {fonts.length>0?fonts.map((f:any)=><option key={f.filename} value={f.filename}>{f.name}</option>)
                  :<option value="biondi.ttf">Biondi (default)</option>}
              </select></div>
            <div><label style={lbl}>Font size: <strong style={{color:c.txt}}>{fontSize}px</strong></label>
              <input type="range" min={28} max={80} value={fontSize}
                onChange={e=>setFontSize(Number(e.target.value))} style={{ width:"100%",marginTop:6 }}/></div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={lbl}>Output folder</label>
            <select value={outputFolder} onChange={async e=>{setOutputFolder(e.target.value);await savePrefs(fontFile,fontSize,e.target.value);}} style={inp}>
              {availFolders.length>0?availFolders.map((f:any)=><option key={f.path} value={f.path}>{f.name}</option>)
                :<option value="">OUTPUT (default)</option>}
            </select>
          </div>

          {/* Trailer preview */}
          <div style={{ marginBottom:12,borderRadius:7,overflow:"hidden",
            border:`1px solid ${c.bdr}` }}>

            {/* Header */}
            <div style={{ padding:"7px 12px",background:c.bg2,
              borderBottom:`1px solid ${c.bdr}`,
              display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.07em",
                textTransform:"uppercase",color:c.mut }}>Trailer</span>
              <button onClick={()=>fetchTrailerPreview(stateOverride||undefined)}
                style={{ fontSize:11,padding:"2px 8px",cursor:"pointer",
                  background:"transparent",border:`1px solid ${c.bdr}`,
                  borderRadius:4,color:c.sec }}>
                {trailerLoading ? "⏳" : "↻ Refresh"}
              </button>
            </div>

            {/* Content */}
            <div style={{ padding:"10px 12px",background:c.bg1 }}>
              {trailerPreview ? (
                <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                  {/* Thumbnail */}
                  {trailerPreview.thumbnail_b64 && (
                    <img src={`data:image/jpeg;base64,${trailerPreview.thumbnail_b64}`}
                      alt="trailer"
                      style={{ width:110,borderRadius:5,flexShrink:0,
                        border:`1px solid ${c.bdr}`,display:"block" }}/>
                  )}
                  <div style={{ flex:1,minWidth:0 }}>
                    {/* Match badge */}
                    <div style={{ display:"inline-flex",alignItems:"center",gap:6,
                      padding:"3px 9px",borderRadius:20,marginBottom:6,
                      background: trailerPreview.trailer_match==="exact"
                        ? `${c.grn}20` : "#f59e0b20",
                      border:`1px solid ${trailerPreview.trailer_match==="exact"
                        ? c.grn : "#f59e0b"}` }}>
                      <span style={{ fontSize:11,fontWeight:700,
                        color: trailerPreview.trailer_match==="exact" ? c.grn : "#f59e0b" }}>
                        {trailerPreview.trailer_match==="exact" ? "✓" : "⚠"}
                      </span>
                      <span style={{ fontSize:11,fontWeight:600,
                        color: trailerPreview.trailer_match==="exact" ? c.grn : "#f59e0b" }}>
                        {trailerPreview.state_name}
                      </span>
                      {trailerPreview.trailer_match!=="exact" && (
                        <span style={{ fontSize:10,color:"#f59e0b" }}>(fallback)</span>
                      )}
                    </div>
                    {/* Filename */}
                    <p style={{ fontSize:10,color:c.mut,margin:"0 0 8px",
                      wordBreak:"break-all",lineHeight:1.4 }}>
                      {trailerPreview.trailer_filename}
                    </p>
                    {/* Override — botones por estado en lugar de select */}
                    <p style={{ fontSize:10,color:c.sec,margin:"0 0 6px",fontWeight:600 }}>
                      Override state:
                    </p>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
                      {/* Auto-detect option */}
                      <button
                        onClick={()=>{ setStateOverride(""); fetchTrailerPreview(undefined); }}
                        style={{
                          padding:"3px 9px",fontSize:10,fontWeight:600,cursor:"pointer",
                          borderRadius:4,border:`1px solid ${!stateOverride ? c.acc : c.bdr}`,
                          background: !stateOverride ? `${c.acc}22` : "transparent",
                          color: !stateOverride ? c.acc : c.sec,
                        }}>
                        Auto
                      </button>
                      {(trailerPreview.available_states||[]).map((s:any)=>(
                        <button key={s.abbr}
                          onClick={()=>{ setStateOverride(s.abbr); fetchTrailerPreview(s.abbr); }}
                          title={s.name}
                          style={{
                            padding:"3px 8px",fontSize:10,fontWeight:600,cursor:"pointer",
                            borderRadius:4,
                            border:`1px solid ${stateOverride===s.abbr
                              ? c.acc
                              : s.has_trailer ? c.bdr : "transparent"}`,
                            background: stateOverride===s.abbr
                              ? `${c.acc}22`
                              : s.has_trailer ? "transparent" : "transparent",
                            color: stateOverride===s.abbr
                              ? c.acc
                              : s.has_trailer ? c.txt : c.mut,
                            opacity: s.has_trailer ? 1 : 0.45,
                          }}>
                          {s.abbr}
                        </button>
                      ))}
                    </div>
                    {stateOverride && (
                      <p style={{ fontSize:10,color:c.acc,margin:"6px 0 0" }}>
                        Using: <strong>{
                          trailerPreview.available_states?.find((s:any)=>s.abbr===stateOverride)?.name
                          || stateOverride
                        }</strong>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize:11,color:c.mut,margin:0,textAlign:"center",padding:"8px 0" }}>
                  {trailerLoading ? "⏳ Loading trailer info…" : "No trailer info — click Refresh"}
                </p>
              )}
            </div>
          </div>

          {/* ── Color Enhancement ── */}
          <div style={{ marginBottom:12,padding:"10px 12px",borderRadius:6,
            background:c.bg2,border:`1px solid ${c.bdr}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:ceEnabled?10:0 }}>
              <p style={{ ...sec,margin:0 }}>🎨 Color enhancement</p>
              <label style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,color:c.txt,cursor:"pointer" }}>
                <input type="checkbox" checked={ceEnabled} onChange={e=>setCeEnabled(e.target.checked)}/>
                {ceEnabled ? "Enabled" : "Disabled"}
              </label>
            </div>
            {ceEnabled && (
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                {([
                  ["Brightness", ceBrightness, setCeBrightness, -0.5,  0.5,  0.01, 0.0],
                  ["Contrast",   ceContrast,   setCeContrast,   0.5,   2.0,  0.01, 1.0],
                  ["Saturation", ceSaturation, setCeSaturation, 0.0,   3.0,  0.01, 1.0],
                  ["Gamma",      ceGamma,      setCeGamma,      0.1,   3.0,  0.01, 1.0],
                  ["Sharpen",    ceSharpen,    setCeSharpen,    0.0,   2.0,  0.05, 0.0],
                ] as [string, number, (v:number)=>void, number, number, number, number][]).map(
                  ([label, val, setter, min, max, step, def]) => (
                  <div key={label}>
                    <label style={lbl}>
                      {label}: <strong style={{color:c.txt}}>{val.toFixed(2)}</strong>
                      {val !== def && (
                        <span onClick={()=>setter(def)}
                          style={{ marginLeft:6,fontSize:9,color:c.acc,cursor:"pointer",textDecoration:"underline" }}>
                          reset
                        </span>
                      )}
                    </label>
                    <input type="range" min={min} max={max} step={step} value={val}
                      onChange={e=>setter(Number(e.target.value))}
                      style={{ width:"100%",marginTop:4,accentColor:c.acc }}/>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!r.sha256_final ? (
            <button disabled={processing} onClick={async()=>{
              const subjEl=document.getElementById(`subj-${r.id}`) as HTMLInputElement;
              const caseEl=document.getElementById(`case-${r.id}`) as HTMLInputElement;
              const dtEl=document.getElementById(`dt-${r.id}`) as HTMLInputElement;
              const patch:any={};
              if(subjEl?.value&&subjEl.value!==subjName) patch.subject_name_override=subjEl.value;
              if(caseEl?.value&&caseEl.value!==caseNum) patch.case_number_override=caseEl.value;
              if(dtEl?.value) patch.media_created_at=dtEl.value+":00Z";
              if(Object.keys(patch).length>0){
                await fetch(`${BASE}/api/video-custody/${r.id}`,{method:"PATCH",credentials:"include",
                  headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)});
              }
              await savePrefs();
              setProcessing(true);
              try{
                const params=new URLSearchParams({
                  font_file:fontFile,font_size:String(fontSize),
                  ts_position:tsPosition,ts_font_style:tsFontStyle,
                  ts_color:tsColor,ts_opacity:String(tsOpacity),
                  ts_font_scale:String(tsFontScale),ts_format:tsFormat,
                  ts_extras:tsExtras.join(","),
                  ...(stateOverride ? {state_override: stateOverride} : {}),
                  ce_enabled:String(ceEnabled),
                  ce_brightness:String(ceBrightness),
                  ce_contrast:String(ceContrast),
                  ce_saturation:String(ceSaturation),
                  ce_gamma:String(ceGamma),
                  ce_sharpen:String(ceSharpen),
                });
                const res=await fetch(`${BASE}/api/video-custody/${r.id}/process?${params}`,{method:"POST",credentials:"include"});
                const d=await res.json();
                if(d.ok){loadRecords(selCase?.id);setStep(3);}
                else alert(`❌ ${d.error||"Process failed"}`);
              }finally{setProcessing(false);}
            }}
            style={{ width:"100%",padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",
              background:processing?c.mut:"linear-gradient(135deg,#7c3aed,#5b21b6)",
              color:"white",border:"none",borderRadius:7,opacity:processing?0.7:1 }}>
              {processing?"⏳ Processing…":"🎬 Process — Burn timestamp + title card + trailer"}
            </button>
          ) : (
            <div>
              <div style={{ padding:"10px 14px",borderRadius:7,background:`${c.grn}18`,
                border:`1px solid ${c.grn}`,marginBottom:10 }}>
                <p style={{ fontSize:12,fontWeight:700,color:c.grn,margin:"0 0 6px" }}>
                  ✅ Processed — {r.output_filename}
                </p>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,fontSize:10,color:c.sec,marginBottom:8 }}>
                  <span>SHA-256 raw:<br/><code style={{color:c.txt,fontSize:9}}>{(r.sha256_raw||"").slice(0,16)}…</code></span>
                  <span>SHA-256 final:<br/><code style={{color:c.txt,fontSize:9}}>{(r.sha256_final||"").slice(0,16)}…</code></span>
                  <span>Color enhanced:<br/><code style={{color:c.txt,fontSize:9}}>{r.color_enhanced?"Yes":"—"}</code></span>
                </div>
                <div style={{ display:"flex",gap:6 }}>
                  <a href={`${BASE}/api/video-custody/${r.id}/download`}
                    style={{ flex:1,padding:"8px",fontSize:12,fontWeight:600,textAlign:"center",
                      background:"#7c3aed",color:"white",borderRadius:6,textDecoration:"none",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:4 }}>
                    ⬇ Download video
                  </a>
                  <a href={`${BASE}/api/video-custody/${r.id}/report`}
                    style={{ flex:1,padding:"8px",fontSize:12,fontWeight:600,textAlign:"center",
                      background:c.bg2,color:c.txt,border:`1px solid ${c.bdr}`,
                      borderRadius:6,textDecoration:"none",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:4 }}>
                    📄 Chain of custody report
                  </a>
                </div>
              </div>
              <button onClick={()=>setStep(3)}
                style={{ width:"100%",padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",
                  background:`linear-gradient(135deg,#0ea5e9,#0284c7)`,
                  color:"white",border:"none",borderRadius:7 }}>
                Next → Publish to Wasabi ☁️
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Publish ── */}
      {step===3 && (
        <div style={{ padding:"14px 16px" }}>
          <p style={sec}>Upload to Wasabi pub-video bucket</p>
          {!r.sha256_final ? (
            <div style={{ padding:"20px",textAlign:"center",color:c.mut,fontSize:13 }}>
              🔒 Complete Step 2 (Process) first
            </div>
          ) : r.wasabi_pub_key ? (
            <div>
              <div style={{ padding:"10px 12px",borderRadius:7,background:`${c.grn}18`,
                border:`1px solid ${c.grn}`,marginBottom:12 }}>
                <p style={{ fontSize:12,fontWeight:700,color:c.grn,margin:"0 0 6px" }}>✅ Published to Wasabi</p>
                <p style={{ fontSize:11,color:c.sec,margin:"0 0 3px" }}>Bucket: <code style={{color:c.txt}}>{r.wasabi_pub_bucket}</code></p>
                <p style={{ fontSize:11,color:c.sec,margin:"0 0 3px" }}>Key: <code style={{color:c.txt,wordBreak:"break-all"}}>{r.wasabi_pub_key}</code></p>
                <p style={{ fontSize:11,color:c.sec,margin:0 }}>SHA-256: <code style={{color:c.txt}}>{(r.sha256_published||"").slice(0,32)}…</code></p>
              </div>
              <button onClick={()=>setStep(4)}
                style={{ width:"100%",padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",
                  background:c.acc,color:"white",border:"none",borderRadius:7 }}>
                Next → Deliver to client 📨
              </button>
            </div>
          ) : (
            <div>
              <div style={{ padding:"10px 12px",borderRadius:6,background:c.bg2,
                border:`1px solid ${c.bdr}`,marginBottom:12,fontSize:12,color:c.sec }}>
                <p style={{ margin:"0 0 4px",fontWeight:600,color:c.txt }}>📹 {r.output_filename}</p>
                <p style={{ margin:0 }}>Uploads the processed video to the secure
                  <strong style={{color:c.acc}}> pub-video</strong> bucket with chain of custody tracking.
                  SHA-256 will be computed and recorded.</p>
              </div>
              <button disabled={publishing} onClick={async()=>{
                setPublishing(true);
                try{
                  const res=await fetch(`${BASE}/api/video-custody/${r.id}/publish`,{method:"POST",credentials:"include"});
                  const d=await res.json();
                  if(d.ok){loadRecords(selCase?.id);setStep(4);}
                  else alert(`❌ ${d.error||"Publish failed"}`);
                }finally{setPublishing(false);}
              }}
              style={{ width:"100%",padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",
                background:publishing?c.mut:"linear-gradient(135deg,#0ea5e9,#0284c7)",
                color:"white",border:"none",borderRadius:7,opacity:publishing?0.7:1 }}>
                {publishing?"⏳ Uploading to Wasabi…":"☁️ Publish to Wasabi"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 4: Deliver ── */}
      {step===4 && (
        <div style={{ padding:"14px 16px" }}>
          <p style={sec}>Send secure link to client</p>
          {!r.wasabi_pub_key ? (
            <div style={{ padding:"20px",textAlign:"center",color:c.mut,fontSize:13 }}>
              🔒 Complete Step 3 (Publish) first
            </div>
          ) : (
            <div>
              {delivLink && (
                <div style={{ padding:"10px 12px",borderRadius:7,background:`${c.grn}18`,
                  border:`1px solid ${c.grn}`,marginBottom:12 }}>
                  <p style={{ fontSize:12,fontWeight:700,color:c.grn,margin:"0 0 4px" }}>
                    ✅ Link delivered to {r.deliver_recipient||r.sent_to_attorney_email}
                  </p>
                  <p style={{ fontSize:11,color:c.sec,margin:"0 0 6px" }}>
                    Expires: {r.deliver_expires_at?new Date(r.deliver_expires_at).toLocaleDateString():"—"}
                  </p>
                  <div style={{ display:"flex",gap:6 }}>
                    <button onClick={()=>navigator.clipboard.writeText(delivLink)}
                      style={{ flex:1,padding:"6px",fontSize:11,fontWeight:600,cursor:"pointer",
                        background:c.acc,color:"white",border:"none",borderRadius:5 }}>
                      📋 Copy link
                    </button>
                    <a href={delivLink} target="_blank" rel="noreferrer"
                      style={{ flex:1,padding:"6px",fontSize:11,fontWeight:600,
                        background:c.bg2,color:c.txt,border:`1px solid ${c.bdr}`,
                        borderRadius:5,textDecoration:"none",textAlign:"center" }}>
                      🔗 Open link
                    </a>
                  </div>
                </div>
              )}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                <div><label style={lbl}>Recipient name</label>
                  <input value={delivRecipient} onChange={e=>setDelivRecipient(e.target.value)}
                    placeholder="e.g. Ava Maynard" style={inp}/></div>
                <div><label style={lbl}>Recipient email</label>
                  <input type="email" value={delivEmail} onChange={e=>setDelivEmail(e.target.value)}
                    placeholder="e.g. amaynard@gvlaw.com" style={inp}/></div>
              </div>
              <div style={{ marginBottom:8 }}>
                <label style={lbl}>Link expires in</label>
                <div style={{ display:"flex",gap:6 }}>
                  {[3,7,14,30,90].map(d=>(
                    <button key={d} onClick={()=>setDelivDays(d)}
                      style={{ flex:1,padding:"6px",fontSize:11,fontWeight:600,cursor:"pointer",
                        background:delivDays===d?c.acc:c.bg2,color:delivDays===d?"white":c.txt,
                        border:`1px solid ${delivDays===d?c.acc:c.bdr}`,borderRadius:5 }}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={lbl}>Note (optional)</label>
                <input value={delivNote} onChange={e=>setDelivNote(e.target.value)}
                  placeholder="e.g. Surveillance footage for deposition 08/19" style={inp}/>
              </div>
              <button disabled={delivering||!delivEmail} onClick={async()=>{
                setDelivering(true);
                try{
                  const res=await fetch(`${BASE}/api/video-custody/${r.id}/deliver`,{
                    method:"POST",credentials:"include",
                    headers:{"Content-Type":"application/json"},
                    body:JSON.stringify({recipient_name:delivRecipient,recipient_email:delivEmail,
                      expiry_days:delivDays,note:delivNote})
                  });
                  const d=await res.json();
                  if(d.ok){setDelivLink(d.link);loadRecords(selCase?.id);}
                  else alert(`❌ ${d.error||"Deliver failed"}`);
                }finally{setDelivering(false);}
              }}
              style={{ width:"100%",padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",
                background:delivering||!delivEmail?c.mut:"linear-gradient(135deg,#10b981,#059669)",
                color:"white",border:"none",borderRadius:7,opacity:delivering||!delivEmail?0.6:1 }}>
                {delivering?"⏳ Generating secure link…":"📨 Generate secure link & record delivery"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function VideoCustodyPage() {
  const dark = useTheme();
  const c = getC(dark);

  // Cases from email pipeline
  const [cases, setCases]       = useState<any[]>([]);
  const [caseSearch, setCaseSearch] = useState("");
  const [selCase, setSelCase]   = useState<any>(null);   // selected case
  const [records, setRecords]   = useState<any[]>([]);
  const [sel, setSel]           = useState<any>(null);   // selected video record

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{name:string;ok:boolean;msg:string}[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Processing prefs
  const [fonts, setFonts]             = useState<{name:string;filename:string}[]>([]);
  const [fontFile, setFontFile]       = useState("biondi.ttf");
  const [fontSize, setFontSize]       = useState(52);
  const [outputFolder, setOutputFolder] = useState("");
  const [availFolders, setAvailFolders] = useState<{name:string;path:string}[]>([]);

  // Confirmation modal
  const [confirming, setConfirming] = useState<any>(null);

  async function loadCases() {
    const r = await fetch(`${BASE}/api/video-custody/investigations/list`, { credentials:"include" });
    if (r.ok) setCases(await r.json());
  }

  async function loadRecords(invId?: number) {
    const url = invId
      ? `${BASE}/api/video-custody/records?investigation_id=${invId}`
      : `${BASE}/api/video-custody/records`;
    const r = await fetch(url, { credentials:"include" });
    if (r.ok) setRecords(await r.json());
  }

  async function loadPrefs() {
    const r = await fetch(`${BASE}/api/video-custody/fonts`, { credentials:"include" });
    if (r.ok) {
      const d = await r.json();
      if (d.fonts?.length) setFonts(d.fonts);
      if (d.default_font)  setFontFile(d.default_font);
      if (d.default_size)  setFontSize(d.default_size);
    }
    const r2 = await fetch(`${BASE}/api/video-custody/preferences`, { credentials:"include" });
    if (r2.ok) {
      const d = await r2.json();
      if (d.font_file)           setFontFile(d.font_file);
      if (d.font_size)           setFontSize(d.font_size);
      if (d.output_folder)       setOutputFolder(d.output_folder);
      if (d.available_folders?.length) setAvailFolders(d.available_folders);
    }
  }

  useEffect(() => {
    loadCases();
    loadRecords();
    loadPrefs();
  }, []);

  // When case is selected, filter records
  useEffect(() => {
    loadRecords(selCase?.id);
  }, [selCase?.id]);

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadMsg([]);
    const results: {name:string;ok:boolean;msg:string}[] = [];

    // Upload strategy:
    // - Files ≤ 90MB: upload.proti.ai proxy (direct, fast)
    // - Files > 90MB: R2 presigned URL (bypasses Cloudflare 100MB limit)
    const R2_THRESHOLD = 90 * 1024 * 1024; // 90MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sizeMB = (file.size/1e6).toFixed(0);
      const useR2 = file.size > R2_THRESHOLD;
      setUploadMsg([{name:file.name, ok:true,
        msg:`⏳ ${useR2 ? "Preparing large file upload…" : `Uploading ${sizeMB}MB…`}`}]);
      try {
        let d: any;

        if (useR2) {
          // ── R2 presigned upload ──────────────────────────────────────────
          setUploadMsg([{name:file.name, ok:true, msg:`⏳ Requesting upload URL for ${sizeMB}MB…`}]);
          const presignRes = await fetch(`${BASE}/api/video-custody/r2/presign`, {
            method:"POST", credentials:"include",
            headers:{"Content-Type":"application/json"},
            body: JSON.stringify({
              filename: file.name,
              content_type: file.type || "video/mp4",
              investigation_id: selCase?.id || null,
            }),
          });
          if (!presignRes.ok) {
            const e = await presignRes.json();
            throw new Error(e.detail || "Could not get upload URL");
          }
          const { presigned_url, r2_key } = await presignRes.json();

          // Upload directly to R2
          setUploadMsg([{name:file.name, ok:true, msg:`⏳ Uploading ${sizeMB}MB to secure storage…`}]);
          const putRes = await fetch(presigned_url, {
            method:"PUT",
            body: file,
            headers:{"Content-Type": file.type || "video/mp4"},
          });
          if (!putRes.ok) throw new Error(`R2 upload failed: ${putRes.status}`);

          // Notify backend to process
          setUploadMsg([{name:file.name, ok:true, msg:`⏳ Processing ${sizeMB}MB video…`}]);
          const completeRes = await fetch(`${BASE}/api/video-custody/r2/complete`, {
            method:"POST", credentials:"include",
            headers:{"Content-Type":"application/json"},
            body: JSON.stringify({
              r2_key, filename: file.name,
              investigation_id: selCase?.id || null,
            }),
          });
          if (!completeRes.ok) {
            const e = await completeRes.json();
            throw new Error(e.detail || "Processing failed");
          }
          d = await completeRes.json();

        } else {
          // ── Direct upload via proxy (≤90MB) ─────────────────────────────
          const isProd = window.location.hostname === "proti.ai";
          let uploadUrl = `${BASE}/api/video-custody/upload`;
          if (isProd) {
            const invParam = selCase?.id ? `?investigation_id=${selCase.id}` : "";
            const tokenRes = await fetch(
              `${BASE}/api/video-custody/upload/token${invParam}`,
              { method:"POST", credentials:"include" }
            );
            if (tokenRes.ok) {
              const { token } = await tokenRes.json();
              uploadUrl = `https://upload.proti.ai?token=${encodeURIComponent(token)}`;
            } else if (tokenRes.status === 401) {
              setUploadMsg([{name:"", ok:false, msg:"Session expired — please log in again."}]);
              setUploading(false); return;
            }
          }
          const form = new FormData();
          form.append("file", file);
          if (!isProd && selCase?.id) form.append("investigation_id", String(selCase.id));
          const fetchOpts: RequestInit = { method:"POST", body:form };
          if (!uploadUrl.includes("upload.proti.ai")) fetchOpts.credentials = "include";
          const r = await fetch(uploadUrl, fetchOpts);
          d = await r.json();
          if (!r.ok) throw new Error(d.detail || "Upload failed");
        }

        results.push({ name:file.name, ok:true,
          msg:`SHA-256: ${d.sha256_raw?.substring(0,16)}… · Camera: ${
            d.media_created_at
              ? new Date(d.media_created_at).toLocaleString()
              : "⚠️ not in metadata"
          } · ${sizeMB}MB` });
      } catch(e:any) {
        results.push({ name:file.name, ok:false, msg:e.message||"Upload failed" });
      }
    }
    setUploadMsg(results);
    setUploading(false);
    loadRecords(selCase?.id);
  }

  async function handleConfirm(rec: any) {
    await fetch(`${BASE}/api/video-custody/${rec.id}/confirm`, { method:"POST", credentials:"include" });
    setConfirming(null);
    loadRecords(selCase?.id);
  }

  async function savePrefs(ff = fontFile, fs = fontSize, of = outputFolder) {
    await fetch(`${BASE}/api/video-custody/preferences`, {
      method:"POST", credentials:"include",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ font_file:ff, font_size:fs, output_folder:of })
    });
  }

  const unconfirmed = records.filter(r => r.upload_method === "folder_watch" && !r.confirmed_at);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", minHeight:"100vh", background:c.bg2, color:c.txt }}>

      {/* ── LEFT SIDEBAR ── */}
      <div style={{ borderRight:`1px solid ${c.bdr}`, background:c.bg1, display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"16px 14px 10px", borderBottom:`1px solid ${c.bdr}` }}>
          <p style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.07em", fontWeight:700, color:c.sec, margin:"0 0 2px" }}>
            Filter by case
          </p>
          <p style={{ fontSize:11, color:c.mut, margin:0 }}>Select a case to upload videos</p>
        </div>

        {/* All */}
        <div style={{ padding:"8px 10px", borderBottom:`1px solid ${c.bdr}` }}>
          <button onClick={() => { setSelCase(null); loadRecords(); }}
            style={{ width:"100%", textAlign:"left", padding:"7px 10px", borderRadius:7,
              background: !selCase ? `${c.acc}22` : "transparent",
              border:`1px solid ${!selCase ? c.acc : "transparent"}`,
              cursor:"pointer", fontSize:12,
              color: !selCase ? c.acc : c.sec, fontWeight: !selCase ? 600 : 400 }}>
            📋 All videos ({records.length})
          </button>
        </div>

        {/* Search */}
        <div style={{ padding:"6px 8px 2px" }}>
          <input
            value={caseSearch}
            onChange={e => setCaseSearch(e.target.value)}
            placeholder="🔍 Search cases..."
            style={{ width:"100%", boxSizing:"border-box", padding:"6px 8px",
              borderRadius:6, border:`1px solid ${c.bdr}`,
              background:c.bg2, color:c.txt, fontSize:11, outline:"none" }}
          />
        </div>

        {/* Cases list */}
        <div style={{ flex:1, overflowY:"auto", padding:"6px 8px" }}>
          {cases.length === 0 ? (
            <p style={{ fontSize:12, color:c.mut, textAlign:"center", marginTop:16 }}>
              No cases yet.<br/>Cases are created<br/>from incoming emails.
            </p>
          ) : cases.filter(cas => {
              if (!caseSearch.trim()) return true;
              const q = caseSearch.toLowerCase();
              return (cas.subject_name||"").toLowerCase().includes(q) ||
                     (cas.claim_number||"").toLowerCase().includes(q);
            }).map(cas => {
            const isSelected = selCase?.id === cas.id;
            const casVids = records.filter(r => r.investigation_id === cas.id);
            const hasReady = casVids.some(r => r.status === "ready");
            return (
              <button key={cas.id} onClick={() => setSelCase(isSelected ? null : cas)}
                style={{ width:"100%", textAlign:"left", padding:"10px 10px", borderRadius:8, marginBottom:4,
                  background: isSelected ? `${c.acc}22` : c.bg2,
                  border:`1px solid ${isSelected ? c.acc : c.bdr}`,
                  cursor:"pointer" }}>
                {/* Status dot + name */}
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", flexShrink:0,
                    background: cas.status === "completed" ? c.grn :
                                cas.status === "active"    ? "#3b82f6" : c.mut }} />
                  <p style={{ fontSize:12, fontWeight:600, margin:0,
                    color: isSelected ? c.acc : c.txt,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {cas.subject_name}
                  </p>
                </div>
                {/* Claim + state */}
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  {cas.claim_number && (
                    <span style={{ fontSize:10, color:c.sec, fontFamily:"monospace" }}>
                      {cas.claim_number}
                    </span>
                  )}
                  {cas.state && (
                    <span style={{ fontSize:9, padding:"1px 5px", borderRadius:10,
                      background:`${c.mut}33`, color:c.sec }}>
                      {cas.state}
                    </span>
                  )}
                  {cas.email_class === "followup" && (
                    <span style={{ fontSize:9, padding:"1px 5px", borderRadius:10,
                      background:"#fef9c3", color:"#854d0e" }}>⟳</span>
                  )}
                </div>
                {/* Video count */}
                {cas.video_count > 0 && (
                  <div style={{ display:"flex", gap:3, marginTop:4 }}>
                    <span style={{ fontSize:10, color: hasReady ? c.grn : c.mut }}>
                      🎬 {cas.video_count} video{cas.video_count > 1 ? "s" : ""}
                      {hasReady ? " ✓" : ""}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Upload button */}
        <div style={{ padding:"10px 12px", borderTop:`1px solid ${c.bdr}` }}>
          {selCase && (
            <div style={{ border:`1px solid ${c.acc}`, borderRadius:7, padding:"7px 10px",
              background:`${c.acc}11`, marginBottom:8 }}>
              <p style={{ fontSize:11, fontWeight:600, color:c.acc, margin:"0 0 1px" }}>
                {selCase.subject_name}
              </p>
              <p style={{ fontSize:10, color:c.sec, margin:0 }}>
                {selCase.claim_number} {selCase.state ? `· ${selCase.state}` : ""}
              </p>
            </div>
          )}
          <button onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ width:"100%", padding:"10px", fontSize:12, fontWeight:600,
              cursor: uploading ? "wait" : "pointer",
              background: uploading ? c.mut : c.acc,
              color:"white", border:"none", borderRadius:7 }}>
            {uploading ? "⏳ Uploading..." : selCase ? `📤 Upload for ${selCase.subject_name.split(" ")[0]}` : "📤 Upload video"}
          </button>
          <input ref={fileRef} type="file"
            accept="video/*,.mp4,.mov,.avi,.mts,.MTS,.MP4,.MOV"
            multiple style={{ display:"none" }}
            onChange={e => handleUpload(e.target.files)} />
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ overflow:"auto", padding:"24px 28px" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:16, marginBottom:20 }}>
          <div style={{ flex:1 }}>
            <h1 style={{ fontSize:20, fontWeight:700, margin:"0 0 3px", color:c.txt }}>
              🔐 Video Chain of Custody
              {selCase && <span style={{ fontSize:14, fontWeight:400, color:c.sec, marginLeft:10 }}>
                — {selCase.subject_name} ({selCase.claim_number})
              </span>}
            </h1>
            <p style={{ fontSize:12, color:c.sec, margin:0 }}>
              SHA-256 verified at every step · Immutable audit trail
            </p>
          </div>
          <button onClick={() => loadRecords(selCase?.id)}
            style={{ padding:"7px 12px", fontSize:12, cursor:"pointer",
              background:c.bg1, border:`1px solid ${c.bdr}`, borderRadius:7, color:c.sec }}>
            ↺ Refresh
          </button>
        </div>

        {/* Unconfirmed banner */}
        {unconfirmed.length > 0 && (
          <div style={{ border:`1px solid ${c.yel}`, borderRadius:10, padding:"12px 16px",
            background: dark ? "rgba(245,158,11,0.1)" : "#fffbeb", marginBottom:20 }}>
            <p style={{ fontSize:13, fontWeight:600, color:"#92400e", margin:"0 0 8px" }}>
              ⚠️ {unconfirmed.length} video{unconfirmed.length > 1?"s":""} need authorship confirmation
            </p>
            {unconfirmed.map(r => (
              <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5,
                padding:"7px 10px", background:c.bg2, borderRadius:6, border:`1px solid ${c.bdr}` }}>
                <span style={{ fontSize:12, flex:1, color:c.txt }}>📹 {r.original_filename}</span>
                <span style={{ fontSize:11, color:c.sec }}>{fmtDate(r.uploaded_at)}</span>
                <button onClick={() => setConfirming(r)}
                  style={{ fontSize:12, fontWeight:600, padding:"5px 14px", cursor:"pointer",
                    background:c.acc, color:"white", border:"none", borderRadius:6 }}>
                  ✅ Confirm
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload results */}
        {uploadMsg.length > 0 && (
          <div style={{ border:`1px solid ${c.bdr}`, borderRadius:8, padding:"10px 14px",
            background:c.bg1, marginBottom:14 }}>
            {uploadMsg.map((r,i) => (
              <p key={i} style={{ fontSize:12, color:r.ok?c.grn:c.red, margin:"3px 0" }}>
                {r.ok?"✅":"❌"} <strong>{r.name}</strong> — {r.msg}
              </p>
            ))}
          </div>
        )}

        {/* Empty state */}
        {records.length === 0 && (
          <div onDragOver={e=>e.preventDefault()}
            onDrop={e=>{e.preventDefault();handleUpload(e.dataTransfer.files);}}
            onClick={() => fileRef.current?.click()}
            style={{ border:`2px dashed ${c.bdr}`, borderRadius:12, padding:"48px 24px",
              textAlign:"center", cursor:"pointer", background:c.bg1 }}>
            <p style={{ fontSize:40, margin:"0 0 10px" }}>📹</p>
            <p style={{ fontSize:14, fontWeight:600, color:c.txt, margin:"0 0 6px" }}>
              {selCase
                ? `Drop videos for ${selCase.subject_name} here`
                : "Select a case on the left, then upload videos"}
            </p>
            <p style={{ fontSize:12, color:c.sec, margin:0 }}>
              MP4, MOV, MTS — SHA-256 + camera metadata automatically extracted
            </p>
          </div>
        )}

        {/* Records */}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {records.map(r => (
            <div key={r.id}>
              {/* Card */}
              <div onClick={() => setSel(sel?.id === r.id ? null : r)}
                style={{ border:`1px solid ${sel?.id===r.id ? c.acc : c.bdr}`,
                  borderLeft:`3px solid ${SC[r.status]||c.bdr}`,
                  borderRadius:8, padding:"12px 14px", background:c.bg2, cursor:"pointer" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 130px 120px 90px", gap:10, alignItems:"center" }}>
                  <div>
                    <p style={{ fontSize:13, fontWeight:600, margin:"0 0 2px", color:c.txt }}>
                      📹 {r.original_filename}
                    </p>
                    <p style={{ fontSize:10, fontFamily:"monospace", color:c.mut, margin:0 }}>
                      {r.sha256_raw?.substring(0,28)}...
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize:12, color:c.txt, margin:"0 0 1px" }}>{fmtBytes(r.file_size_bytes)}</p>
                    <p style={{ fontSize:11, color:c.sec, margin:0 }}>{fmtDur(r.duration_seconds)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize:10, color:c.mut, margin:"0 0 1px", textTransform:"uppercase", letterSpacing:"0.04em" }}>Camera</p>
                    {r.media_created_at ? (
                      <>
                        <p style={{ fontSize:12, color:c.txt, margin:0 }}>
                          {new Date(r.media_created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"})}
                        </p>
                        <p style={{ fontSize:11, color:c.sec, margin:0 }}>
                          {new Date(r.media_created_at).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}
                        </p>
                      </>
                    ) : (
                      <p style={{ fontSize:11, color:c.yel, margin:0, fontWeight:600 }}>⚠️ No metadata</p>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize:12, color:c.txt, margin:"0 0 1px" }}>{r.uploaded_by_name?.split(" ")[0]}</p>
                    <p style={{ fontSize:11, color:c.sec, margin:0 }}>{fmtDate(r.uploaded_at)}</p>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:20,
                    textAlign:"center", background:`${SC[r.status]||c.sec}22`, color:SC[r.status]||c.sec }}>
                    {r.status}
                  </span>
                </div>
              </div>

              {/* Expanded — 4-step workflow */}
              {sel?.id === r.id && (
                <ExpandedRecord
                  r={r}
                  c={c}
                  BASE={BASE}
                  selCase={selCase}
                  fontFile={fontFile}
                  setFontFile={setFontFile}
                  fontSize={fontSize}
                  setFontSize={setFontSize}
                  outputFolder={outputFolder}
                  setOutputFolder={setOutputFolder}
                  fonts={fonts}
                  availFolders={availFolders}
                  savePrefs={savePrefs}
                  loadRecords={loadRecords}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Confirm modal */}
      {confirming && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:9999,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:c.bg2, border:`1px solid ${c.bdr}`, borderRadius:12,
            padding:28, width:460, boxShadow:"0 24px 80px rgba(0,0,0,0.5)" }}>
            <h3 style={{ fontSize:16, fontWeight:700, color:c.txt, margin:"0 0 12px" }}>
              ✅ Confirm video authorship
            </h3>
            <p style={{ fontSize:13, color:c.sec, margin:"0 0 16px", lineHeight:1.6 }}>
              Confirm that <strong style={{color:c.txt}}>{confirming.original_filename}</strong> was
              recorded and uploaded by you.
            </p>
            <p style={{ fontSize:11, fontFamily:"monospace", color:c.mut, margin:"0 0 16px",
              background:c.bg1, padding:"6px 10px", borderRadius:5 }}>
              SHA-256: {confirming.sha256_raw?.substring(0,32)}...
            </p>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => handleConfirm(confirming)}
                style={{ flex:1, padding:"10px", fontSize:13, fontWeight:600, cursor:"pointer",
                  background:c.acc, color:"white", border:"none", borderRadius:7 }}>
                Yes — I recorded and uploaded this
              </button>
              <button onClick={() => setConfirming(null)}
                style={{ padding:"10px 16px", fontSize:13, cursor:"pointer",
                  background:c.bg1, color:c.sec, border:`1px solid ${c.bdr}`, borderRadius:7 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

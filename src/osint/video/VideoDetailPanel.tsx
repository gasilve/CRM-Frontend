import { useState, useEffect, useCallback, useRef } from "react";
import { FileVideo, CheckCircle2, CloudUpload, Send, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { PanelShell } from "@/pages/case-detail-panels";
import type { VideoRecord, useVideoState } from "./useVideoState";

type State = ReturnType<typeof useVideoState>;
const BASE = "/api-proxy";

const fmtDate = (s: string | null) => !s ? "—" :
  new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtBytes = (b: number | null) => !b ? "—" :
  b > 1e9 ? (b/1e9).toFixed(2)+" GB" :
  b > 1e6 ? (b/1e6).toFixed(1)+" MB" : (b/1e3).toFixed(0)+" KB";

type Step = 1|2|3|4;

function StepBadge({ n, done, active }: { n:number; done:boolean; active:boolean }) {
  const col = done?"#10b981":active?"var(--color-accent)":"var(--color-text-lo)";
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[0.625rem] font-bold"
      style={{ borderColor:col, color:col, background:done||active?`${col}22`:"transparent" }}>
      {done?"✓":n}
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">{children}</div>;
}

function InfoRow({ label, value }: { label:string; value:string|null }) {
  if (!value||value==="—") return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0 font-mono text-[0.5625rem] text-[var(--color-text-lo)]">{label}</span>
      <span className="break-all text-right text-[0.6875rem] text-[var(--color-text-hi)]">{value}</span>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, def, onChange }: {
  label:string; value:number; min:number; max:number; step:number; def:number;
  onChange:(v:number)=>void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[0.625rem] text-[var(--color-text-hi)]">{value.toFixed(2)}</span>
          {value!==def && (
            <button onClick={()=>onChange(def)}
              className="font-mono text-[0.5rem] text-[var(--color-accent)] underline">reset</button>
          )}
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-accent)]" />
    </div>
  );
}

export function VideoDetailPanel({ record, state }: { record:VideoRecord|null; state:State }) {
  const r = record;
  const [step, setStep] = useState<Step>(1);

  // Process state
  const [processing, setProcessing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [delivEmail, setDelivEmail] = useState("");
  const [delivDays,  setDelivDays]  = useState(7);

  // Timestamp
  const [tsPosition,  setTsPosition]  = useState("bottom-left");
  const [tsFontStyle, setTsFontStyle] = useState("duplex");
  const [tsColor,     setTsColor]     = useState("#ffffff");
  const [tsOpacity,   setTsOpacity]   = useState(0.45);
  const [tsFontScale, setTsFontScale] = useState(1.1);
  const [tsFormat,    setTsFormat]    = useState("%m/%d/%Y  %I:%M:%S %p");
  const [tsExtras,    setTsExtras]    = useState<string[]>([]);
  const [fontFile,    setFontFile]    = useState("biondi.ttf");
  const [fontSize,    setFontSize]    = useState(52);

  // Color enhancement
  const [ceEnabled,    setCeEnabled]    = useState(true);
  const [ceBrightness, setCeBrightness] = useState(0.04);
  const [ceContrast,   setCeContrast]   = useState(1.08);
  const [ceSaturation, setCeSaturation] = useState(1.15);
  const [ceGamma,      setCeGamma]      = useState(0.95);
  const [ceSharpen,    setCeSharpen]    = useState(0.3);

  // Trailer
  const [trailer,       setTrailer]       = useState<any>(null);
  const [trailerLoading,setTrailerLoading]= useState(false);
  const [stateOverride, setStateOverride] = useState("");

  // Frame preview
  const [frame,       setFrame]       = useState<string|null>(null);
  const [frameLoading,setFrameLoading]= useState(false);
  const [previewMode, setPreviewMode] = useState<"raw"|"enhanced">("raw");
  const [seekSec,     setSeekSec]     = useState(3);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Subject/case override
  const [subjName, setSubjName] = useState("");
  const [caseNum,  setCaseNum]  = useState("");

  useEffect(() => {
    if (!r) return;
    const stepInit: Step = r.sent_to_attorney_at?4:r.wasabi_pub_key?3:r.sha256_final?2:1;
    setStep(stepInit);
    setSubjName((r as any).subject_name_override || "");
    setCaseNum((r as any).case_number_override || "");
  }, [r?.id]);

  // Load fonts/prefs once
  useEffect(() => {
    fetch(`${BASE}/api/video-custody/preferences`, { credentials:"include" })
      .then(r=>r.ok?r.json():null)
      .then(d=>{ if(d){ if(d.font_file)setFontFile(d.font_file); if(d.font_size)setFontSize(d.font_size); }})
      .catch(()=>{});
  }, []);

  const fetchTrailer = useCallback(async (override?: string) => {
    if (!r) return;
    setTrailerLoading(true);
    try {
      const qs = override ? `?state_override=${override}` : "";
      const res = await fetch(`${BASE}/api/video-custody/${r.id}/trailer-preview${qs}`, { credentials:"include" });
      if (res.ok) setTrailer(await res.json());
    } finally { setTrailerLoading(false); }
  }, [r?.id]);

  const fetchFrame = useCallback(async (seek=seekSec) => {
    if (!r) return;
    setFrameLoading(true); setPreviewOpen(true);
    try {
      const res = await fetch(`${BASE}/api/video-custody/${r.id}/frame?t=${seek}&width=640&which=raw`, { credentials:"include" });
      if (res.ok) { const d=await res.json(); setFrame(d.frame_b64||null); }
    } finally { setFrameLoading(false); }
  }, [r?.id, seekSec]);

  useEffect(() => {
    if (step===2 && r && !trailer) fetchTrailer(stateOverride||undefined);
  }, [step, r?.id]);

  const doProcess = async () => {
    if (!r) return;
    setProcessing(true);
    try {
      const params = new URLSearchParams({
        font_file:fontFile, font_size:String(fontSize),
        ts_position:tsPosition, ts_font_style:tsFontStyle,
        ts_color:tsColor, ts_opacity:String(tsOpacity),
        ts_font_scale:String(tsFontScale), ts_format:tsFormat,
        ts_extras:tsExtras.join(","),
        ...(stateOverride?{state_override:stateOverride}:{}),
        ce_enabled:String(ceEnabled),
        ce_brightness:String(ceBrightness), ce_contrast:String(ceContrast),
        ce_saturation:String(ceSaturation), ce_gamma:String(ceGamma),
        ce_sharpen:String(ceSharpen),
      });
      // Patch overrides if changed
      const patch: any = {};
      if (subjName) patch.subject_name_override = subjName;
      if (caseNum)  patch.case_number_override  = caseNum;
      if (Object.keys(patch).length) {
        await fetch(`${BASE}/api/video-custody/${r.id}`, {
          method:"PATCH", credentials:"include",
          headers:{"Content-Type":"application/json"}, body:JSON.stringify(patch),
        });
      }
      const res = await fetch(`${BASE}/api/video-custody/${r.id}/process?${params}`, {
        method:"POST", credentials:"include",
      });
      const d = await res.json();
      if (d.ok) { await state.reload(); setStep(3); }
      else alert(d.error || "Process failed");
    } finally { setProcessing(false); }
  };

  const doPublish = async () => {
    if (!r) return;
    setPublishing(true);
    try {
      const res = await fetch(`${BASE}/api/video-custody/${r.id}/publish`, { method:"POST", credentials:"include" });
      if (res.ok) { await state.reload(); setStep(3); }
      else { const d=await res.json(); alert(d.detail||"Publish failed"); }
    } finally { setPublishing(false); }
  };

  const doDeliver = async () => {
    if (!r) return;
    setDelivering(true);
    try {
      const res = await fetch(`${BASE}/api/video-custody/${r.id}/deliver`, {
        method:"POST", credentials:"include",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ email:delivEmail, days:delivDays }),
      });
      if (res.ok) { await state.reload(); setStep(4); }
      else { const d=await res.json(); alert(d.detail||"Deliver failed"); }
    } finally { setDelivering(false); }
  };

  if (!r) {
    return (
      <PanelShell title="Detail" icon={<FileVideo size={11} strokeWidth={1.8}/>}>
        <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
          <FileVideo size={28} className="text-[var(--color-text-lo)]"/>
          <div className="text-[0.75rem] text-[var(--color-text-lo)]">Select a video to see details</div>
        </div>
      </PanelShell>
    );
  }

  const stepDone = (n:number) => n===1?true:n===2?!!r.sha256_final:n===3?!!r.wasabi_pub_key:!!r.sent_to_attorney_at;
  const STEPS = [[1,"📤","Upload"],[2,"🎬","Process"],[3,"☁️","Publish"],[4,"📨","Deliver"]] as const;

  return (
    <PanelShell title={r.original_filename} icon={<FileVideo size={11} strokeWidth={1.8}/>}>
      <div className="flex flex-col gap-3">

        {/* Step tabs */}
        <div className="flex gap-1 rounded-[0.625rem] border border-[var(--color-line)] p-1">
          {STEPS.map(([n,icon,label])=>{
            const done=stepDone(n); const active=step===n;
            const col=done?"#10b981":active?"var(--color-accent)":"var(--color-text-lo)";
            return (
              <button key={n} type="button" onClick={()=>setStep(n as Step)}
                className="flex flex-1 flex-col items-center gap-1 rounded-[0.375rem] px-1 py-2 transition-colors"
                style={{background:active?"var(--color-accent-soft)":"transparent"}}>
                <StepBadge n={n} done={done} active={active}/>
                <span className="text-[0.5rem] font-medium" style={{color:col}}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* ── STEP 1: Chain of custody ── */}
        {step===1 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] p-3">
              <InfoRow label="File"        value={r.original_filename}/>
              <InfoRow label="Size"        value={fmtBytes(r.file_size_bytes)}/>
              <InfoRow label="Filmed"      value={fmtDate(r.media_created_at)}/>
              <InfoRow label="Uploaded"    value={fmtDate(r.uploaded_at)}/>
              <InfoRow label="By"          value={r.uploaded_by_name}/>
              <InfoRow label="Investigator"value={r.investigator_override}/>
              <InfoRow label="Type"        value={r.video_type}/>
            </div>
            {r.sha256_raw && (
              <div className="rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] p-2.5">
                <Lbl>SHA-256 raw</Lbl>
                <div className="break-all font-mono text-[0.5rem] text-[var(--color-text-mid)]">{r.sha256_raw}</div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Process ── */}
        {step===2 && (
          <div className="flex flex-col gap-3">

            {/* If already processed */}
            {r.sha256_final && (
              <div className="flex flex-col gap-1.5 rounded-[0.625rem] border border-[#10b981]/30 bg-[rgba(16,185,129,0.08)] p-3">
                <div className="flex items-center gap-2 text-[0.75rem] font-semibold text-[#10b981]">
                  <CheckCircle2 size={13}/> Already processed
                </div>
                <InfoRow label="Output" value={r.output_filename}/>
                <div className="break-all font-mono text-[0.5rem] text-[var(--color-text-mid)] mt-1">{r.sha256_final}</div>
              </div>
            )}

            {/* Title card */}
            <div className="flex flex-col gap-2">
              <Lbl>Title card</Lbl>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Lbl>Subject name</Lbl>
                  <input value={subjName} onChange={e=>setSubjName(e.target.value)} placeholder="e.g. John Smith"
                    className="w-full rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] focus:outline-none focus:border-[var(--color-accent)]"/>
                </div>
                <div>
                  <Lbl>Case / Claim #</Lbl>
                  <input value={caseNum} onChange={e=>setCaseNum(e.target.value)} placeholder="e.g. MSA.2024011"
                    className="w-full rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] focus:outline-none focus:border-[var(--color-accent)]"/>
                </div>
              </div>
            </div>

            {/* Frame preview */}
            <div className="overflow-hidden rounded-[0.5rem] border border-[var(--color-line-2)]">
              <div className="flex flex-wrap gap-1.5 border-b border-[var(--color-line-2)] bg-[var(--color-ink-2)] px-2 py-1.5">
                <button type="button" onClick={()=>fetchFrame()}
                  className="rounded-[0.25rem] border px-2 py-0.5 text-[0.625rem] font-semibold transition-colors"
                  style={{background:previewOpen&&!frameLoading?"var(--color-accent-soft)":"transparent",
                    color:previewOpen?"var(--color-accent)":"var(--color-text-mid)",
                    borderColor:previewOpen?"var(--color-accent)":"var(--color-line-2)"}}>
                  {frameLoading?"⏳ Loading…":"🖼 Frame preview"}
                </button>
                {previewOpen && (
                  <button type="button" onClick={()=>{setPreviewOpen(false);setFrame(null);}}
                    className="ml-auto rounded-[0.25rem] border border-[var(--color-line-2)] px-2 py-0.5 text-[0.625rem] text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
                    ✕
                  </button>
                )}
              </div>
              {previewOpen && (
                <div className="bg-black">
                  {frameLoading ? (
                    <div className="flex h-32 items-center justify-center gap-2 text-[0.75rem] text-[var(--color-text-lo)]">
                      <Loader2 size={13} className="animate-spin"/> Extracting frame…
                    </div>
                  ) : frame ? (
                    <div className="relative">
                      {/* Raw/Enhanced toggle */}
                      <div className="absolute left-2 top-2 z-10 flex gap-1">
                        {(["raw","enhanced"] as const).map(m=>(
                          <button key={m} type="button" onClick={()=>setPreviewMode(m)}
                            className="rounded px-2 py-0.5 text-[0.5625rem] font-bold"
                            style={{background:previewMode===m?"rgba(0,0,0,0.85)":"rgba(0,0,0,0.4)",
                              color:previewMode===m?"var(--color-accent)":"rgba(255,255,255,0.6)",
                              border:`1px solid ${previewMode===m?"var(--color-accent)":"rgba(255,255,255,0.2)"}`}}>
                            {m==="raw"?"Original":"✨ Enhanced"}
                          </button>
                        ))}
                      </div>
                      <img src={`data:image/jpeg;base64,${frame}`} alt="preview"
                        className="block w-full"
                        style={{filter:previewMode==="enhanced"&&ceEnabled?
                          `brightness(${(1+ceBrightness*2).toFixed(2)}) contrast(${ceContrast}) saturate(${ceSaturation}) opacity(1)`
                          :undefined}}
                      />
                      {/* Timestamp overlay simulation */}
                      <div className="absolute font-mono text-[0.5rem] font-bold"
                        style={{color:tsColor, opacity:tsOpacity,
                          ...(tsPosition==="bottom-left"?{bottom:40,left:8}:
                              tsPosition==="bottom-right"?{bottom:40,right:8}:
                              tsPosition==="top-left"?{top:8,left:8}:{top:8,right:8})}}>
                        <div>{new Date().toLocaleString("en-US",{month:"2-digit",day:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>
                        {tsExtras.includes("investigator")&&<div>INV: {r.investigator_override||"Investigator"}</div>}
                        {tsExtras.includes("claim")&&<div>CLM: {caseNum||"—"}</div>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-24 items-center justify-center text-[0.75rem] text-[var(--color-text-lo)]">
                      Click "Frame preview" to extract a frame
                    </div>
                  )}
                  {/* Seek slider */}
                  {frame && (
                    <div className="flex items-center gap-2 border-t border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.5)] px-3 py-2">
                      <span className="font-mono text-[0.5rem] text-[rgba(255,255,255,0.5)]">Seek</span>
                      <input type="range" min={0} max={300} step={1} value={seekSec}
                        onChange={e=>setSeekSec(Number(e.target.value))}
                        onMouseUp={()=>fetchFrame(seekSec)}
                        className="flex-1 accent-[var(--color-accent)]"/>
                      <span className="w-8 font-mono text-[0.5rem] text-[rgba(255,255,255,0.5)]">{seekSec}s</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Timestamp controls */}
            <div className="flex flex-col gap-2 rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] p-3">
              <Lbl>Timestamp overlay</Lbl>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Lbl>Position</Lbl>
                  <select value={tsPosition} onChange={e=>setTsPosition(e.target.value)}
                    className="w-full rounded-[0.25rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-hi)] focus:outline-none">
                    <option value="bottom-left">Bottom left</option>
                    <option value="bottom-right">Bottom right</option>
                    <option value="top-left">Top left</option>
                    <option value="top-right">Top right</option>
                  </select>
                </div>
                <div>
                  <Lbl>Font style</Lbl>
                  <select value={tsFontStyle} onChange={e=>setTsFontStyle(e.target.value)}
                    className="w-full rounded-[0.25rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-hi)] focus:outline-none">
                    <option value="duplex">Duplex</option>
                    <option value="simplex">Simplex</option>
                    <option value="plain">Plain</option>
                    <option value="complex">Complex</option>
                    <option value="triplex">Triplex</option>
                  </select>
                </div>
                <div>
                  <Lbl>Color</Lbl>
                  <div className="flex items-center gap-2">
                    <input type="color" value={tsColor} onChange={e=>setTsColor(e.target.value)}
                      className="h-7 w-10 cursor-pointer rounded border border-[var(--color-line-2)] bg-transparent"/>
                    <span className="font-mono text-[0.625rem] text-[var(--color-text-mid)]">{tsColor}</span>
                  </div>
                </div>
                <div>
                  <Lbl>Opacity ({tsOpacity.toFixed(2)})</Lbl>
                  <input type="range" min={0.1} max={1} step={0.05} value={tsOpacity}
                    onChange={e=>setTsOpacity(Number(e.target.value))}
                    className="w-full accent-[var(--color-accent)]"/>
                </div>
                <div>
                  <Lbl>Font scale ({tsFontScale.toFixed(1)}x)</Lbl>
                  <input type="range" min={0.5} max={2.5} step={0.1} value={tsFontScale}
                    onChange={e=>setTsFontScale(Number(e.target.value))}
                    className="w-full accent-[var(--color-accent)]"/>
                </div>
                <div>
                  <Lbl>Font size ({fontSize}px)</Lbl>
                  <input type="range" min={24} max={96} step={2} value={fontSize}
                    onChange={e=>setFontSize(Number(e.target.value))}
                    className="w-full accent-[var(--color-accent)]"/>
                </div>
              </div>
              <div>
                <Lbl>Extras</Lbl>
                <div className="flex gap-2">
                  {["investigator","claim"].map(x=>(
                    <label key={x} className="flex items-center gap-1.5 text-[0.625rem] text-[var(--color-text-mid)]">
                      <input type="checkbox" checked={tsExtras.includes(x)}
                        onChange={e=>setTsExtras(p=>e.target.checked?[...p,x]:p.filter(i=>i!==x))}
                        className="accent-[var(--color-accent)]"/>
                      {x}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Trailer */}
            <div className="overflow-hidden rounded-[0.5rem] border border-[var(--color-line-2)]">
              <div className="flex items-center justify-between border-b border-[var(--color-line-2)] bg-[var(--color-ink-2)] px-3 py-2">
                <Lbl>Trailer</Lbl>
                <button type="button" onClick={()=>fetchTrailer(stateOverride||undefined)}
                  className="flex items-center gap-1 rounded border border-[var(--color-line-2)] px-2 py-0.5 text-[0.5625rem] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]">
                  <RefreshCw size={9}/>{trailerLoading?"Loading…":"Refresh"}
                </button>
              </div>
              <div className="bg-[var(--color-ink-2)] p-3">
                {trailer ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {trailer.thumbnail_b64 && (
                        <img src={`data:image/jpeg;base64,${trailer.thumbnail_b64}`} alt="trailer"
                          className="h-14 w-24 shrink-0 rounded object-cover border border-[var(--color-line-2)]"/>
                      )}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full px-2 py-0.5 text-[0.5625rem] font-semibold"
                            style={{background:trailer.trailer_match==="exact"?"rgba(16,185,129,0.15)":"rgba(245,158,11,0.15)",
                              color:trailer.trailer_match==="exact"?"#10b981":"#f59e0b",
                              border:`1px solid ${trailer.trailer_match==="exact"?"#10b981":"#f59e0b"}`}}>
                            {trailer.trailer_match==="exact"?"✓ Exact":"⚠ Fallback"}: {trailer.state_name}
                          </span>
                        </div>
                        <div className="break-all font-mono text-[0.5rem] text-[var(--color-text-lo)]">
                          {trailer.trailer_filename}
                        </div>
                      </div>
                    </div>
                    {/* State override buttons */}
                    <div>
                      <Lbl>Override state</Lbl>
                      <div className="flex flex-wrap gap-1">
                        <button type="button"
                          onClick={()=>{setStateOverride("");fetchTrailer(undefined);}}
                          className="rounded px-2 py-0.5 text-[0.5625rem] font-semibold"
                          style={{background:!stateOverride?"var(--color-accent-soft)":"transparent",
                            color:!stateOverride?"var(--color-accent)":"var(--color-text-mid)",
                            border:`1px solid ${!stateOverride?"var(--color-accent)":"var(--color-line-2)"}`}}>
                          Auto
                        </button>
                        {(trailer.available_states||[]).map((s:any)=>(
                          <button key={s.abbr} type="button" title={s.name}
                            onClick={()=>{setStateOverride(s.abbr);fetchTrailer(s.abbr);}}
                            className="rounded px-2 py-0.5 text-[0.5625rem] font-semibold"
                            style={{opacity:s.has_trailer?1:0.4,
                              background:stateOverride===s.abbr?"var(--color-accent-soft)":"transparent",
                              color:stateOverride===s.abbr?"var(--color-accent)":s.has_trailer?"var(--color-text-hi)":"var(--color-text-lo)",
                              border:`1px solid ${stateOverride===s.abbr?"var(--color-accent)":s.has_trailer?"var(--color-line-2)":"transparent"}`}}>
                            {s.abbr}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-3 text-center text-[0.6875rem] text-[var(--color-text-lo)]">
                    {trailerLoading?"Loading trailer…":"Click Refresh to load trailer info"}
                  </div>
                )}
              </div>
            </div>

            {/* Color Enhancement */}
            <div className="rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <Lbl>🎨 Color enhancement</Lbl>
                <label className="flex cursor-pointer items-center gap-1.5 text-[0.625rem] text-[var(--color-text-mid)]">
                  <input type="checkbox" checked={ceEnabled} onChange={e=>setCeEnabled(e.target.checked)}
                    className="accent-[var(--color-accent)]"/>
                  {ceEnabled?"On":"Off"}
                </label>
              </div>
              {ceEnabled && (
                <div className="flex flex-col gap-2">
                  <SliderRow label="Brightness" value={ceBrightness} min={-0.5} max={0.5} step={0.01} def={0} onChange={setCeBrightness}/>
                  <SliderRow label="Contrast"   value={ceContrast}   min={0.5}  max={2.0} step={0.01} def={1} onChange={setCeContrast}/>
                  <SliderRow label="Saturation" value={ceSaturation} min={0}    max={3.0} step={0.01} def={1} onChange={setCeSaturation}/>
                  <SliderRow label="Gamma"      value={ceGamma}      min={0.1}  max={3.0} step={0.01} def={1} onChange={setCeGamma}/>
                  <SliderRow label="Sharpen"    value={ceSharpen}    min={0}    max={2.0} step={0.05} def={0} onChange={setCeSharpen}/>
                </div>
              )}
            </div>

            {/* Process button */}
            <button type="button" onClick={doProcess} disabled={processing}
              className="flex w-full items-center justify-center gap-2 rounded-[0.5rem] py-3 text-[0.875rem] font-bold text-white disabled:opacity-60"
              style={{background:processing?"var(--color-text-lo)":"linear-gradient(135deg,#7c3aed,#5b21b6)"}}>
              {processing?<><Loader2 size={15} className="animate-spin"/>Processing…</>:"🎬 Process — Burn timestamp + trailer"}
            </button>
          </div>
        )}

        {/* ── STEP 3: Publish ── */}
        {step===3 && (
          <div className="flex flex-col gap-3">
            {r.wasabi_pub_key ? (
              <div className="flex flex-col gap-1.5 rounded-[0.625rem] border border-[#3b82f6]/30 bg-[rgba(59,130,246,0.08)] p-3">
                <div className="flex items-center gap-2 text-[0.75rem] font-semibold text-[#3b82f6]">
                  <CloudUpload size={14}/> Published to cloud
                </div>
                <InfoRow label="Key" value={r.wasabi_pub_key}/>
              </div>
            ) : r.sha256_final ? (
              <>
                <div className="rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] p-3 text-[0.75rem] text-[var(--color-text-mid)]">
                  Upload the processed video to the public Wasabi bucket with chain of custody tracking.
                </div>
                <button type="button" onClick={doPublish} disabled={publishing}
                  className="flex items-center justify-center gap-2 rounded-[0.5rem] py-2.5 text-[0.8125rem] font-bold text-white disabled:opacity-60"
                  style={{background:"linear-gradient(135deg,#0ea5e9,#3b82f6)"}}>
                  {publishing?<><Loader2 size={14} className="animate-spin"/>Publishing…</>:"☁️ Publish video"}
                </button>
              </>
            ) : (
              <div className="rounded-[0.625rem] border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] p-3 text-[0.75rem] text-[#f59e0b]">
                Complete Step 2 (Process) first.
              </div>
            )}
          </div>
        )}

        {/* ── STEP 4: Deliver ── */}
        {step===4 && (
          <div className="flex flex-col gap-3">
            {r.deliver_link ? (
              <div className="flex flex-col gap-2 rounded-[0.625rem] border border-[#10b981]/30 bg-[rgba(16,185,129,0.08)] p-3">
                <div className="flex items-center gap-2 text-[0.75rem] font-semibold text-[#10b981]">
                  <Send size={14}/> Delivered
                </div>
                <InfoRow label="Sent" value={fmtDate(r.sent_to_attorney_at)}/>
                <a href={r.deliver_link} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-[0.375rem] border border-[#10b981]/30 px-2.5 py-1.5 text-[0.6875rem] text-[#10b981] hover:bg-[rgba(16,185,129,0.15)]">
                  <ExternalLink size={11}/> Open delivery link
                </a>
              </div>
            ) : r.wasabi_pub_key ? (
              <div className="flex flex-col gap-3">
                <input type="email" placeholder="Attorney email…" value={delivEmail}
                  onChange={e=>setDelivEmail(e.target.value)}
                  className="w-full rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3 py-2 text-[0.8125rem] text-[var(--color-text-hi)] focus:outline-none focus:border-[var(--color-accent)]"/>
                <div className="flex items-center gap-2">
                  <span className="text-[0.75rem] text-[var(--color-text-mid)]">Expires in</span>
                  {[3,7,14,30].map(d=>(
                    <button key={d} type="button" onClick={()=>setDelivDays(d)}
                      className="rounded-[0.375rem] px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
                      style={{background:delivDays===d?"var(--color-accent)":"var(--color-ink-3)",
                        color:delivDays===d?"white":"var(--color-text-mid)",
                        border:`1px solid ${delivDays===d?"var(--color-accent)":"var(--color-line)"}`}}>
                      {d}d
                    </button>
                  ))}
                </div>
                <button type="button" onClick={doDeliver} disabled={delivering||!delivEmail}
                  className="flex items-center justify-center gap-2 rounded-[0.5rem] py-2.5 text-[0.8125rem] font-bold text-white disabled:opacity-60"
                  style={{background:"linear-gradient(135deg,#10b981,#059669)"}}>
                  {delivering?<><Loader2 size={14} className="animate-spin"/>Sending…</>:"📨 Send delivery link"}
                </button>
              </div>
            ) : (
              <div className="rounded-[0.625rem] border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] p-3 text-[0.75rem] text-[#f59e0b]">
                Complete Step 3 (Publish) first.
              </div>
            )}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

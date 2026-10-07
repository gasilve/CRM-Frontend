import React, { useEffect, useState, useRef } from "react";

const BASE = "/api-proxy";

interface Frame {
  frame_id: number;
  custody_id: number;
  time_sec: number;
  timestamp: string;
  description: string;
  filename: string;
  investigator: string;
  recorded_at: string | null;
  duration: number;
  effort_score: number;
  face_clusters?: Record<string,number>;
  face_count?: number;
  subject_match?: boolean;
  thumbnail_presigned?: string;
  clip_presigned?: string;
}

function effortColor(score: number): string {
  if (score >= 7) return "#ef4444"; // red — high effort
  if (score >= 4) return "#f59e0b"; // amber — medium
  if (score >= 1) return "#22c55e"; // green — low
  return "#334155"; // dark — no person/sedentary
}

function effortLabel(score: number): string {
  if (score >= 7) return "HIGH";
  if (score >= 4) return "MED";
  if (score >= 1) return "LOW";
  return "—";
}

const ACTIVITY_KEYWORDS = [
  { label: "All", value: "" },
  { label: "Bending", value: "bend" },
  { label: "Lifting", value: "lift" },
  { label: "Carrying", value: "carry" },
  { label: "Walking", value: "walk" },
  { label: "Running", value: "run" },
  { label: "Squatting", value: "squat" },
  { label: "Climbing", value: "climb" },
  { label: "Working", value: "work" },
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}

function HL({ text, kw }: { text: string; kw: string }) {
  if (!kw) return <>{text}</>;
  const re = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`, "gi");
  return <>{text.split(re).map((p,i) =>
    re.test(p) ? <mark key={i} style={{background:"#fef08a",borderRadius:2}}>{p}</mark> : p
  )}</>;
}

interface Props {
  investigationId: number;
  subjectName: string;
  onClose: () => void;
}

export function HighlightsPanel({ investigationId, subjectName, onClose }: Props) {
  const [frames, setFrames]       = useState<Frame[]>([]);
  const [loading, setLoading]     = useState(true);
  const [keyword, setKeyword]     = useState("");
  const [inv, setInv]             = useState("");
  const [playing, setPlaying]     = useState<Frame|null>(null);
  const [clipLoading, setClipLoading] = useState(false);
  const [clipUrl, setClipUrl]     = useState<string|null>(null);
  const [page, setPage]           = useState(1);
  const [personFilter, setPersonFilter] = useState<number|null>(null);
  const [subjectOnly, setSubjectOnly] = useState(false);
  const [effortFilter, setEffortFilter] = useState<"all"|"high"|"med"|"low">("all");
  const [personThumbs, setPersonThumbs] = useState<Array<{person_id:number,label:string,appearances:number,thumbnail:string}>>([]);
  const PAGE_SIZE = 20;
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string|null>(null);
  const [expiryDays, setExpiryDays] = useState(30);
  const [subjectPhoto, setSubjectPhoto] = useState<string>("");
  const photoRef = React.useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  function toggleSelect(frameId: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(frameId) ? next.delete(frameId) : next.add(frameId);
      return next;
    });
  }

  async function generateLink() {
    if (selected.size === 0) { alert("Select at least one frame first"); return; }
    setGenerating(true);
    try {
      const r = await fetch("/api/highlights/create", {
        method: "POST", credentials: "include",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          investigation_id: investigationId,
          frame_ids: [...selected],
          expiry_days: expiryDays,
          note: `Activity highlights — ${subjectName}`,
          subject_photo: subjectPhoto,
        })
      });
      const d = await r.json();
      if (d.url) setGeneratedUrl(d.url);
    } catch(e) { alert("Failed to generate link"); }
    setGenerating(false);
  }

  useEffect(() => {
    fetch(`${BASE}/api/video-custody/investigation/${investigationId}/highlights?limit=3000${subjectOnly?"&subject_only=true":""}`,
      {credentials:"include"})
      .then(r=>r.json()).then(d=>{
        setFrames(d); setLoading(false);
        fetch(`${BASE}/api/video-custody/investigation/${investigationId}/person-thumbnails`,
          {credentials:"include"})
          .then(r=>r.ok?r.json():[]).then(d=>setPersonThumbs(d)).catch(()=>{});
      })
      .catch(()=>setLoading(false));
  }, [investigationId, subjectOnly]);

  const investigators = [...new Set(frames.map(f=>f.investigator).filter(Boolean))];
  // Build person cluster map from frames
  const personMap = React.useMemo(() => {
    const map: Record<number, number> = {}; // frame_id -> cluster_id
    frames.forEach(f => {
      if (f.face_clusters && Object.keys(f.face_clusters).length > 0) {
        const firstCluster = parseInt(Object.values(f.face_clusters as Record<string,number>)[0].toString());
        map[f.frame_id] = firstCluster;
      }
    });
    return map;
  }, [frames]);

  const personCounts = React.useMemo(() => {
    const counts: Record<number, number> = {};
    Object.values(personMap).forEach(cid => {
      counts[cid] = (counts[cid] || 0) + 1;
    });
    return counts;
  }, [personMap]);

  const filtered = frames.filter(f =>
    (!keyword || f.description.toLowerCase().includes(keyword.toLowerCase())) &&
    (!inv || f.investigator === inv) &&
    (personFilter === null || personMap[f.frame_id] === personFilter) &&
    (effortFilter === "all" ||
     (effortFilter === "high" && (f.effort_score||0) >= 7) ||
     (effortFilter === "med"  && (f.effort_score||0) >= 4 && (f.effort_score||0) <= 6) ||
     (effortFilter === "low"  && (f.effort_score||0) >= 1 && (f.effort_score||0) <= 3))
  );
  React.useEffect(() => { setPage(1); }, [keyword, inv, personFilter, subjectOnly, effortFilter]);
  const visible = filtered.slice(0, page * PAGE_SIZE);

  async function playClip(frame: Frame) {
    setPlaying(frame);
    setClipLoading(true);
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    setClipUrl(null);
    try {
      if (frame.clip_presigned) {
        setClipUrl(frame.clip_presigned);
        setClipLoading(false);
        setTimeout(()=>videoRef.current?.play(), 100);
        return;
      }
      const r = await fetch(
        `${BASE}/api/video-custody/${frame.custody_id}/clip?t=${frame.time_sec}&before=10&after=10`,
        {credentials:"include"});
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        setClipUrl(url);
        setTimeout(()=>videoRef.current?.play(), 100);
      }
    } catch(e){console.error(e);}
    setClipLoading(false);
  }

  const navy = "#0f1f3d";

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:99999,
      display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* Header */}
      <div style={{background:navy,padding:"12px 20px",display:"flex",
        alignItems:"center",gap:12,flexShrink:0}}>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,.5)",
            textTransform:"uppercase",letterSpacing:2}}>Video Intelligence — Activity Highlights</p>
          <p style={{margin:"2px 0 0",fontSize:16,fontWeight:700,color:"white"}}>{subjectName}</p>
        </div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.5)"}}>
          {visible.length < filtered.length ? `${visible.length}/${filtered.length} shown` : `${filtered.length}`} / {frames.length} frames
          {selected.size > 0 && <span style={{color:"#60a5fa",marginLeft:8}}>· {selected.size} selected</span>}
        </div>
        {selected.size > 0 && !generatedUrl && (
          <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
            {/* Subject photo upload */}
            <div onClick={()=>photoRef.current?.click()} title="Upload subject photo"
              style={{width:28,height:28,borderRadius:"50%",cursor:"pointer",
                border:"2px dashed rgba(255,255,255,.3)",overflow:"hidden",
                display:"flex",alignItems:"center",justifyContent:"center",
                background:"rgba(255,255,255,.05)",flexShrink:0}}>
              {subjectPhoto
                ? <img src={subjectPhoto} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                : <span style={{fontSize:14}}>👤</span>}
            </div>
            <input ref={photoRef} type="file" accept="image/*" style={{display:"none"}}
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = ev => setSubjectPhoto(ev.target?.result as string);
                reader.readAsDataURL(f);
              }}/>
            <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>Expires:</span>
            {[7,30,60,90].map(d=>(
              <button key={d} onClick={()=>setExpiryDays(d)}
                style={{padding:"4px 8px",fontSize:11,fontWeight:600,cursor:"pointer",
                  borderRadius:4,border:"none",
                  background:expiryDays===d?"#6d28d9":"rgba(255,255,255,.1)",
                  color:"white"}}>
                {d}d
              </button>
            ))}
            <button onClick={generateLink} disabled={generating}
              style={{background:"#7c3aed",border:"none",color:"white",
                padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,marginLeft:4}}>
              {generating ? "⏳ Generating…" : `🔗 Generate Link (${selected.size} clips)`}
            </button>
          </div>
        )}
        {generatedUrl && (
          <div style={{display:"flex",alignItems:"center",gap:8,
            background:"rgba(34,197,94,.15)",border:"1px solid #22c55e",
            borderRadius:6,padding:"5px 10px"}}>
            <span style={{fontSize:11,color:"#22c55e",fontWeight:600}}>✅ Link ready:</span>
            <a href={generatedUrl} target="_blank" rel="noreferrer"
              style={{fontSize:11,color:"#60a5fa",textDecoration:"none"}}>
              {generatedUrl}
            </a>
            <button onClick={()=>navigator.clipboard.writeText(generatedUrl)}
              style={{background:"transparent",border:"1px solid #334155",color:"#94a3b8",
                padding:"2px 8px",borderRadius:4,cursor:"pointer",fontSize:10}}>
              Copy
            </button>
          </div>
        )}
        <button onClick={onClose} style={{background:"transparent",
          border:"1px solid rgba(255,255,255,.3)",color:"white",
          padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:12}}>
          ✕ Close
        </button>
      </div>

      {/* Filters */}
      <div style={{background:"#1a2e5c",padding:"10px 20px",display:"flex",
        gap:6,flexWrap:"wrap",alignItems:"center",flexShrink:0}}>
        <span style={{fontSize:11,color:"rgba(255,255,255,.5)",marginRight:4}}>Filter:</span>
        <button onClick={()=>setSubjectOnly(!subjectOnly)}
          style={{padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",
            borderRadius:4,border:"none",
            background:subjectOnly?"#ef4444":"rgba(255,255,255,.08)",
            color:"white",marginRight:4}}>
          {subjectOnly ? "🎯 Subject Only ✓" : "🎯 Subject Only"}
        </button>
        {ACTIVITY_KEYWORDS.map(k=>(
          <button key={k.value} onClick={()=>setKeyword(k.value)}
            style={{padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",
              borderRadius:4,border:"none",
              background:keyword===k.value?"#3b82f6":"rgba(255,255,255,.1)",
              color:"white"}}>
            {k.label}
          </button>
        ))}
        <div style={{width:1,background:"rgba(255,255,255,.15)",margin:"0 4px",height:20}}/>
        {([
          {k:"all",  label:"All effort",  color:"rgba(255,255,255,.15)"},
          {k:"high", label:"🔴 HIGH",     color:"#ef444430"},
          {k:"med",  label:"🟡 MED",      color:"#f59e0b30"},
          {k:"low",  label:"🟢 LOW",      color:"#22c55e30"},
        ] as const).map(e=>(
          <button key={e.k} onClick={()=>setEffortFilter(e.k)}
            style={{padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",
              borderRadius:4,border:"none",
              background:effortFilter===e.k?"rgba(255,255,255,.25)":e.color,
              color:"white",outline:effortFilter===e.k?"2px solid rgba(255,255,255,.4)":"none"}}>
            {e.label}
          </button>
        ))}
        <input placeholder="Custom search…" value={keyword} onChange={e=>setKeyword(e.target.value)}
          style={{fontSize:11,padding:"4px 10px",borderRadius:4,border:"none",
            background:"rgba(255,255,255,.1)",color:"white",width:140,marginLeft:8}}/>
        <button onClick={()=>setSelected(new Set(filtered.map(f=>f.frame_id)))}
          style={{marginLeft:"auto",padding:"4px 10px",fontSize:11,fontWeight:600,
            cursor:"pointer",borderRadius:4,border:"1px solid rgba(255,255,255,.2)",
            background:"transparent",color:"rgba(255,255,255,.7)"}}>
          Select all visible ({filtered.length})
        </button>
        <button onClick={()=>setSelected(new Set())}
          style={{padding:"4px 10px",fontSize:11,fontWeight:600,
            cursor:"pointer",borderRadius:4,border:"1px solid rgba(255,255,255,.2)",
            background:"transparent",color:"rgba(255,255,255,.5)"}}>
          Clear
        </button>
        <select value={inv} onChange={e=>setInv(e.target.value)}
          style={{fontSize:11,padding:"4px 8px",borderRadius:4,border:"none",
            background:"rgba(255,255,255,.1)",color:"white",marginLeft:4}}>
          <option value="">All investigators</option>
          {investigators.map(i=>(
            <option key={i} value={i}>{i.replace(" Camcorder","")}</option>
          ))}
        </select>
        {personThumbs.length > 0 && (
          <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:8,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>Person:</span>
            <button onClick={()=>setPersonFilter(null)}
              style={{padding:"4px 8px",fontSize:11,fontWeight:600,cursor:"pointer",
                borderRadius:4,border:"none",
                background:personFilter===null?"#3b82f6":"rgba(255,255,255,.1)",
                color:"white"}}>All</button>
            {personThumbs.map(p=>(
              <button key={p.person_id} onClick={()=>setPersonFilter(p.person_id)}
                title={`${p.label} — ${p.appearances} frames`}
                style={{display:"flex",alignItems:"center",gap:5,
                  padding:"2px 8px 2px 2px",fontSize:11,fontWeight:600,
                  cursor:"pointer",borderRadius:20,border:"none",
                  background:personFilter===p.person_id?"rgba(245,158,11,.2)":"rgba(255,255,255,.08)",
                  outline:personFilter===p.person_id?"2px solid #f59e0b":"2px solid transparent",
                  color:"white"}}>
                <img src={p.thumbnail} alt={p.label}
                  style={{width:26,height:26,borderRadius:"50%",objectFit:"cover",
                    border:`2px solid ${personFilter===p.person_id?"#f59e0b":"rgba(255,255,255,.2)"}`}}/>
                <span>{p.label}</span>
                <span style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>({p.appearances})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Grid */}
        <div style={{flex:1,overflow:"auto",padding:14,
          display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",
          gap:10,alignContent:"start"}}>
          {loading && (
            <div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:"#64748b"}}>
              Loading intelligence frames…
            </div>
          )}
          {!loading && filtered.length===0 && (
            <div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:"#64748b"}}>
              No frames match — try a different filter
            </div>
          )}
          {visible.length < filtered.length && (
            <div style={{gridColumn:"1/-1",textAlign:"center",padding:16}}>
              <button onClick={()=>setPage(p=>p+1)}
                style={{padding:"8px 20px",fontSize:12,fontWeight:600,cursor:"pointer",
                  background:"rgba(59,130,246,.15)",border:"1px solid #3b82f6",
                  color:"#60a5fa",borderRadius:6}}>
                Load more ({visible.length} of {filtered.length} shown)
              </button>
            </div>
          )}
          {visible.map(frame=>(
            <div key={frame.frame_id} onClick={()=>playClip(frame)}
              style={{background:"#1e293b",borderRadius:8,overflow:"hidden",cursor:"pointer",
                border:`2px solid ${selected.has(frame.frame_id)?"#3b82f6":playing?.frame_id===frame.frame_id?"#60a5fa":frame.effort_score>=7?"#ef444444":frame.effort_score>=4?"#f59e0b44":"transparent"}`,
                transition:"border-color .15s, transform .15s",
                transform:playing?.frame_id===frame.frame_id?"scale(1.02)":"scale(1)"}}>
              {/* Thumb */}
              <div style={{background:"#0f172a",height:118,display:"flex",
                alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
                {frame.thumbnail_presigned
                  ? <img src={frame.thumbnail_presigned} alt="frame"
                      style={{width:"100%",height:"100%",objectFit:"cover",opacity:.9}}/>
                  : <span style={{fontSize:28,opacity:.4}}>🎬</span>}
                <div style={{position:"absolute",bottom:5,left:6,
                  background:"rgba(0,0,0,.75)",borderRadius:3,padding:"2px 6px",
                  fontSize:10,fontFamily:"monospace",color:"white"}}>
                  {frame.timestamp}
                </div>
                <div style={{position:"absolute",top:5,right:5,
                  background:"rgba(59,130,246,.85)",borderRadius:3,padding:"2px 6px",
                  fontSize:9,color:"white",fontWeight:700}}>
                  ▶ 20s
                </div>
                {frame.subject_match && (
                  <div style={{position:"absolute",bottom:5,right:36,
                    background:"rgba(239,68,68,.85)",borderRadius:3,padding:"2px 5px",
                    fontSize:9,color:"white",fontWeight:700}}>
                    🎯 Subject
                  </div>
                )}
                {frame.effort_score > 0 && (
                  <div style={{position:"absolute",top:5,left:6,
                    background:effortColor(frame.effort_score),
                    borderRadius:3,padding:"2px 6px",
                    fontSize:9,color:"white",fontWeight:700}}>
                    {effortLabel(frame.effort_score)} {frame.effort_score}/10
                  </div>
                )}
                <div onClick={e=>{e.stopPropagation();toggleSelect(frame.frame_id);}}
                  style={{position:"absolute",bottom:5,right:6,
                    width:18,height:18,borderRadius:3,cursor:"pointer",
                    background:selected.has(frame.frame_id)?"#3b82f6":"rgba(255,255,255,.2)",
                    border:"2px solid white",display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:11,color:"white",fontWeight:700}}>
                  {selected.has(frame.frame_id)?"✓":""}
                </div>
              </div>
              {/* Info */}
              <div style={{padding:"7px 9px"}}>
                <p style={{margin:"0 0 3px",fontSize:10,color:"#475569"}}>
                  {fmtDate(frame.recorded_at)} · {frame.investigator.replace(" Camcorder","")}
                </p>
                <p style={{margin:0,fontSize:11,color:"#cbd5e1",lineHeight:1.45}}>
                  <HL text={frame.description} kw={keyword}/>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Player */}
        {playing && (
          <div style={{width:370,background:"#0f172a",borderLeft:"1px solid #1e293b",
            display:"flex",flexDirection:"column",flexShrink:0}}>
            <div style={{padding:"10px 14px",borderBottom:"1px solid #1e293b"}}>
              <p style={{margin:0,fontSize:12,fontWeight:700,color:"white",
                fontFamily:"monospace"}}>{playing.filename}</p>
              <p style={{margin:"2px 0 0",fontSize:11,color:"#64748b"}}>
                {playing.timestamp} · {playing.investigator.replace(" Camcorder","")}
              </p>
            </div>
            <div style={{background:"black",aspectRatio:"16/9",position:"relative",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              {clipLoading && (
                <div style={{textAlign:"center"}}>
                  <div style={{width:28,height:28,border:"3px solid #334155",
                    borderTop:"3px solid #3b82f6",borderRadius:"50%",
                    animation:"spin 1s linear infinite",margin:"0 auto 8px"}}/>
                  <p style={{margin:0,fontSize:11,color:"#475569"}}>Generating clip…</p>
                </div>
              )}
              {clipUrl && <video ref={videoRef} src={clipUrl} controls autoPlay
                style={{width:"100%",height:"100%"}}/>}
            </div>
            <div style={{padding:"12px 14px",flex:1,overflow:"auto"}}>
              <p style={{margin:"0 0 6px",fontSize:10,fontWeight:700,color:"#475569",
                textTransform:"uppercase",letterSpacing:.06}}>AI Description</p>
              <p style={{margin:"0 0 12px",fontSize:12,color:"#e2e8f0",lineHeight:1.6}}>
                {playing.description}
              </p>
              <div style={{background:"#1e293b",borderRadius:6,padding:"8px 10px",
                fontSize:10,color:"#64748b",lineHeight:1.8}}>
                <span style={{color:"#94a3b8",fontWeight:600}}>Recorded:</span> {fmtDate(playing.recorded_at)}<br/>
                <span style={{color:"#94a3b8",fontWeight:600}}>File:</span> {playing.filename}<br/>
                <span style={{color:"#94a3b8",fontWeight:600}}>Clip:</span> {playing.timestamp} ±10s
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

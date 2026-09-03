
import React, { useState, useEffect, useCallback } from "react";

interface Vehicle {
  source: string; year: string; make: string; model: string;
  vin?: string; color?: string; plate?: string; notes?: string;
  decoded?: Record<string,string>; added_at: string;
}

const SOURCE_LABELS: Record<string,string> = {
  toggle:"Toggle", mercury:"Mercury", state_farm:"State Farm",
  allstate:"Allstate", manual:"Manual", nicb:"NICB",
};
const SOURCE_COLORS: Record<string,string> = {
  toggle:"#6366f1", mercury:"#ef4444", state_farm:"#3b82f6",
  allstate:"#f59e0b", manual:"#10b981", nicb:"#8b5cf6",
};


// ── Allstate Scrape Section ──────────────────────────────────────────────────
function AllstateScrapeSection({ inv, base, isDark, acc, txt, sec, mut, bdr, bg1, onFound }: any) {
  const [open, setOpen]       = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult]   = React.useState<any>(null);
  const [form, setForm]       = React.useState({
    zip_code: "", vin: "", year: "", make: "", model: "",
  });

  // Pre-fill from investigation subject
  React.useEffect(() => {
    if (!inv) return;
    const name  = inv.subject_name || "";
    const parts = name.trim().split(/\s+/);
    setForm(f => ({
      ...f,
      zip_code: (inv.subject_addresses?.[0] || "").match(/\b(\d{5})\b/)?.[1] || "",
    }));
  }, [inv]);

  const inp: React.CSSProperties = {
    flex:1, padding:"7px 10px", borderRadius:7, border:`1px solid ${bdr}`,
    background:bg1, color:txt, fontSize:13, outline:"none", minWidth:0,
  };

  const run = async () => {
    setLoading(true); setResult(null);
    const name  = inv?.subject_name || "";
    const parts = name.trim().split(/\s+/);
    const first = parts[0] || "";
    const last  = parts[parts.length-1] || "";
    const dob   = inv?.subject_dob || "";
    const gender = inv?.subject_gender === "male" ? "M" : "F";

    try {
      const r = await fetch(`${base}/api/insurance-vehicles/${inv.id}/scrape-allstate`, {
        method:"POST", credentials:"include",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...form, first_name:first, last_name:last, dob, gender }),
      });
      const data = await r.json();
      setResult(data);
      if (data.found) onFound?.();
    } catch(e: any) {
      setResult({error: e.message});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{marginTop:12, border:`1px solid ${isDark?"rgba(251,191,36,0.3)":"#fde68a"}`, borderRadius:10, overflow:"hidden"}}>
      <button onClick={() => setOpen(o=>!o)} style={{
        width:"100%", padding:"10px 14px", background:isDark?"rgba(251,191,36,0.1)":"#fefce8",
        border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:8,
        color:isDark?"#fde047":"#854d0e", fontSize:13, fontWeight:600, textAlign:"left" as any,
      }}>
        <span>🔍 Allstate Vehicle Lookup</span>
        <span style={{marginLeft:"auto", fontSize:11, opacity:.7}}>{open?"▲":"▼"}</span>
      </button>

      {open && (
        <div style={{padding:14, display:"flex", flexDirection:"column" as any, gap:10}}>
          <div style={{display:"flex", gap:8, flexWrap:"wrap" as any}}>
            <input value={form.zip_code} onChange={e=>setForm(f=>({...f,zip_code:e.target.value}))}
              placeholder="ZIP code" style={{...inp, maxWidth:100}} />
            <input value={form.vin} onChange={e=>setForm(f=>({...f,vin:e.target.value.toUpperCase()}))}
              placeholder="VIN (optional)" style={{...inp, maxWidth:180, fontFamily:"monospace"}} />
          </div>
          <div style={{display:"flex", gap:8, flexWrap:"wrap" as any}}>
            <input value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))}
              placeholder="Year" style={{...inp, maxWidth:80}} />
            <input value={form.make} onChange={e=>setForm(f=>({...f,make:e.target.value}))}
              placeholder="Make" style={{...inp, maxWidth:120}} />
            <input value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))}
              placeholder="Model" style={inp} />
          </div>

          <button onClick={run} disabled={loading || !form.zip_code} style={{
            padding:"9px 18px", borderRadius:8, border:"none", cursor:loading?"wait":"pointer",
            background: loading ? (isDark?"#374151":"#e5e7eb") : (isDark?"rgba(251,191,36,0.8)":"#ca8a04"),
            color: loading ? sec : "white", fontWeight:700, fontSize:13,
            opacity: (!form.zip_code) ? .5 : 1,
          }}>
            {loading ? "⏳ Scraping Allstate..." : "🔍 Run Allstate Lookup"}
          </button>

          {result && (
            <div style={{
              padding:"10px 12px", borderRadius:8, fontSize:12,
              background: result.error ? (isDark?"rgba(239,68,68,0.1)":"#fef2f2") :
                          result.found ? (isDark?"rgba(16,185,129,0.1)":"#f0fdf4") :
                                         (isDark?"rgba(255,255,255,0.05)":"#f8fafc"),
              border:`1px solid ${result.error?(isDark?"rgba(239,68,68,0.3)":"#fecaca"):
                                  result.found?(isDark?"rgba(16,185,129,0.3)":"#86efac"):bdr}`,
              color: result.error?(isDark?"#f87171":"#dc2626"):
                     result.found?(isDark?"#4ade80":"#166534"):sec,
            }}>
              {result.error && <div>❌ Error: {result.error}</div>}
              {!result.error && result.found && <div>✅ Vehicle found in Allstate system!</div>}
              {!result.error && !result.found && <div>ℹ️ Vehicle not found or CA restriction applies.</div>}
              {result.url && <div style={{marginTop:4, opacity:.7, fontSize:11}}>URL: {result.url}</div>}
              {result.page_snippet && <div style={{marginTop:6, fontFamily:"monospace", fontSize:10, opacity:.6, whiteSpace:"pre-wrap" as any}}>{result.page_snippet.substring(0,200)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InsuranceVehiclesTab({inv,base,acc,sec,isDark,txt,mut,bg1,bg2,bdr}: any) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [vinLookup, setVinLookup] = useState("");
  const [vinResult, setVinResult] = useState<any>(null);
  const [vinLoading, setVinLoading] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({
    source:"manual",year:"",make:"",model:"",vin:"",color:"",plate:"",notes:"",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${base}/api/insurance-vehicles/${inv.id}/vehicles`,
        {credentials:"include"});
      if (r.ok) { const d=await r.json(); setVehicles(d.vehicles||[]); }
    } finally { setLoading(false); }
  }, [base, inv.id]);

  useEffect(() => { load(); }, [load]);

  const lookupVin = async () => {
    if (vinLookup.length !== 17) return;
    setVinLoading(true); setVinResult(null);
    try {
      const r = await fetch(`${base}/api/insurance-vehicles/nhtsa/${vinLookup.toUpperCase()}`,
        {credentials:"include"});
      if (r.ok) {
        const d = await r.json(); setVinResult(d);
        setForm(f=>({...f, vin:d.vin, year:d.year, make:d.make, model:d.model}));
      } else { setVinResult({error:"VIN not found"}); }
    } catch { setVinResult({error:"Lookup failed"}); }
    setVinLoading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${base}/api/insurance-vehicles/${inv.id}/add-vehicle`, {
        method:"POST", credentials:"include",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify(form),
      });
      if (r.ok) {
        setShowAdd(false);
        setForm({source:"manual",year:"",make:"",model:"",vin:"",color:"",plate:"",notes:""});
        setVinLookup(""); setVinResult(null); await load();
      } else { alert("Save failed"); }
    } finally { setSaving(false); }
  };

  const remove = async (idx: number) => {
    if (!confirm("Remove this vehicle?")) return;
    const r = await fetch(`${base}/api/insurance-vehicles/${inv.id}/vehicles/${idx}`,
      {method:"DELETE",credentials:"include"});
    if (r.ok) await load();
  };

  const card:React.CSSProperties = {border:`1px solid ${bdr}`,borderRadius:10,background:bg2,padding:"12px 16px",marginBottom:10};
  const lbl:React.CSSProperties  = {fontSize:10,textTransform:"uppercase" as any,letterSpacing:".06em",color:mut,fontWeight:700,marginBottom:3,display:"block"};
  const inp:React.CSSProperties  = {width:"100%",boxSizing:"border-box" as any,padding:"7px 10px",borderRadius:6,fontSize:13,border:`1px solid ${bdr}`,background:bg1,color:txt,outline:"none"};
  const btn = (bg:string,col="white"):React.CSSProperties => ({padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:600,background:bg,color:col,border:"none",cursor:"pointer"});

  return (
    <div style={{padding:"16px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <p style={{margin:0,fontSize:15,fontWeight:600,color:txt}}>
            Insurance Vehicles
            {vehicles.length>0 && <span style={{marginLeft:8,fontSize:12,color:acc,fontWeight:700}}>{vehicles.length}</span>}
          </p>
          <p style={{margin:"2px 0 0",fontSize:11,color:mut}}>Vehicles found via Toggle · Mercury · State Farm · Allstate</p>
        </div>
        <button onClick={()=>setShowAdd(v=>!v)} style={btn(acc)}>{showAdd?"✕ Cancel":"+ Add Vehicle"}</button>
      </div>

      {showAdd && (
        <div style={{...card,background:isDark?"rgba(99,102,241,0.06)":"#f0f0ff",border:`1px solid ${acc}40`,marginBottom:16}}>
          <div style={{marginBottom:14}}>
            <span style={lbl}>VIN Lookup via NHTSA (free, no API key)</span>
            <div style={{display:"flex",gap:8}}>
              <input value={vinLookup} onChange={e=>setVinLookup(e.target.value.toUpperCase())}
                placeholder="Enter 17-char VIN" maxLength={17}
                style={{...inp,fontFamily:"monospace",flex:1}} />
              <button onClick={lookupVin} disabled={vinLookup.length!==17||vinLoading}
                style={btn(vinLookup.length===17?acc:bdr, vinLookup.length===17?"white":mut)}>
                {vinLoading?"…":"Decode"}
              </button>
            </div>
            {vinResult&&!vinResult.error && (
              <div style={{marginTop:8,padding:"6px 12px",borderRadius:6,
                background:isDark?"rgba(16,185,129,0.1)":"#f0fdf4",
                border:"1px solid #86efac",fontSize:12,color:isDark?"#4ade80":"#166534"}}>
                ✓ {vinResult.year} {vinResult.make} {vinResult.model}
                {vinResult.body_class&&` · ${vinResult.body_class}`}
              </div>
            )}
            {vinResult?.error && <div style={{marginTop:6,fontSize:12,color:"#ef4444"}}>✗ {vinResult.error}</div>}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><span style={lbl}>Source</span>
              <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={inp}>
                {Object.entries(SOURCE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><span style={lbl}>Year</span><input value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))} placeholder="2019" style={inp}/></div>
            <div><span style={lbl}>Make</span><input value={form.make} onChange={e=>setForm(f=>({...f,make:e.target.value}))} placeholder="Honda" style={inp}/></div>
            <div><span style={lbl}>Model</span><input value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))} placeholder="Accord" style={inp}/></div>
            <div><span style={lbl}>Color</span><input value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} placeholder="Black" style={inp}/></div>
            <div><span style={lbl}>Plate</span><input value={form.plate} onChange={e=>setForm(f=>({...f,plate:e.target.value}))} placeholder="7ABC123" style={inp}/></div>
            <div style={{gridColumn:"1/-1"}}><span style={lbl}>VIN</span>
              <input value={form.vin} onChange={e=>setForm(f=>({...f,vin:e.target.value.toUpperCase()}))}
                placeholder="17 characters" maxLength={17} style={{...inp,fontFamily:"monospace"}}/>
            </div>
            <div style={{gridColumn:"1/-1"}}><span style={lbl}>Notes</span>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                placeholder="Primary driver, registered address…" style={inp}/>
            </div>
          </div>
          <div style={{marginTop:14,display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={save} disabled={saving||(!form.make&&!form.vin)} style={btn(acc)}>
              {saving?"Saving…":"💾 Save Vehicle"}
            </button>
          </div>
        </div>
      )}

      {loading ? <p style={{color:mut,fontSize:13}}>Loading…</p>
      : vehicles.length===0 ? (
        <div style={{...card,textAlign:"center",padding:"32px 16px"}}>
          <p style={{fontSize:28,margin:"0 0 8px"}}>🚗</p>
          <p style={{fontSize:13,color:mut,margin:0}}>
            No vehicles yet. Run Toggle/Mercury/Allstate/State Farm quote lookups for this subject,
            then add any vehicles found here. Use the VIN decoder above to auto-fill make/model/year.
          </p>
        </div>
      ) : vehicles.map((v,idx)=>{
        const srcCol = SOURCE_COLORS[v.source]||acc;
        return (
          <div key={idx} style={card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <span style={{display:"inline-block",fontSize:10,padding:"2px 8px",borderRadius:20,
                  background:`${srcCol}20`,color:srcCol,fontWeight:700,marginBottom:6,
                  textTransform:"uppercase" as any,letterSpacing:".05em"}}>
                  {SOURCE_LABELS[v.source]||v.source}
                </span>
                <p style={{margin:"0 0 4px",fontSize:16,fontWeight:700,color:txt}}>
                  {[v.year,v.make,v.model].filter(Boolean).join(" ")||"Unknown Vehicle"}
                  {v.color&&<span style={{fontSize:13,fontWeight:400,color:mut,marginLeft:8}}>{v.color}</span>}
                </p>
                <div style={{display:"flex",gap:16,flexWrap:"wrap" as any,marginBottom:4}}>
                  {v.vin&&<span style={{fontSize:12,color:mut,fontFamily:"monospace"}}>VIN: <span style={{color:txt}}>{v.vin}</span></span>}
                  {v.plate&&<span style={{fontSize:12,color:mut}}>Plate: <span style={{color:txt,fontWeight:600}}>{v.plate}</span></span>}
                </div>
                {v.decoded&&!v.decoded.error&&Object.keys(v.decoded).length>0&&(
                  <div style={{fontSize:11,color:mut,display:"flex",gap:10,flexWrap:"wrap" as any}}>
                    {v.decoded.body_class&&<span>📦 {v.decoded.body_class}</span>}
                    {v.decoded.fuel_type&&<span>⛽ {v.decoded.fuel_type}</span>}
                    {v.decoded.drive_type&&<span>🔧 {v.decoded.drive_type}</span>}
                  </div>
                )}
                {v.notes&&<p style={{margin:"6px 0 0",fontSize:12,color:mut,padding:"4px 8px",background:`${bdr}40`,borderRadius:4}}>📋 {v.notes}</p>}
                <p style={{margin:"6px 0 0",fontSize:10,color:mut}}>
                  Added {new Date(v.added_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                </p>
              </div>
              <button onClick={()=>remove(idx)}
                style={{background:"transparent",border:"none",cursor:"pointer",color:mut,fontSize:16,padding:"0 4px",flexShrink:0}}>×</button>
            </div>
          </div>
        );
      })}

      {/* Allstate Scraper */}
      <AllstateScrapeSection inv={inv} base={base} isDark={isDark} acc={acc} txt={txt} sec={sec} mut={mut} bdr={bdr} bg1={bg1} onFound={() => { fetch(`${base}/api/insurance-vehicles/${inv.id}/vehicles`,{credentials:"include"}).then(r=>r.json()).then(d=>{if(d.vehicles) setVehicles(d.vehicles);}); }} />

      <div style={{marginTop:16,padding:"10px 14px",borderRadius:8,
        background:isDark?"rgba(251,191,36,0.08)":"#fffbeb",
        border:`1px solid ${isDark?"rgba(251,191,36,0.2)":"#fde68a"}`,
        fontSize:12,color:isDark?"#fbbf24":"#92400e"}}>
        <strong>Note on scrapers:</strong> Toggle is blocked in CA (Farmers paused new auto policies).
        Mercury uses DataDome bot protection — run lookups from Jennifer's browser then paste results here.
        Allstate scraper works for most states — enter subject info to check.
        VIN from Toggle/Mercury → NHTSA decoder fills year/make/model automatically for free.
      </div>
    </div>
  );
}

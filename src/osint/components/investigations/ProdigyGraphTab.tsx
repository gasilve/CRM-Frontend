// @ts-nocheck

import { useState, useEffect, useRef } from "react";

const BASE = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";

const NODE_CFG: Record<string,{color:string;r:number;icon:string}> = {
  subject:  { color:"#6a8fff", r:14, icon:"👤" },
  employer: { color:"#f59e0b", r:10, icon:"🏢" },
  address:  { color:"#10b981", r:9,  icon:"📍" },
  phone:    { color:"#a78bfa", r:8,  icon:"📞" },
  email:    { color:"#f472b6", r:8,  icon:"✉️"  },
  username: { color:"#fb923c", r:8,  icon:"@"  },
  vehicle:  { color:"#34d399", r:9,  icon:"🚗" },
  finding:  { color:"#94a3b8", r:7,  icon:"🔎" },
};

function buildGraph(inv: any, meta: any) {
  const nodes: any[] = [];
  const links: any[] = [];
  const addN = (id:string, label:string, type:string) => {
    if (!label?.trim() || nodes.find((n:any)=>n.id===id)) return;
    nodes.push({ id, label, type });
  };
  const addL = (s:string, t:string) => {
    if (nodes.find((n:any)=>n.id===s) && nodes.find((n:any)=>n.id===t))
      links.push({ source:s, target:t });
  };
  addN("subj", inv?.subject_name||"Unknown", "subject");
  const emp = meta?.employer_name||inv?.employer_name;
  if (emp) { addN("emp",emp,"employer"); addL("subj","emp"); }
  (inv?.subject_addresses||[]).slice(0,4).forEach((a:string,i:number)=>{ if(!a) return; addN(`a${i}`,String(a),"address"); addL("subj",`a${i}`); });
  (inv?.subject_phones||[]).slice(0,5).forEach((p:string,i:number)=>{ if(!p) return; addN(`p${i}`,String(p),"phone"); addL("subj",`p${i}`); });
  (inv?.subject_emails||[]).slice(0,4).forEach((e:string,i:number)=>{ if(!e) return; addN(`e${i}`,String(e),"email"); addL("subj",`e${i}`); });
  (inv?.vehicles||[]).slice(0,3).forEach((v:any,i:number)=>{ const l=v?.plate||`${v?.year||""} ${v?.make||""} ${v?.model||""}`.trim(); if(!l) return; addN(`v${i}`,l,"vehicle"); addL("subj",`v${i}`); });
  const plats: Record<string,{count:number,vals:string[]}> = {};
  (inv?.findings||[]).forEach((f:any)=>{ const p=(f?.platform||"").toLowerCase(); if(!p) return; if(!plats[p]) plats[p]={count:0,vals:[]}; plats[p].count++; const val=f.found_username||f.url||""; if(val&&plats[p].vals.length<2) plats[p].vals.push(val); });
  Object.entries(plats).slice(0,10).forEach(([plat,{count,vals}],i)=>{ addN(`pl${i}`,`${plat} (${count})`,"finding"); addL("subj",`pl${i}`); if(vals[0]){addN(`pv${i}`,vals[0].substring(0,20),"username"); addL(`pl${i}`,`pv${i}`);}});
  return { nodes, links };
}

export function ProdigyGraphTab({ invId, inv: invProp, meta: metaProp, isGL }: {
  invId:number; inv?:any; meta?:any; isGL:boolean;
}) {
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphInstanceRef = useRef<any>(null);

  const bdr = isGL?"rgba(255,255,255,0.12)":"#e2e8f0";
  const bg  = isGL?"#080c14":"#f1f5f9";
  const sec = isGL?"rgba(160,185,240,0.70)":"#64748b";
  const acc = isGL?"#6a8fff":"#1e40af";
  const txt = isGL?"rgba(218,234,255,0.95)":"#0f172a";

  // Load data
  useEffect(() => {
    const id = invId;
    if (!id) return;
    Promise.all([
      invProp ? Promise.resolve(invProp)
        : fetch(`${BASE}/api/investigations/${id}`,{credentials:"include"}).then(r=>r.json()),
      fetch(`${BASE}/api/investigations/${id}/findings?limit=50`,{credentials:"include"}).then(r=>r.json()).catch(()=>[]),
      fetch(`${BASE}/api/investigations/${id}/vehicles`,{credentials:"include"}).then(r=>r.json()).catch(()=>[]),
    ]).then(([invData, findData, vehData]) => {
      const base = invProp||invData||{};
      const m = metaProp||base.extra_metadata||{};
      const enriched = {
        subject_name: base.subject_name,
        subject_addresses: base.subject_addresses||[],
        subject_phones: base.subject_phones||[],
        subject_emails: base.subject_emails||[],
        employer_name: m.employer_name,
        findings: Array.isArray(findData)?findData:(findData?.items||[]),
        vehicles: Array.isArray(vehData)?vehData:(vehData?.items||[]),
      };
      setGraphData(buildGraph(enriched, m));
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, [invId, invProp, metaProp]);

  // Mount force-graph after data is ready
  useEffect(() => {
    if (!graphData || !containerRef.current) return;

    import("force-graph").then(mod => {
      const ForceGraph = mod.default;
      const el = containerRef.current!;
      el.innerHTML = "";

      const Graph = ForceGraph()(el)
        .width(el.offsetWidth||700)
        .height(el.offsetHeight||500)
        .backgroundColor(bg)
        .linkColor(() => isGL?"rgba(106,143,255,0.3)":"rgba(100,116,139,0.25)")
        .linkWidth(1.5)
        .nodeCanvasObject((n:any, ctx:CanvasRenderingContext2D, scale:number) => {
          const cfg = NODE_CFG[n.type]||NODE_CFG.finding;
          const isSel = sel?.id === n.id;
          if (isSel) {
            ctx.beginPath(); ctx.arc(n.x,n.y,cfg.r+6,0,2*Math.PI);
            ctx.fillStyle=cfg.color+"33"; ctx.fill();
          }
          ctx.beginPath(); ctx.arc(n.x,n.y,cfg.r,0,2*Math.PI);
          ctx.fillStyle=cfg.color; ctx.fill();
          if (isSel) { ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke(); }
          ctx.font=`${cfg.r*1.1}px serif`;
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(cfg.icon, n.x, n.y);
          if (scale > 0.7) {
            const label = n.label.length>18?n.label.substring(0,16)+"…":n.label;
            ctx.font=`bold ${Math.max(8,10/scale)}px system-ui`;
            ctx.textAlign="center"; ctx.textBaseline="top";
            ctx.fillStyle=isGL?"rgba(218,234,255,0.9)":"#1e293b";
            ctx.fillText(label, n.x, n.y+cfg.r+3);
          }
        })
        .nodePointerAreaPaint((n:any, color:string, ctx:any) => {
          ctx.fillStyle=color;
          ctx.beginPath();
          ctx.arc(n.x,n.y,(NODE_CFG[n.type]?.r||7)+4,0,2*Math.PI);
          ctx.fill();
        })
        .onNodeClick((n:any) => setSel((s:any)=>s?.id===n.id?null:n))
        .onBackgroundClick(() => setSel(null))
        .graphData(graphData);

      graphInstanceRef.current = Graph;

      // Fit after simulation
      setTimeout(() => {
        try { Graph.zoomToFit(500, 60); } catch {}
      }, 1500);

      // Resize
      const ro = new ResizeObserver(() => {
        Graph.width(el.offsetWidth||700).height(el.offsetHeight||500);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }).catch(e => console.error("force-graph error:", e));
  }, [graphData, isGL]);

  // Update selected node highlight
  useEffect(() => {
    graphInstanceRef.current?.nodeCanvasObject((n:any, ctx:any, scale:number) => {
      const cfg = NODE_CFG[n.type]||NODE_CFG.finding;
      const isSel = sel?.id === n.id;
      if (isSel) {
        ctx.beginPath(); ctx.arc(n.x,n.y,cfg.r+6,0,2*Math.PI);
        ctx.fillStyle=cfg.color+"33"; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(n.x,n.y,cfg.r,0,2*Math.PI);
      ctx.fillStyle=cfg.color; ctx.fill();
      if (isSel) { ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke(); }
      ctx.font=`${cfg.r*1.1}px serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(cfg.icon, n.x, n.y);
    });
  }, [sel]);

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:450,flexDirection:"column",gap:12,color:sec}}>
      <div style={{fontSize:32}}>⚙️</div><div style={{fontSize:13}}>Building graph…</div>
    </div>
  );

  if (!graphData||!graphData.nodes.length) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:450,flexDirection:"column",gap:12,color:sec,border:"1px solid "+bdr,borderRadius:10}}>
      <div style={{fontSize:36}}>🔗</div>
      <div style={{fontSize:13,fontWeight:600,color:txt}}>No data to visualize</div>
    </div>
  );

  return (
    <div style={{display:"flex",gap:10,height:"calc(100vh - 280px)",minHeight:500}}>
      <div style={{flex:1,border:"1px solid "+bdr,borderRadius:10,overflow:"hidden",position:"relative"}}>
        <div ref={containerRef} style={{width:"100%",height:"100%"}}/>
        <div style={{position:"absolute",bottom:8,left:10,fontSize:10,color:sec,
          background:"rgba(0,0,0,0.6)",padding:"2px 8px",borderRadius:20,pointerEvents:"none"}}>
          {graphData.nodes.length} nodes · {graphData.links.length} edges
        </div>
        <button onClick={()=>{ try{graphInstanceRef.current?.zoomToFit(500,60);}catch{} }}
          style={{position:"absolute",top:10,right:10,fontSize:10,padding:"4px 10px",
            borderRadius:6,cursor:"pointer",border:"1px solid "+bdr,
            background:"rgba(0,0,0,0.5)",color:"#fff"}}>⊡ Fit</button>
      </div>

      <div style={{width:175,display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
        <div style={{border:"1px solid "+bdr,borderRadius:10,padding:"10px 12px",
          background:isGL?"rgba(255,255,255,0.05)":"#f8fafc"}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase" as any,
            letterSpacing:"0.06em",color:sec,marginBottom:8}}>Legend</div>
          {Object.entries(NODE_CFG).map(([type,cfg])=>(
            <div key={type} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:txt,marginBottom:4}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:cfg.color,flexShrink:0}}/>
              <span style={{textTransform:"capitalize" as any}}>{type}</span>
            </div>
          ))}
        </div>
        {sel&&(
          <div style={{border:"1px solid "+acc+"44",borderRadius:10,padding:"10px 12px",
            background:isGL?"rgba(106,143,255,0.08)":"#eff6ff"}}>
            <div style={{fontSize:10,fontWeight:700,color:acc,marginBottom:6,
              textTransform:"uppercase" as any}}>Selected</div>
            <div style={{fontSize:12,fontWeight:700,color:txt,marginBottom:4,
              wordBreak:"break-word" as any}}>{sel.label}</div>
            <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,
              background:(NODE_CFG[sel.type]?.color||"#888")+"22",
              color:NODE_CFG[sel.type]?.color||sec,
              textTransform:"capitalize" as any}}>{sel.type}</span>
          </div>
        )}
        <div style={{fontSize:10,color:sec,lineHeight:1.6}}>
          💡 Drag nodes · Scroll to zoom · Click to inspect
        </div>
      </div>
    </div>
  );
}

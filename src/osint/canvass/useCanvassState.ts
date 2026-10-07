import { useState, useEffect, useCallback, useMemo } from "react";

export type Facility = {
  id: string; name: string; type: string;
  address?: string; city?: string; state?: string; phone?: string;
  distance_mi: number;
  status: "pending"|"no_record"|"with_record"|"chart_only"|"dismissed";
  record_note?: string; canvass_note?: string; same_address_count?: number;
};

export type FacilityResult = {
  facility_id: string;
  status: "pending"|"no_record"|"with_record"|"chart_only"|"dismissed";
  record_name_variant?: string; record_note?: string; notes?: string;
};

export const TYPE_CFG: Record<string,{ label:string; dot:string; chipOnDark:string; chipTextDark:string; defaultOn?:boolean }> = {
  hospital:         { label:"Hospital",           dot:"#e5484d", defaultOn:true,  chipOnDark:"rgba(229,72,77,0.22)",   chipTextDark:"#f87171" },
  urgent_care:      { label:"Urgent care",        dot:"#f76b15", defaultOn:true,  chipOnDark:"rgba(247,107,21,0.22)",  chipTextDark:"#fb923c" },
  pharmacy:         { label:"Pharmacy",            dot:"#1a9a6c", defaultOn:true,  chipOnDark:"rgba(26,154,108,0.22)",  chipTextDark:"#34d399" },
  imaging:          { label:"Diagnostic imaging",  dot:"#6366f1", chipOnDark:"rgba(99,102,241,0.22)",  chipTextDark:"#818cf8" },
  orthopedic:       { label:"Orthopedic",          dot:"#f59e0b", chipOnDark:"rgba(245,158,11,0.22)",  chipTextDark:"#fbbf24" },
  physical_therapy: { label:"Physical therapy",    dot:"#14b8a6", chipOnDark:"rgba(20,184,166,0.22)",  chipTextDark:"#2dd4bf" },
  pain_management:  { label:"Pain management",     dot:"#ef4444", chipOnDark:"rgba(239,68,68,0.22)",   chipTextDark:"#fca5a5" },
  neurology:        { label:"Neurology",            dot:"#a855f7", chipOnDark:"rgba(168,85,247,0.22)",  chipTextDark:"#d8b4fe" },
  surgery_center:   { label:"Surgery center",      dot:"#dc2626", chipOnDark:"rgba(220,38,38,0.22)",   chipTextDark:"#fda4af" },
  lab:              { label:"Lab / Blood work",    dot:"#64748b", chipOnDark:"rgba(100,116,139,0.22)", chipTextDark:"#94a3b8" },
  psychiatric:      { label:"Psychiatric",          dot:"#8b5cf6", chipOnDark:"rgba(139,92,246,0.22)",  chipTextDark:"#a78bfa" },
  mental_health:    { label:"Mental health",        dot:"#ec4899", chipOnDark:"rgba(236,72,153,0.22)",  chipTextDark:"#f9a8d4" },
  chiropractor:     { label:"Chiropractor",         dot:"#7c3aed", chipOnDark:"rgba(124,58,237,0.22)",  chipTextDark:"#c4b5fd" },
  primary_care:     { label:"Primary care",         dot:"#0ea5e9", chipOnDark:"rgba(14,165,233,0.22)",  chipTextDark:"#38bdf8" },
  other:            { label:"Other",                dot:"#64748b", chipOnDark:"rgba(100,116,139,0.22)", chipTextDark:"#94a3b8" },
};

function cleanAddr(a: string) {
  return a && a.length>10 && a[0]>="0" && a[0]<="9"
    && !a.includes("people named") && !a.includes("RESIDES IN")
    && !a.includes("People Search") && !a.includes("LOCATIONS");
}

export function useCanvassState(inv: any, meta: any, base: string) {
  const DEFAULT_TYPES = Object.entries(TYPE_CFG).filter(([,v])=>v.defaultOn).map(([k])=>k);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(DEFAULT_TYPES));
  const [radius, setRadius] = useState(30);
  const [committedRadius, setCommittedRadius] = useState(30);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string,FacilityResult>>({});
  const [addressChanged, setAddressChanged] = useState<{mi:number;cached:string}|null>(null);
  const [invalidating, setInvalidating] = useState(false);

  const getDefaultAddr = () =>
    meta?.canvass_address || inv?.extra_metadata?.canvass_address ||
    meta?.primary_address  || inv?.extra_metadata?.primary_address  ||
    (inv?.subject_addresses||[]).find(cleanAddr) || "";

  const [canvassAddress, setCanvassAddress] = useState(getDefaultAddr);

  useEffect(() => { setCanvassAddress(getDefaultAddr()); },
    [inv?.id, inv?.extra_metadata?.canvass_address, meta?.canvass_address]);

  useEffect(() => {
    if (!inv?.id) return;
    fetch(`${base}/api/investigations/${inv.id}/canvass-results`,{credentials:"include"})
      .then(r=>r.ok?r.json():null)
      .then(d => { if(d?.results){ const m:Record<string,FacilityResult>={};
        d.results.forEach((r:FacilityResult)=>{m[r.facility_id]=r;}); setResults(m); }})
      .catch(()=>{});
  }, [inv?.id, base]);

  useEffect(() => {
    if (!canvassAddress || !inv?.id) return;
    const types = Array.from(activeTypes).join(",");
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(),120000);
    const ap = canvassAddress?`&address_override=${encodeURIComponent(canvassAddress)}`:"";
    fetch(`${base}/api/investigations/${inv.id}/canvass-facilities?types=${types}&limit=500${ap}`,
      {credentials:"include",signal:ctrl.signal})
      .then(r=>r.ok?r.json():Promise.reject(r.status))
      .then(d=>{
        if(d.facilities){
          const ord:Record<string,number>={pending:0,no_record:1,with_record:2};
          setFacilities([...d.facilities].sort((a:any,b:any)=>(ord[a.status]??0)-(ord[b.status]??0)));
          setAddressChanged(d.address_changed&&d.address_change_mi>0
            ?{mi:d.address_change_mi,cached:d.cached_address||""}:null);
        }
      }).catch(()=>{}).finally(()=>{clearTimeout(t);setLoading(false);});
  }, [inv?.id, canvassAddress, committedRadius, Array.from(activeTypes).sort().join(","), base]);

  const getFacStatus = useCallback((f:Facility)=>
    ((results[f.id]?.status as any)||f.status||"pending") as "pending"|"no_record"|"with_record",
    [results]);

  const visible   = useMemo(()=>facilities.filter(f=>activeTypes.has(f.type)||activeTypes.has("other")),[facilities,activeTypes]);
  const pending   = useMemo(()=>visible.filter(f=>getFacStatus(f)==="pending"),    [visible,results,getFacStatus]);
  const withRecord= useMemo(()=>visible.filter(f=>getFacStatus(f)==="with_record"),[visible,results,getFacStatus]);
  const chartOnly = useMemo(()=>visible.filter(f=>(getFacStatus(f) as string)==="chart_only"), [visible,results,getFacStatus]);
  const noRecord  = useMemo(()=>visible.filter(f=>getFacStatus(f)==="no_record"),  [visible,results,getFacStatus]);
  const dismissed = useMemo(()=>visible.filter(f=>(getFacStatus(f) as string)==="dismissed"),  [visible,results,getFacStatus]);

  const post = useCallback((body:any)=>
    fetch(`${base}/api/investigations/${inv.id}/canvass-result`,
      {method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).catch(()=>{}),
    [inv?.id,base]);

  const markNoRecord  = useCallback((f:Facility)=>{ setResults(r=>({...r,[f.id]:{...r[f.id],facility_id:f.id,status:"no_record"}}));  post({facility_id:f.id,status:"no_record"}); },[post]);
  const markPending   = useCallback((f:Facility)=>{ setResults(r=>({...r,[f.id]:{...r[f.id],facility_id:f.id,status:"pending"}}));    post({facility_id:f.id,status:"pending"}); },[post]);
  const saveNote      = useCallback((f:Facility,notes:string)=>{ setResults(r=>({...r,[f.id]:{...r[f.id],facility_id:f.id,notes}})); post({facility_id:f.id,status:results[f.id]?.status||"pending",notes}); },[post,results]);
  const markWithRecord= useCallback((f:Facility,data:any)=>{ setResults(r=>({...r,[f.id]:{facility_id:f.id,status:"with_record",...data}})); post({facility_id:f.id,status:"with_record",...data}); },[post]);
  const markChartOnly = useCallback((f:Facility,data:any)=>{ setResults(r=>({...r,[f.id]:{facility_id:f.id,status:"chart_only",...data}})); post({facility_id:f.id,status:"chart_only",...data}); },[post]);

  const invalidateCache = useCallback(async()=>{
    if(!inv?.id)return; setInvalidating(true);
    try{ await fetch(`${base}/api/investigations/${inv.id}/canvass-invalidate`,{method:"POST",credentials:"include"});
      setAddressChanged(null); setFacilities([]); }finally{setInvalidating(false);}
  },[inv?.id,base]);

  return {
    activeTypes,setActiveTypes, radius,setRadius, committedRadius,setCommittedRadius,
    facilities, loading, results, canvassAddress, setCanvassAddress,
    addressChanged, invalidating, invalidateCache,
    visible, pending, withRecord, chartOnly, noRecord, dismissed,
    getFacStatus, getFacNote:(f:Facility)=>results[f.id]?.notes||f.canvass_note||"",
    markNoRecord, markPending, saveNote, markWithRecord, markChartOnly,
  };
}


import { useState, useEffect } from "react";

export interface FieldDef {
  id: string;
  label: string;
  category: "subject"|"client"|"employer"|"defense"|"injury"|"surveillance";
  valueKey: string;
  valueSource: "inv"|"meta"|"meta_array"|"inv_array";
  inputType?: "text"|"date"|"select"|"radio"|"textarea";
  options?: string[];
}

export interface TabLayout {
  id: string;
  label: string;
  columns: number;
  fields: string[];
}

export const ALL_FIELDS: FieldDef[] = [
  { id:"subject_name",        label:"Subject name",           category:"subject",      valueKey:"subject_name",        valueSource:"inv" },
  { id:"subject_aliases",     label:"Aliases (AKA)",          category:"subject",      valueKey:"subject_aliases",     valueSource:"inv_array" },
  { id:"subject_dob",         label:"Date of birth",          category:"subject",      valueKey:"subject_dob",         valueSource:"inv" },
  { id:"subject_ssn",         label:"SSN",                    category:"subject",      valueKey:"subject_ssn",         valueSource:"meta" },
  { id:"subject_addresses",   label:"Addresses",              category:"subject",      valueKey:"subject_addresses",   valueSource:"inv_array" },
  { id:"subject_phones",      label:"Phone numbers",          category:"subject",      valueKey:"subject_phones",      valueSource:"inv_array" },
  { id:"subject_emails",      label:"Email addresses",        category:"subject",      valueKey:"subject_emails",      valueSource:"inv_array" },
  { id:"subject_usernames",   label:"Social usernames",       category:"subject",      valueKey:"subject_usernames",   valueSource:"inv_array" },
  { id:"subject_job",         label:"Job title",              category:"subject",      valueKey:"subject_job",         valueSource:"meta" },
  { id:"primary_language",    label:"Primary language",       category:"subject",      valueKey:"primary_language",    valueSource:"meta" },
  { id:"physical_attributes", label:"Physical attributes",    category:"subject",      valueKey:"physical_attributes", valueSource:"meta" },
  { id:"employment_status",   label:"Employment status",      category:"subject",      valueKey:"employment_status",   valueSource:"meta" },
  { id:"client_company",      label:"Insurance company",      category:"client",       valueKey:"client_company",      valueSource:"meta" },
  { id:"claim_number",        label:"Claim number",           category:"client",       valueKey:"claim_number",        valueSource:"meta" },
  { id:"type_of_claim",       label:"Type of claim",          category:"client",       valueKey:"type_of_claim",       valueSource:"meta" },
  { id:"adjuster_name",       label:"Adjuster name",          category:"client",       valueKey:"adjuster_name",       valueSource:"meta" },
  { id:"adjuster_phone",      label:"Adjuster phone",         category:"client",       valueKey:"adjuster_phone",      valueSource:"meta" },
  { id:"adjuster_ext",        label:"Adjuster ext",           category:"client",       valueKey:"adjuster_ext",        valueSource:"meta" },
  { id:"adjuster_email",      label:"Adjuster email",         category:"client",       valueKey:"adjuster_email",      valueSource:"meta" },
  { id:"report_due_date",     label:"Report due date",        category:"client",       valueKey:"report_due_date",     valueSource:"meta" },
  { id:"defense_attorney",    label:"Defense attorney",       category:"defense",      valueKey:"defense_attorney",    valueSource:"meta" },
  { id:"defense_law_firm",    label:"Law firm",               category:"defense",      valueKey:"defense_law_firm",    valueSource:"meta" },
  { id:"defense_address",     label:"Defense address",        category:"defense",      valueKey:"defense_address",     valueSource:"meta" },
  { id:"defense_city_state_zip", label:"Defense city/state",  category:"defense",      valueKey:"defense_city_state_zip", valueSource:"meta" },
  { id:"defense_phone",       label:"Defense phone",          category:"defense",      valueKey:"defense_phone",       valueSource:"meta" },
  { id:"is_represented",      label:"Represented by atty?",  category:"defense",      valueKey:"is_represented",      valueSource:"meta" },
  { id:"employer_name",       label:"Employer name",          category:"employer",     valueKey:"employer_name",       valueSource:"meta" },
  { id:"employer_contact",    label:"Employer contact",       category:"employer",     valueKey:"employer_contact",    valueSource:"meta" },
  { id:"employer_phone",      label:"Employer phone",         category:"employer",     valueKey:"employer_phone",      valueSource:"meta" },
  { id:"employer_address",    label:"Employer address",       category:"employer",     valueKey:"employer_address",    valueSource:"meta" },
  { id:"employer_city_state_zip", label:"Employer city/state", category:"employer",   valueKey:"employer_city_state_zip", valueSource:"meta" },
  { id:"date_of_injury",      label:"Date of injury",         category:"injury",       valueKey:"date_of_injury",      valueSource:"meta" },
  { id:"body_parts",          label:"Body parts injured",     category:"injury",       valueKey:"body_parts",          valueSource:"meta" },
  { id:"restrictions",        label:"Current restrictions",   category:"injury",       valueKey:"restrictions",        valueSource:"meta" },
  { id:"injury_description",  label:"Injury description",     category:"injury",       valueKey:"injury_description",  valueSource:"meta" },
  { id:"subjective_complaints", label:"Subjective complaints", category:"injury",      valueKey:"subjective_complaints", valueSource:"meta" },
  { id:"suspicion",           label:"Fraud suspicion",        category:"injury",       valueKey:"suspicion",           valueSource:"meta" },
  { id:"surveillance_days",   label:"Surveillance days",      category:"surveillance", valueKey:"surveillance_days",   valueSource:"meta" },
  { id:"days_previously_completed", label:"Days prev. done",  category:"surveillance", valueKey:"days_previously_completed", valueSource:"meta" },
  { id:"instructions",        label:"Instructions",           category:"surveillance", valueKey:"instructions",        valueSource:"meta" },
  { id:"claim_summary",       label:"Claim summary",          category:"surveillance", valueKey:"claim_summary",       valueSource:"meta" },
];

export const DEFAULT_LAYOUT: TabLayout[] = [
  { id:"subject",     label:"Subject",     columns:2, fields:["subject_name","subject_aliases","subject_addresses","subject_phones","subject_emails","subject_dob","subject_ssn","subject_job","primary_language","subject_usernames","physical_attributes","employment_status"] },
  { id:"client",      label:"Client",      columns:2, fields:["client_company","claim_number","type_of_claim","adjuster_name","adjuster_phone","adjuster_ext","adjuster_email","report_due_date","defense_attorney","defense_law_firm","defense_address","defense_city_state_zip","defense_phone","is_represented"] },
  { id:"employer",    label:"Employer",    columns:2, fields:["employer_name","employer_contact","employer_phone","employer_address","employer_city_state_zip","date_of_injury","body_parts","restrictions","injury_description","surveillance_days","days_previously_completed","instructions","suspicion"] },
  { id:"vehicles",    label:"Vehicles",    columns:1, fields:[] },
  { id:"description", label:"Description", columns:2, fields:[] },
  { id:"assignment",  label:"Assignment",  columns:1, fields:[] },
  { id:"history",     label:"History",     columns:1, fields:[] },
  { id:"audit",       label:"Data audit",  columns:1, fields:[] },
];

const CAT_COLORS: Record<string,string> = {
  subject:"#3b82f6", client:"#8b5cf6", employer:"#f59e0b",
  defense:"#ef4444", injury:"#ec4899", surveillance:"#10b981",
};

// Detect if dark theme is active
function isDark() {
  if (typeof document === "undefined") return true;
  const html = document.documentElement;
  return !html.classList.contains("theme-royal") && !html.classList.contains("theme-slate");
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (layout: TabLayout[]) => void;
  currentLayout: TabLayout[];
}

export function LayoutEditor({ isOpen, onClose, onSave, currentLayout }: Props) {
  const [layout, setLayout] = useState<TabLayout[]>(currentLayout.length ? currentLayout : DEFAULT_LAYOUT);
  const [activeTab, setActiveTab] = useState(0);
  const [dragField, setDragField] = useState<{fieldId:string; fromTab?:string}|null>(null);
  const [dragOverTab, setDragOverTab] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [showAddTab, setShowAddTab] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLayout(currentLayout.length ? currentLayout : DEFAULT_LAYOUT);
      setDark(isDark());
    }
  }, [isOpen]);

  // Theme-aware colors
  const bg      = dark ? "#1a0f08" : "#ffffff";
  const bgPanel = dark ? "#241409" : "#f8fafc";
  const bgCard  = dark ? "#2e1a0e" : "#f1f5f9";
  const bgField = dark ? "#3a2010" : "#ffffff";
  const border  = dark ? "#5c3019" : "#e2e8f0";
  const textPri = dark ? "#f5ede6" : "#1e293b";
  const textSec = dark ? "#c4956a" : "#64748b";
  const textMut = dark ? "#7a5030" : "#94a3b8";
  const accent  = dark ? "#ff6a1a" : "#6366f1";
  const accentBg = dark ? "rgba(255,106,26,0.15)" : "rgba(99,102,241,0.1)";

  const usedIds = new Set(layout.flatMap(t => t.fields));
  const available = ALL_FIELDS.filter(f => !usedIds.has(f.id));
  const tab = layout[activeTab];

  function dropInto(toTabId: string, atIdx?: number) {
    if (!dragField) return;
    setLayout(prev => {
      const next = prev.map(t => ({...t, fields:[...t.fields]}));
      if (dragField.fromTab) {
        const src = next.find(t => t.id === dragField.fromTab);
        if (src) src.fields = src.fields.filter(f => f !== dragField.fieldId);
      }
      const dst = next.find(t => t.id === toTabId);
      if (dst) {
        dst.fields = dst.fields.filter(f => f !== dragField.fieldId);
        if (atIdx !== undefined) dst.fields.splice(atIdx, 0, dragField.fieldId);
        else dst.fields.push(dragField.fieldId);
      }
      return next;
    });
    setDragField(null); setDragOverTab(null);
  }

  if (!isOpen) return null;

  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)"}} onClick={onClose}/>

      <div style={{position:"absolute",top:0,right:0,bottom:0,width:940,background:bg,display:"flex",flexDirection:"column",boxShadow:"-4px 0 32px rgba(0,0,0,0.5)",borderLeft:`1px solid ${border}`}}>

        {/* Header */}
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${border}`,display:"flex",alignItems:"center",gap:10,background:bgPanel}}>
          <span style={{fontSize:18}}>🎨</span>
          <div style={{flex:1}}>
            <h2 style={{fontSize:15,fontWeight:700,margin:0,color:textPri}}>Layout Editor</h2>
            <p style={{fontSize:11,color:textSec,margin:0}}>Drag fields between tabs · Add or remove tabs · Choose columns</p>
          </div>
          <button onClick={()=>setLayout(DEFAULT_LAYOUT)}
            style={{fontSize:12,padding:"5px 12px",cursor:"pointer",border:`1px solid ${border}`,borderRadius:6,background:bgCard,color:textSec}}>
            ↺ Reset
          </button>
          <button onClick={async()=>{setSaving(true);try{await onSave(layout)}finally{setSaving(false)}}} disabled={saving}
            style={{fontSize:12,fontWeight:600,padding:"6px 16px",cursor:"pointer",background:accent,color:"white",border:"none",borderRadius:6}}>
            {saving?"Saving…":"💾 Save"}
          </button>
          <button onClick={onClose}
            style={{fontSize:18,color:textMut,background:"none",border:"none",cursor:"pointer",padding:"2px 8px"}}>✕</button>
        </div>

        <div style={{flex:1,display:"grid",gridTemplateColumns:"200px 1fr",overflow:"hidden"}}>

          {/* Left: Available fields */}
          <div style={{borderRight:`1px solid ${border}`,overflow:"auto",padding:12,background:bgPanel}}>
            <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em",color:textSec,fontWeight:600,margin:"0 0 8px"}}>
              Available ({available.length})
            </p>
            <div onDragOver={e=>e.preventDefault()} onDrop={()=>{
              if (dragField?.fromTab) {
                setLayout(prev=>prev.map(t=>t.id===dragField.fromTab?{...t,fields:t.fields.filter(f=>f!==dragField.fieldId)}:t));
                setDragField(null);
              }
            }}>
              {Object.entries(available.reduce((a,f)=>({...a,[f.category]:[...(a[f.category]||[]),f]}),{} as Record<string,FieldDef[]>)).map(([cat,fields])=>(
                <div key={cat} style={{marginBottom:10}}>
                  <p style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:700,color:CAT_COLORS[cat]||textSec,margin:"0 0 4px"}}>{cat}</p>
                  {fields.map(f=>(
                    <div key={f.id} draggable onDragStart={()=>setDragField({fieldId:f.id})}
                      style={{padding:"6px 10px",marginBottom:3,borderRadius:6,cursor:"grab",background:bgField,
                        border:`1px solid ${CAT_COLORS[f.category]||border}`,
                        borderLeft:`3px solid ${CAT_COLORS[f.category]||border}`,
                        fontSize:11,color:textPri,userSelect:"none"}}>
                      {f.label}
                    </div>
                  ))}
                </div>
              ))}
              {available.length===0 && (
                <p style={{fontSize:11,color:textMut,textAlign:"center",paddingTop:20}}>All fields in tabs ✓</p>
              )}
            </div>
          </div>

          {/* Right: Tab editor */}
          <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>

            {/* Tab row */}
            <div style={{display:"flex",gap:4,padding:"10px 14px",borderBottom:`1px solid ${border}`,flexWrap:"wrap",alignItems:"center",background:bgPanel}}>
              {layout.map((t,i)=>(
                <div key={t.id} style={{position:"relative"}}>
                  <button onClick={()=>setActiveTab(i)}
                    style={{padding:"6px 12px",fontSize:12,fontWeight:i===activeTab?600:400,
                      border:`1px solid ${i===activeTab?accent:border}`,borderRadius:6,cursor:"pointer",
                      background:i===activeTab?accent:bgCard,
                      color:i===activeTab?"white":textSec}}>
                    {t.label} <span style={{fontSize:10,opacity:0.7}}>({t.fields.length})</span>
                  </button>
                  {!["subject","client","employer","vehicles","description","assignment"].includes(t.id) && (
                    <button onClick={()=>{setLayout(p=>p.filter(x=>x.id!==t.id));setActiveTab(0)}}
                      style={{position:"absolute",top:-5,right:-5,width:16,height:16,borderRadius:"50%",
                        background:"#ef4444",color:"white",border:"none",cursor:"pointer",fontSize:10,
                        display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
                  )}
                </div>
              ))}
              {showAddTab ? (
                <div style={{display:"flex",gap:4}}>
                  <input value={newTabName} onChange={e=>setNewTabName(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&newTabName.trim()){const id=newTabName.toLowerCase().replace(/\s+/g,"_");setLayout(p=>[...p,{id,label:newTabName.trim(),columns:2,fields:[]}]);setNewTabName("");setShowAddTab(false);setActiveTab(layout.length);}}}
                    placeholder="Tab name…" autoFocus
                    style={{padding:"5px 10px",fontSize:12,border:`1px solid ${accent}`,borderRadius:6,background:bgCard,color:textPri,outline:"none"}}/>
                  <button onClick={()=>{if(newTabName.trim()){const id=newTabName.toLowerCase().replace(/\s+/g,"_");setLayout(p=>[...p,{id,label:newTabName.trim(),columns:2,fields:[]}]);setNewTabName("");setShowAddTab(false);setActiveTab(layout.length);}}}
                    style={{padding:"5px 12px",fontSize:12,background:accent,color:"white",border:"none",borderRadius:6,cursor:"pointer"}}>Add</button>
                  <button onClick={()=>setShowAddTab(false)}
                    style={{padding:"5px 10px",fontSize:12,background:bgCard,color:textSec,border:`1px solid ${border}`,borderRadius:6,cursor:"pointer"}}>✕</button>
                </div>
              ) : (
                <button onClick={()=>setShowAddTab(true)}
                  style={{padding:"6px 12px",fontSize:12,border:`1px dashed ${border}`,borderRadius:6,cursor:"pointer",background:"transparent",color:textMut}}>
                  + Add tab
                </button>
              )}
            </div>

            {/* Active tab content */}
            {tab && (
              <div style={{flex:1,overflow:"auto",padding:16,background:bg}}>
                {/* Settings bar */}
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14,padding:"10px 14px",background:bgPanel,borderRadius:8,border:`1px solid ${border}`}}>
                  <span style={{fontSize:13,fontWeight:600,color:textPri}}>{tab.label}</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:11,color:textSec}}>Columns:</span>
                    {[1,2,3].map(n=>(
                      <button key={n} onClick={()=>setLayout(p=>p.map(t=>t.id===tab.id?{...t,columns:n}:t))}
                        style={{width:28,height:24,fontSize:11,fontWeight:tab.columns===n?700:400,
                          border:`1px solid ${tab.columns===n?accent:border}`,borderRadius:4,cursor:"pointer",
                          background:tab.columns===n?accent:bgCard,
                          color:tab.columns===n?"white":textSec}}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <span style={{fontSize:11,color:textMut}}>{tab.fields.length} fields — drag to reorder · × to remove</span>
                </div>

                {/* Drop grid */}
                <div
                  onDragOver={e=>{e.preventDefault();setDragOverTab(tab.id)}}
                  onDrop={()=>dropInto(tab.id)}
                  style={{display:"grid",gridTemplateColumns:`repeat(${tab.columns},1fr)`,gap:8,minHeight:200,
                    padding:12,borderRadius:10,
                    border:dragField&&dragOverTab===tab.id?`2px dashed ${accent}`:`2px dashed ${border}`,
                    background:dragField?accentBg:"transparent",transition:"all 0.15s"}}>

                  {tab.fields.length===0 && (
                    <div style={{gridColumn:`1/${tab.columns+1}`,textAlign:"center",padding:"50px 0",color:textMut,fontSize:13}}>
                      Drop fields here from the left panel or from other tabs
                    </div>
                  )}

                  {tab.fields.map((fid,idx)=>{
                    const f = ALL_FIELDS.find(x=>x.id===fid);
                    if (!f) return null;
                    const catColor = CAT_COLORS[f.category] || border;
                    return (
                      <div key={fid} draggable
                        onDragStart={()=>setDragField({fieldId:fid,fromTab:tab.id})}
                        onDragOver={e=>{e.preventDefault();e.stopPropagation()}}
                        onDrop={e=>{e.stopPropagation();dropInto(tab.id,idx)}}
                        style={{padding:"10px 12px",borderRadius:8,cursor:"grab",background:bgCard,
                          border:`1px solid ${catColor}`,
                          borderLeft:`3px solid ${catColor}`,
                          userSelect:"none",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                        <div>
                          <p style={{fontSize:12,fontWeight:600,margin:0,color:textPri}}>{f.label}</p>
                          <p style={{fontSize:9,margin:"2px 0 0",color:catColor,textTransform:"uppercase",letterSpacing:"0.06em"}}>{f.category}</p>
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                          <span style={{fontSize:16,color:textMut,cursor:"grab"}}>⠿</span>
                          <button onClick={()=>setLayout(p=>p.map(t=>t.id===tab.id?{...t,fields:t.fields.filter(x=>x!==fid)}:t))}
                            style={{fontSize:16,color:textMut,background:"none",border:"none",cursor:"pointer",padding:"0 2px",lineHeight:1,fontWeight:400}}
                            title="Remove">×</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

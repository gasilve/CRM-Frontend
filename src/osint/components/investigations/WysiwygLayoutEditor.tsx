
import { useState, useRef, useCallback } from "react";
import type { TabLayout, FieldDef } from "./LayoutEditor";
import { ALL_FIELDS, DEFAULT_LAYOUT } from "./LayoutEditor";

// ── Color presets ──────────────────────────────────────────────────────────
const LABEL_COLORS = [
  { name:"default",  label:"#64748b", value:"#64748b" },
  { name:"blue",     label:"#1e40af", value:"#1e40af" },
  { name:"purple",   label:"#6b21a8", value:"#6b21a8" },
  { name:"teal",     label:"#0f6e56", value:"#0f6e56" },
  { name:"amber",    label:"#92400e", value:"#92400e" },
  { name:"red",      label:"#991b1b", value:"#991b1b" },
];
const BLOCK_BG_COLORS = [
  { name:"none",    bg:"transparent",  border:"#e2e8f0" },
  { name:"slate",   bg:"#f8fafc",      border:"#e2e8f0" },
  { name:"blue",    bg:"#eff6ff",      border:"#bfdbfe" },
  { name:"purple",  bg:"#faf5ff",      border:"#e9d5ff" },
  { name:"amber",   bg:"#fffbeb",      border:"#fde68a" },
  { name:"green",   bg:"#f0fdf4",      border:"#bbf7d0" },
];

export interface FieldStyle {
  labelColor?: string;
  blockBg?: string;
  blockBorder?: string;
  customLabel?: string;
}

export interface StyledTabLayout extends TabLayout {
  fieldStyles?: Record<string, FieldStyle>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (layout: StyledTabLayout[]) => void;
  currentLayout: StyledTabLayout[];
  inv: any; // live investigation data for preview
}

function resolveValue(inv: any, field: FieldDef): string {
  const meta = inv?.extra_metadata || {};
  if (field.valueSource === "inv") return inv?.[field.valueKey] || "";
  if (field.valueSource === "meta") return meta[field.valueKey] || "";
  if (field.valueSource === "inv_array") {
    const arr = inv?.[field.valueKey];
    return Array.isArray(arr) ? arr.slice(0,3).join(", ") : "";
  }
  if (field.valueSource === "meta_array") {
    const arr = meta[field.valueKey];
    return Array.isArray(arr) ? arr.slice(0,3).join(", ") : "";
  }
  return "";
}

// ── Mini live preview of a single tab ─────────────────────────────────────
function TabPreview({ tab, inv, selectedField, onSelectField }: {
  tab: StyledTabLayout;
  inv: any;
  selectedField: string | null;
  onSelectField: (id: string) => void;
}) {
  const fields = tab.fields
    .map(fid => ALL_FIELDS.find(f => f.id === fid))
    .filter(Boolean) as FieldDef[];

  const styles: Record<string, FieldStyle> = tab.fieldStyles || {};

  const gridCols = tab.columns === 2
    ? "repeat(2, minmax(0, 1fr))"
    : "1fr";

  return (
    <div style={{ display:"grid", gridTemplateColumns:gridCols, gap:8 }}>
      {fields.map(field => {
        const fs = styles[field.id] || {};
        const val = resolveValue(inv, field);
        const isSelected = selectedField === field.id;
        return (
          <div
            key={field.id}
            onClick={() => onSelectField(field.id)}
            style={{
              padding:"8px 12px",
              borderRadius:8,
              border:`1.5px solid ${isSelected ? "#3b82f6" : (fs.blockBorder || "#e2e8f0")}`,
              background: fs.blockBg || "transparent",
              cursor:"pointer",
              outline: isSelected ? "2px solid #93c5fd" : "none",
              outlineOffset:2,
              transition:"all 0.1s",
            }}
          >
            <p style={{
              fontSize:9,
              fontWeight:700,
              textTransform:"uppercase",
              letterSpacing:"0.06em",
              color: fs.labelColor || "#64748b",
              margin:"0 0 3px",
            }}>
              {fs.customLabel || field.label}
            </p>
            <p style={{
              fontSize:13,
              color: val ? "#111827" : "#d1d5db",
              margin:0,
              fontStyle: val ? "normal" : "italic",
            }}>
              {val || "—"}
            </p>
          </div>
        );
      })}
      {fields.length === 0 && (
        <div style={{
          gridColumn:"1/-1",
          padding:"24px",
          textAlign:"center",
          border:"1px dashed #e2e8f0",
          borderRadius:8,
          color:"#94a3b8",
          fontSize:13,
        }}>
          No fields — drag fields here from the panel
        </div>
      )}
    </div>
  );
}

// ── Main editor ────────────────────────────────────────────────────────────
export function WysiwygLayoutEditor({ isOpen, onClose, onSave, currentLayout, inv }: Props) {
  const [layout, setLayout] = useState<StyledTabLayout[]>(
    currentLayout.length ? currentLayout : DEFAULT_LAYOUT
  );
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [draggingField, setDraggingField] = useState<{id:string; fromTab:string} | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const activeTab = layout[activeTabIdx];
  const selectedFieldDef = selectedField
    ? ALL_FIELDS.find(f => f.id === selectedField) || null
    : null;
  const selectedFieldStyle: FieldStyle =
    (activeTab?.fieldStyles || {})[selectedField || ""] || {};

  // Unused fields for this tab
  const usedInActive = new Set(activeTab?.fields || []);
  const availableFields = ALL_FIELDS.filter(f => !usedInActive.has(f.id));

  function updateActiveTab(updater: (t: StyledTabLayout) => StyledTabLayout) {
    setLayout(prev => prev.map((t, i) => i === activeTabIdx ? updater(t) : t));
  }

  function updateFieldStyle(fieldId: string, patch: Partial<FieldStyle>) {
    updateActiveTab(t => ({
      ...t,
      fieldStyles: {
        ...(t.fieldStyles || {}),
        [fieldId]: { ...((t.fieldStyles || {})[fieldId] || {}), ...patch },
      },
    }));
  }

  // ── Drag within tab (reorder) ──────────────────────────────────────────
  function handleDragStart(fieldId: string) {
    setDraggingField({ id: fieldId, fromTab: activeTab.id });
  }

  function handleDropOnField(targetIdx: number) {
    if (!draggingField) return;
    const fromTab = layout.find(t => t.id === draggingField.fromTab);
    if (!fromTab) return;

    if (fromTab.id === activeTab.id) {
      // Reorder within tab
      updateActiveTab(t => {
        const fields = [...t.fields];
        const srcIdx = fields.indexOf(draggingField.id);
        if (srcIdx === -1) return t;
        fields.splice(srcIdx, 1);
        fields.splice(targetIdx, 0, draggingField.id);
        return { ...t, fields };
      });
    } else {
      // Move from other tab to active tab
      setLayout(prev => prev.map(t => {
        if (t.id === draggingField.fromTab) {
          return { ...t, fields: t.fields.filter(f => f !== draggingField.id) };
        }
        if (t.id === activeTab.id) {
          const fields = [...t.fields];
          fields.splice(targetIdx, 0, draggingField.id);
          return { ...t, fields };
        }
        return t;
      }));
    }
    setDraggingField(null);
    setDragOverIdx(null);
  }

  function addField(fieldId: string) {
    updateActiveTab(t => ({ ...t, fields: [...t.fields, fieldId] }));
  }

  function removeField(fieldId: string) {
    updateActiveTab(t => ({ ...t, fields: t.fields.filter(f => f !== fieldId) }));
    if (selectedField === fieldId) setSelectedField(null);
  }

  async function handleSave() {
    setSaving(true);
    await onSave(layout);
    setSaving(false);
  }

  const catColors: Record<string,string> = {
    subject:"#3b82f6", client:"#8b5cf6", employer:"#f59e0b",
    defense:"#ef4444", injury:"#ec4899", surveillance:"#10b981",
  };

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9000,
      display:"flex", alignItems:"stretch",
    }}>
      {/* Backdrop */}
      <div
        style={{ flex:1, background:"rgba(0,0,0,0.35)" }}
        onClick={onClose}
      />

      {/* Editor panel */}
      <div
        ref={panelRef}
        style={{
          width:900,
          maxWidth:"95vw",
          background:"#ffffff",
          display:"flex",
          flexDirection:"column",
          boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",
          overflow:"hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"12px 20px",
          borderBottom:"1px solid #e5e7eb",
          flexShrink:0,
        }}>
          <div>
            <p style={{fontWeight:600,fontSize:15,margin:0,color:"#111827"}}>Layout editor</p>
            <p style={{fontSize:12,color:"#9ca3af",margin:0}}>
              Changes apply to all investigations
            </p>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose}
              style={{padding:"6px 14px",borderRadius:6,border:"1px solid #e5e7eb",
                background:"white",fontSize:13,cursor:"pointer",color:"#6b7280"}}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{padding:"6px 14px",borderRadius:6,border:"none",
                background:"#3b82f6",color:"white",fontSize:13,fontWeight:500,
                cursor:saving?"wait":"pointer",opacity:saving?0.7:1}}>
              {saving ? "Saving…" : "Save layout"}
            </button>
          </div>
        </div>

        {/* Body: split into preview + controls */}
        <div style={{display:"flex",flex:1,overflow:"hidden"}}>

          {/* ── LEFT: live preview ──────────────────────────────── */}
          <div style={{
            flex:1, overflowY:"auto", padding:20,
            borderRight:"1px solid #e5e7eb",
            background:"#f9fafb",
          }}>
            {/* Tab bar preview */}
            <div style={{
              display:"flex", gap:2, marginBottom:16,
              borderBottom:"1px solid #e5e7eb", paddingBottom:0,
            }}>
              {layout.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => { setActiveTabIdx(i); setSelectedField(null); }}
                  style={{
                    padding:"8px 16px",
                    fontSize:13,
                    fontWeight: i === activeTabIdx ? 600 : 400,
                    color: i === activeTabIdx ? "#3b82f6" : "#6b7280",
                    background:"transparent",
                    border:"none",
                    borderBottom: i === activeTabIdx ? "2px solid #3b82f6" : "2px solid transparent",
                    cursor:"pointer",
                    whiteSpace:"nowrap",
                    marginBottom:-1,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Live tab content */}
            <TabPreview
              tab={activeTab}
              inv={inv}
              selectedField={selectedField}
              onSelectField={id => setSelectedField(prev => prev === id ? null : id)}
            />

            {/* Hint */}
            <p style={{fontSize:11,color:"#94a3b8",marginTop:12,textAlign:"center"}}>
              Click a field to select it, then edit on the right
            </p>
          </div>

          {/* ── RIGHT: controls ─────────────────────────────────── */}
          <div style={{
            width:300, overflowY:"auto", padding:16,
            display:"flex", flexDirection:"column", gap:16,
          }}>

            {/* Tab settings */}
            <section>
              <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",
                letterSpacing:"0.06em",color:"#94a3b8",margin:"0 0 10px"}}>
                Tab settings
              </p>

              {/* Tab name */}
              <label style={{fontSize:12,color:"#374151",display:"block",marginBottom:4}}>
                Tab name
              </label>
              <input
                value={activeTab?.label || ""}
                onChange={e => updateActiveTab(t => ({ ...t, label: e.target.value }))}
                style={{
                  width:"100%",padding:"6px 10px",borderRadius:6,
                  border:"1px solid #e5e7eb",fontSize:13,
                  boxSizing:"border-box",
                }}
              />

              {/* Columns */}
              <label style={{fontSize:12,color:"#374151",display:"block",margin:"10px 0 4px"}}>
                Columns
              </label>
              <div style={{display:"flex",gap:8}}>
                {[1,2].map(n => (
                  <button key={n}
                    onClick={() => updateActiveTab(t => ({ ...t, columns: n }))}
                    style={{
                      flex:1, padding:"6px", borderRadius:6, fontSize:13,
                      border:"1px solid",cursor:"pointer",
                      borderColor: activeTab?.columns === n ? "#3b82f6" : "#e5e7eb",
                      background: activeTab?.columns === n ? "#eff6ff" : "white",
                      color: activeTab?.columns === n ? "#1e40af" : "#6b7280",
                      fontWeight: activeTab?.columns === n ? 600 : 400,
                    }}>
                    {n} column{n > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </section>

            {/* Selected field styles */}
            {selectedField && selectedFieldDef && (
              <section style={{
                padding:12, borderRadius:8,
                border:"1.5px solid #3b82f6",
                background:"#eff6ff",
              }}>
                <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",
                  letterSpacing:"0.06em",color:"#1e40af",margin:"0 0 12px"}}>
                  {selectedFieldDef.label}
                </p>

                {/* Custom label */}
                <label style={{fontSize:12,color:"#374151",display:"block",marginBottom:4}}>
                  Custom label
                </label>
                <input
                  value={selectedFieldStyle.customLabel || ""}
                  placeholder={selectedFieldDef.label}
                  onChange={e => updateFieldStyle(selectedField, { customLabel: e.target.value || undefined })}
                  style={{
                    width:"100%",padding:"5px 9px",borderRadius:6,
                    border:"1px solid #bfdbfe",fontSize:12,
                    boxSizing:"border-box", background:"white",
                  }}
                />

                {/* Label color */}
                <label style={{fontSize:12,color:"#374151",display:"block",margin:"10px 0 6px"}}>
                  Label color
                </label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {LABEL_COLORS.map(lc => (
                    <button key={lc.name}
                      onClick={() => updateFieldStyle(selectedField, { labelColor: lc.value })}
                      title={lc.name}
                      style={{
                        width:22, height:22, borderRadius:"50%",
                        background:lc.value, border:"2px solid",
                        borderColor:(selectedFieldStyle.labelColor || "#64748b") === lc.value
                          ? "#111827" : "transparent",
                        cursor:"pointer",
                      }}
                    />
                  ))}
                </div>

                {/* Block background */}
                <label style={{fontSize:12,color:"#374151",display:"block",margin:"10px 0 6px"}}>
                  Block background
                </label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {BLOCK_BG_COLORS.map(bc => (
                    <button key={bc.name}
                      onClick={() => updateFieldStyle(selectedField, {
                        blockBg: bc.bg === "transparent" ? undefined : bc.bg,
                        blockBorder: bc.border,
                      })}
                      title={bc.name}
                      style={{
                        width:22, height:22, borderRadius:4,
                        background: bc.bg === "transparent" ? "white" : bc.bg,
                        border:"2px solid",
                        borderColor:(selectedFieldStyle.blockBg || "transparent") === bc.bg
                          ? "#3b82f6" : bc.border,
                        cursor:"pointer",
                        backgroundImage: bc.bg === "transparent"
                          ? "repeating-linear-gradient(45deg,#e5e7eb 0,#e5e7eb 1px,transparent 0,transparent 50%)"
                          : "none",
                        backgroundSize:"6px 6px",
                      }}
                    />
                  ))}
                </div>

                {/* Remove field */}
                <button
                  onClick={() => removeField(selectedField)}
                  style={{
                    marginTop:12, width:"100%", padding:"5px",
                    borderRadius:6, border:"1px solid #fca5a5",
                    background:"#fef2f2", color:"#b91c1c",
                    fontSize:12, cursor:"pointer",
                  }}>
                  Remove from tab
                </button>
              </section>
            )}

            {/* Add fields */}
            <section>
              <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",
                letterSpacing:"0.06em",color:"#94a3b8",margin:"0 0 10px"}}>
                Add fields
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:300,overflowY:"auto"}}>
                {availableFields.map(f => (
                  <button key={f.id}
                    onClick={() => addField(f.id)}
                    style={{
                      display:"flex",alignItems:"center",justifyContent:"space-between",
                      padding:"6px 10px",borderRadius:6,
                      border:"1px solid #e5e7eb",
                      background:"white",
                      fontSize:12,cursor:"pointer",textAlign:"left",
                    }}>
                    <span style={{color:"#374151"}}>{f.label}</span>
                    <span style={{
                      fontSize:10,padding:"1px 6px",borderRadius:10,
                      background: catColors[f.category] + "1a",
                      color: catColors[f.category],
                      fontWeight:600,
                    }}>{f.category}</span>
                  </button>
                ))}
                {availableFields.length === 0 && (
                  <p style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"8px 0"}}>
                    All fields are in this tab
                  </p>
                )}
              </div>
            </section>

            {/* Move to another tab */}
            {selectedField && (
              <section>
                <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",
                  letterSpacing:"0.06em",color:"#94a3b8",margin:"0 0 10px"}}>
                  Move to tab
                </p>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {layout.filter((_, i) => i !== activeTabIdx).map(t => (
                    <button key={t.id}
                      onClick={() => {
                        const fid = selectedField;
                        setLayout(prev => prev.map(tab => {
                          if (tab.id === activeTab.id)
                            return { ...tab, fields: tab.fields.filter(f => f !== fid) };
                          if (tab.id === t.id)
                            return { ...tab, fields: [...tab.fields, fid] };
                          return tab;
                        }));
                        setSelectedField(null);
                      }}
                      style={{
                        padding:"6px 10px",borderRadius:6,
                        border:"1px solid #e5e7eb",background:"white",
                        fontSize:12,cursor:"pointer",color:"#374151",textAlign:"left",
                      }}>
                      → {t.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

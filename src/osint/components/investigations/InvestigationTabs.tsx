// @ts-nocheck

import { DraggableGrid, useGridEditMode, GridItem } from "./DraggableGrid";
import { CapturesTab } from "./CapturesTab";
import { SelectorsTab } from "./SelectorsTab";
import { ProdigyGraphTab } from "./ProdigyGraphTab";
// MapTab placeholder

import React, { lazy, Suspense, useState, useEffect, useRef } from "react";
import type { TabLayout, FieldDef } from "./LayoutEditor";
import { ALL_FIELDS, DEFAULT_LAYOUT } from "./LayoutEditor";
;

const InvestigationMap = lazy(() => import("@/osint/components/investigations/InvestigationMap"));
const CanvassPanel = lazy(() => import("@/osint/components/investigations/CanvassPanel"));
const InsuranceVehiclesTab = lazy(() => import("./InsuranceVehiclesTab"));

const CanvassRightPanel = lazy(() => import("@/osint/components/investigations/CanvassRightPanel"));
const MapTab = lazy(() => import("@/osint/components/investigations/MapTab"));

interface Props {
  inv: any;
  userRole?: string;
  canViewPii?: boolean;
  piiClosedCases?: boolean;
  onSave?: (field: string, value: any) => void;
  layout?: TabLayout[];
}

const TABS = [
  { id: "subject",     label: "Subject" },
  { id: "client",      label: "Client" },
  { id: "employer",    label: "Employer" },
  { id: "vehicles",    label: "Vehicles" },
  { id: "assignment",  label: "Assignment" },
  { id: "documents",   label: "Documents" },
  { id: "email",       label: "Email" },
  { id: "template",    label: "Template" },
  { id: "history",     label: "History" },
  { id: "captures",    label: "🌐 Web Captures" },
  { id: "selectors",   label: "🔍 Selectors" },
  { id: "flowsint",   label: "🔗 Graph" },
  { id: "audit",       label: "Data audit" },
];

// Dynamic layout from DB (admin-configurable)
// Falls back to TABS if API unavailable

function Field({ label, value, empty, onEdit, editable = true, type = "text" }: any) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setVal(value || ""); }, [value]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26 }}>
      {/* Label — fixed width, uppercase small caps */}
      <span style={{
        fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em",
        color: "var(--text-secondary)", fontWeight: 600,
        flexShrink: 0, width: 110,
      }}>{label}</span>
      {/* Value */}
      {editing ? (
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          <input ref={inputRef} value={val} type={type}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { onEdit?.(val); setEditing(false); }
              if (e.key === "Escape") { setEditing(false); setVal(value || ""); }
            }}
            style={{ flex: 1, border: "1px solid var(--fill-accent)", borderRadius: 5, padding: "3px 7px", fontSize: 13, background: "var(--surface-2)", color: "var(--text-primary)", outline: "none" }} />
          <button onClick={() => { onEdit?.(val); setEditing(false); }}
            style={{ fontSize: 11, padding: "3px 8px", background: "var(--fill-accent)", color: "white", border: "none", borderRadius: 5, cursor: "pointer" }}>Save</button>
          <button onClick={() => { setEditing(false); setVal(value || ""); }}
            style={{ fontSize: 11, padding: "3px 7px", background: "transparent", border: "1px solid var(--border)", borderRadius: 5, cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
        </div>
      ) : (
        <div onClick={() => editable && setEditing(true)}
          style={{ flex: 1, fontSize: 13, color: value ? "var(--text-primary)" : "var(--text-muted)", cursor: editable ? "pointer" : "default",
            padding: "2px 6px", borderRadius: 5, border: "0.5px solid transparent", transition: "border-color 0.1s, background 0.1s" }}
          onMouseEnter={e => { if (editable) { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-1)"; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
          {value || (empty || <span style={{ color: "var(--text-muted)", fontSize: 12 }}>— add</span>)}
        </div>
      )}
    </div>
  );
}

function ArrayField({ label, values, onAdd, onRemove, meta }: any) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  // Confidence badge color
  const confColor = (pct: number) =>
    pct >= 90 ? "#16a34a" : pct >= 70 ? "#2563eb" : pct >= 50 ? "#d97706" : "#6b7280";

  return (
    <div>
      <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", fontWeight: 600, margin: "0 0 4px" }}>{label}</p>
      <div style={{ border: "0.5px solid var(--border)", borderRadius: 6, padding: "6px 9px", background: "var(--surface-1)", minHeight: 34 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
          {(values || []).map((v: string, i: number) => {
            const conf = meta?.[v];
            return (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 13, padding: "2px 4px 2px 9px", background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 20, color: "var(--text-primary)" }}>
              {v}
              {conf !== undefined && (
                <span style={{ fontSize: 9, fontWeight: 700, color: confColor(conf),
                  background: "transparent", padding: "0 2px", letterSpacing: ".03em" }}>
                  {conf}%
                </span>
              )}
              <button onClick={() => onRemove?.(v)}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, borderRadius: "50%", lineHeight: 1 }}
                title="Remove">✕</button>
            </span>
            );
          })}
          {(!values || values.length === 0) && !adding && (
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>—</span>
          )}
          {adding ? (
            <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && val.trim()) { onAdd?.(val.trim()); setVal(""); setAdding(false); }
                if (e.key === "Escape") { setAdding(false); setVal(""); }
              }}
              placeholder="Enter and press ↵"
              style={{ border: "1px solid var(--fill-accent)", borderRadius: 6, padding: "2px 8px", fontSize: 12, background: "var(--surface-2)", color: "var(--text-primary)", outline: "none", width: 140 }} />
          ) : (
            <button onClick={() => setAdding(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, color: "var(--text-accent)", background: "none", border: "0.5px dashed var(--border-accent)", borderRadius: 20, padding: "2px 8px", cursor: "pointer" }}>
              + add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


const SEL_OPTIONS: Record<string,string[]> = {
  Sex:         ["Male","Female","Non-binary","Unknown"],
  Race:        ["Hispanic","White","Black","Asian","Pacific Islander","Native American","Unknown"],
  Build:       ["Slim","Athletic","Average","Stocky","Heavy","Obese"],
  "Hair color":["Black","Brown","Dark brown","Light brown","Blonde","Red","Gray","White","Bald","Unknown"],
  "Hair length":["Bald","Buzzed","Short","Medium","Long","Very long"],
  "Hair style":["Straight","Wavy","Curly","Afro","Braids","Ponytail","Bun","Unknown"],
  Eyes:        ["Brown","Black","Blue","Green","Hazel","Gray","Unknown"],
  Complexion:  ["Light","Medium","Olive","Dark","Very dark","Unknown"],
  "Facial hair":["None","Mustache","Beard","Goatee","Stubble","Unknown"],
  Glasses:     ["None","Eyeglasses","Sunglasses","Reading glasses","Unknown"],
};

function SelectCell({ label, value, onEdit, bdr, bg1, bg2, txt, sec, mut }: any) {
  const opts = SEL_OPTIONS[label] || [];
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: "relative" }}>
      <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: sec, fontWeight: 600, margin: "0 0 3px" }}>{label}</p>
      <div onClick={() => setOpen(o => !o)}
        style={{ border: `1px solid ${bdr}`, borderRadius: 6, padding: "7px 10px", background: bg1,
          fontSize: 13, color: value ? txt : mut, cursor: opts.length ? "pointer" : "default",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{value || "— select"}</span>
        {opts.length > 0 && <span style={{ fontSize: 10, color: mut, marginLeft: 4 }}>▾</span>}
      </div>
      {open && opts.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: bg2, border: `1px solid ${bdr}`, borderRadius: 6, marginTop: 2,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)", maxHeight: 180, overflowY: "auto" }}>
          {opts.map(o => (
            <div key={o} onClick={() => { onEdit(o); setOpen(false); }}
              style={{ padding: "7px 12px", fontSize: 12, cursor: "pointer",
                color: o === value ? "#ff6a1a" : txt,
                fontWeight: o === value ? 700 : 400,
                background: "transparent" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,106,26,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}








function SurveillanceIntelBlock({ meta, isDark, acc, sec, txt, bg1, bg2, bdr, mut, save, vehicles, inv }: any) {
  const BODY_PARTS = ['Head', 'Neck', 'Right shoulder', 'Left shoulder', 'Right arm', 'Left arm', 'Right elbow', 'Left elbow', 'Right wrist', 'Left wrist', 'Right hand', 'Left hand', 'Upper back', 'Low back', 'Right hip', 'Left hip', 'Right knee', 'Left knee', 'Right ankle', 'Left ankle', 'Right foot', 'Left foot', 'Bilateral shoulders', 'Bilateral knees', 'Bilateral hips', 'Psych / Emotional trauma', 'Teeth / Jaw', 'Eyes', 'Respiratory', 'Neurological', 'Weight gain', 'Other'];
  const ADDRESS_QUALITY = ["Confirmed","Unconfirmed","Uncertain","Not verified"];
  const [showBPDD, setShowBPDD] = React.useState(false);

  // Parse currently selected body parts
  const selectedParts: string[] = React.useMemo(() => {
    const raw = meta?.body_parts || "";
    if (!raw) return [];
    return raw.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean);
  }, [meta?.body_parts]);

  const togglePart = (part: string) => {
    const current = new Set(selectedParts);
    if (current.has(part)) current.delete(part); else current.add(part);
    save("body_parts")(Array.from(current).join(", "));
  };

  // Primary vehicle = first vehicle with driver_type === "Subject"
  const primaryVeh = vehicles?.find((v: any) => v.driver_type === "Subject") || vehicles?.[0];

  // Prior results from crm_history
  const crmH = meta?.crm_history as any;
  const summary = crmH?.summary;
  const lastObs = crmH?.days ? [...crmH.days].reverse().find((d: any) => d.observed) : null;
  const burns   = crmH?.days ? crmH.days.filter((d: any) => d.burned) : [];
  const hasClothing = lastObs?.clothing;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── EAT + Address Quality + Primary vehicle ── */}
      <div style={{ border: "1px solid " + bdr, borderRadius: 8, padding: "12px 14px", background: bg2 }}>
        <p style={{ fontSize: 9, textTransform: "uppercase" as any, letterSpacing: "0.07em",
          color: mut, fontWeight: 700, margin: "0 0 10px" }}>Surveillance intel</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

          {/* EAT */}
          <div>
            <p style={{ fontSize: 10, color: sec, fontWeight: 600, textTransform: "uppercase" as any,
              letterSpacing: "0.05em", margin: "0 0 4px" }}>
              EAT — Earliest Active Time
            </p>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="time"
                defaultValue={meta?.earliest_active_time || ""}
                onBlur={e => save("earliest_active_time")(e.target.value)}
                style={{ padding: "6px 10px", border: "1px solid " + bdr, borderRadius: 6,
                  fontSize: 14, fontWeight: 700, background: bg1, color: txt,
                  outline: "none", fontFamily: "monospace", width: 110 }}/>
              {meta?.earliest_active_time && (
                <span style={{ fontSize: 11, color: sec }}>Start 2h before</span>
              )}
            </div>
            {meta?.eat_notes && (
              <p style={{ fontSize: 11, color: sec, margin: "4px 0 0" }}>{meta.eat_notes}</p>
            )}
            <input placeholder="Notes (e.g. takes kids to school at 7am)..."
              defaultValue={meta?.eat_notes || ""}
              onBlur={e => save("eat_notes")(e.target.value)}
              style={{ marginTop: 5, width: "100%", padding: "4px 8px", border: "1px solid " + bdr,
                borderRadius: 5, fontSize: 11, background: bg1, color: txt,
                outline: "none", boxSizing: "border-box" as any }}/>
          </div>

          {/* Address Quality */}
          <div>
            <p style={{ fontSize: 10, color: sec, fontWeight: 600, textTransform: "uppercase" as any,
              letterSpacing: "0.05em", margin: "0 0 4px" }}>Address quality</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {ADDRESS_QUALITY.map(q => (
                <label key={q} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 12 }}>
                  <input type="radio" name={"addr_quality_" + inv?.id}
                    checked={meta?.address_quality === q}
                    onChange={() => save("address_quality")(q)}
                    style={{ accentColor: acc }}/>
                  <span style={{ color: meta?.address_quality === q ? txt : sec, fontWeight: meta?.address_quality === q ? 600 : 400 }}>{q}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Primary vehicle */}
        {primaryVeh && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: bg1,
            border: "1px solid " + bdr, borderRadius: 8,
            display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🚗</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: sec, textTransform: "uppercase" as any, fontWeight: 700,
                letterSpacing: "0.05em", margin: "0 0 2px" }}>Primary vehicle</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: txt, margin: 0 }}>
                {[primaryVeh.year, primaryVeh.color, primaryVeh.make_model].filter(Boolean).join(" ")}
              </p>
            </div>
            {primaryVeh.plate && (
              <span style={{ fontSize: 13, fontWeight: 800, padding: "3px 10px", borderRadius: 5,
                background: bg2, border: "2px solid " + bdr, color: acc,
                fontFamily: "monospace", letterSpacing: "0.1em" }}>
                {primaryVeh.plate}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Prior results (from CRM history) ── */}
      {summary && (
        <div style={{ border: "1px solid " + (burns.length > 0 ? "#fecaca" : bdr),
          borderRadius: 8, padding: "12px 14px",
          background: burns.length > 0 ? (isDark ? "rgba(239,68,68,0.06)" : "#fef2f2") : bg2 }}>
          <p style={{ fontSize: 9, textTransform: "uppercase" as any, letterSpacing: "0.07em",
            color: burns.length > 0 ? "#dc2626" : mut, fontWeight: 700, margin: "0 0 10px" }}>
            Prior surveillance results
          </p>

          {/* Summary pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as any, marginBottom: 10 }}>
            {[
              { label: "Days", value: summary.total_days, color: acc },
              { label: "Hours", value: summary.total_hours + "h", color: acc },
              { label: "Observed", value: summary.days_observed, color: "#16a34a" },
              { label: "Burned 🔥", value: summary.days_burned, color: summary.days_burned > 0 ? "#dc2626" : sec },
              { label: "Video", value: summary.total_video_min > 0 ? summary.total_video_min + "min" : "—", color: acc },
            ].map((item: any) => (
              <div key={item.label} style={{ padding: "5px 10px", borderRadius: 8, background: bg1,
                border: "1px solid " + bdr, textAlign: "center" as any, minWidth: 60 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value ?? "—"}</div>
                <div style={{ fontSize: 9, color: sec, textTransform: "uppercase" as any }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Last observation */}
          {lastObs && (
            <div style={{ padding: "8px 10px", background: isDark ? "rgba(34,197,94,0.08)" : "#f0fdf4",
              border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: "#166534" }}>Last observed: </span>
              <span style={{ color: sec }}>{lastObs.date}</span>
              {lastObs.video_min > 0 && <span style={{ color: sec }}> · {lastObs.video_min}min video</span>}
              {hasClothing && <span style={{ color: sec }}> · wearing {lastObs.clothing}</span>}
              {lastObs.unrestricted && <span style={{ marginLeft: 6, color: "#ca8a04", fontWeight: 600 }}>UNRESTRICTED</span>}
              {lastObs.working && <span style={{ marginLeft: 6, color: "#0369a1", fontWeight: 600 }}>WORKING</span>}
            </div>
          )}

          {/* Burns */}
          {burns.length > 0 && (
            <div style={{ padding: "8px 10px", background: isDark ? "rgba(239,68,68,0.08)" : "#fef2f2",
              border: "1px solid #fecaca", borderRadius: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: "#dc2626" }}>🔥 Burned {burns.length}x — </span>
              <span style={{ color: sec }}>Subject has detected surveillance before. Exercise extreme caution.</span>
              {burns.map((b: any, i: number) => b.burn_desc && (
                <div key={i} style={{ marginTop: 3, color: "#dc2626", fontSize: 11 }}>
                  {b.date}: {b.burn_desc}
                </div>
              ))}
            </div>
          )}

          {/* Pattern notes */}
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 10, color: sec, fontWeight: 600, textTransform: "uppercase" as any,
              letterSpacing: "0.05em", margin: "0 0 3px" }}>Behavioral pattern / notes</p>
            <input placeholder="e.g. leaves at 8am, takes kids to school, goes to gym..."
              defaultValue={meta?.behavior_pattern || ""}
              onBlur={e => save("behavior_pattern")(e.target.value)}
              style={{ width: "100%", padding: "6px 10px", border: "1px solid " + bdr, borderRadius: 6,
                fontSize: 12, background: bg1, color: txt, outline: "none", boxSizing: "border-box" as any }}/>
          </div>
        </div>
      )}

      {/* ── Body parts multi-select ── */}
      <div style={{ border: "1px solid " + bdr, borderRadius: 8, padding: "12px 14px", background: bg2 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 9, textTransform: "uppercase" as any, letterSpacing: "0.07em",
            color: mut, fontWeight: 700, margin: 0 }}>Body parts injured</p>
          <button onClick={() => setShowBPDD(s => !s)}
            style={{ fontSize: 11, padding: "2px 8px", border: "1px solid " + bdr,
              borderRadius: 5, background: bg1, color: sec, cursor: "pointer" }}>
            {showBPDD ? "▲ Close" : "▼ Edit"}
          </button>
        </div>

        {/* Current selection */}
        <div style={{ display: "flex", flexWrap: "wrap" as any, gap: 5, marginBottom: showBPDD ? 10 : 0 }}>
          {selectedParts.length > 0 ? selectedParts.map((p: string) => (
            <span key={p} style={{ fontSize: 11.5, padding: "2px 9px", borderRadius: 20,
              background: isDark ? "rgba(99,102,241,0.15)" : "#eff6ff",
              border: "1px solid " + (isDark ? "rgba(99,102,241,0.3)" : "#c7d2fe"),
              color: acc, fontWeight: 500 }}>
              {p}
              {showBPDD && (
                <button onClick={() => togglePart(p)}
                  style={{ marginLeft: 4, fontSize: 11, color: "#dc2626", background: "none",
                    border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
              )}
            </span>
          )) : (
            <span style={{ fontSize: 12, color: mut, fontStyle: "italic" }}>None selected</span>
          )}
        </div>

        {/* Dropdown grid */}
        {showBPDD && (
          <div style={{ display: "flex", flexWrap: "wrap" as any, gap: 5,
            padding: "10px", background: bg1, borderRadius: 6, border: "1px solid " + bdr }}>
            {BODY_PARTS.map((part: string) => {
              const sel = selectedParts.includes(part);
              return (
                <button key={part} onClick={() => togglePart(part)}
                  style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11.5, cursor: "pointer",
                    border: "1px solid",
                    background: sel ? acc : bg2,
                    color:      sel ? "white" : sec,
                    borderColor: sel ? acc : bdr,
                    fontWeight:  sel ? 600 : 400 }}>
                  {part}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


function SummariesBlock({ invId, isDark, acc, sec, txt, bg1, bg2, bdr, mut }: any) {
  const [summaries, setSummaries] = React.useState<any[]>([]);
  const [loading, setLoading]     = React.useState(true);
  const [expanded, setExpanded]   = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    if (!invId) return;
    fetch("/api/investigations/" + invId + "/summaries")
      .then(r => r.json())
      .then(d => { setSummaries(d.summaries || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [invId]);

  if (loading) return null;
  if (!summaries.length) return (
    <div style={{ padding: "14px", background: bg2, border: "1px solid " + bdr,
      borderRadius: 8, fontSize: 12, color: sec, fontStyle: "italic" }}>
      No investigator summaries yet. They will appear here automatically when received by email.
    </div>
  );

  return (
    <div style={{ border: "1px solid " + acc, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", background: isDark ? "rgba(99,102,241,0.12)" : "#eff6ff",
        borderBottom: "1px solid " + bdr, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 9, textTransform: "uppercase" as any, letterSpacing: "0.07em",
          color: acc, fontWeight: 700 }}>
          📝 Investigator summaries ({summaries.length})
        </span>
        <span style={{ fontSize: 10, color: sec }}>auto-imported from email</span>
      </div>
      {summaries.map((s: any, i: number) => {
        const isExp = expanded.has(s.id);
        const vehs: any[] = s.vehicles_extracted || [];
        return (
          <div key={s.id} style={{ borderBottom: i < summaries.length-1 ? "0.5px solid " + bdr : "none" }}>
            {/* Summary header */}
            <div onClick={() => {
                const n = new Set(expanded);
                isExp ? n.delete(s.id) : n.add(s.id);
                setExpanded(n);
              }}
              style={{ padding: "10px 14px", cursor: "pointer", display: "flex",
                alignItems: "center", gap: 12, background: i%2===1 ? bg2 : bg1 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(99,102,241,0.06)" : "#f5f3ff"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i%2===1 ? bg2 : bg1}>

              {/* Date */}
              <div style={{ minWidth: 90 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: txt }}>
                  {s.summary_date || "No date"}
                </div>
                {s.investigator_name && (
                  <div style={{ fontSize: 10, color: sec, marginTop: 1 }}>
                    {s.investigator_name}
                  </div>
                )}
              </div>

              {/* Hours */}
              {(s.hours_start || s.hours_end) && (
                <div style={{ fontSize: 11, color: sec, minWidth: 120 }}>
                  {s.hours_start} – {s.hours_end}
                </div>
              )}

              {/* Flags */}
              <div style={{ display: "flex", gap: 5, flex: 1 }}>
                {s.observed    && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: "#dcfce7", color: "#166534", fontWeight: 600 }}>Observed</span>}
                {s.working     && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: "#dbeafe", color: "#1e40af", fontWeight: 600 }}>Working</span>}
                {s.unrestricted && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: "#fef9c3", color: "#854d0e", fontWeight: 600 }}>Unrestricted</span>}
                {s.burned      && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: "#fee2e2", color: "#991b1b", fontWeight: 700 }}>🔥 Burned</span>}
              </div>

              {/* Vehicles */}
              {vehs.length > 0 && (
                <span style={{ fontSize: 10, color: acc }}>🚗 {vehs.length} vehicle{vehs.length!==1?"s":""}</span>
              )}

              <span style={{ fontSize: 11, color: mut }}>{isExp ? "▲" : "▼"}</span>
            </div>

            {/* Expanded body */}
            {isExp && (
              <div style={{ padding: "12px 16px", background: isDark ? "rgba(99,102,241,0.04)" : "#fafafa",
                borderTop: "0.5px solid " + bdr }}>
                {/* Vehicles extracted */}
                {vehs.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: sec, textTransform: "uppercase" as any,
                      letterSpacing: "0.07em", margin: "0 0 6px" }}>Vehicles extracted by AI</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {vehs.map((v: any, j: number) => (
                        <div key={j} style={{ fontSize: 11.5, color: txt, display: "flex", gap: 8, padding: "4px 8px",
                          background: bg1, borderRadius: 5, border: "1px solid " + bdr }}>
                          <span style={{ fontWeight: 600 }}>{[v.year, v.color, v.make_model].filter(Boolean).join(" ")}</span>
                          {v.plate && <span style={{ fontFamily: "monospace", color: acc, fontWeight: 700 }}>{v.plate}</span>}
                          {v.registered_owner && <span style={{ color: sec }}>R/O: {v.registered_owner}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Body text */}
                <p style={{ fontSize: 10, fontWeight: 700, color: sec, textTransform: "uppercase" as any,
                  letterSpacing: "0.07em", margin: "0 0 6px" }}>Summary</p>
                <p style={{ fontSize: 12, color: txt, margin: 0, lineHeight: 1.6,
                  whiteSpace: "pre-wrap" as any, maxHeight: 200, overflowY: "auto" as any }}>
                  {(s.body_text || "").substring(0, 800)}{(s.body_text || "").length > 800 ? "..." : ""}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VehiclesTab({ inv, vehicles, setVehicles, isDark, acc, sec, txt, bg1, bg2, bdr, mut, base }: any) {
  const [editing, setEditing]     = React.useState<Record<number, any>>({});
  const [adding, setAdding]       = React.useState(false);
  const [newVeh, setNewVeh]       = React.useState({ year:"", make_model:"", plate:"", color:"", registered_owner:"", driver_type:"Subject", other_driver:"", notes:"", source:"manual" });
  const [showTable, setShowTable] = React.useState(false);
  const fileRefs                  = React.useRef<Record<number, HTMLInputElement>>({});

  const DRIVER_TYPES = ["Subject", "Shared", "Other"];
  const COLORS       = ["Black","White","Silver","Gray","Red","Blue","Green","Brown","Gold","Yellow","Orange","Other"];

  const COLOR_MAP: Record<string,string> = {
    black:"#1a1a1a", white:"#f5f5f5", silver:"#c0c0c0", gray:"#808080",
    red:"#dc2626", blue:"#2563eb", green:"#16a34a", brown:"#92400e",
    gold:"#d97706", yellow:"#eab308", orange:"#ea580c"
  };

  const reload = async () => {
    const r = await fetch("/api/investigations/" + inv.id + "/vehicles", { credentials: "include" });
    const d = await r.json();
    setVehicles(d);
  };

  const patchVehicle = async (id: number, updates: any) => {
    await fetch("/api/investigations/" + inv.id + "/vehicles/" + id, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  };

  const saveEdit = async (veh: any) => {
    const upd = editing[veh.id] || {};
    if (Object.keys(upd).length) await patchVehicle(veh.id, upd);
    setEditing(prev => { const n = {...prev}; delete n[veh.id]; return n; });
    reload();
  };

  const deleteVeh = async (id: number) => {
    if (!window.confirm("Delete this vehicle?")) return;
    await fetch("/api/investigations/" + inv.id + "/vehicles/" + id,
      { method: "DELETE", credentials: "include" });
    reload();
  };

  const addVehicle = async () => {
    if (!newVeh.make_model.trim() && !newVeh.year.trim()) { alert("Enter at least year or make/model"); return; }
    await fetch("/api/investigations/" + inv.id + "/vehicles", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newVeh),
    });
    setAdding(false);
    setNewVeh({ year:"", make_model:"", plate:"", color:"", registered_owner:"", driver_type:"Subject", other_driver:"", notes:"", source:"manual" });
    reload();
  };

  const sourceLabel = (src: string) => {
    if (src === "dmv_registration")   return { label: "DMV", color: "#10b981" };
    if (src === "onedrive_ingestor")  return { label: "OneDrive", color: "#8b5cf6" };
    if (src === "accurint_current")   return { label: "Accurint", color: "#10b981" };
    if (src === "iso_report")         return { label: "ISO", color: "#f59e0b" };
    if (src === "manual")             return { label: "Manual", color: "#6b7280" };
    if (src === "email_attachment")   return { label: "Email", color: "#3b82f6" };
    return { label: src || "Unknown", color: "#6b7280" };
  };

  const realVehs = vehicles.filter((v: any) => v.make_model !== "Insurance check" && v.year);
  const insVehs  = vehicles.filter((v: any) => v.insurer && (v.make_model === "Insurance check" || !v.year));

  const setField = (id: number, field: string, val: string) => {
    setEditing(prev => ({ ...prev, [id]: { ...(prev[id]||{}), [field]: val } }));
  };
  const getField = (veh: any, field: string) =>
    editing[veh.id]?.[field] !== undefined ? editing[veh.id][field] : (veh[field] || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowTable(f => !f)}
            style={{ padding: "5px 12px", fontSize: 11.5, cursor: "pointer", borderRadius: 6,
              border: "1px solid " + (showTable ? acc : bdr),
              background: showTable ? (isDark ? "rgba(99,102,241,0.1)" : "#eff6ff") : bg1,
              color: showTable ? acc : sec, fontWeight: 500 }}>
            {showTable ? "📋 Table view" : "🃏 Card view"}
          </button>
        </div>
        <button onClick={() => setAdding(true)}
          style={{ padding: "6px 14px", background: acc, color: "white", border: "none",
            borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          + Add vehicle
        </button>
      </div>

      {/* Add vehicle form */}
      {adding && (
        <div style={{ border: "2px solid " + acc, borderRadius: 10, padding: "16px", background: bg2 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: acc, margin: "0 0 12px", textTransform: "uppercase" as any, letterSpacing: "0.07em" }}>New Vehicle</p>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 100px", gap: 8, marginBottom: 8 }}>
            {[["Year","year"],["Make / Model","make_model"],["Plate","plate"],["Color","color"]].map(([label,field]) => (
              <div key={field}>
                <p style={{ fontSize: 10, color: sec, fontWeight: 600, textTransform: "uppercase" as any, margin: "0 0 3px" }}>{label}</p>
                {field === "color" ? (
                  <select value={newVeh[field as keyof typeof newVeh]} onChange={e => setNewVeh(v => ({...v, [field]: e.target.value}))}
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid " + bdr, borderRadius: 5, fontSize: 12, background: bg1, color: txt }}>
                    <option value="">—</option>
                    {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input value={newVeh[field as keyof typeof newVeh]} onChange={e => setNewVeh(v => ({...v, [field]: e.target.value}))}
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid " + bdr, borderRadius: 5, fontSize: 12, background: bg1, color: txt, boxSizing: "border-box" as any }}/>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 10, color: sec, fontWeight: 600, textTransform: "uppercase" as any, margin: "0 0 3px" }}>Registered owner</p>
              <input value={newVeh.registered_owner} onChange={e => setNewVeh(v => ({...v, registered_owner: e.target.value}))}
                style={{ width: "100%", padding: "6px 8px", border: "1px solid " + bdr, borderRadius: 5, fontSize: 12, background: bg1, color: txt, boxSizing: "border-box" as any }}/>
            </div>
            <div>
              <p style={{ fontSize: 10, color: sec, fontWeight: 600, textTransform: "uppercase" as any, margin: "0 0 3px" }}>Driver</p>
              <div style={{ display: "flex", gap: 4 }}>
                {DRIVER_TYPES.map(dt => (
                  <button key={dt} onClick={() => setNewVeh(v => ({...v, driver_type: dt}))}
                    style={{ flex: 1, padding: "5px 4px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                      borderRadius: 5, border: "1px solid",
                      background: newVeh.driver_type === dt ? acc : bg1,
                      color: newVeh.driver_type === dt ? "white" : sec,
                      borderColor: newVeh.driver_type === dt ? acc : bdr }}>
                    {dt}
                  </button>
                ))}
              </div>
              {newVeh.driver_type === "Shared" && (
                <input placeholder="Other driver name..." value={newVeh.other_driver}
                  onChange={e => setNewVeh(v => ({...v, other_driver: e.target.value}))}
                  style={{ width: "100%", marginTop: 4, padding: "5px 8px", border: "1px solid " + bdr, borderRadius: 5, fontSize: 11, background: bg1, color: txt, boxSizing: "border-box" as any }}/>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addVehicle}
              style={{ padding: "7px 18px", background: acc, color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Save Vehicle
            </button>
            <button onClick={() => setAdding(false)}
              style={{ padding: "7px 14px", background: "transparent", color: sec, border: "1px solid " + bdr, borderRadius: 7, fontSize: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {vehicles.length === 0 && !adding && (
        <div style={{ textAlign: "center", padding: "32px 16px", border: "1px dashed " + bdr, borderRadius: 8 }}>
          <p style={{ fontSize: 28, margin: "0 0 6px" }}>🚗</p>
          <p style={{ fontSize: 13, color: sec, margin: 0 }}>No vehicles found yet</p>
        </div>
      )}

      {/* TABLE VIEW */}
      {showTable && realVehs.length > 0 && (
        <div style={{ border: "1px solid " + bdr, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", background: bg1, borderBottom: "1px solid " + bdr }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: sec, textTransform: "uppercase" as any, letterSpacing: "0.07em", margin: 0 }}>
              Vehicle table — ready to merge into report
            </p>
          </div>
          <div style={{ overflowX: "auto" as any }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: bg2, borderBottom: "1px solid " + bdr }}>
                  {["Year","Make/Model","Color","Plate","Registered Owner","Driver","Source"].map(h => (
                    <th key={h} style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700,
                      textTransform: "uppercase" as any, color: sec, textAlign: "left", whiteSpace: "nowrap" as any, borderRight: "0.5px solid " + bdr }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {realVehs.map((veh: any, i: number) => {
                  const sl = sourceLabel(veh.source);
                  return (
                    <tr key={veh.id} style={{ borderBottom: "0.5px solid " + bdr, background: i%2===1 ? bg2 : bg1 }}>
                      <td style={{ padding: "7px 10px", color: txt, fontWeight: 600 }}>{veh.year||"—"}</td>
                      <td style={{ padding: "7px 10px", color: txt }}>{veh.make_model||"—"}</td>
                      <td style={{ padding: "7px 10px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          {veh.color && <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLOR_MAP[veh.color.toLowerCase()]||mut, display: "inline-block", border: "1px solid " + bdr }}/>}
                          {veh.color||"—"}
                        </span>
                      </td>
                      <td style={{ padding: "7px 10px", fontFamily: "monospace", color: acc, fontWeight: 700 }}>{veh.plate||"—"}</td>
                      <td style={{ padding: "7px 10px", color: txt }}>{veh.registered_owner||"—"}</td>
                      <td style={{ padding: "7px 10px" }}>
                        <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, fontWeight: 600,
                          background: veh.driver_type==="Subject"?"#dbeafe":veh.driver_type==="Shared"?"#fef9c3":"#f1f5f9",
                          color: veh.driver_type==="Subject"?"#1e40af":veh.driver_type==="Shared"?"#854d0e":"#475569" }}>
                          {veh.driver_type||"—"}
                          {veh.other_driver ? " / " + veh.other_driver : ""}
                        </span>
                      </td>
                      <td style={{ padding: "7px 10px", fontSize: 11, color: sl.color }}>{sl.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARD VIEW */}
      {!showTable && realVehs.map((veh: any) => {
        const isEditing = veh.id in editing;
        const sl = sourceLabel(veh.source);
        const parts = (veh.make_model || "").split(" ");
        const make  = parts[0] || "";
        const model = parts.slice(1).join(" ") || "";
        const colorKey = (getField(veh,"color")||"").toLowerCase();

        return (
          <div key={veh.id} style={{ border: "1px solid " + (isEditing ? acc : bdr),
            borderRadius: 10, background: bg2, overflow: "hidden" }}>

            {/* Header bar */}
            <div style={{ padding: "11px 16px", borderBottom: "1px solid " + bdr,
              background: bg1, display: "flex", alignItems: "center", gap: 12 }}>
              {/* Color swatch */}
              <div style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                background: COLOR_MAP[colorKey] || mut, border: "1px solid " + bdr }}/>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: txt, margin: 0 }}>
                  {[veh.year, veh.color, make, model].filter(Boolean).join(" ") || "Vehicle"}
                </p>
                <p style={{ fontSize: 11, color: sl.color, margin: "1px 0 0" }}>
                  {sl.label}
                </p>
              </div>
              {/* Driver badge */}
              {veh.driver_type && (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                  background: veh.driver_type==="Subject"?"#dbeafe":veh.driver_type==="Shared"?"#fef9c3":"#f1f5f9",
                  color: veh.driver_type==="Subject"?"#1e40af":veh.driver_type==="Shared"?"#854d0e":"#475569" }}>
                  {veh.driver_type}{veh.other_driver ? " / " + veh.other_driver : ""}
                </span>
              )}
              {/* Plate */}
              {veh.plate && (
                <span style={{ fontSize: 14, fontWeight: 800, padding: "4px 12px", borderRadius: 5,
                  background: bg2, border: "2px solid " + bdr, color: acc,
                  fontFamily: "monospace", letterSpacing: "0.1em" }}>
                  {veh.plate}
                </span>
              )}
              {/* Edit / Delete */}
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {isEditing ? (
                  <>
                    <button onClick={() => saveEdit(veh)}
                      style={{ padding: "4px 10px", background: "#166534", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditing(prev => { const n={...prev}; delete n[veh.id]; return n; })}
                      style={{ padding: "4px 8px", background: "transparent", color: sec, border: "1px solid " + bdr, borderRadius: 6, fontSize: 11, cursor: "pointer" }}>✕</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setEditing(prev => ({...prev, [veh.id]: {}}))}
                      style={{ padding: "4px 10px", background: bg2, color: sec, border: "1px solid " + bdr, borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Edit</button>
                    <button onClick={() => deleteVeh(veh.id)}
                      style={{ padding: "4px 8px", background: "transparent", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>🗑</button>
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "110px 1fr", gap: 12, alignItems: "start" }}>
              {/* Photo placeholder */}
              <div style={{ border: "1px solid " + bdr, borderRadius: 7, overflow: "hidden" }}>
                <div style={{ height: 80, background: bg1, display: "flex", alignItems: "center",
                  justifyContent: "center", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 22, opacity: 0.25 }}>🚗</span>
                  <span style={{ fontSize: 9, color: mut }}>No photo</span>
                </div>
                <div style={{ padding: 4, borderTop: "1px solid " + bdr, background: bg1 }}>
                  <input ref={(el: any) => { if (el) fileRefs.current[veh.id] = el; }} type="file" accept="image/*" style={{ display: "none" }}/>
                  <button onClick={() => fileRefs.current[veh.id]?.click()}
                    style={{ fontSize: 10, padding: "2px 0", width: "100%", cursor: "pointer",
                      background: bg2, border: "1px solid " + bdr, borderRadius: 4, color: sec }}>
                    📷 Add
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 90px", gap: 6 }}>
                  {[["Year","year"],["Make",""],["Model",""],["Color","color"]].map(([label, field]: any) => {
                    const val = field === "" ? (label==="Make" ? make : model) : getField(veh, field);
                    return (
                      <div key={label} style={{ border: "1px solid " + bdr, borderRadius: 5, padding: "5px 8px", background: bg1 }}>
                        <p style={{ fontSize: 9, color: mut, textTransform: "uppercase" as any, fontWeight: 700, margin: "0 0 2px" }}>{label}</p>
                        {isEditing && field ? (
                          field === "color" ? (
                            <select value={getField(veh,field)} onChange={e => setField(veh.id, field, e.target.value)}
                              style={{ width: "100%", border: "none", background: "transparent", fontSize: 12, color: txt, outline: "none" }}>
                              <option value="">—</option>
                              {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <input value={getField(veh,field)} onChange={e => setField(veh.id, field, e.target.value)}
                              style={{ width: "100%", border: "none", background: "transparent", fontSize: 12, color: txt, outline: "none" }}/>
                          )
                        ) : (
                          <p style={{ fontSize: 12, color: val ? txt : mut, margin: 0 }}>{val || "—"}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Make/Model combined field when editing */}
                {isEditing && (
                  <div style={{ border: "1px solid " + acc, borderRadius: 5, padding: "5px 8px", background: bg1 }}>
                    <p style={{ fontSize: 9, color: acc, textTransform: "uppercase" as any, fontWeight: 700, margin: "0 0 2px" }}>Make / Model (combined)</p>
                    <input value={getField(veh,"make_model")||veh.make_model||""} onChange={e => setField(veh.id,"make_model",e.target.value)}
                      style={{ width: "100%", border: "none", background: "transparent", fontSize: 12, color: txt, outline: "none" }}/>
                  </div>
                )}

                {/* Registered owner */}
                <div style={{ border: "1px solid " + bdr, borderRadius: 5, padding: "6px 10px", background: bg1 }}>
                  <p style={{ fontSize: 9, color: mut, textTransform: "uppercase" as any, fontWeight: 700, margin: "0 0 3px" }}>Registered owner</p>
                  {isEditing ? (
                    <input value={getField(veh,"registered_owner")} onChange={e => setField(veh.id,"registered_owner",e.target.value)}
                      style={{ width: "100%", border: "none", background: "transparent", fontSize: 13, fontWeight: 600, color: txt, outline: "none" }}/>
                  ) : (
                    <p style={{ fontSize: 13, fontWeight: 600, color: veh.registered_owner ? txt : mut, margin: 0 }}>
                      {veh.registered_owner || "— unknown"}
                    </p>
                  )}
                </div>

                {/* Driver type */}
                <div>
                  <p style={{ fontSize: 9, color: mut, textTransform: "uppercase" as any, fontWeight: 700, margin: "0 0 4px" }}>Driver</p>
                  <div style={{ display: "flex", gap: 4 }}>
                    {DRIVER_TYPES.map(dt => (
                      <button key={dt}
                        onClick={() => isEditing ? setField(veh.id,"driver_type",dt) : null}
                        style={{ flex: 1, padding: "4px 6px", fontSize: 11, fontWeight: 600,
                          borderRadius: 5, border: "1px solid",
                          cursor: isEditing ? "pointer" : "default",
                          background: getField(veh,"driver_type")===dt||(!isEditing&&veh.driver_type===dt) ? acc : bg1,
                          color:     getField(veh,"driver_type")===dt||(!isEditing&&veh.driver_type===dt) ? "white" : sec,
                          borderColor: getField(veh,"driver_type")===dt||(!isEditing&&veh.driver_type===dt) ? acc : bdr }}>
                        {dt}
                      </button>
                    ))}
                  </div>
                  {(getField(veh,"driver_type")==="Shared"||(!editing[veh.id]&&veh.driver_type==="Shared")) && (
                    isEditing ? (
                      <input placeholder="Other driver..." value={getField(veh,"other_driver")} onChange={e => setField(veh.id,"other_driver",e.target.value)}
                        style={{ width:"100%", marginTop:4, padding:"5px 8px", border:"1px solid "+bdr, borderRadius:5, fontSize:11, background:bg1, color:txt, boxSizing:"border-box" as any }}/>
                    ) : veh.other_driver ? (
                      <p style={{ fontSize: 11, color: sec, margin: "4px 0 0" }}>Other driver: {veh.other_driver}</p>
                    ) : null
                  )}
                </div>

                {/* Notes */}
                {(isEditing || veh.notes) && (
                  <div>
                    <p style={{ fontSize: 9, color: mut, textTransform: "uppercase" as any, fontWeight: 700, margin: "0 0 3px" }}>Notes</p>
                    {isEditing ? (
                      <input value={getField(veh,"notes")} onChange={e => setField(veh.id,"notes",e.target.value)}
                        placeholder="Optional notes..."
                        style={{ width:"100%", padding:"6px 8px", border:"1px solid "+bdr, borderRadius:5, fontSize:12, background:bg1, color:txt, boxSizing:"border-box" as any }}/>
                    ) : (
                      <p style={{ fontSize: 12, color: sec, margin: 0 }}>{veh.notes}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Insurance checks */}
      {insVehs.length > 0 && (
        <div style={{ border: "1px solid " + bdr, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: bg1, borderBottom: "1px solid " + bdr }}>
            <p style={{ fontSize: 10, textTransform: "uppercase" as any, letterSpacing: "0.07em",
              color: sec, fontWeight: 700, margin: 0 }}>Insurance checks ({insVehs.length})</p>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap" as any, gap: 8 }}>
            {insVehs.map((ins: any) => (
              <div key={ins.id} style={{ border: "1px solid " + (ins.insurance_hit ? "#10b981" : bdr),
                borderRadius: 8, padding: "8px 14px", background: ins.insurance_hit ? (isDark ? "rgba(16,185,129,0.1)" : "#f0fdf4") : bg1,
                display: "flex", alignItems: "center", gap: 8, minWidth: 130 }}>
                <span style={{ fontSize: 16 }}>{ins.insurance_hit ? "✅" : "❌"}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: txt, margin: 0 }}>{ins.insurer}</p>
                  <p style={{ fontSize: 11, color: ins.insurance_hit ? "#10b981" : mut, margin: 0 }}>
                    {ins.insurance_hit ? "HIT" : "No vehicle found"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmployerTab({ inv, meta, isDark, acc, sec, txt, bg1, bg2, bdr, mut, save }: any) {

  const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ border: "1px solid " + bdr, borderRadius: 8, padding: "12px 14px", background: bg2 }}>
      <p style={{ fontSize: 9, textTransform: "uppercase" as any, letterSpacing: "0.07em",
        color: mut, fontWeight: 700, margin: "0 0 10px" }}>{title}</p>
      {children}
    </div>
  );

  const warn   = "#92400e";
  const warnBg = isDark ? "rgba(245,158,11,0.1)" : "#fffbeb";

  // Employment status options (from Todd)
  const EMP_STATUS = [
    "Employed (Insured Worker)",
    "Terminated",
    "TTD - Temporary Totally Disabled",
    "Off Work",
    "Unknown",
    "Subsequent Employer",
  ];

  // Work site options
  const WORK_SITE = ["On-Premises", "Field (varies)", "Other Address"];

  // Represented options
  const REP_OPTIONS = ["Yes", "No", "Unknown"];

  const [showEmpDD, setShowEmpDD]   = React.useState(false);
  const [showSiteDD, setShowSiteDD] = React.useState(false);
  const [showRepDD, setShowRepDD]   = React.useState(false);

  const contactVal = meta?.employer_contact || "";
  const isNoContact = contactVal.toLowerCase().includes("no contact") || contactVal.toLowerCase().includes("do not");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

      {/* LEFT — Employer */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontSize: 10, textTransform: "uppercase" as any, letterSpacing: "0.07em",
          fontWeight: 700, color: sec, margin: 0, paddingBottom: 8, borderBottom: "2px solid " + bdr }}>
          Employer
        </p>

        <Block title="Company">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Field
              label={(() => {
                const ct = (meta?.type_of_claim || "").toLowerCase();
                if (ct.includes("liab") || ct.includes("slip") || ct.includes("auto")) return "Employer";
                if (ct.includes("worker") || ct.includes("comp")) return "Insured";
                return "Company / Insured";
              })()}
              value={meta?.employer_name} onEdit={save("employer_name")} />

            {/* Contact person — with Do Not Contact option */}
            <div>
              <p style={{ fontSize: 10, textTransform: "uppercase" as any, letterSpacing: "0.06em",
                color: sec, fontWeight: 600, margin: "0 0 4px" }}>Contact person</p>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <Field label="" value={isNoContact ? null : (meta?.employer_contact || null)}
                    onEdit={save("employer_contact")}
                    empty={isNoContact
                      ? <span style={{ color: "#dc2626", fontWeight: 600, fontSize: 12 }}>⛔ Do Not Contact</span>
                      : undefined} />
                </div>
                <button
                  onClick={() => save("employer_contact")(isNoContact ? "" : "Do Not Contact")}
                  style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                    border: "1px solid " + (isNoContact ? "#dc2626" : bdr),
                    borderRadius: 6, background: isNoContact ? "#fef2f2" : bg1,
                    color: isNoContact ? "#dc2626" : sec, whiteSpace: "nowrap" as any, flexShrink: 0 }}>
                  {isNoContact ? "⛔ DNC" : "Set DNC"}
                </button>
              </div>
            </div>

            <Field label="Phone"               value={meta?.employer_phone}           onEdit={save("employer_phone")} />
            <Field label="Address"             value={meta?.employer_address}         onEdit={save("employer_address")} />
            <Field label="City / State / Zip"  value={meta?.employer_city_state_zip}  onEdit={save("employer_city_state_zip")} />
          </div>
        </Block>

        {/* Work site type */}
        <Block title="Work site">
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setShowSiteDD(s => !s)}
              style={{ padding: "7px 10px", border: "1px solid " + bdr, borderRadius: 6, cursor: "pointer",
                fontSize: 13, background: bg1, color: meta?.work_site_type ? txt : sec,
                display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{meta?.work_site_type || "Select work site type..."}</span>
              <span style={{ fontSize: 10, color: sec }}>{showSiteDD ? "▲" : "▼"}</span>
            </div>
            {showSiteDD && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 40,
                background: bg2, border: "1px solid " + bdr, borderRadius: 6,
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}>
                {WORK_SITE.map(opt => (
                  <div key={opt}
                    onClick={() => { save("work_site_type")(opt); setShowSiteDD(false); }}
                    style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13,
                      color: meta?.work_site_type === opt ? acc : txt,
                      fontWeight: meta?.work_site_type === opt ? 600 : 400,
                      borderBottom: "0.5px solid " + bdr }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? "#2a1a0a" : "#eff6ff"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}>
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginTop: 8 }}>
            <Field label="Other address (if field)" value={meta?.work_site_address} onEdit={save("work_site_address")} />
          </div>
        </Block>

        <Block title="Claimant">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Job title"       value={meta?.subject_job}       onEdit={save("subject_job")} />
            <Field label="Language"        value={meta?.primary_language}  onEdit={save("primary_language")} />
          </div>

          {/* Employment status — dropdown */}
          <div style={{ marginTop: 8, position: "relative" }}>
            <p style={{ fontSize: 10, textTransform: "uppercase" as any, letterSpacing: "0.06em",
              color: sec, fontWeight: 600, margin: "0 0 4px" }}>Employment status</p>
            <div onClick={() => setShowEmpDD(s => !s)}
              style={{ padding: "7px 10px", border: "1px solid " + bdr, borderRadius: 6, cursor: "pointer",
                fontSize: 13, background: bg1, color: meta?.employment_status ? txt : sec,
                display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{meta?.employment_status || "Select status..."}</span>
              <span style={{ fontSize: 10, color: sec }}>{showEmpDD ? "▲" : "▼"}</span>
            </div>
            {showEmpDD && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 40,
                background: bg2, border: "1px solid " + bdr, borderRadius: 6,
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}>
                {EMP_STATUS.map(opt => (
                  <div key={opt}
                    onClick={() => { save("employment_status")(opt); setShowEmpDD(false); }}
                    style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13,
                      color: meta?.employment_status === opt ? acc : txt,
                      fontWeight: meta?.employment_status === opt ? 600 : 400,
                      borderBottom: "0.5px solid " + bdr }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? "#2a1a0a" : "#eff6ff"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}>
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Represented — toggle */}
          <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: sec, flexShrink: 0 }}>Represented by attorney?</span>
            <div style={{ display: "flex", gap: 4 }}>
              {REP_OPTIONS.map(opt => (
                <button key={opt}
                  onClick={() => save("is_represented")(opt)}
                  style={{ padding: "3px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                    borderRadius: 20, border: "1px solid",
                    background: meta?.is_represented === opt ? (opt==="Yes"?"#dbeafe":opt==="No"?"#fee2e2":"#f1f5f9") : bg1,
                    color: meta?.is_represented === opt ? (opt==="Yes"?"#1e40af":opt==="No"?"#991b1b":"#475569") : sec,
                    borderColor: meta?.is_represented === opt ? (opt==="Yes"?"#1e40af":opt==="No"?"#991b1b":"#94a3b8") : bdr }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </Block>
      </div>

      {/* RIGHT — Injury & Surveillance */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontSize: 10, textTransform: "uppercase" as any, letterSpacing: "0.07em",
          fontWeight: 700, color: sec, margin: 0, paddingBottom: 8, borderBottom: "2px solid " + bdr }}>
          Injury
        </p>

        <Block title="Injury">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <Field label="Date of injury"      value={meta?.date_of_injury}           onEdit={save("date_of_injury")} />
            <Field label="Surv. days"          value={meta?.surveillance_days}        onEdit={save("surveillance_days")} />
            <Field label="Days prev. done"     value={meta?.days_previously_completed} onEdit={save("days_previously_completed")} />
            <Field label="Report due"          value={meta?.report_due_date}          onEdit={save("report_due_date")} />
          </div>
          <Field label="Body parts injured"    value={meta?.body_parts}               onEdit={save("body_parts")} />
          <div style={{ marginTop: 8 }}>
            <Field label="Current restrictions" value={meta?.restrictions}            onEdit={save("restrictions")} />
          </div>
          {meta?.subjective_complaints && (
            <div style={{ marginTop: 8 }}>
              <Field label="Subjective complaints" value={meta?.subjective_complaints} onEdit={save("subjective_complaints")} />
            </div>
          )}
        </Block>

        {meta?.suspicion && (
          <div style={{ border: "1px solid " + bdr, borderRadius: 8, padding: "10px 12px", background: bg1 }}>
            <p style={{ fontSize: 9, textTransform: "uppercase" as any, letterSpacing: "0.07em",
              color: mut, fontWeight: 700, margin: "0 0 6px" }}>Fraud suspicion</p>
            <p style={{ fontSize: 12, color: sec, margin: 0 }}>{(meta.suspicion||"").substring(0,200)}</p>
          </div>
        )}

        {meta?.instructions && (
          <div style={{ border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 12px", background: warnBg }}>
            <p style={{ fontSize: 9, textTransform: "uppercase" as any, letterSpacing: "0.07em",
              color: warn, fontWeight: 700, margin: "0 0 6px" }}>Instructions</p>
            <p style={{ fontSize: 12, color: txt, margin: 0 }}>{(meta.instructions||"").substring(0,300)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientTab({ inv, meta, isDark, acc, sec, txt, bg1, bg2, bdr, mut, save }: any) {
  const [adjusters, setAdjusters]     = React.useState<any[]>([]);
  const [adjSearch, setAdjSearch]     = React.useState("");
  const [showAdjDD, setShowAdjDD]     = React.useState(false);

  // Load known adjusters on mount
  React.useEffect(() => {
    fetch("/api/investigations/adjusters/known")
      .then(r => r.json())
      .then(d => setAdjusters(d.adjusters || []))
      .catch(() => {});
  }, []);

  const filteredAdj = adjSearch.length > 1
    ? adjusters.filter((a: any) =>
        (a.name||"").toLowerCase().includes(adjSearch.toLowerCase()) ||
        (a.company||"").toLowerCase().includes(adjSearch.toLowerCase()))
    : adjusters.slice(0, 8);

  const selectAdjuster = (adj: any) => {
    if (adj.name)             save("adjuster_name")(adj.name);
    if (adj.company)          save("client_company")(adj.company);
    if (adj.phone)            save("adjuster_phone")(adj.phone);
    if (adj.ext)              save("adjuster_ext")(adj.ext);
    if (adj.email)            save("adjuster_email")(adj.email);
    if (adj.address)          save("adjuster_address")(adj.address);
    if (adj.city_state_zip)   save("adjuster_city_state_zip")(adj.city_state_zip);
    setShowAdjDD(false);
    setAdjSearch("");
  };

  const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ border: "1px solid " + bdr, borderRadius: 8, padding: "12px 14px", background: bg2 }}>
      <p style={{ fontSize: 9, textTransform: "uppercase" as any, letterSpacing: "0.07em",
        color: mut, fontWeight: 700, margin: "0 0 10px" }}>{title}</p>
      {children}
    </div>
  );

  const hasAtty   = !!(meta?.defense_attorney && meta?.defense_law_firm);
  const claimType = (meta?.type_of_claim || "").toLowerCase();
  const isWC      = claimType.includes("worker") || claimType.includes("comp") || claimType.includes("employer");
  const isLiab    = claimType.includes("liab") || claimType.includes("slip") || claimType.includes("tort");
  const isAuto    = claimType.includes("auto") || claimType.includes("vehicle");
  const warn      = "#92400e";
  const warnBg    = isDark ? "rgba(245,158,11,0.1)" : "#fffbeb";
  const priorSurv = (meta?.prior_surveillance || []) as any[];

  // Report routing logic (from Todd's rules)
  const routingInfo = hasAtty
    ? { icon: "⚖️", color: "#92400e", bg: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb",
        text: "Report Only → attorney + adjuster. Invoice Only → adjuster separately." }
    : { icon: "📋", color: "#166534", bg: isDark ? "rgba(34,197,94,0.08)" : "#f0fdf4",
        text: "Report + Invoice → adjuster (no attorney on file)." };

  return (
    <DraggableGrid
      storageKey={`client_tab_${inv?.id||"0"}`}
      cols={2}
      acc={acc} bdr={bdr} bg1={bg1} isDark={isDark}
      items={[
        { id: "insurance", title: "Insurance / Adjuster", colSpan: 1 as 1, content: (
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 10, textTransform: "uppercase" as any, letterSpacing: "0.07em",
            fontWeight: 700, color: sec, margin: 0, paddingBottom: 8, borderBottom: "2px solid " + bdr }}>
            Insurance company
          </p>

        {/* Case type badge + multi-work-type selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {meta?.type_of_claim && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as any }}>
              {[
                { label: "Workers Comp", active: isWC,   color: "#1e40af", bg: "#dbeafe" },
                { label: "Auto",         active: isAuto,  color: "#6b21a8", bg: "#f3e8ff" },
                { label: "Liability",    active: isLiab,  color: "#9d174d", bg: "#fce7f3" },
              ].map(b => (
                <span key={b.label} style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5,
                  fontWeight: 600,
                  background: b.active ? b.bg : (isDark ? "#1a1a1a" : "#f8fafc"),
                  color: b.active ? b.color : sec,
                  border: "1px solid " + (b.active ? b.color : bdr) }}>
                  {b.label}
                </span>
              ))}
            </div>
          )}
          {/* Work types assigned to this case (multi-select) */}
          <div>
            <p style={{ fontSize: 9, color: mut, fontWeight: 700, textTransform: "uppercase" as any,
              letterSpacing: "0.06em", margin: "0 0 5px" }}>Work types on this case</p>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as any }}>
              {([
                ["Surveillance",              "surveillance"],
                ["Social Media / Background", "background"],
                ["Medical Canvass",           "medical_canvass"],
                ["Asset",                     "asset"],
                ["Auto",                      "auto"],
              ] as [string,string][]).map(([label, key]) => {
                const types: string[] = ((inv as any)?.case_types || []) as string[];
                const isActive = types.includes(key);
                const wt = label;
                return (
                  <button key={key} onClick={() => {
                    const next = isActive ? types.filter((t:string)=>t!==key) : [...types,key];
                    save("case_types")(next);
                  }}
                  style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", border: "1px solid",
                    background: isActive ? acc : bg1,
                    color: isActive ? "white" : sec,
                    borderColor: isActive ? acc : bdr }}>
                    {isActive ? "✓ " : ""}{wt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Adjuster block with autocomplete */}
        <Block title="Adjuster">
          {/* Autocomplete search */}
          <div style={{ position: "relative", marginBottom: 10 }}>
            <input
              placeholder="Search known adjusters..."
              value={adjSearch}
              onFocus={() => setShowAdjDD(true)}
              onBlur={() => setTimeout(() => setShowAdjDD(false), 200)}
              onChange={e => { setAdjSearch(e.target.value); setShowAdjDD(true); }}
              style={{ width: "100%", padding: "6px 10px", border: "1px solid " + acc,
                borderRadius: 6, fontSize: 12, background: bg1, color: txt,
                outline: "none", boxSizing: "border-box" as any }}/>
            {showAdjDD && filteredAdj.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                background: bg2, border: "1px solid " + bdr, borderRadius: 6,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)", maxHeight: 220, overflowY: "auto" as any }}>
                {filteredAdj.map((adj: any, i: number) => (
                  <div key={i} onMouseDown={() => selectAdjuster(adj)}
                    style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "0.5px solid " + bdr,
                      fontSize: 12 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? "#2a1a0a" : "#eff6ff"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}>
                    <div style={{ fontWeight: 600, color: txt }}>{adj.name}</div>
                    <div style={{ color: sec, fontSize: 11, marginTop: 1 }}>
                      {adj.company}{adj.phone ? " · " + adj.phone : ""}{adj.ext ? " x" + adj.ext : ""}
                      {adj.email ? " · " + adj.email : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Company"        value={meta?.client_company}    onEdit={save("client_company")} />
            <Field label="Adjuster name"  value={meta?.adjuster_name}     onEdit={save("adjuster_name")} />
            <Field label="Phone"          value={meta?.adjuster_phone}    onEdit={save("adjuster_phone")} />
            <Field label="Ext"            value={meta?.adjuster_ext}      onEdit={save("adjuster_ext")} />
            <Field label="Email"          value={meta?.adjuster_email}    onEdit={save("adjuster_email")} />
            <Field label="Type of claim"  value={meta?.type_of_claim}     onEdit={save("type_of_claim")} />
          </div>

          {/* Adjuster address — for report header when no attorney */}
          {!hasAtty && (
            <div style={{ marginTop: 4 }}>
              <p style={{ fontSize: 9, color: mut, fontWeight: 700, textTransform: "uppercase" as any,
                letterSpacing: "0.06em", margin: "0 0 6px" }}>
                Address (for report — no attorney on file)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Field label="Street address"     value={meta?.adjuster_address}         onEdit={save("adjuster_address")} />
                <Field label="City / State / Zip" value={meta?.adjuster_city_state_zip}  onEdit={save("adjuster_city_state_zip")} />
              </div>
              {(meta?.adjuster_name || meta?.client_company) && (meta?.adjuster_address || meta?.adjuster_city_state_zip) && (
                <div style={{ marginTop: 8, padding: "8px 10px", background: bg1,
                  border: "1px solid " + bdr, borderRadius: 6, fontSize: 11.5, lineHeight: 1.8, color: txt }}>
                  {meta?.adjuster_name    && <div style={{ fontWeight: 600 }}>{meta.adjuster_name}</div>}
                  {meta?.client_company   && <div>{meta.client_company}</div>}
                  {meta?.adjuster_address && <div style={{ color: sec }}>{meta.adjuster_address}</div>}
                  {meta?.adjuster_city_state_zip && <div style={{ color: sec }}>{meta.adjuster_city_state_zip}</div>}
                  <button
                    onClick={() => {
                      const lines = [meta?.adjuster_name, meta?.client_company, meta?.adjuster_address, meta?.adjuster_city_state_zip].filter(Boolean).join("\n"); navigator.clipboard.writeText(lines);
                    }}
                    style={{ marginTop: 6, fontSize: 10, padding: "2px 8px", border: "1px solid " + bdr,
                      borderRadius: 4, background: "transparent", color: sec, cursor: "pointer" }}>
                    📋 Copy for report
                  </button>
                </div>
              )}
            </div>
          )}
        </Block>

        {/* Claim # + DOI always together */}
        <Block title="Claim · Date of Injury">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Claim number"   value={meta?.claim_number}      onEdit={save("claim_number")} />
            <Field label="Date of injury" value={meta?.date_of_injury}    onEdit={save("date_of_injury")} />
          </div>
          {meta?.claim_number && meta?.date_of_injury && (
            <div style={{ marginTop: 8, padding: "6px 10px", background: bg1,
              borderRadius: 6, fontSize: 11, color: sec, display: "flex", gap: 8 }}>
              <span style={{ fontFamily: "monospace", color: txt }}>{meta.claim_number}</span>
              <span>·</span>
              <span>DOI {meta.date_of_injury}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(meta.claim_number + " · DOI " + meta.date_of_injury); }}
                style={{ marginLeft: "auto", fontSize: 10, padding: "1px 6px", border: "1px solid " + bdr,
                  borderRadius: 4, background: "transparent", color: sec, cursor: "pointer" }}>
                Copy
              </button>
            </div>
          )}
        </Block>

        {/* Assignment */}
        <Block title="Assignment">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Report due"     value={meta?.report_due_date}   onEdit={save("report_due_date")} />
            <Field label="Surv. days"     value={meta?.surveillance_days} onEdit={save("surveillance_days")} />
          </div>
        </Block>

        {/* Report routing info */}
        <div style={{ padding: "10px 12px", borderRadius: 8, fontSize: 12,
          background: routingInfo.bg, border: "1px solid " + bdr }}>
          <span style={{ fontWeight: 700, color: routingInfo.color }}>{routingInfo.icon} Routing: </span>
          <span style={{ color: sec }}>{routingInfo.text}</span>
        </div>

        {/* Email origin */}
        {meta?.email_received_at && (
          <div style={{ border: "1px solid " + bdr, borderRadius: 8, padding: "10px 12px", background: bg1 }}>
            <p style={{ fontSize: 9, textTransform: "uppercase" as any, letterSpacing: "0.07em",
              color: mut, fontWeight: 700, margin: "0 0 6px" }}>Email origin</p>
            <p style={{ fontSize: 12, color: txt, margin: "0 0 2px" }}>
              📧 {new Date(meta.email_received_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
            </p>
            <p style={{ fontSize: 11, color: sec, margin: 0 }}>{meta.email_subject}</p>
          </div>
        )}

        {/* Prior surveillance */}
        {priorSurv.length > 0 && (
          <div style={{ border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 12px", background: warnBg }}>
            <p style={{ fontSize: 9, textTransform: "uppercase" as any, letterSpacing: "0.07em",
              fontWeight: 700, color: warn, margin: "0 0 8px" }}>
              ⚠️ Prior surveillance ({priorSurv.length})
            </p>
            {priorSurv.map((s: any, i: number) => (
              <div key={i} style={{ fontSize: 12, color: sec, marginBottom: 5, paddingBottom: 5,
                borderBottom: i < priorSurv.length-1 ? "0.5px solid " + bdr : "none" }}>
                {s.source === "db" ? (
                  <span>📁 <a href={"/investigations/" + s.inv_id} style={{ color: acc }}>Inv #{s.inv_id}</a>
                    {" — "}{s.subject_name} {s.claim ? "(" + s.claim + ")" : ""} {s.days ? "· " + s.days + "d" : ""} {s.date}
                    <span style={{ fontSize: 10, color: mut, marginLeft: 4 }}>[{s.status}]</span>
                  </span>
                ) : (
                  <span>📂 ✅ {(s.filename||"").replace(/^COMPLETED - /,"").substring(0,65)}{s.due_date ? " — " + s.due_date : ""}</span>
                )}
              </div>
            ))}
          </div>
        )}
          </div>
        ) }, /* end insurance item */
        { id: "defense-routing", title: "Defense / Routing", colSpan: 1 as 1, content: (
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontSize: 10, textTransform: "uppercase" as any, letterSpacing: "0.07em",
          fontWeight: 700, color: sec, margin: 0, paddingBottom: 8, borderBottom: "2px solid " + bdr }}>
          Defense attorney {hasAtty && <span style={{ color: "#dc2626", marginLeft: 4 }}>●</span>}
        </p>

        {!hasAtty && (
          <div style={{ fontSize: 12, color: sec, padding: "8px 12px", background: bg2,
            border: "1px solid " + bdr, borderRadius: 8, fontStyle: "italic" }}>
            No defense attorney on file — report goes directly to adjuster.
          </div>
        )}

        <Block title="Contact">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Field label="Attorney name"  value={meta?.defense_attorney}       onEdit={save("defense_attorney")} />
            <Field label="Law firm"       value={meta?.defense_law_firm}       onEdit={save("defense_law_firm")} />
            <Field label="Phone"          value={meta?.defense_phone}          onEdit={save("defense_phone")} />
            <Field label="Email"          value={meta?.defense_email}          onEdit={save("defense_email")} />
          </div>
        </Block>

        {/* Address — grouped for copy/paste into report */}
        <Block title="Address (for report header)">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Field label="Street address"       value={meta?.defense_address}          onEdit={save("defense_address")} />
            <Field label="City / State / Zip"   value={meta?.defense_city_state_zip}   onEdit={save("defense_city_state_zip")} />
          </div>
          {/* Copy block for report template */}
          {(meta?.defense_attorney || meta?.defense_law_firm) && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: bg1, borderRadius: 6,
              fontSize: 11.5, lineHeight: 1.8, color: txt, border: "1px solid " + bdr }}>
              {meta?.defense_attorney && <div style={{ fontWeight: 600 }}>{meta.defense_attorney}</div>}
              {meta?.defense_law_firm && <div>{meta.defense_law_firm}</div>}
              {meta?.defense_address && <div style={{ color: sec }}>{meta.defense_address}</div>}
              {meta?.defense_city_state_zip && <div style={{ color: sec }}>{meta.defense_city_state_zip}</div>}
              <button
                onClick={() => {
                  const lines = [meta?.defense_attorney, meta?.defense_law_firm,
                    meta?.defense_address, meta?.defense_city_state_zip].filter(Boolean).join("\n");
                  navigator.clipboard.writeText(lines);
                }}
                style={{ marginTop: 6, fontSize: 10, padding: "2px 8px", border: "1px solid " + bdr,
                  borderRadius: 4, background: "transparent", color: sec, cursor: "pointer" }}>
                📋 Copy for report
              </button>
            </div>
          )}
        </Block>

        {/* Liability-specific: court case number + paralegal */}
        {(isLiab || meta?.defense_court_no || meta?.defense_assistant) && (
          <Block title={isLiab ? "Court / Litigation" : "Other"}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Court case no."   value={meta?.defense_court_no}    onEdit={save("defense_court_no")} />
              <Field label="Paralegal / Asst" value={meta?.defense_assistant}   onEdit={save("defense_assistant")} />
            </div>
          </Block>
        )}

        {/* Plaintiff attorney (litigation cases) */}
        {(meta?.attorney_plaintiff || isLiab) && (
          <Block title="Plaintiff attorney">
            <Field label="Attorney / Firm" value={meta?.attorney_plaintiff} onEdit={save("attorney_plaintiff")} />
          </Block>
        )}

        {/* Incident details */}
        {(meta?.incident_location || meta?.incident_description) && (
          <Block title="Incident details">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Field label="Location"     value={meta?.incident_location}    onEdit={save("incident_location")} />
              <Field label="Description"  value={meta?.incident_description} onEdit={save("incident_description")} />
            </div>
          </Block>
        )}

        {/* SIU / Prior claims */}
        {meta?.prior_claims && (
          <Block title="Prior claims / SIU flags">
            <Field label="Notes" value={meta?.prior_claims} onEdit={save("prior_claims")} />
          </Block>
        )}
          </div>
        ) }, /* end defense item */
      ]} />
  );
}

function DocumentsTab({ inv, meta, isDark, acc, sec, txt, bg1, bg2, bdr, mut }: any) {
  const [files, setFiles]         = React.useState<any[]>([]);
  const [loading, setLoading]     = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [filter, setFilter]       = React.useState("all");
  const [lightbox, setLightbox]   = React.useState<any>(null); // { url, name, type }
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/investigations/" + inv.id + "/documents")
      .then(r => r.json())
      .then(d => { setFiles(d.files || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [inv.id]);

  React.useEffect(() => { load(); }, [load]);

  // Close lightbox on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const IMAGE_EXTS = new Set(["jpg","jpeg","png","webp","gif"]);
  const DOCX_EXTS  = new Set(["docx","doc"]);
  const PDF_EXTS   = new Set(["pdf"]);

  const previewUrl = (path: string) =>
    "/api/investigations/" + inv.id + "/documents/preview?path=" + encodeURIComponent(path);
  const downloadUrl = (path: string) =>
    "/api/investigations/" + inv.id + "/documents/download?path=" + encodeURIComponent(path);

  const openFile = (file: any) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (IMAGE_EXTS.has(ext) || DOCX_EXTS.has(ext) || PDF_EXTS.has(ext)) {
      setLightbox({ url: previewUrl(file.path), name: file.name, type: IMAGE_EXTS.has(ext) ? "image" : "doc" });
    } else {
      const a = document.createElement("a"); a.href = downloadUrl(file.path); a.download = file.name; a.click();
    }
  };

  const buttonLabel = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (IMAGE_EXTS.has(ext)) return "🖼 View";
    if (PDF_EXTS.has(ext))   return "📄 View";
    if (DOCX_EXTS.has(ext))  return "📝 View";
    return "⬇ Save";
  };

  const upload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", uploadFile);
      const r = await fetch("/api/investigations/" + inv.id + "/documents/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (d.ok) { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; load(); }
      else alert("Upload failed: " + d.detail);
    } catch(e) { alert("Upload error: " + String(e)); }
    finally { setUploading(false); }
  };

  const ICONS: Record<string,string> = { pdf:"📄", docx:"📝", image:"🖼️", video:"🎬", file:"📎" };
  const CAT_ORDER = ["Email Attachments","Documents","Reference Photos","OSINT Candidates","Photos","Other"];
  const CAT_ICONS: Record<string,string> = {
    "Email Attachments":"📧", "Documents":"📄", "Reference Photos":"👤",
    "OSINT Candidates":"🔍", "Photos":"🖼️", "Other":"📎",
  };

  const categories = [...new Set(files.map((f:any) => f.category))].sort(
    (a,b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b));

  const filtered = filter === "all" ? files : files.filter((f:any) => f.category === filter);

  // Group by category for display
  const grouped: Record<string, any[]> = {};
  for (const f of filtered) {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  }

  const formatSize = (kb: number) => kb > 1024 ? (kb/1024).toFixed(1)+"MB" : kb+"KB";

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: txt, margin: "0 0 3px" }}>Documents</p>
          <p style={{ fontSize: 12, color: sec, margin: 0 }}>{files.length} files attached to this case</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()}
          style={{ padding: "7px 14px", background: acc, color: "white", border: "none",
            borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6 }}>
          + Upload
        </button>
        <input ref={fileInputRef} type="file" style={{ display: "none" }}
          onChange={e => { setUploadFile(e.target.files?.[0] || null); }}/>
      </div>

      {/* Upload bar */}
      {uploadFile && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px",
          background: bg2, border: "1px solid " + acc, borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: txt, flex: 1 }}>
            {ICONS["file"]} {uploadFile.name} ({formatSize(uploadFile.size/1024)})
          </span>
          <button onClick={upload} disabled={uploading}
            style={{ padding: "5px 14px", background: uploading ? "#9ca3af" : "#166534",
              color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: uploading ? "wait" : "pointer" }}>
            {uploading ? "Uploading..." : "Confirm Upload"}
          </button>
          <button onClick={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
            style={{ padding: "5px 10px", background: "transparent", color: sec,
              border: "1px solid " + bdr, borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      )}

      {/* Category filter tabs */}
      {categories.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as any }}>
          {["all", ...categories].map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 500,
                cursor: "pointer", border: "1px solid",
                background: filter === cat ? acc : bg1,
                color: filter === cat ? "white" : sec,
                borderColor: filter === cat ? acc : bdr }}>
              {cat === "all" ? "All (" + files.length + ")" : (CAT_ICONS[cat]||"") + " " + cat + " (" + files.filter((f:any)=>f.category===cat).length + ")"}
            </button>
          ))}
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 44, background: bg2, borderRadius: 8 }}/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: sec }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <p style={{ fontSize: 13, margin: 0 }}>No documents yet</p>
          <p style={{ fontSize: 11, marginTop: 4 }}>Upload files using the button above</p>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, catFiles]) => (
          <div key={cat}>
            {/* Category header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>{CAT_ICONS[cat]||"📎"}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: sec, textTransform: "uppercase" as any, letterSpacing: "0.07em" }}>
                {cat}
              </span>
              <span style={{ fontSize: 11, color: mut }}>· {(catFiles as any[]).length} file{(catFiles as any[]).length!==1?"s":""}</span>
              <div style={{ flex: 1, height: 1, background: bdr }}/>
            </div>

            {/* Files in category */}
            <div style={{ border: "1px solid " + bdr, borderRadius: 8, overflow: "hidden" }}>
              {(catFiles as any[]).map((file: any, idx: number) => (
                <div key={file.path}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                    borderBottom: idx < (catFiles as any[]).length-1 ? "0.5px solid " + bdr : "none",
                    background: idx % 2 === 1 ? bg2 : bg1,
                    transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(59,130,246,0.08)" : "#eff6ff"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = idx%2===1 ? bg2 : bg1}>

                  {/* Icon or thumbnail */}
                  {file.icon === "image" ? (
                    <img
                      src={previewUrl(file.path)}
                      alt={file.name}
                      onClick={() => openFile(file)}
                      style={{ width: 44, height: 36, objectFit: "cover", borderRadius: 4,
                        border: "1px solid " + bdr, cursor: "pointer", flexShrink: 0 }}
                      onError={e => { (e.target as HTMLImageElement).style.display="none"; }}
                    />
                  ) : (
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{ICONS[file.icon] || "📎"}</span>
                  )}

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: txt, fontWeight: 500,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as any,
                      maxWidth: "100%" }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: sec, marginTop: 1 }}>
                      {formatSize(file.size_kb)} {file.modified ? " · " + file.modified : ""}
                    </div>
                  </div>

                  {/* Download button */}
                  <button onClick={() => openFile(file)}
                    style={{ padding: "4px 12px", background: "transparent", color: acc,
                      border: "1px solid " + acc, borderRadius: 6, fontSize: 11.5,
                      fontWeight: 500, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" as any }}>
                    {buttonLabel(file.name)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* ── Lightbox / inline viewer ── */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.88)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ position: "relative", width: "100%", maxWidth: lightbox.type === "image" ? 900 : 1100,
              maxHeight: "90vh", display: "flex", flexDirection: "column",
              background: "#1a1a2e", borderRadius: 12, overflow: "hidden",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px", background: "#0f172a", flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as any, maxWidth: "70%" }}>
                {lightbox.name}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={lightbox.url} download={lightbox.name}
                  style={{ padding: "4px 12px", background: "#1e40af", color: "white",
                    borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
                  ⬇ Download
                </a>
                <button onClick={() => setLightbox(null)}
                  style={{ padding: "4px 10px", background: "#dc2626", color: "white",
                    border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                  ✕
                </button>
              </div>
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflow: "auto", display: "flex",
              alignItems: lightbox.type === "image" ? "center" : "flex-start",
              justifyContent: lightbox.type === "image" ? "center" : "flex-start",
              background: lightbox.type === "image" ? "#0a0a0a" : "white" }}>
              {lightbox.type === "image" ? (
                <img src={lightbox.url} alt={lightbox.name}
                  style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }}/>
              ) : (
                <iframe src={lightbox.url} title={lightbox.name}
                  style={{ width: "100%", height: "80vh", border: "none" }}/>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OneDrive files */}
      {meta?.prior_surveillance && (meta.prior_surveillance as any[]).some((p:any) => p.photos_found?.length || p.vehicles_found?.length) && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>☁️</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: sec, textTransform: "uppercase" as any, letterSpacing: "0.07em" }}>OneDrive (Prior Surveillance)</span>
            <div style={{ flex: 1, height: 1, background: bdr }}/>
          </div>
          <div style={{ border: "1px solid " + bdr, borderRadius: 8, overflow: "hidden" }}>
            {(meta.prior_surveillance as any[]).map((ps: any, i: number) => {
              const allFiles = [...(ps.photos_found||[]), ...(ps.vehicles_found||[]), ...(ps.profiles_found||[])];
              if (!allFiles.length) return null;
              return (
                <div key={i} style={{ padding: "10px 14px", borderBottom: i < (meta.prior_surveillance as any[]).length-1 ? "0.5px solid " + bdr : "none" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: txt, marginBottom: 6 }}>
                    {ps.filename || ps.surv_report || "Prior report"} · {ps.due_date}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as any }}>
                    {allFiles.slice(0,8).map((f:string, j:number) => (
                      <div key={j} style={{ fontSize: 10.5, color: sec, padding: "2px 8px",
                        background: bg2, borderRadius: 4, border: "1px solid " + bdr }}>
                        {f.split(" ").slice(-2).join(" ")}
                      </div>
                    ))}
                    {allFiles.length > 8 && <div style={{ fontSize: 10.5, color: mut }}>+{allFiles.length-8} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateTab({ inv, meta, isDark, acc, sec, txt, bg1, bg2, bdr }: any) {
  const [generating, setGenerating]     = React.useState(false);
  const [uploading, setUploading]       = React.useState(false);
  const [uploadGender, setUploadGender] = React.useState("male");
  const [uploadFile, setUploadFile]     = React.useState<File | null>(null);
  const [result, setResult]             = React.useState<any>(null);
  const [templateInfo, setTemplateInfo] = React.useState<any>(null);
  const [recipientMode, setRecipientMode] = React.useState<string>("adjuster");

  const hasAtty = !!(meta?.defense_attorney && meta?.defense_law_firm);
  const claim   = meta?.claim_number    || "";
  const doi     = meta?.date_of_injury  || "";
  const invName = (inv as any).investigator_name || "Rylee Christine Adams";
  const gender  = ((inv as any).subject_gender || "unknown").toLowerCase();
  const templateUsed = gender === "female" ? "female" : "male";

  React.useEffect(() => { setRecipientMode(hasAtty ? "attorney" : "adjuster"); }, [hasAtty]);

  React.useEffect(() => {
    fetch("/api/investigations/template/info")
      .then(r => r.json()).then(setTemplateInfo).catch(() => {});
  }, []);

  const recipient = recipientMode === "attorney" ? {
    name: meta?.defense_attorney || "", organization: meta?.defense_law_firm || "",
    address: meta?.defense_address || "", claim_no: claim, date_of_loss: doi,
  } : {
    name: meta?.adjuster_name || "", organization: meta?.client_company || "",
    claim_no: claim, date_of_loss: doi,
  };

  const generate = async () => {
    setGenerating(true); setResult(null);
    try {
      const r = await fetch("/api/investigations/" + inv.id + "/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient, investigator: invName }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: r.statusText }));
        setResult({ ok: false, error: err.detail || r.statusText }); return;
      }
      const blob = await r.blob();
      const fname = ((inv.subject_name || "report").replace(/\s+/g,"_")) + "_" + claim + "_report.docx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);
      setResult({ ok: true, filename: fname });
    } catch(e) { setResult({ ok: false, error: String(e) }); }
    finally { setGenerating(false); }
  };

  const uploadTemplate = async () => {
    if (!uploadFile) { alert("Select a .docx file first"); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", uploadFile);
      const r = await fetch("/api/investigations/template/upload?gender=" + uploadGender, { method: "POST", body: fd });
      const d = await r.json();
      if (d.status === "ok") {
        setResult({ ok: true, filename: "Template updated: " + d.filename });
        fetch("/api/investigations/template/info").then(r => r.json()).then(setTemplateInfo);
        setUploadFile(null);
      } else { setResult({ ok: false, error: JSON.stringify(d) }); }
    } catch(e) { setResult({ ok: false, error: String(e) }); }
    finally { setUploading(false); }
  };

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>

      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: txt, margin: "0 0 4px" }}>Report Template</p>
        <p style={{ fontSize: 12, color: sec, margin: 0 }}>Generate the Word report using the official Prodigy template.</p>
      </div>

      {templateInfo && (
        <div style={{ display: "flex", gap: 10 }}>
          {["male","female"].map((g: string) => {
            const info = (templateInfo as any)[g] || {};
            const isUsed = g === templateUsed;
            return (
              <div key={g} style={{ flex: 1, border: "2px solid " + (isUsed ? acc : bdr),
                borderRadius: 8, padding: "10px 14px",
                background: isUsed ? (isDark ? "rgba(59,130,246,0.08)" : "#eff6ff") : bg2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isUsed ? acc : sec,
                  textTransform: "uppercase" as any, letterSpacing: "0.07em", marginBottom: 4 }}>
                  {g === "male" ? "Male" : "Female"}{isUsed ? " ← this case" : ""}
                </div>
                {info.exists
                  ? <><div style={{ fontSize: 12, color: txt }}>{info.size_kb} KB</div>
                      <div style={{ fontSize: 10, color: sec, marginTop: 2 }}>Modified {info.modified}</div></>
                  : <div style={{ fontSize: 12, color: "#ef4444" }}>Missing</div>}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: sec, textTransform: "uppercase" as any, letterSpacing: "0.07em", margin: 0 }}>Address report to</p>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "attorney", label: "Defense Attorney", icon: "⚖️", available: hasAtty, sub: hasAtty ? (meta?.defense_attorney||"") : "No attorney on file" },
            { id: "adjuster", label: "Claims Adjuster",  icon: "🏢", available: true,    sub: meta?.adjuster_name || meta?.client_company || "" },
          ].map((opt: any) => (
            <div key={opt.id} onClick={() => opt.available && setRecipientMode(opt.id)}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, cursor: opt.available ? "pointer" : "not-allowed",
                border: "2px solid " + (recipientMode === opt.id ? acc : bdr),
                background: !opt.available ? bg2 : recipientMode === opt.id ? (isDark ? "rgba(59,130,246,0.08)" : "#eff6ff") : bg1,
                opacity: opt.available ? 1 : 0.45 }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: recipientMode === opt.id ? acc : txt }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: sec, marginTop: 2 }}>{opt.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ background: bg2, border: "1px solid " + bdr, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: sec, textTransform: "uppercase" as any, letterSpacing: "0.06em", margin: "0 0 6px" }}>Addressed to</p>
          <div style={{ color: txt, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600 }}>{recipient.name || <span style={{color:sec}}>Name missing — add in {recipientMode === "attorney" ? "Client" : "Client"} tab</span>}</div>
            <div>{recipient.organization}</div>
            {recipient.address && <div style={{ color: sec }}>{recipient.address}</div>}
            <div style={{ marginTop: 4, color: sec }}>Claim # {claim || "—"} &nbsp;·&nbsp; DOI {doi || "—"}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: sec, textTransform: "uppercase" as any, letterSpacing: "0.07em", margin: 0 }}>Investigating officer</p>
        <div style={{ fontSize: 13, color: txt, padding: "8px 12px", background: bg2, border: "1px solid " + bdr, borderRadius: 6 }}>
          {invName}<span style={{ fontSize: 11, color: sec, marginLeft: 8 }}>(from case assignment)</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={generate} disabled={generating}
          style={{ padding: "11px 24px", background: generating ? "#9ca3af" : acc,
            color: "white", border: "none", borderRadius: 8, fontSize: 13,
            fontWeight: 700, cursor: generating ? "wait" : "pointer" }}>
          {generating ? "Generating..." : "Generate & Download Report"}
        </button>
        <span style={{ fontSize: 11, color: sec }}>Downloads as .docx</span>
      </div>

      {result && (
        <div style={{ padding: "12px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: result.ok ? "#f0fdf4" : "#fef2f2",
          color: result.ok ? "#166534" : "#991b1b",
          border: "1px solid " + (result.ok ? "#bbf7d0" : "#fecaca") }}>
          {result.ok ? ("Download started: " + result.filename) : ("Error: " + result.error)}
        </div>
      )}

      <div style={{ height: 1, background: bdr }}/>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: sec, textTransform: "uppercase" as any, letterSpacing: "0.07em", margin: 0 }}>Update Template (Admin)</p>
        <p style={{ fontSize: 12, color: sec, margin: 0 }}>Upload a new .docx to replace the current template. Previous version is backed up automatically.</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as any }}>
          <select value={uploadGender} onChange={(e:any) => setUploadGender(e.target.value)}
            style={{ padding: "7px 10px", border: "1px solid " + bdr, borderRadius: 6, fontSize: 13, background: bg1, color: txt }}>
            <option value="male">Male template</option>
            <option value="female">Female template</option>
          </select>
          <input type="file" accept=".docx"
            onChange={(e:any) => setUploadFile(e.target.files?.[0] || null)}
            style={{ fontSize: 12, color: txt }}/>
          <button onClick={uploadTemplate} disabled={uploading || !uploadFile}
            style={{ padding: "7px 16px", background: uploading || !uploadFile ? "#9ca3af" : "#475569",
              color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: uploading || !uploadFile ? "not-allowed" : "pointer" }}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailTab({ inv, meta, isDark, acc, sec, txt, bg1, bg2, bdr }: any) {
  const [emailType, setEmailType]     = React.useState("confirmation");
  const [generating, setGenerating]   = React.useState(false);
  const [sending, setSending]         = React.useState(false);
  const [draft, setDraft]             = React.useState<any>(null);
  const [editBody, setEditBody]       = React.useState("");
  const [editSubject, setEditSubject] = React.useState("");
  const [editTo, setEditTo]           = React.useState("");
  const [editCc, setEditCc]           = React.useState("");
  const [sendResult, setSendResult]   = React.useState<any>(null);

  const EMAIL_TYPES = [
    { id: "confirmation",   label: "Confirmation of Receipt",  icon: "✅", desc: "Confirm we received the assignment" },
    { id: "update",         label: "Surveillance Update",       icon: "🔄", desc: "Update on surveillance progress" },
    { id: "report_only",    label: "Report Only",              icon: "📋", desc: "To attorney (if any) + adjuster. Invoice sent separately." },
    { id: "invoice_only",   label: "Invoice Only",             icon: "💰", desc: "Invoice only to adjuster — no report attached" },
    { id: "report_invoice", label: "Report + Invoice",         icon: "📦", desc: "To adjuster when no attorney on file" },
  ];

  const hasAtty = !!(meta?.defense_attorney && meta?.defense_law_firm);

  const generate = async () => {
    setGenerating(true);
    setSendResult(null);
    setDraft(null);
    try {
      const r = await fetch(`/api/investigations/${inv.id}/email/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_type: emailType }),
      });
      const d = await r.json();
      setDraft(d);
      setEditBody(d.body_text || "");
      setEditSubject(d.subject || "");
      setEditTo((d.recipients?.to || []).join(", "));
      setEditCc((d.recipients?.cc || []).join(", "));
    } catch(e) {
      setDraft({ error: String(e) });
    } finally {
      setGenerating(false);
    }
  };

  const send = async () => {
    if (!editTo.trim()) { alert("Add at least one recipient email"); return; }
    // Approval flow: submit for review instead of direct send
    setSending(true);
    setSendResult(null);
    try {
      const bodyHtml = editBody.split("\n").map((l: string) =>
        l.trim() ? `<p style="margin:0 0 10px">${l}</p>` : "<br/>").join("");
      const r = await fetch(`/api/investigations/${inv.id}/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editSubject,
          body_html: bodyHtml,
          email_type: emailType,
          to: editTo.split(",").map((s: string) => s.trim()).filter(Boolean),
          cc: editCc.split(",").map((s: string) => s.trim()).filter(Boolean),
        }),
      });
      const d = await r.json();
      setSendResult(d);
    } catch(e) {
      setSendResult({ ok: false, error: String(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: txt, margin: "0 0 4px" }}>Case Email</p>
        <p style={{ fontSize: 12, color: sec, margin: 0 }}>
          AI drafts the email — review and edit before sending. Sent from assign@factsnotfiction.com
        </p>
      </div>

      <div style={{ background: bg2, border: `1px solid ${bdr}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: sec }}>
        {hasAtty
          ? <span>⚖️ <strong style={{color:txt}}>Defense attorney on file</strong> — Report Only goes to attorney + adjuster. Invoice Only to adjuster separately.</span>
          : <span>📋 <strong style={{color:txt}}>No defense attorney</strong> — Report + Invoice goes to adjuster.</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: sec, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Select email type</p>
        {EMAIL_TYPES.map((et: any) => (
          <div key={et.id}
            onClick={() => { setEmailType(et.id); setDraft(null); setSendResult(null); }}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
              borderRadius: 8, cursor: "pointer",
              border: `2px solid ${emailType === et.id ? acc : bdr}`,
              background: emailType === et.id ? (isDark ? "rgba(59,130,246,0.1)" : "#eff6ff") : bg1 }}>
            <span style={{ fontSize: 18 }}>{et.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: emailType === et.id ? acc : txt }}>{et.label}</div>
              <div style={{ fontSize: 11, color: sec, marginTop: 2 }}>{et.desc}</div>
            </div>
            {emailType === et.id && <span style={{ color: acc }}>●</span>}
          </div>
        ))}
      </div>

      <button onClick={generate} disabled={generating}
        style={{ padding: "10px 20px", background: generating ? "#9ca3af" : acc,
          color: "white", border: "none", borderRadius: 8, fontSize: 13,
          fontWeight: 600, cursor: generating ? "wait" : "pointer", alignSelf: "flex-start" }}>
        {generating ? "✨ Generating..." : "✨ Generate Draft"}
      </button>

      {draft && !draft.error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, border: `1px solid ${bdr}`,
          borderRadius: 10, padding: "16px 18px", background: bg2 }}>

          <p style={{ fontSize: 12, fontWeight: 700, color: sec, textTransform: "uppercase",
            letterSpacing: "0.07em", margin: 0 }}>Review & Edit Before Sending</p>

          {draft.attorney_email_needed && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6,
              padding: "8px 12px", fontSize: 12, color: "#c2410c" }}>
              ⚠️ Defense attorney on file but no email address — add it manually in the To field below.
            </div>
          )}

          {[
            { label: "Subject", val: editSubject, set: setEditSubject, rows: 1 },
            { label: "To",      val: editTo,      set: setEditTo,      rows: 1, hint: "email@example.com, another@example.com" },
            { label: "CC",      val: editCc,      set: setEditCc,      rows: 1, hint: "optional..." },
          ].map(({ label, val, set, hint }: any) => (
            <div key={label}>
              <p style={{ fontSize: 11, fontWeight: 600, color: sec, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
              <input value={val} onChange={(e: any) => set(e.target.value)} placeholder={hint}
                style={{ width: "100%", padding: "7px 10px", border: `1px solid ${bdr}`, borderRadius: 6,
                  fontSize: 13, background: bg1, color: txt, outline: "none", boxSizing: "border-box" as any }}/>
            </div>
          ))}

          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: sec, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Body</p>
            <textarea value={editBody} onChange={(e: any) => setEditBody(e.target.value)} rows={14}
              style={{ width: "100%", padding: "10px", border: `1px solid ${bdr}`, borderRadius: 6,
                fontSize: 12.5, background: bg1, color: txt, outline: "none",
                lineHeight: 1.6, resize: "vertical" as any, fontFamily: "inherit", boxSizing: "border-box" as any }}/>
          </div>

          {sendResult && (
            <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: sendResult.ok ? (sendResult.queued ? "#fff7ed" : "#f0fdf4") : "#fef2f2",
              color: sendResult.ok ? "#166534" : "#991b1b",
              border: `1px solid ${sendResult.ok ? (sendResult.queued ? "#fed7aa" : "#bbf7d0") : "#fecaca"}` }}>
              {sendResult.ok
                ? `✅ Email sent to ${(sendResult.to || []).join(", ")}`
                : `❌ Send failed: ${sendResult.error}`}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={send} disabled={sending}
              style={{ padding: "10px 24px", background: sending ? "#9ca3af" : "#166534",
                color: "white", border: "none", borderRadius: 8, fontSize: 13,
                fontWeight: 700, cursor: sending ? "wait" : "pointer" }}>
              {sending ? "Submitting…" : "📤 Submit for approval"}
            </button>
            <button onClick={() => { setDraft(null); setSendResult(null); }}
              style={{ padding: "10px 16px", background: "transparent", color: sec,
                border: `1px solid ${bdr}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
              Discard
            </button>
          </div>
        </div>
      )}

      {draft?.error && (
        <div style={{ padding: "12px 14px", background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 8, fontSize: 12, color: "#991b1b" }}>
          ❌ Error: {draft.error}
        </div>
      )}
    </div>
  );
}


function build3DViewerHTML(verts: any[], faces: any[], vertCount: number, photosUsed: number): string {
  const vertsJson = JSON.stringify(verts);
  const html = `<!DOCTYPE html>
<html><head><title>3D Face</title>
<style>
  body { margin:0; background:#06060e; overflow:hidden; }
  canvas { display:block; }
  #info { position:fixed; bottom:12px; left:50%; transform:translateX(-50%);
    color:rgba(160,185,240,0.7); font:12px system-ui; white-space:nowrap; }
  #err { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    color:#f87171; font:14px system-ui; display:none; }
</style></head><body>
<canvas id=c></canvas>
<div id=info>Drag to rotate · Scroll to zoom · ${vertCount} pts · ${photosUsed} photo(s)</div>
<div id=err></div>
<script>
var verts = ${vertsJson};

var c = document.getElementById('c');
c.width = window.innerWidth;
c.height = window.innerHeight;
window.addEventListener('resize', function() {
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  if (gl) gl.viewport(0, 0, c.width, c.height);
});

var gl = c.getContext('webgl');
if (!gl) {
  document.getElementById('err').style.display = 'block';
  document.getElementById('err').textContent = 'WebGL not supported';
} else {
  var vert_src = [
    'attribute vec3 aPos;',
    'uniform float uRotX;',
    'uniform float uRotY;',
    'uniform float uZoom;',
    'varying float vZ;',
    'void main() {',
    '  float cx = cos(uRotX); float sx = sin(uRotX);',
    '  float cy = cos(uRotY); float sy = sin(uRotY);',
    '  vec3 p = aPos;',
    '  // rotate Y',
    '  float px = p.x * cy + p.z * sy;',
    '  float pz = -p.x * sy + p.z * cy;',
    '  p = vec3(px, p.y, pz);',
    '  // rotate X',
    '  float py2 = p.y * cx - p.z * sx;',
    '  float pz2 = p.y * sx + p.z * cx;',
    '  p = vec3(p.x, py2, pz2);',
    '  // perspective',
    '  float z = p.z + uZoom;',
    '  float asp = float(' + Math.round(window.innerWidth) + ') / float(' + Math.round(window.innerHeight) + ');',
    '  gl_Position = vec4(p.x / (asp * z * 0.6), p.y / (z * 0.6), p.z * 0.1, 1.0);',
    '  gl_PointSize = max(1.5, 3.0 - z * 0.5);',
    '  vZ = pz2;',
    '}'
  ].join('
');

  var frag_src = [
    'precision mediump float;',
    'varying float vZ;',
    'void main() {',
    '  float t = clamp((vZ + 1.0) / 2.0, 0.0, 1.0);',
    '  vec3 col = mix(vec3(0.15, 0.35, 0.95), vec3(0.95, 0.72, 0.52), t);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('
');

  function makeShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var prog = gl.createProgram();
  gl.attachShader(prog, makeShader(gl.VERTEX_SHADER, vert_src));
  gl.attachShader(prog, makeShader(gl.FRAGMENT_SHADER, frag_src));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Link error:', gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);

  var flat = [];
  for (var i = 0; i < verts.length; i++) {
    flat.push(verts[i][0], verts[i][1], verts[i][2]);
  }

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flat), gl.STATIC_DRAW);

  var aPosLoc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 0, 0);

  var uRotX = gl.getUniformLocation(prog, 'uRotX');
  var uRotY = gl.getUniformLocation(prog, 'uRotY');
  var uZoom = gl.getUniformLocation(prog, 'uZoom');

  var rotX = -0.15, rotY = 0.0, zoom = 2.5;
  var drag = false, lastX = 0, lastY = 0;

  c.addEventListener('mousedown', function(e) { drag=true; lastX=e.clientX; lastY=e.clientY; });
  window.addEventListener('mouseup', function() { drag=false; });
  window.addEventListener('mousemove', function(e) {
    if (!drag) return;
    rotY += (e.clientX - lastX) * 0.01;
    rotX += (e.clientY - lastY) * 0.01;
    rotX = Math.max(-1.4, Math.min(1.4, rotX));
    lastX = e.clientX; lastY = e.clientY;
  });
  c.addEventListener('wheel', function(e) {
    zoom = Math.max(0.8, Math.min(6.0, zoom + e.deltaY * 0.005));
    e.preventDefault();
  }, { passive: false });

  function draw() {
    gl.viewport(0, 0, c.width, c.height);
    gl.clearColor(0.024, 0.024, 0.055, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.uniform1f(uRotX, rotX);
    gl.uniform1f(uRotY, rotY);
    gl.uniform1f(uZoom, zoom);
    gl.drawArrays(gl.POINTS, 0, verts.length);
    requestAnimationFrame(draw);
  }
  draw();
}
</script></body></html>`;
  return html;
}


// ── Face3D inline viewer ─────────────────────────────────────────────────────
function Face3DViewer({ base, invId, onFullscreen }: {
  base: string; invId: number; onFullscreen: () => void;
}) {
  const [frames, setFrames] = React.useState<string[]>([]);
  const [idx, setIdx]       = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError]   = React.useState(false);
  const dragRef = React.useRef<{dragging:boolean;startX:number;startIdx:number}>({
    dragging:false, startX:0, startIdx:0
  });

  React.useEffect(() => {
    if (!invId) return;
    setLoading(true); setError(false);
    const url = `${base}/api/face3d/gif/${invId}`;
    fetch(url, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        if (!d.frames || d.frames.length === 0) throw new Error("no frames");
        setFrames(d.frames); setIdx(0); setLoading(false);
      })
      .catch(e => { console.error("face3d fetch failed:", url, e); setError(true); setLoading(false); });
  }, [invId]);

  const n = frames.length;
  const sensitivity = n / 360;
  const dragRef2 = React.useRef({ dragging: false, startX: 0, startIdx: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef2.current = { dragging: true, startX: e.clientX, startIdx: idx };
    e.preventDefault();
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef2.current.dragging || !n) return;
    const delta = e.clientX - dragRef2.current.startX;
    const newIdx = ((Math.round(dragRef2.current.startIdx + delta * sensitivity) % n) + n) % n;
    setIdx(newIdx);
  };
  const onMouseUp = () => { dragRef2.current.dragging = false; };
  const onWheel = (e: React.WheelEvent) => {
    if (!n) return;
    setIdx(i => ((i + (e.deltaY > 0 ? 1 : -1) + n) % n));
    e.preventDefault();
  };

  if (loading) return (
    <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",
      justifyContent:"center",background:"#0a0a12",color:"rgba(150,180,220,0.7)",
      fontSize:11,fontFamily:"system-ui" }}>
      ⏳ Building 3D model…
    </div>
  );
  if (error || (!loading && !frames.length)) return (
    <div style={{ width:"100%",height:"100%",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",background:"#0a0a12",
      color:"#f87171",fontSize:11,gap:4 }}>
      <span>No face detected</span>
      <span style={{fontSize:9,color:"rgba(200,100,100,0.5)"}}>Check console for details</span>
    </div>
  );
  return (
    <img
      src={`data:image/jpeg;base64,${frames[idx]}`}
      alt="3D Face"
      draggable={false}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
      onClick={onFullscreen}
      style={{ width:"100%",height:"100%",objectFit:"contain",
        background:"#0a0a12",cursor:"grab",userSelect:"none",display:"block" }}
      title="Drag to rotate · Scroll · Click fullscreen"
    />
  );
}


// ── PatternOfLifePanel — editable inline intel for investigators ──────────────
function PatternOfLifePanel({ inv, base, subjectIntel, intelLoading, setSubjectIntel,
  acc, sec, txt, bg1, bg2, bdr, mut }: any) {

  // Save a single field to backend and update local state
  const saveIntel = React.useCallback(async (field: string, value: any) => {
    if (!inv?.id) return;
    try {
      const r = await fetch(`${base}/api/investigations/${inv.id}/subject-profile/intel`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (r.ok) {
        setSubjectIntel((prev: any) => prev ? {
          ...prev,
          intel: { ...(prev.intel || {}), [field]: value }
        } : prev);
      }
    } catch {}
  }, [inv?.id, base]);

  // Inline editable text field — click to edit, blur/enter to save
  const IntelField = ({ field, label, value, multiline = false, placeholder = "— tap to add" }: {
    field: string; label: string; value: string|null|undefined;
    multiline?: boolean; placeholder?: string;
  }) => {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(value || "");
    React.useEffect(() => { setDraft(value || ""); }, [value]);

    const commit = () => {
      setEditing(false);
      if (draft !== (value || "")) saveIntel(field, draft || null);
    };

    if (editing) {
      return (
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          <span style={{fontSize:10,color:sec,textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600}}>{label}</span>
          {multiline ? (
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              rows={3}
              style={{fontSize:12,color:txt,background:bg1,border:`1px solid ${acc}`,
                borderRadius:6,padding:"6px 8px",resize:"vertical",width:"100%",
                fontFamily:"inherit",outline:"none"}}
            />
          ) : (
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key==="Enter") commit(); if (e.key==="Escape") setEditing(false); }}
              style={{fontSize:12,color:txt,background:bg1,border:`1px solid ${acc}`,
                borderRadius:6,padding:"5px 8px",width:"100%",fontFamily:"inherit",outline:"none"}}
            />
          )}
        </div>
      );
    }
    return (
      <div style={{display:"flex",flexDirection:"column",gap:2,cursor:"pointer"}}
        onClick={() => setEditing(true)}>
        <span style={{fontSize:10,color:sec,textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600}}>{label}</span>
        <span style={{fontSize:12,color:value ? txt : mut,fontStyle:value?"normal":"italic",
          padding:"4px 6px",borderRadius:5,border:`1px solid transparent`,
          transition:"border 0.1s",background:"transparent"}}
          onMouseEnter={e => (e.currentTarget.style.borderColor=bdr)}
          onMouseLeave={e => (e.currentTarget.style.borderColor="transparent")}>
          {value || placeholder}
        </span>
      </div>
    );
  };

  // Select field
  const IntelSelect = ({ field, label, value, options }: {
    field: string; label: string; value: string|null|undefined;
    options: string[];
  }) => (
    <div style={{display:"flex",flexDirection:"column",gap:2}}>
      <span style={{fontSize:10,color:sec,textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600}}>{label}</span>
      <select
        value={value || ""}
        onChange={e => saveIntel(field, e.target.value || null)}
        style={{fontSize:12,color:value?txt:mut,background:bg1,border:`1px solid ${bdr}`,
          borderRadius:6,padding:"5px 8px",cursor:"pointer",outline:"none",fontFamily:"inherit"}}>
        <option value="">— select</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  if (intelLoading) return (
    <div style={{fontSize:12,color:sec,textAlign:"center",padding:24}}>⏳ Loading…</div>
  );

  const intel = subjectIntel?.intel || {};
  const stats = subjectIntel?.stats || {};
  const profile = subjectIntel?.profile || {};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10,overflowY:"auto",
      maxHeight:"calc(100vh - 280px)"}}>

      {/* ── Surveillance stats (read-only) ── */}
      {(stats.total_days > 0 || profile.total_cases > 0) && (
        <div style={{background:bg2,borderRadius:10,padding:12,border:`1px solid ${bdr}`}}>
          <div style={{fontSize:11,fontWeight:600,color:acc,marginBottom:8,
            textTransform:"uppercase",letterSpacing:"0.05em"}}>Surveillance history</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
            {[
              ["Days worked",   stats.total_days ?? "—"],
              ["Observed",      stats.observed_days ?? "—"],
              ["Observed %",    stats.total_days
                ? Math.round(((stats.observed_days||0)/(stats.total_days||1))*100)+"%" : "—"],
              ["Not observed",  stats.not_observed_days ?? "—"],
              ["First surv.",   (stats.first_surv||stats.first_day)?.slice(0,10) ?? "—"],
              ["Last surv.",    (stats.last_surv||stats.last_day)?.slice(0,10)   ?? "—"],
              ["OSINT cases",   profile.total_cases ?? "—"],
              ["Findings",      profile.total_findings ?? "—"],
              ["Photos",        profile.total_photos ?? "—"],
            ].map(([label, val]) => (
              <div key={label as string} style={{textAlign:"center",background:bg1,
                borderRadius:8,padding:"8px 4px"}}>
                <div style={{fontSize:15,fontWeight:600,color:txt}}>{val}</div>
                <div style={{fontSize:10,color:sec,marginTop:1}}>{label}</div>
              </div>
            ))}
          </div>
          {stats.has_pipeline_data && (
            <div style={{fontSize:10,color:sec,marginTop:4,textAlign:"right",fontStyle:"italic"}}>
              Surveillance days from PDF pipeline
            </div>
          )}
        </div>
      )}

      {/* ── Daily schedule ── */}
      <div style={{background:bg2,borderRadius:10,padding:12,border:`1px solid ${bdr}`}}>
        <div style={{fontSize:11,fontWeight:600,color:acc,marginBottom:10,
          textTransform:"uppercase",letterSpacing:"0.05em"}}>Daily schedule</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <IntelField field="usual_departure_time" label="Departure time"
            value={intel.usual_departure_time} placeholder="e.g. 7:00–8:30 AM" />
          <IntelField field="usual_return_time" label="Return time"
            value={intel.usual_return_time} placeholder="e.g. 5:00–6:00 PM" />
          <IntelField field="work_schedule" label="Work schedule"
            value={intel.work_schedule} placeholder="e.g. Mon–Fri 8am–5pm" />
          <IntelSelect field="activity_level" label="Activity level"
            value={intel.activity_level}
            options={["very_active","active","moderate","sedentary","unknown"]} />
        </div>
      </div>

      {/* ── Field intel — critical for investigators ── */}
      <div style={{background:bg2,borderRadius:10,padding:12,border:`1px solid ${bdr}`}}>
        <div style={{fontSize:11,fontWeight:600,color:acc,marginBottom:10,
          textTransform:"uppercase",letterSpacing:"0.05em"}}>Field intel</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <IntelField field="approach_warnings" label="⚠ Approach warnings"
            value={intel.approach_warnings} multiline
            placeholder="Aware of surveillance, confrontational, calls police…" />
          <IntelField field="surveillance_tips" label="💡 Surveillance tips"
            value={intel.surveillance_tips} multiline
            placeholder="Best parking on Oak St, use south side entrance…" />
          <IntelField field="security_notes" label="🔒 Security"
            value={intel.security_notes} multiline
            placeholder="Ring camera on front door, dog in backyard, gated community…" />
          <IntelField field="neighbor_notes" label="🏘 Neighbor notes"
            value={intel.neighbor_notes}
            placeholder="Nosy neighbor at #12, cooperative property manager…" />
        </div>
      </div>

      {/* ── Lifestyle + pattern ── */}
      <div style={{background:bg2,borderRadius:10,padding:12,border:`1px solid ${bdr}`}}>
        <div style={{fontSize:11,fontWeight:600,color:acc,marginBottom:10,
          textTransform:"uppercase",letterSpacing:"0.05em"}}>Pattern of life</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <IntelField field="lifestyle_notes" label="Lifestyle / hobbies observed"
            value={intel.lifestyle_notes} multiline
            placeholder="Coaches soccer Saturday mornings, goes to gym Tue/Thu…" />
          <IntelField field="social_circle_notes" label="Social circle"
            value={intel.social_circle_notes} multiline
            placeholder="Seen with wife and two kids, friend group at BBQs…" />
          <IntelField field="pet_notes" label="Pets"
            value={intel.pet_notes}
            placeholder="Large black dog, walks daily ~6:30 AM…" />
          <IntelField field="evasion_behavior" label="Evasion behavior"
            value={intel.evasion_behavior} multiline
            placeholder="Checks mirrors frequently, varies routes, uses back door…" />
          <IntelField field="general_intel" label="General notes"
            value={intel.general_intel} multiline
            placeholder="Any other intelligence useful for field investigators…" />
        </div>
      </div>

      {/* ── Surveillance summaries from all cases ── */}
      {(subjectIntel?.summaries?.length ?? 0) > 0 && (
        <div style={{background:bg2,borderRadius:10,padding:12,border:`1px solid ${bdr}`}}>
          <div style={{fontSize:11,fontWeight:600,color:acc,marginBottom:8,
            textTransform:"uppercase",letterSpacing:"0.05em"}}>
            Surveillance summaries ({subjectIntel.summaries.length})
          </div>
          {(subjectIntel.summaries as any[]).map((s: any) => (
            <div key={s.id} style={{marginBottom:10,paddingBottom:10,
              borderBottom:`1px solid ${bdr}`}}>
              <div style={{display:"flex",justifyContent:"space-between",
                alignItems:"baseline",marginBottom:4}}>
                <span style={{fontSize:11,color:txt,fontWeight:600}}>
                  {s.subject?.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/,'')
                    .replace(/\s*:\s*Leonard.*$/,'').slice(0,60)}
                </span>
                <span style={{fontSize:10,color:sec,flexShrink:0,marginLeft:8}}>
                  {s.date}
                </span>
              </div>
              {s.body && (
                <div style={{fontSize:11,color:sec,lineHeight:1.5}}>
                  {s.body.slice(0,250)}{s.body.length > 250 ? "…" : ""}
                </div>
              )}
              {s.vehicles && Array.isArray(s.vehicles) && s.vehicles.length > 0 && (
                <div style={{marginTop:4,fontSize:11}}>
                  {(s.vehicles as any[]).map((v: any, i: number) => (
                    <span key={i} style={{display:"inline-block",marginRight:6,
                      background:bg1,border:`1px solid ${bdr}`,
                      borderRadius:4,padding:"1px 6px",color:txt}}>
                      🚗 {[v.year,v.color,v.make,v.model].filter(Boolean).join(" ")}
                      {v.plate ? ` · ${v.plate}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Surveillance summaries from all cases ── */}
      {(subjectIntel?.summaries?.length ?? 0) > 0 && (
        <div style={{background:bg2,borderRadius:10,padding:12,border:`1px solid ${bdr}`}}>
          <div style={{fontSize:11,fontWeight:600,color:acc,marginBottom:8,
            textTransform:"uppercase",letterSpacing:"0.05em"}}>
            Surveillance summaries ({subjectIntel.summaries.length})
          </div>
          {(subjectIntel.summaries as any[]).map((s: any) => (
            <div key={s.id} style={{marginBottom:10,paddingBottom:10,
              borderBottom:`1px solid ${bdr}`}}>
              <div style={{display:"flex",justifyContent:"space-between",
                alignItems:"baseline",marginBottom:4}}>
                <span style={{fontSize:11,color:txt,fontWeight:600}}>
                  {(s.subject||"").replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/,"")
                    .replace(/\s*:\s*[\w\s]+$/,"").slice(0,65)}
                </span>
                <span style={{fontSize:10,color:sec,flexShrink:0,marginLeft:8}}>{s.date}</span>
              </div>
              {s.body && (
                <div style={{fontSize:11,color:sec,lineHeight:1.5}}>
                  {s.body.slice(0,280)}{s.body.length>280?"…":""}
                </div>
              )}
              {s.vehicles && Array.isArray(s.vehicles) && s.vehicles.length > 0 && (
                <div style={{marginTop:4,display:"flex",flexWrap:"wrap" as any,gap:4}}>
                  {(s.vehicles as any[]).map((v: any, i: number) => (
                    <span key={i} style={{fontSize:10,background:bg1,border:`1px solid ${bdr}`,
                      borderRadius:4,padding:"1px 6px",color:txt}}>
                      {[v.year,v.color,v.make,v.model].filter(Boolean).join(" ")}
                      {v.plate ? " · "+v.plate : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Prior cases ── */}
      {(subjectIntel?.investigations?.length ?? 0) > 1 && (
        <div style={{background:bg2,borderRadius:10,padding:12,border:`1px solid ${bdr}`}}>
          <div style={{fontSize:11,fontWeight:600,color:acc,marginBottom:8,
            textTransform:"uppercase",letterSpacing:"0.05em"}}>Prior cases</div>
          {(subjectIntel.investigations as any[])
            .filter((c: any) => c.id !== inv?.id)
            .slice(0,6)
            .map((c: any) => (
            <div key={c.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",
              gap:4,fontSize:11,padding:"5px 0",borderBottom:`1px solid ${bdr}`,
              alignItems:"center"}}>
              <span style={{color:txt,fontWeight:500}}>
                #{c.id} — {c.investigation_type?.replace("_"," ")}
              </span>
              <span style={{color:sec}}>{c.claim_number || "—"}</span>
              <span style={{color:sec}}>{String(c.created_at||"").slice(0,10)}</span>
              <span style={{color:c.findings_count>0?"#22c55e":mut,fontWeight:600}}>
                {c.findings_count} findings
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}


// ── SocialUsernamesField ─────────────────────────────────────────────────────
// Self-contained component with local optimistic state to avoid stale-inv bugs
function SocialUsernamesField({ inv, acc, mut, onSave }: {
  inv: any; acc: string; mut: string;
  onSave?: (field: string, value: any) => void;
}) {
  const base = typeof window !== "undefined" &&
    !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";

  // Local state — initialised from inv, updated optimistically on add/remove
  const [localUsernames, setLocalUsernames] = React.useState<string[]>(() =>
    (inv?.subject_usernames || []).map((u: string) => u.replace(/^@/,""))
  );

  // Sync when inv changes from outside (e.g. refetch)
  React.useEffect(() => {
    setLocalUsernames((inv?.subject_usernames || []).map((u: string) => u.replace(/^@/,"")));
  }, [inv?.subject_usernames?.join(",")]);

  const saveUsernames = async (newList: string[]) => {
    setLocalUsernames(newList); // optimistic
    try {
      await fetch(`${base}/api/investigations/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject_usernames: newList }),
      });
      onSave?.("subject_usernames", newList);
    } catch {
      // revert on error
      setLocalUsernames((inv?.subject_usernames || []).map((u: string) => u.replace(/^@/,"")));
    }
  };

  const addUsername = (u: string) => {
    const clean = u.replace(/^@/,"").trim();
    if (!clean || localUsernames.includes(clean)) return;
    saveUsernames([...localUsernames, clean]);
  };

  const removeUsername = (u: string) => {
    saveUsernames(localUsernames.filter(x => x !== u));
  };

  // Suggestions: email prefixes not yet in list
  const suggestions = (inv?.subject_emails || [])
    .map((e: string) => e.split("@")[0].toLowerCase().trim())
    .filter((u: string) => u && u.length > 2 && !localUsernames.includes(u));

  const [newVal, setNewVal] = React.useState("");

  return (
    <div style={{ padding: "10px 14px" }}>
      <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em",
                  color: mut, fontWeight: 700, margin: "0 0 8px" }}>
        Social usernames {localUsernames.length > 0 && <span style={{ color: acc }}>({localUsernames.length})</span>}
      </p>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: mut, marginRight: 2 }}>Suggested:</span>
          {suggestions.map(u => (
            <button key={u}
              onClick={e => { e.preventDefault(); e.stopPropagation(); addUsername(u); }}
              style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, cursor: "pointer",
                background: `${acc}15`, border: `1px dashed ${acc}`, color: acc }}>
              + @{u}
            </button>
          ))}
        </div>
      )}

      {/* Existing usernames */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {localUsernames.map(u => (
          <span key={u} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 20,
            background: `${acc}20`, color: acc, display: "flex", alignItems: "center", gap: 4 }}>
            @{u}
            <span onClick={() => removeUsername(u)}
              style={{ cursor: "pointer", fontSize: 10, opacity: 0.7, fontWeight: 700 }}>×</span>
          </span>
        ))}
      </div>

      {/* Add new */}
      <div style={{ display: "flex", gap: 4 }}>
        <input
          value={newVal}
          onChange={e => setNewVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { addUsername(newVal); setNewVal(""); } }}
          placeholder="Add username..."
          style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, flex: 1,
            border: "1px solid var(--border)", background: "var(--surface-1)",
            color: "var(--text-primary)" }}
        />
        <button onClick={() => { addUsername(newVal); setNewVal(""); }}
          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, cursor: "pointer",
            background: acc, color: "white", border: "none" }}>
          Add
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function InvestigationTabs({ inv, userRole = "investigator", canViewPii = false, piiClosedCases = false, onSave, layout }: Props) {
  const { editMode: globalEditMode, toggleEditMode: toggleGlobalEdit } = useGridEditMode();
  const activeLayout = layout?.length ? layout : DEFAULT_LAYOUT;
  const [tab, setTab] = useState("subject");
  const [subjectPhoto, setSubjectPhoto] = useState<any>(null);
  const [heroView, setHeroView]     = useState<"subject"|"map"|"summary"|"canvass"|"description"|"pattern">("subject");
  const [subjectIntel, setSubjectIntel] = useState<any>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [survDays, setSurvDays]     = useState<any[]|null>(null);
  const [survDaysInvId, setSurvDaysInvId] = useState<number|null>(null);

  // Shared state between CanvassPanel (left) and CanvassRightPanel (right)
  const [canvassFacilities, setCanvassFacilities] = useState<any[]>([]);
  const [canvassResults,    setCanvassResults]    = useState<Record<string,any>>({});
  const [canvassRadius,     setCanvassRadius]     = useState(30);
  const [canvassGenerating, setCanvassGenerating] = useState(false);

  const handleCanvassRadiusChange = (r: number) => setCanvassRadius(r);

  const handleCanvassFacilitiesChange = (facs: any[], res?: Record<string,any>) => {
    setCanvassFacilities(facs);
    if (res) setCanvassResults(res);
  };

  const handleCanvassGenerate = async (overrides: Record<string,string> = {}) => {
    if (!inv?.id) return;
    setCanvassGenerating(true);
    try {
      const r = await fetch(`${base}/api/investigations/${inv.id}/canvass-report`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: canvassResults, overrides }),
      });
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const claimNo = (inv as any)?.extra_metadata?.claim_number || inv?.id;
        a.download = `canvass_report_${claimNo}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      } else { alert('Error generating report'); }
    } catch(e: any) { alert('Error: ' + e.message); }
    finally { setCanvassGenerating(false); }
  };

  // Default to canvass view for medical_canvass investigations
  useEffect(() => {
    const invType = (inv as any)?.investigation_type;
    if (invType === "medical_canvass" && heroView === "subject") {
      setHeroView("canvass");
    }
  }, [inv?.id, (inv as any)?.investigation_type]);
  const [allSubjectPhotos, setAllSubjectPhotos] = useState<any[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [showAllAddresses, setShowAllAddresses] = useState(false);

  // PII visibility rules (per Todd):
  // - admin/supervisor/medical_canvass: always see PII on open cases
  // - investigator (field): never see DOB, SSN, DL, phone, email of subject
  // - closed cases: only admin sees PII
  const isCaseClosed = inv?.status === "completed" || inv?.status === "cancelled";
  // Also show PII if the case itself is medical_canvass type (needed for canvass report)
  const invType = (inv as any)?.investigation_type || "";
  const canSeePII    = canViewPii
    || ["admin","supervisor","medical_canvass"].includes(userRole)
    || invType === "medical_canvass";
  
  // Load surveillance days when summary view is opened
  useEffect(() => {
    if (heroView !== "summary" || !inv?.id) return;
    // Reset if different case
    if (survDaysInvId !== inv.id) {
      setSurvDays(null);
      setSurvDaysInvId(inv.id);
    }
    if (survDays !== null && survDaysInvId === inv.id) return;
    const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
    fetch(`${base}/api/investigations/${inv.id}/surveillance-days`, {credentials:"include"})
      .then(r => r.json())
      .then(d => { setSurvDays(Array.isArray(d) ? d : []); setSurvDaysInvId(inv.id); })
      .catch(() => { setSurvDays([]); setSurvDaysInvId(inv.id); });
  }, [heroView, inv?.id]);

  // Load subject profile intel for description/pattern views
  React.useEffect(() => {
    if ((heroView !== "description" && heroView !== "pattern") || !inv?.id) return;
    if (subjectIntel) return;  // already loaded
    setIntelLoading(true);
    fetch(`${base}/api/investigations/${inv.id}/subject-profile`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSubjectIntel(d); setIntelLoading(false); })
      .catch(() => setIntelLoading(false));
  }, [heroView, inv?.id]);
  const showPII      = canSeePII && (!isCaseClosed || piiClosedCases || userRole === "admin");

  // Theme detection — reactive to theme changes
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? !document.documentElement.classList.contains("theme-royal") &&
        !document.documentElement.classList.contains("theme-slate")
      : true
  );
  const [isGlassState, setIsGlassState] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("theme-glass") : false
  );
  useEffect(() => {
    const check = () => {
      setIsDark(!document.documentElement.classList.contains('theme-royal') && !document.documentElement.classList.contains('theme-slate'));
      setIsGlassState(document.documentElement.classList.contains('theme-glass'));
    };
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Theme colors — derived from isDark state
  const isGlass = isGlassState;
  const _bdr = isGlass ? "rgba(255,255,255,0.13)"  : isDark ? "#5c3019" : "#e2e8f0";
  const _bg1 = isGlass ? "rgba(255,255,255,0.04)"  : isDark ? "#2e1a0e" : "#f8fafc";
  const _bg2 = isGlass ? "rgba(255,255,255,0.07)"  : isDark ? "#1a0f08" : "#ffffff";
  const _txt = isGlass ? "rgba(232,244,255,0.97)"  : isDark ? "#f5ede6" : "#1e293b";
  const _sec = isGlass ? "rgba(185,208,250,0.82)"  : isDark ? "#c4956a" : "#64748b";
  const _mut = isGlass ? "rgba(160,185,235,0.70)"  : isDark ? "#7a5030" : "#94a3b8";
  const _acc = isGlass ? "#6a8fff"                 : isDark ? "#ff6a1a" : "#6366f1";
  const [photoCarouselIdx, setPhotoCarouselIdx] = useState(0);
  const photoCarouselState: [number, React.Dispatch<React.SetStateAction<number>>] = [photoCarouselIdx, setPhotoCarouselIdx];
  const [historyTabIdx, setHistoryTabIdx] = useState("osint");
  const historyTabState: [string, React.Dispatch<React.SetStateAction<string>>] = [historyTabIdx, setHistoryTabIdx];
  const [osintFindings, setOsintFindings] = useState<any[]>([]);
  const [osintMeta, setOsintMeta] = useState<{maigret_unverified:number;total_all:number;hidden_low_conf:number}>({maigret_unverified:0,total_all:0,hidden_low_conf:0});
  const [verifyTask, setVerifyTask] = useState<{id:string;state:string;current:number;total:number;status:string}|null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [analyzingPhysical, setAnalyzingPhysical] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState("");
  const isAdmin = userRole === "admin";

  const base = typeof window !== "undefined"
    ? (!["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000")
    : "";

  async function runEnrichment() {
    setEnriching(true);
    setEnrichMsg("");
    try {
      const r = await fetch(`${base}/api/investigations/${inv?.id}/enrich-missing`, {
        method: "POST", credentials: "include"
      });
      const d = await r.json();
      setEnrichMsg(d.message || "Done — reloading…");
      setTimeout(() => setEnrichMsg(""), 6000);
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      setEnrichMsg("Error — try again");
    } finally {
      setEnriching(false);
    }
  }

  // Load vehicles
  useEffect(() => {
    if (!inv?.id) return;
    fetch(`${base}/api/investigations/${inv.id}/vehicles`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(v => { if (Array.isArray(v)) setVehicles(v); })
      .catch(() => {});
  }, [inv?.id]);

  // Load subject photos (all marked_as_subject)
  useEffect(() => {
    if (!inv?.id) return;
    fetch(`${base}/api/investigations/${inv.id}/photos`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(photos => {
        const arr = Array.isArray(photos) ? photos : photos.items || [];
        const subjectPhotos = arr
          .filter((p: any) =>
            p.marked_as_subject || p.minio_path?.includes("reference") || p.minio_path?.includes("onedrive_photos")
          )
          .map((p: any) => ({
            ...p,
            _isPrior: p.source_inv_id && p.source_inv_id !== inv?.id,
          }));
        if (subjectPhotos.length > 0) {
          setSubjectPhoto(subjectPhotos[0]);
          setAllSubjectPhotos(subjectPhotos);
        }
      })
      .catch(() => {});
  }, [inv?.id]);

  const save = (field: string) => (val: any) => onSave?.(field, val);

  const saveArrayAdd = (field: string) => (val: string) => {
    const existing = inv?.[field] || [];
    onSave?.(field, [...existing, val]);
  };
  const saveArrayRemove = (field: string) => (val: string) => {
    const existing = inv?.[field] || [];
    onSave?.(field, existing.filter((v: string) => v !== val));
  };

  const meta = (inv?.extra_metadata as any) || {};
  const usernames = (inv?.subject_usernames || []).map((u: string) => u.replace(/^@/, ""));

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>

      {/* Tab bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20, borderBottom: "2px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: "9px 18px", fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              border: "none",
              borderBottom: tab === t.id ? "2px solid var(--fill-accent)" : "2px solid transparent",
              color: tab === t.id ? "var(--text-accent)" : "var(--text-secondary)",
              background: "transparent",
              cursor: "pointer", whiteSpace: "nowrap",
              borderRadius: 0,
              marginBottom: -2,
              transition: "color 0.1s",
            }}>
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {/* Status + ID + New/Reopened badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 2 }}>
          {inv?.status && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
              background: inv.status === "completed" ? "#dcfce7" : inv.status === "active" ? "#dbeafe" : "#f1f5f9",
              color: inv.status === "completed" ? "#166534" : inv.status === "active" ? "#1e40af" : "#475569",
              border: "1px solid currentColor", borderColor: inv.status === "completed" ? "#86efac" : inv.status === "active" ? "#93c5fd" : "#cbd5e1"
            }}>
              {inv.status}
            </span>
          )}
          
        </div>
      </div>

      {/* SUBJECT */}
      {tab === "subject" && (() => {
        const bdr = _bdr, bg1 = _bg1, bg2 = _bg2, txt = _txt, sec = _sec, mut = _mut, acc = _acc;

        const Blk = ({ title, children }: { title: string; children: React.ReactNode }) => (
          <div style={{ border: `1px solid ${bdr}`, borderRadius: 8, padding: "12px 14px", background: bg2 }}>
            <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: mut, fontWeight: 700, margin: "0 0 10px" }}>{title}</p>
            {children}
          </div>
        );

        const FRow = ({ fields }: { fields: { label: string; value: string|null; key: string }[] }) => (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${fields.length}, 1fr)`, gap: 8 }}>
            {fields.map(f => <Field key={f.label} label={f.label} value={f.value} onEdit={save(f.key)} />)}
          </div>
        );

        const age = inv?.subject_dob
          ? String(new Date().getFullYear() - new Date(inv.subject_dob+"T00:00:00").getFullYear())
          : null;

        return (
          <div style={{ display: "grid", gridTemplateColumns: heroView === "canvass" ? "1fr 260px" : "1fr minmax(280px,340px)", gap: 20, alignItems: "start" }}>

            {/* LEFT */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Name + View buttons — always visible */}
              <div>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                  <div style={{flex:1}}>
                    <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 3px", color: txt }}>{inv?.subject_name}</h2>
                    {inv?.subject_aliases?.length > 0 && (
                      <p style={{ fontSize: 13, color: sec, margin: "0 0 4px" }}>AKA: {inv.subject_aliases.join(" · ")}</p>
                    )}
                    {(() => {
                      const invType = (inv as any)?.investigation_type || meta?.email_classification;
                      const caseTypes: string[] = (inv as any)?.case_types || [];
                      const badgeCfg: Record<string,{bg:string;color:string;border:string;label:string}> = {
                        surveillance:          {bg:"#dbeafe",color:"#1e40af",border:"#93c5fd",label:"🔍 Surveillance"},
                        surveillance_followup: {bg:"#fef9c3",color:"#854d0e",border:"#fde047",label:"⟳ Reopened"},
                        background:            {bg:"#f3e8ff",color:"#6b21a8",border:"#d8b4fe",label:"🔎 Background"},
                        social_background:     {bg:"#f3e8ff",color:"#6b21a8",border:"#d8b4fe",label:"🔎 Background"},
                        medical_canvass:       {bg:"#fce7f3",color:"#9d174d",border:"#f9a8d4",label:"🏥 Medical Canvass"},
                        declaration:           {bg:"#fff7ed",color:"#9a3412",border:"#fdba74",label:"📋 Declaration"},
                        field_assignment:      {bg:"#f0fdf4",color:"#166534",border:"#86efac",label:"📍 Field Assignment"},
                      };
                      // Show ALL types from case_types array, fallback to investigation_type
                      const typesToShow = caseTypes.length > 0 ? caseTypes : [invType || "surveillance"];
                      return <>{typesToShow.map((t: string) => {
                        const cfg = badgeCfg[t] || badgeCfg["surveillance"];
                        return <span key={t} style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,
                          background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.border}`,marginRight:4}}>{cfg.label}</span>;
                      })}</>;
                    })()}
                  </div>
                  <div style={{display:"flex",gap:3,background:bg1,border:"1px solid "+bdr,
                    borderRadius:10,padding:3,flexShrink:0,alignSelf:"flex-start",marginTop:2}}>
                    {(["subject","map","summary","canvass","description","pattern"] as const)
                      .filter(v => v !== "canvass" || (inv as any)?.investigation_type === "medical_canvass" || ((inv as any)?.case_types || []).includes("medical_canvass"))
                      .map(v => (
                      <button key={v}
                        onClick={() => setHeroView(v)}
                        style={{padding:"5px 10px",borderRadius:7,cursor:"pointer",
                          fontSize:11.5,fontWeight:600,border:"none",whiteSpace:"nowrap" as any,
                          background:heroView===v?acc:"transparent",
                          color:heroView===v?"white":sec,transition:"all 0.15s"}}>
                        {v==="subject"?"👤 View"
                          :v==="map"?"🗺 Map"
                          :v==="canvass"?"🏥 Canvass"
                          :v==="description"?"📋 Description"
                          :v==="pattern"?"🕐 Pattern"
                          :"📝 Summary"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description mode: the description box is already in the grid above */}

              {/* ── Pattern of Life view ── */}
              {heroView === "pattern" && (
                <PatternOfLifePanel
                  inv={inv} base={base}
                  subjectIntel={subjectIntel} intelLoading={intelLoading}
                  setSubjectIntel={setSubjectIntel}
                  acc={acc} sec={sec} txt={txt} bg1={bg1} bg2={bg2} bdr={bdr} mut={mut}
                />
              )}

              {heroView === "map" && (
                <div style={{gridColumn:"1/-1"}}>
                  <MapTab
                    inv={inv} meta={meta} isDark={isDark}
                    acc={acc} sec={sec} txt={txt}
                    bg1={bg1} bg2={bg2} bdr={bdr} mut={mut}
                    userRole={userRole}
                  />
                </div>
              )}

              {/* Summary view — replaces boxes when Summary button is active */}
              {heroView === "summary" && (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:txt }}>
                    📋 Surveillance Summaries
                    {survDays && survDays.length > 0 && (
                      <span style={{ fontSize:11, color:sec, fontWeight:400, marginLeft:8 }}>
                        {survDays.length} day(s)
                      </span>
                    )}
                  </div>
                  {survDays === null ? (
                    <div style={{ fontSize:12, color:sec, padding:16, textAlign:"center" }}>⏳ Loading…</div>
                  ) : survDays.length === 0 ? (
                    <div style={{ border:"1px solid "+bdr, borderRadius:8, padding:24,
                      textAlign:"center", background:bg2 }}>
                      <div style={{ fontSize:28, opacity:0.2, marginBottom:8 }}>📋</div>
                      <div style={{ fontSize:12, color:sec }}>No surveillance days on record</div>
                    </div>
                  ) : survDays.map((s:any, i:number) => (
                    <div key={i} style={{ border:"1px solid "+bdr, borderRadius:8,
                      padding:"10px 14px", background:bg2 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px",
                          borderRadius:20, background:acc+"22", color:acc }}>
                          Day {s.day_number||i+1}
                        </span>
                        <span style={{ fontSize:11, color:sec }}>{s.surveillance_date||""}</span>
                        {s.subject_observed && (
                          <span style={{ fontSize:10, padding:"1px 6px", borderRadius:20,
                            background:"rgba(80,220,150,0.15)", color:"rgba(80,220,150,0.9)",
                            border:"1px solid rgba(80,220,150,0.25)" }}>✓ Observed</span>
                        )}
                      </div>
                      <div style={{ fontSize:10, color:sec }}>
                        {s.start_time && <span>🕐 {s.start_time}</span>}
                        {s.end_time && <span> — {s.end_time}</span>}
                        {s.total_hours && <span style={{marginLeft:6}}>({s.total_hours}h)</span>}
                      </div>
                      {s.notes && (
                        <div style={{ fontSize:11, color:txt, marginTop:6, lineHeight:1.5,
                          padding:"6px 8px", borderRadius:6, background:bg1,
                          border:"1px solid "+bdr }}>
                          {String(s.notes).substring(0,200)}{String(s.notes).length>200?"…":""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}


              {/* ── MEDICAL CANVASS PANEL ── */}
              {heroView === "canvass" && (
                <CanvassPanel inv={inv} meta={meta} isDark={isDark}
                  acc={acc} sec={sec} txt={txt} bg1={bg1} bg2={bg2} bdr={bdr} mut={mut}
                  base={base} save={save}
                  radius={canvassRadius}
                  onRadiusChange={handleCanvassRadiusChange}
                  onFacilitiesChange={handleCanvassFacilitiesChange}
                  canSeePII={canSeePII}
                  userRole={userRole} />
              )}

              {/* Normal subject boxes — hidden when Summary is active */}
              {heroView !== "summary" && heroView !== "canvass" && heroView !== "pattern" && <>

              {/* All hero boxes — DraggableGrid for drag+resize */}
              <DraggableGrid
                storageKey={`hero_main_${inv?.id||"0"}`}
                cols={2} acc={_acc} bdr={bdr} bg1={bg2} isDark={isDark}
                items={[
                { id: "addresses", title: "Addresses", colSpan: 2 as 2, content: (
                <div style={{ padding: "10px 14px", position: "relative" as any }}>
                  <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: mut, fontWeight: 700, margin: "0 0 6px" }}>
                    Addresses {inv?.subject_addresses?.length > 1 && <span style={{ color: acc }}>({inv.subject_addresses.length})</span>}
                  </p>
                  {inv?.subject_addresses?.length > 0 ? (
                    <div style={{ position: "relative" as any }}>
                      {/* Primary address row with dropdown trigger */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: txt, flex: 1 }}>
                          {inv.subject_addresses[0]}
                        </p>
                        {inv.subject_addresses.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowAllAddresses(v => !v); }}
                            style={{ fontSize: 11, padding: "2px 8px", cursor: "pointer", flexShrink: 0,
                              background: showAllAddresses ? `${acc}22` : "transparent",
                              border: `1px solid ${bdr}`, borderRadius: 5, color: acc, fontWeight: 600,
                              lineHeight: 1.6 }}>
                            {showAllAddresses ? "▲" : `▼ +${inv.subject_addresses.length - 1}`}
                          </button>
                        )}
                      </div>
                      {/* Dropdown with all other addresses + set as primary */}
                      {showAllAddresses && inv.subject_addresses.length > 1 && (
                        <div style={{
                          position: "absolute" as any, top: "100%", left: 0, right: 0, zIndex: 200,
                          marginTop: 4, borderRadius: 8, overflow: "hidden",
                          border: `1px solid ${bdr}`,
                          background: isDark ? "#1e2433" : "#fff",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.25)"
                        }}>
                          <div style={{ padding: "6px 8px", fontSize: 10, color: mut, textTransform: "uppercase" as any, letterSpacing: ".06em", fontWeight: 700, borderBottom: `1px solid ${bdr}` }}>
                            All addresses — click to set as primary
                          </div>
                          {inv.subject_addresses.slice(1).map((a: string, i: number) => (
                            <button key={i}
                              onClick={async (e) => {
                                e.stopPropagation();
                                // Move selected address to front
                                const reordered = [a, ...inv.subject_addresses.filter((x: string) => x !== a)];
                                try {
                                  await fetch(`${base}/api/investigations/${inv.id}`, {
                                    method: "PATCH", credentials: "include",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ subject_addresses: reordered })
                                  });
                                  // Update local state
                                  /* setInv removed — update handled via API */
                                  setShowAllAddresses(false);
                                } catch(err) { console.error(err); }
                              }}
                              style={{
                                width: "100%", textAlign: "left" as any, padding: "8px 12px",
                                background: "transparent", border: "none",
                                borderBottom: i < inv.subject_addresses.length - 2 ? `1px solid ${bdr}` : "none",
                                cursor: "pointer", fontSize: 12, color: txt,
                                display: "flex", alignItems: "center", gap: 8,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "#f8fafc")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                              <span style={{ fontSize: 10, color: acc }}>★</span>
                              <span>{a}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: mut, margin: 0 }}>— add address</p>
                  )}
                </div>
                )}, /* end addresses */
                { id: "assignment", title: "Assignment Details", colSpan: 2 as 2, content: (
                <div>
                {(() => {
                const invType = (inv as any)?.investigation_type;
                if (!invType || invType === "surveillance" || invType === "surveillance_followup") return null;

                const isBg      = invType === "background";
                const isMedical = invType === "medical_canvass" || invType === "declaration" || invType === "field_assignment";

                const rawInstr = meta?.instructions || "";
                const cleanInstr = rawInstr
                  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
                  .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
                  .replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();

                return (
                  <div style={{ border: `1px solid ${bdr}`, borderRadius: 8, padding: "12px 14px", background: bg2 }}>
                    <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: mut, fontWeight: 700, margin: "0 0 10px" }}>
                      {isBg ? "Background Check Details" : "Assignment Details"}
                    </p>

                    {isBg && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <Field label="Client"       value={meta?.client_company}  onEdit={save("client_company")} />
                        <Field label="Requested by" value={meta?.requester_name}  onEdit={save("requester_name")} />
                        <div style={{ gridColumn: "1 / -1" }}>
                          <Field label="Scope" value={meta?.background_scope} onEdit={save("background_scope")} />
                        </div>
                      </div>
                    )}

                    {isMedical && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
                        <Field label="Client"         value={meta?.client_company}    onEdit={save("client_company")} />
                        <Field label="Claim #"        value={meta?.claim_number}      onEdit={save("claim_number")} />
                        <Field label="City"           value={meta?.canvass_city}      onEdit={save("canvass_city")} />
                        <Field label="Policy #"       value={meta?.policy_number}     onEdit={save("policy_number")} />
                        <Field label="Start time"     value={meta?.start_time}        onEdit={save("start_time")} />
                        <Field label="Due date"       value={meta?.report_due_date}   onEdit={save("report_due_date")} />
                        <Field label="Adjuster"       value={meta?.adjuster_name}     onEdit={save("adjuster_name")} />
                        <Field label="Days"           value={meta?.surveillance_days} onEdit={save("surveillance_days")} />
                        <Field label="Date of injury" value={meta?.date_of_injury}    onEdit={save("date_of_injury")} />
                        <Field label="Employer"       value={meta?.employer_name}     onEdit={save("employer_name")} />
                        {/* Body parts moved to Client tab — Todd request */}
                        {(meta?.knock_addresses || []).length > 0 && (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <p style={{ fontSize: 10, color: mut, margin: "4px 0 6px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                              Knock addresses — click to mark result
                            </p>
                            {(meta.knock_addresses as string[]).map((addr: string, i: number) => {
                              const results: Record<string,string> = (meta?.knock_results || {}) as any;
                              const result = results[addr] || "pending";
                              const resultCfg: Record<string,{label:string;bg:string;color:string}> = {
                                pending:   { label: "Pending",   bg: bg1, color: sec },
                                no_record: { label: "No Record", bg: "#fef2f2", color: "#dc2626" },
                                hit:       { label: "HIT ✓",     bg: "#f0fdf4", color: "#166534" },
                                closed:    { label: "Closed",    bg: "#f1f5f9", color: "#475569" },
                                skipped:   { label: "Skipped",   bg: "#fefce8", color: "#854d0e" },
                              };
                              const cfg = resultCfg[result] || resultCfg.pending;
                              return (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
                                  padding: "6px 8px", marginBottom: 5, borderRadius: 7,
                                  border: "1px solid " + bdr, background: cfg.bg }}>
                                  <span style={{ fontSize: 12, flex: 1, color: txt }}>📍 {addr}</span>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    {["no_record","hit","closed","skipped"].map((r:string) => (
                                      <button key={r} onClick={() => {
                                        const cur: Record<string,string> = {...(meta?.knock_results||{})} as any;
                                        cur[addr] = result === r ? "pending" : r;
                                        save("knock_results")(cur);
                                      }}
                                      style={{ padding: "2px 8px", fontSize: 10, fontWeight: 600,
                                        borderRadius: 10, cursor: "pointer", border: "1px solid",
                                        background: result===r ? resultCfg[r].bg : bg1,
                                        color: result===r ? resultCfg[r].color : sec,
                                        borderColor: result===r ? resultCfg[r].color : bdr }}>
                                        {resultCfg[r].label}
                                      </button>
                                    ))}
                                  </div>
                                  {/* Notes for this address */}
                                  <input
                                    placeholder="note..."
                                    defaultValue={((meta?.knock_notes||{}) as any)[addr] || ""}
                                    onBlur={(e:any) => {
                                      const cur: Record<string,string> = {...(meta?.knock_notes||{})} as any;
                                      cur[addr] = e.target.value;
                                      save("knock_notes")(cur);
                                    }}
                                    style={{ width: 100, padding: "2px 6px", fontSize: 11,
                                      border: "1px solid " + bdr, borderRadius: 5,
                                      background: bg1, color: txt, outline: "none" }}/>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {cleanInstr.length > 3 && (
                          <div style={{ gridColumn: "1 / -1", padding: "8px 10px", borderRadius: 6,
                            background: isDark ? "rgba(255,166,26,0.07)" : "#fffbeb",
                            border: `1px solid ${isDark ? "rgba(255,166,26,0.2)" : "#fde68a"}` }}>
                            <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em",
                              color: isDark ? "#f59e0b" : "#92400e", fontWeight: 700, margin: "0 0 4px" }}>
                              Instructions
                            </p>
                            <p style={{ fontSize: 12, color: txt, margin: 0, lineHeight: 1.5 }}>
                              {cleanInstr.substring(0, 400)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
                </div>
                )}, /* end assignment */
                { id: "surv-intel", title: "Surveillance", colSpan: 2 as 2, content: (
                <div>
                {((inv as any)?.investigation_type === "surveillance" || (inv as any)?.investigation_type === "surveillance_followup") && (
                <SurveillanceIntelBlock meta={meta} isDark={isDark} acc={acc} sec={sec} txt={txt} bg1={bg1} bg2={bg2} bdr={bdr} mut={mut} save={save} vehicles={vehicles} inv={inv} />
                )}
                </div>
                )}, /* end surv-intel */
                { id: "description", title: "Description", colSpan: 2 as 2, content: (
                  <div style={{ padding: "10px 14px" }}>
                    <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: mut, fontWeight: 700, margin: "0 0 8px" }}>
                      Physical description
                      <button onClick={async () => {
                        const r = await fetch(`${base}/api/investigations/${inv?.id}/analyze-physical`,
                          { method: "POST", credentials: "include" });
                        const d = await r.json();
                        if (d.ok) { alert(`✅ Updated from ${d.photos_analyzed} photo(s)`); window.location.reload(); }
                        else alert(d.skipped ? `ℹ️ ${d.reason}` : `❌ ${d.error||"Error"}`);
                      }} style={{ marginLeft:10, fontSize:9, padding:"2px 7px", borderRadius:4,
                        background:"#7c3aed", color:"white", border:"none", cursor:"pointer",
                        fontWeight:600, textTransform:"none", letterSpacing:"normal" }}>
                        🤖 Auto-fill from photos
                      </button>
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                        <Field label="Sex"        value={inv?.subject_gender}      onEdit={save("subject_gender")} />
                        <Field label="Race"       value={inv?.subject_race}        onEdit={save("subject_race")} />
                        <Field label="Age"        value={age || null}              onEdit={()=>{}} />
                        <Field label="Build"      value={inv?.subject_build}       onEdit={save("subject_build")} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                        <Field label="Height"     value={meta?.height}             onEdit={save("height")} />
                        <Field label="Weight"     value={meta?.weight}             onEdit={save("weight")} />
                        <Field label="Complexion" value={inv?.subject_complexion}  onEdit={save("subject_complexion")} />
                        <Field label="Eyes"       value={inv?.subject_eyes}        onEdit={save("subject_eyes")} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                        <Field label="Hair color" value={inv?.subject_hair_color}  onEdit={save("subject_hair_color")} />
                        <Field label="Hair length" value={inv?.subject_hair_length} onEdit={save("subject_hair_length")} />
                        <Field label="Facial hair" value={inv?.subject_facial_hair} onEdit={save("subject_facial_hair")} />
                        <Field label="Glasses"    value={inv?.subject_glasses}     onEdit={save("subject_glasses")} />
                      </div>
                      <Field label="Distinguishing marks / tattoos"
                        value={meta?.descriptive_features}                         onEdit={save("descriptive_features")} />
                      <Field label="Identification notes"
                        value={meta?.identification_notes}                         onEdit={save("identification_notes")} />
                    </div>
                    {/* Surveillance photo upload */}
                    <div style={{ marginTop: 10, borderTop: `1px solid ${bdr}`, paddingTop: 10 }}>
                      <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em",
                        color: "#f59e0b", fontWeight: 700, margin: "0 0 8px" }}>
                        📸 Surveillance photo
                      </p>
                      {(() => {
                        const survPhoto = (inv?.reference_photos || []).find((p: any) =>
                          p.minio_path?.includes("surveillance") || p.type === "surveillance"
                        ) || (inv?.reference_photos || [])[0];
                        return (
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                            {survPhoto ? (
                              <img
                                src={survPhoto.id
                                  ? `${base}/api/photos/${survPhoto.id}/thumbnail`
                                  : (survPhoto.thumbnail_path
                                    ? `${base}/api/photos/by-path?path=${encodeURIComponent(survPhoto.thumbnail_path)}`
                                    : `${base}/api/photos/by-path?path=${encodeURIComponent(survPhoto.minio_path)}`)}
                                style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8,
                                  border: `1px solid ${bdr}` }}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                alt="Surveillance photo"
                              />
                            ) : (
                              <div style={{ width: 80, height: 80, borderRadius: 8, border: `1px dashed ${bdr}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: bg1, color: mut, fontSize: 11 }}>
                                No photo
                              </div>
                            )}
                            <label style={{ cursor: "pointer" }}>
                              <input type="file" accept="image/*" style={{ display: "none" }}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0]; if (!file) return;
                                  const form = new FormData();
                                  form.append("files", file);
                                  form.append("uploaded_by", "investigator");
                                  const r = await fetch(
                                    `${base}/api/investigations/${inv?.id}/reference-photos`,
                                    { method: "POST", credentials: "include", body: form }
                                  );
                                  if (r.ok) {
                                    const d = await r.json();
                                    if (d.results?.[0]?.status === "no_face") {
                                      alert("⚠️ No face detected in photo. Please use a clear face photo.");
                                    } else { window.location.reload(); }
                                  } else alert("Upload failed");
                                }} />
                              <span style={{ fontSize: 11, padding: "5px 12px", cursor: "pointer",
                                background: bg2, border: `1px solid ${bdr}`, borderRadius: 6,
                                display: "inline-block", color: txt, fontWeight: 500 }}>
                                📤 Upload surveillance photo
                              </span>
                            </label>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )},
                { id: "identity", title: "Identity", colSpan: 1 as 1, content: (
                  <div style={{ padding: "10px 14px" }}>
                    <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: showPII ? mut : "#92400e", fontWeight: 700, margin: "0 0 8px" }}>
                      Identity {!showPII && <span style={{ fontSize: 9, color: "#f59e0b" }}>🔒</span>}
                    </p>
                    {showPII ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <Field label="Date of birth"
                          value={inv?.subject_dob ? new Date(inv.subject_dob+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) + (age ? ` (${age}y)` : "") : null}
                          onEdit={save("subject_dob")} />
                        <Field label="SSN" value={inv?.subject_ssn_last4 ? "•••-••-"+inv.subject_ssn_last4 : (meta?.subject_ssn ? "•••-••-" + meta.subject_ssn.slice(-4) : null)} empty="•••-••-____" onEdit={save("subject_ssn_last4")} />
                        <Field label="Driver lic." value={meta?.drivers_license} onEdit={save("subject_drivers_license")} />
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#f59e0b" }}>🔒 DOB · SSN · DL — admin only</div>
                    )}
                  </div>
                )},
                { id: "work", title: "Work", colSpan: 1 as 1, content: (
                  <div style={{ padding: "10px 14px" }}>
                    <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: mut, fontWeight: 700, margin: "0 0 8px" }}>Work</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Field label="Job title" value={meta?.subject_job} onEdit={save("subject_job")} />
                      <Field label="Employer" value={meta?.employer_name} onEdit={save("employer_name")} />
                      <Field label="Status" value={meta?.employment_status} onEdit={save("employment_status")} />
                      <Field label="Language" value={meta?.primary_language} onEdit={save("primary_language")} />
                    </div>
                  </div>
                )},
                { id: "phones", title: "Phones", colSpan: 1 as 1, content: (
                  showPII ? (
                    <div style={{ padding: "10px 14px" }}>
                      <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: mut, fontWeight: 700, margin: "0 0 8px" }}>Phones</p>
                      <ArrayField label="" values={inv?.subject_phones}
                        onAdd={saveArrayAdd("subject_phones")} onRemove={saveArrayRemove("subject_phones")}
                        meta={(inv as any)?.subject_phones_meta || {}} />
                    </div>
                  ) : (
                    <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>🔒</span><span style={{ fontSize: 12, color: sec }}>Phones — restricted</span>
                    </div>
                  )
                )},
                { id: "emails", title: "Emails", colSpan: 1 as 1, content: (
                  showPII ? (
                    <div style={{ padding: "10px 14px" }}>
                      <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: mut, fontWeight: 700, margin: "0 0 8px" }}>Emails</p>
                      <ArrayField label="" values={inv?.subject_emails}
                        onAdd={saveArrayAdd("subject_emails")} onRemove={saveArrayRemove("subject_emails")}
                        meta={(inv as any)?.extra_metadata?.emails_confidence || {}} />
                    </div>
                  ) : (
                    <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>🔒</span><span style={{ fontSize: 12, color: sec }}>Emails — restricted</span>
                    </div>
                  )
                )},

                { id: "social", title: "Social Usernames", colSpan: 2 as 2, content: (
                <SocialUsernamesField
                  inv={inv} acc={acc} mut={mut} onSave={onSave}
                />
                )},
              ].filter((item: any) => {
                if (heroView === "description") {
                  return item.id === "description";
                }
                return item.id !== "description";
              })} />
              </>}

            </div>

            {/* RIGHT: Photo + Map + heroView content */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* ── CANVASS RIGHT: map + case info (replaces photo when in canvass mode) ── */}
              {heroView === "canvass" && (
                <CanvassRightPanel inv={inv} meta={meta} isDark={isDark}
                  acc={acc} sec={sec} txt={txt} bg1={bg1} bg2={bg2} bdr={bdr} mut={mut}
                  base={base}
                  facilities={canvassFacilities}
                  radius={canvassRadius}
                  results={canvassResults} />
              )}
              {heroView === "canvass" ? null : (<>

              {/* Photo carousel */}
              {(() => {
                // Build photo list: reference photos + OSINT photos marked as subject
                // Merge: reference_photos from inv + all marked_as_subject from DB
                // reference_photos from JSONB have no id — use thumbnail_path directly
                const refPhotos = (inv?.reference_photos || []).map((p: any) => ({
                  ...p,
                  type: "reference",
                  // If photo has id, use /api/photos/{id}/thumbnail which serves
                  // enhanced version automatically. Otherwise fall back to minio path.
                  _thumbUrl: p.id
                    ? null
                    : (p.thumbnail_path
                        ? `${base}/api/photos/minio/${encodeURIComponent(p.thumbnail_path)}`
                        : null),
                }));
                // DB photos have id — use normal endpoint
                const osintPhotos = allSubjectPhotos
                  .filter((p: any) => !refPhotos.some((r: any) => r.minio_path === p.minio_path))
                  .map((p: any) => ({ ...p, type: p.minio_path?.includes("onedrive") ? "onedrive" : "osint" }));
                const has3D = (refPhotos.length + osintPhotos.length) > 0;
                const photo3D: any[] = has3D ? [{ id: "__3d__", type: "3d", _thumbUrl: null, minio_path: "__3d__" }] : [];
                const allPhotos = [...refPhotos, ...osintPhotos, ...photo3D];
                const [photoIdx, setPhotoIdx] = photoCarouselState;
                const curPhoto = allPhotos[photoIdx] || null;
                const is3D = curPhoto?.type === "3d";

                return (
                  <div style={{ border: `1px solid ${bdr}`, borderRadius: 8, overflow: "hidden" }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "6px 10px", borderBottom: `1px solid ${bdr}`, background: bg1 }}>
                      <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em",
                        color: sec, margin: 0, fontWeight: 600 }}>
                        Subject photos
                        {allPhotos.length > 0 && (
                          <span style={{ marginLeft: 6, color: acc, fontWeight: 700 }}>
                            {photoIdx + 1}/{allPhotos.length}
                          </span>
                        )}
                      </p>
                      {allPhotos.length > 1 && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => setPhotoIdx(i => (i - 1 + allPhotos.length) % allPhotos.length)}
                            style={{ fontSize: 12, width: 22, height: 22, border: `1px solid ${bdr}`,
                              borderRadius: 4, cursor: "pointer", background: bg2, color: txt }}>‹</button>
                          <button onClick={() => setPhotoIdx(i => (i + 1) % allPhotos.length)}
                            style={{ fontSize: 12, width: 22, height: 22, border: `1px solid ${bdr}`,
                              borderRadius: 4, cursor: "pointer", background: bg2, color: txt }}>›</button>
                        </div>
                      )}
                    </div>

                    {/* Photo / 3D viewer */}
                    <div style={{ height: 200, background: is3D ? "#06060e" : bg2, display: "flex",
                      alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                      {is3D ? (
                        <Face3DViewer
                          key={`f3d-${inv?.id}`}
                          base={base}
                          invId={inv?.id}
                          onFullscreen={() => window.open(`${base}/api/face3d/view/${inv?.id}?full=1`, "_blank")}
                        />
                      ) : curPhoto ? (
                        <>
                          <img src={curPhoto._thumbUrl || `${base}/api/photos/${curPhoto.id}/thumbnail?v=${(curPhoto.exif_data?.enhanced_path || curPhoto.id)}`}
                            alt="Subject" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <span style={{ position: "absolute", top: 6, left: 6, fontSize: 10,
                            fontWeight: 600, padding: "2px 7px", borderRadius: 20,
                            background: curPhoto.type === "reference" ? "#dcfce7"
                              : curPhoto._isPrior ? "#fef3c7"
                              : "#dbeafe",
                            color: curPhoto.type === "reference" ? "#166534"
                              : curPhoto._isPrior ? "#92400e"
                              : curPhoto.type === "onedrive" ? "#7c3aed" : "#1e40af" }}>
                            {curPhoto.type === "reference" ? "✓ Reference"
                              : curPhoto._isPrior ? "📁 Prior case"
                              : curPhoto.type === "onedrive" ? "📂 OneDrive" : "🔍 OSINT"}
                          </span>
                          {curPhoto.source_platform && (
                            <span style={{ position: "absolute", bottom: 6, right: 6, fontSize: 9,
                              padding: "2px 6px", borderRadius: 20, background: "rgba(0,0,0,0.5)", color: "white" }}>
                              {curPhoto.source_platform}
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: 52, opacity: 0.1 }}>👤</span>
                      )}
                    </div>
                                        {/* Thumbnails strip */}
                    {allPhotos.length > 1 && (
                      <div style={{ display: "flex", gap: 3, padding: "5px 6px", overflowX: "auto",
                        background: bg1, borderTop: `1px solid ${bdr}` }}>
                        {allPhotos.map((p: any, i: number) => (
                          <div key={i} onClick={() => setPhotoIdx(i)}
                            style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 4,
                              overflow: "hidden", cursor: "pointer",
                              border: `2px solid ${i === photoIdx ? acc : bdr}`,
                              background: p.type === "3d" ? "#06060e" : bg2,
                              display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {p.type === "3d" ? (
                              <span style={{ fontSize: 18 }}>🧊</span>
                            ) : (
                              <img src={p._thumbUrl || `${base}/api/photos/${p.id}/thumbnail`}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                onError={e => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ padding: "6px 8px", borderTop: `1px solid ${bdr}`,
                      display: "flex", gap: 4, background: bg1 }}>
                      <label style={{ flex: 1 }}>
                        <input type="file" accept="image/*" style={{ display: "none" }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0]; if (!file) return;
                            const form = new FormData();
                            form.append("files", file);
                            form.append("uploaded_by", "investigator");
                            const r = await fetch(`${base}/api/investigations/${inv?.id}/reference-photos`,
                              { method: "POST", credentials: "include", body: form });
                            if (r.ok) {
                              const d = await r.json();
                              if (d.results?.[0]?.status === "no_face") {
                                alert("⚠️ No face detected. Use a clear face photo.");
                              } else { window.location.reload(); }
                            } else alert("Upload failed");
                          }} />
                        <span style={{ fontSize: 11, padding: "4px 8px", cursor: "pointer", background: bg2,
                          border: `1px solid ${bdr}`, borderRadius: 5, display: "block",
                          textAlign: "center", color: txt }}>📤 Upload</span>
                      </label>
                      <button
                        onClick={async () => {
                          if (!meta?.claim_number) { alert("Add claim # in Client tab first"); return; }
                          const r = await fetch(`${base}/api/investigations/${inv?.id}/send-images-ai`,
                            { method: "POST", credentials: "include" });
                          const d = await r.json();
                          alert(d.ok ? "✅ Sent to images.ai" : `❌ ${d.error}`);
                        }}
                        style={{ fontSize: 11, padding: "4px 8px", flex: 1, cursor: "pointer",
                          background: "linear-gradient(135deg, #7c3aed, #5b21b6)", color: "white",
                          border: "none", borderRadius: 5, fontWeight: 600 }}>
                        🔍 images.ai
                      </button>
                      <button
                        id="enhance-btn"
                        onClick={async () => {
                          if (!curPhoto) { alert("No photo selected"); return; }
                          const photoId = (curPhoto as any).id;
                          if (!photoId || photoId === "__3d__") {
                            alert("⚠️ This photo can\'t be enhanced yet. Try navigating to it after a page refresh.");
                            return;
                          }
                          const btn = document.getElementById("enhance-btn") as HTMLButtonElement;
                          if (btn) { btn.textContent = "⏳ Enhancing…"; btn.disabled = true; }
                          try {
                            // CodeFormer by default (best quality), fidelity=0.7
                            const r = await fetch(
                              `${base}/api/photos/${photoId}/enhance?method=codeformer&fidelity=0.7`,
                              { method: "POST", credentials: "include" });
                            const d = await r.json();
                            if (r.ok) {
                              alert(`✅ Enhanced (CodeFormer) to ${d.enhanced_size} — reload to see`);
                              window.location.reload();
                            } else {
                              alert("❌ " + (d.detail || "Enhancement failed"));
                            }
                          } catch(e: any) { alert("Error: " + e.message); }
                          finally { if (btn) { btn.textContent = "✨ Enhance"; btn.disabled = false; } }
                        }}
                        style={{ fontSize: 11, padding: "4px 8px", flex: 1, cursor: "pointer",
                          background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white",
                          border: "none", borderRadius: 5, fontWeight: 600 }}>
                        ✨ Enhance
                      </button>
                      <button
                        id="colorize-btn"
                        onClick={async () => {
                          if (!curPhoto) { alert("No photo selected"); return; }
                          const btn = document.getElementById("colorize-btn") as HTMLButtonElement;
                          if (btn) { (btn as HTMLButtonElement).textContent = "⏳ Colorizing…"; (btn as HTMLButtonElement).disabled = true; }
                          try {
                            const photoUrl = (curPhoto as any).id
                              ? `${base}/api/photos/${(curPhoto as any).id}/thumbnail`
                              : (curPhoto as any)._thumbUrl;
                            const imgResp = await fetch(photoUrl, { credentials: "include" });
                            const blob = await imgResp.blob();
                            const form = new FormData();
                            form.append("file", blob, "photo.jpg");
                            const r = await fetch(`${base}/api/colorize`, {
                              method: "POST", credentials: "include", body: form
                            });
                            const d = await r.json();
                            if (d.image) {
                              const win = window.open("", "_blank");
                              if (win) {
                                win.document.write('<html><body style="background:#000;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;overflow:hidden"><img id="cimg" src="' + d.image + '" style="max-width:90vw;max-height:90vh;border-radius:8px;cursor:grab" /><script>var img=document.getElementById("cimg");document.body.addEventListener("mousemove",function(e){var r=img.getBoundingClientRect();var cx=r.left+r.width/2,cy=r.top+r.height/2;var dx=(e.clientX-cx)/(r.width/2)*18;var dy=(e.clientY-cy)/(r.height/2)*18;img.style.transform="perspective(700px) rotateY("+dx+"deg) rotateX("+(-dy)+"deg) scale(1.03)";img.style.transition="transform 0.06s";});document.body.addEventListener("mouseleave",function(){img.style.transform="none";});<' + '/script></body></html>');
                              }
                            } else { alert("❌ " + (d.detail||"Colorization failed")); }
                          } catch(e: any) { alert("Error: "+e.message); }
                          finally { if (btn) { btn.textContent = "🎨 Colorize"; btn.disabled = false; } }
                        }}
                        style={{ fontSize: 11, padding: "4px 8px", flex: 1, cursor: "pointer",
                          background: "linear-gradient(135deg, #10b981, #059669)", color: "white",
                          border: "none", borderRadius: 5, fontWeight: 600 }}>
                        🎨 Colorize
                      </button>
                      <button
                        id="face3d-btn"
                        onClick={() => {
                          const invId = inv?.id; if (!invId) return;
                          if (is3D) {
                            window.open(`${base}/api/face3d/view/${invId}?full=1`, "_blank");
                          } else {
                            const idx3d = allPhotos.findIndex((p: any) => p.type === "3d");
                            if (idx3d >= 0) setPhotoIdx(idx3d);
                          }
                        }}
                        style={{ fontSize: 11, padding: "4px 8px", flex: 1, cursor: "pointer",
                          background: is3D ? "linear-gradient(135deg, #0f172a, #1e3a5f)" : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                          color: "white", border: is3D ? "1px solid #3b82f6" : "none",
                          borderRadius: 5, fontWeight: 600 }}>
                        {is3D ? "⛶ Fullscreen" : "🧊 View 3D"}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Map */}
              <div style={{ border: `1px solid ${bdr}`, borderRadius: 8, overflow: "hidden", flex: 1, minHeight: 200 }}>
                <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: sec,
                  margin: 0, padding: "6px 10px", fontWeight: 600, borderBottom: `1px solid ${bdr}`, background: bg1 }}>
                  Location map
                </p>
                <InvestigationMap
                  addresses={inv?.subject_addresses ?? []}
                  subjectName={inv?.subject_name || ""}
                  investigationId={inv?.id}
                  canvassFacilities={heroView === "canvass" ? canvassFacilities : undefined}
                  canvassRadius={heroView === "canvass" ? canvassRadius : undefined}
                  canvassMode={heroView === "canvass"}
                />
              </div>
            </>)}
            </div>
          </div>
        );
      })()}

      {tab === "client" && (
        <ClientTab inv={inv} meta={meta} isDark={isDark} acc={_acc} sec={_sec} txt={_txt} bg1={_bg1} bg2={_bg2} bdr={_bdr} mut={_mut} save={save} />
      )}
      {tab === "employer" && (
        <EmployerTab inv={inv} meta={meta} isDark={isDark} acc={_acc} sec={_sec} txt={_txt} bg1={_bg1} bg2={_bg2} bdr={_bdr} mut={_mut} save={save} />
      )}
      {tab === "vehicles" && (
        <>
          <VehiclesTab inv={inv} vehicles={vehicles} setVehicles={setVehicles} isDark={isDark} acc={_acc} sec={_sec} txt={_txt} bg1={_bg1} bg2={_bg2} bdr={_bdr} mut={_mut} base={base} />
          <div style={{ marginTop: 24, borderTop: `1px solid ${_bdr}`, paddingTop: 8 }}>
            <InsuranceVehiclesTab inv={inv} base={base} acc={_acc} isDark={isDark}
              txt={_txt} mut={_mut} bg1={_bg1} bg2={_bg2} bdr={_bdr} sec={_sec} />
          </div>
        </>
      )}



      {/* HISTORY */}
      {tab === "flowsint" && (
        <ProdigyGraphTab invId={inv?.id||0} inv={inv} meta={(inv?.extra_metadata as any)||{}} isGL={isGlass} />
      )}
      {tab === "summaries" && (() => {
        const bdr=_bdr,bg1=_bg1,bg2=_bg2,txt=_txt,sec=_sec,mut=_mut,acc=_acc;
        const summaries = (meta?.prior_surveillance || []) as any[];
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ fontSize:13, fontWeight:600, color:txt }}>
              Surveillance summaries
              <span style={{ fontSize:11, color:sec, fontWeight:400, marginLeft:8 }}>
                {summaries.length} day(s) on record
              </span>
            </div>
            {summaries.length===0 ? (
              <div style={{ border:"1px solid "+bdr, borderRadius:10, padding:32,
                textAlign:"center", background:bg1 }}>
                <div style={{ fontSize:32, opacity:0.2, marginBottom:8 }}>📋</div>
                <div style={{ fontSize:13, color:sec }}>No surveillance summaries yet</div>
              </div>
            ) : summaries.map((s: any, i: number) => (
              <div key={i} style={{ border:"1px solid "+bdr, borderRadius:10,
                padding:"12px 14px", background:bg2 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                  <div style={{ padding:"3px 10px", borderRadius:20,
                    background:acc+"22", border:"1px solid "+acc+"44",
                    fontSize:11, fontWeight:700, color:acc }}>Day {s.day_number || i+1}</div>
                  {(s.surveillance_date||s.date) && (
                    <span style={{ fontSize:12, color:sec }}>{s.surveillance_date||s.date}</span>
                  )}
                  {s.subject_observed && (
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20,
                      background:"rgba(80,220,150,0.15)", color:"rgba(80,220,150,0.9)",
                      border:"1px solid rgba(80,220,150,0.25)" }}>✓ Subject observed</span>
                  )}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:4 }}>
                  {s.start_time&&<div style={{fontSize:11,color:sec}}><span style={{color:mut}}>Start: </span><span style={{color:txt,fontWeight:600}}>{s.start_time}</span></div>}
                  {s.end_time&&<div style={{fontSize:11,color:sec}}><span style={{color:mut}}>End: </span><span style={{color:txt,fontWeight:600}}>{s.end_time}</span></div>}
                  {s.total_hours&&<div style={{fontSize:11,color:sec}}><span style={{color:mut}}>Hours: </span><span style={{color:txt,fontWeight:600}}>{s.total_hours}h</span></div>}
                </div>
                {s.notes&&<div style={{fontSize:12,color:txt,lineHeight:1.6,padding:"6px 10px",
                  borderRadius:7,background:bg1,border:"1px solid "+bdr}}>{s.notes}</div>}
              </div>
            ))}
          </div>
        );
      })()}
      {tab === "selectors" && (
        <SelectorsTab invId={inv?.id || 0} subjectName={inv?.subject_name} isGL={isGlass} />
      )}
      {tab === "captures" && (
        <CapturesTab invId={inv?.id || 0} isGL={isGlass} />
      )}
      {tab === "history" && (() => {
        const bdr = _bdr, bg1 = _bg1, bg2 = _bg2, txt = _txt, sec = _sec, mut = _mut, acc = _acc;

        const priorSurv = (meta?.prior_surveillance || []) as any[];
        const findings  = osintFindings;
        const [histTab, setHistTab] = historyTabState;

        const PLAT_COLORS: Record<string,string> = {
          facebook:"#1877f2", instagram:"#e1306c", twitter:"#1da1f2",
          tiktok:"#000000", linkedin:"#0077b5", snapchat:"#fffc00",
          youtube:"#ff0000", facecheck:"#7c3aed", pimeyes:"#ec4899",
          spokeo:"#0ea5e9", maigret:"#10b981", holehe:"#f59e0b",
        };

        const byPlatform = findings.reduce((acc: any, f: any) => {
          const p = (f.platform || f.engine || "other").toLowerCase();
          (acc[p] = acc[p] || []).push(f);
          return acc;
        }, {});

        return (
          <div>
            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 2, marginBottom: 16,
              borderBottom: `2px solid ${bdr}`, paddingBottom: 0 }}>
              {[
                { id: "osint", label: `🔍 OSINT findings (${findings.length})` },
                { id: "surveillance", label: `📋 Prior surveillance (${(meta?.prior_surveillance_days || []).length > 0 ? (meta?.prior_surveillance_days as any[]).length + "d" : priorSurv.length + " cases"})` },
              ].map(t => (
                <button key={t.id} onClick={() => setHistTab(t.id)}
                  style={{ padding: "8px 16px", fontSize: 12, fontWeight: histTab === t.id ? 600 : 400,
                    border: "none", background: "transparent", cursor: "pointer",
                    borderBottom: `2px solid ${histTab === t.id ? acc : "transparent"}`,
                    color: histTab === t.id ? acc : sec, marginBottom: -2 }}>
                  {t.label}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={async () => {
                    const r = await fetch(`${base}/api/investigations/${inv?.id}/osint-history`, { credentials: "include" });
                    if (r.ok) {
                      const d = await r.json();
                      setOsintFindings(d.findings || []);
                      setOsintMeta({maigret_unverified: d.maigret_unverified||0, total_all: d.total_all||0, hidden_low_conf: d.hidden_low_conf||0});
                      // Auto-trigger verification if there are pending maigret findings >= 80%
                      if (d.maigret_unverified > 0 && !verifyTask) {
                        const rv = await fetch(`${base}/api/investigations/${inv?.id}/verify-findings?max_urls=100`,
                          { method: "POST", credentials: "include" });
                        const dv = await rv.json();
                        if (dv.task_id) {
                          setVerifyTask({ id: dv.task_id, state: "PENDING", current: 0, total: d.maigret_unverified, status: "Auto-starting..." });
                          const poll = setInterval(async () => {
                            const rs = await fetch(`${base}/api/investigations/${inv?.id}/verify-findings/status?task_id=${dv.task_id}`,
                              { credentials: "include" });
                            const ds = await rs.json();
                            setVerifyTask({ id: dv.task_id, state: ds.state, current: ds.current, total: ds.total, status: ds.status||"" });
                            if (ds.ready) {
                              clearInterval(poll);
                              const r2 = await fetch(`${base}/api/investigations/${inv?.id}/osint-history`, { credentials: "include" });
                              if (r2.ok) { const d2 = await r2.json(); setOsintFindings(d2.findings||[]); setOsintMeta({maigret_unverified: d2.maigret_unverified||0, total_all: d2.total_all||0, hidden_low_conf: d2.hidden_low_conf||0}); }
                            }
                          }, 4000);
                        }
                      }
                    }
                  }}
                  style={{ fontSize: 11, padding: "5px 12px", cursor: "pointer",
                    background: findings.length > 0 ? bg1 : acc, color: findings.length > 0 ? sec : "white",
                    border: `1px solid ${bdr}`, borderRadius: 6, marginBottom: 4 }}>
                  {findings.length > 0 ? "↺ Refresh" : "📊 Load"}
                </button>
                <button
                  onClick={async () => {
                    const r = await fetch(`${base}/api/investigations/${inv?.id}/ingest-onedrive`,
                      { method: "POST", credentials: "include" });
                    const d = await r.json();
                    if (!d.error) {
                      const r2 = await fetch(`${base}/api/investigations/${inv?.id}/osint-history`, { credentials: "include" });
                      if (r2.ok) { const d2 = await r2.json(); setOsintFindings(d2.findings || []); setOsintMeta({maigret_unverified: d2.maigret_unverified||0, total_all: d2.total_all||0, hidden_low_conf: d2.hidden_low_conf||0}); }
                    }
                  }}
                  style={{ fontSize: 11, padding: "5px 12px", cursor: "pointer",
                    background: "#6366f1", color: "white", border: "none", borderRadius: 6, marginBottom: 4 }}>
                  📂 OneDrive
                </button>
                <button
                  disabled={verifyTask !== null && verifyTask.state !== "SUCCESS" && verifyTask.state !== "FAILURE"}
                  onClick={async () => {
                    const r = await fetch(`${base}/api/investigations/${inv?.id}/verify-findings?max_urls=100`,
                      { method: "POST", credentials: "include" });
                    const d = await r.json();
                    if (!d.task_id) return;
                    setVerifyTask({ id: d.task_id, state: "PENDING", current: 0, total: 0, status: "Starting..." });
                    // Poll for progress
                    const poll = setInterval(async () => {
                      const rs = await fetch(`${base}/api/investigations/${inv?.id}/verify-findings/status?task_id=${d.task_id}`,
                        { credentials: "include" });
                      const ds = await rs.json();
                      setVerifyTask({ id: d.task_id, state: ds.state, current: ds.current, total: ds.total, status: ds.status || "" });
                      if (ds.ready) {
                        clearInterval(poll);
                        // Reload findings
                        const r2 = await fetch(`${base}/api/investigations/${inv?.id}/osint-history`, { credentials: "include" });
                        if (r2.ok) { const d2 = await r2.json(); setOsintFindings(d2.findings || []); setOsintMeta({maigret_unverified: d2.maigret_unverified||0, total_all: d2.total_all||0, hidden_low_conf: d2.hidden_low_conf||0}); }
                      }
                    }, 4000);
                  }}
                  style={{ fontSize: 11, padding: "5px 12px", cursor: "pointer",
                    background: verifyTask && verifyTask.state !== "SUCCESS" && verifyTask.state !== "FAILURE" ? mut : "#10b981",
                    color: "white", border: "none", borderRadius: 6, marginBottom: 4 }}>
                  {verifyTask && verifyTask.state !== "SUCCESS" && verifyTask.state !== "FAILURE"
                    ? `⏳ ${verifyTask.current}/${verifyTask.total}`
                    : "✅ Verify"}
                </button>
                {meta?.email_classification === "followup" && (
                  <button
                    onClick={async () => {
                      const r = await fetch(`${base}/api/investigations/${inv?.id}/import-prior-findings`,
                        { method: "POST", credentials: "include" });
                      const d = await r.json();
                      if (d.ok) {
                        alert(`✅ Imported ${d.imported} confirmed findings from ${d.prior_investigations} prior case(s)`);
                        const r2 = await fetch(`${base}/api/investigations/${inv?.id}/osint-history`, { credentials: "include" });
                        if (r2.ok) { const d2 = await r2.json(); setOsintFindings(d2.findings || []); setOsintMeta({maigret_unverified: d2.maigret_unverified||0, total_all: d2.total_all||0, hidden_low_conf: d2.hidden_low_conf||0}); }
                      }
                    }}
                    style={{ fontSize: 11, padding: "5px 12px", cursor: "pointer",
                      background: "#f59e0b", color: "white", border: "none", borderRadius: 6, marginBottom: 4 }}>
                    ⟳ Prior case
                  </button>
                )}
              </div>
            </div>

            {/* OSINT findings */}
            {histTab === "osint" && (
              <div>
                {findings.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 16px", border: `1px dashed ${bdr}`, borderRadius: 8 }}>
                    <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔍</p>
                    <p style={{ fontSize: 13, color: sec, margin: "0 0 12px" }}>
                      {inv?.status === "completed"
                        ? "OSINT completed — click to load findings summary"
                        : "Run OSINT to start collecting data about this subject"}
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={async () => {
                          const r = await fetch(`${base}/api/investigations/${inv?.id}/osint-history`, { credentials: "include" });
                          if (r.ok) { const d = await r.json(); setOsintFindings(d.findings || []); }
                        }}
                        style={{ fontSize: 12, fontWeight: 600, padding: "8px 20px", cursor: "pointer",
                          background: acc, color: "white", border: "none", borderRadius: 7 }}>
                        📊 Load OSINT findings
                      </button>
                      <button
                        onClick={async () => {
                          const r = await fetch(`${base}/api/investigations/${inv?.id}/ingest-onedrive`,
                            { method: "POST", credentials: "include" });
                          const d = await r.json();
                          if (d.error) { alert("❌ " + d.error); return; }
                          alert(`✅ Imported from OneDrive:\n• ${d.social_profiles} social profiles\n• ${d.photos} photos\n• ${d.vehicles} vehicles\n• ${d.face_recognition} face recognition\n• ${d.people_search} people search\n• ${d.identity_docs} identity docs`);
                          // Reload findings
                          const r2 = await fetch(`${base}/api/investigations/${inv?.id}/osint-history`, { credentials: "include" });
                          if (r2.ok) { const d2 = await r2.json(); setOsintFindings(d2.findings || []); }
                        }}
                        style={{ fontSize: 12, fontWeight: 600, padding: "8px 20px", cursor: "pointer",
                          background: "#6366f1", color: "white", border: "none", borderRadius: 7 }}>
                        📂 Import from OneDrive
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Summary bar */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 8 }}>
                      {[
                        { label: "Verified findings", value: findings.length, color: acc },
                        { label: "Platforms", value: Object.keys(byPlatform).length, color: "#10b981" },
                        { label: "High confidence", value: findings.filter((f:any) => (f.confidence||0) >= 0.85).length, color: "#6366f1" },
                        { label: "Photos found", value: findings.filter((f:any) => f.finding_type === "photo_match" || f.finding_type === "photo").length, color: "#ec4899" },
                      ].map(s => (
                        <div key={s.label} style={{ border: `1px solid ${bdr}`, borderRadius: 7,
                          padding: "10px 12px", background: bg2, textAlign: "center" }}>
                          <p style={{ fontSize: 22, fontWeight: 700, color: s.color, margin: "0 0 2px" }}>{s.value}</p>
                          <p style={{ fontSize: 10, color: sec, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                    {/* Verify progress bar */}
                    {verifyTask && verifyTask.state !== "SUCCESS" && verifyTask.state !== "FAILURE" && (
                      <div style={{ border: `1px solid ${acc}`, borderRadius: 7, padding: "8px 12px",
                        background: bg1, marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: txt, fontWeight: 600 }}>
                            ⏳ Verifying findings...
                          </span>
                          <span style={{ fontSize: 11, color: sec }}>
                            {verifyTask.current}/{verifyTask.total}
                          </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: bdr, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 3, background: acc, transition: "width 0.5s",
                            width: verifyTask.total > 0 ? `${Math.round(verifyTask.current/verifyTask.total*100)}%` : "5%" }} />
                        </div>
                        {verifyTask.status && (
                          <p style={{ fontSize: 11, color: sec, margin: "4px 0 0" }}>{verifyTask.status}</p>
                        )}
                      </div>
                    )}

                    {/* Stats note */}
                    {(osintMeta.maigret_unverified > 0 || osintMeta.hidden_low_conf > 0) && (
                      <div style={{ border: `1px solid ${bdr}`, borderRadius: 7, padding: "8px 12px",
                        background: bg1, marginBottom: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        {osintMeta.hidden_low_conf > 0 && (
                          <span style={{ fontSize: 11, color: mut }}>
                            🔽 {osintMeta.hidden_low_conf} low-confidence findings hidden (&lt;80%)
                          </span>
                        )}
                        {osintMeta.maigret_unverified > 0 && (
                          <span style={{ fontSize: 11, color: sec }}>
                            ⏳ {osintMeta.maigret_unverified} pending verification (auto-running)
                          </span>
                        )}
                      </div>
                    )}

                    {/* By platform */}
                    {Object.entries(byPlatform).sort(([,a]:any,[,b]:any) => b.length - a.length).map(([plat, items]: any) => (
                      <div key={plat} style={{ border: `1px solid ${bdr}`, borderRadius: 8, overflow: "hidden" }}>
                        {/* Platform header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                          background: bg1, borderBottom: `1px solid ${bdr}` }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%",
                            background: PLAT_COLORS[plat] || mut }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: txt, textTransform: "capitalize" }}>
                            {plat}
                          </span>
                          <span style={{ fontSize: 11, color: sec }}>{items.length} finding{items.length > 1 ? "s" : ""}</span>
                          {/* Source badges */}
                          {[...new Set(items.map((f:any) => f.engine))].map((eng:any) => (
                            <span key={eng} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 20,
                              background: eng === "onedrive_ingestor" ? "#dbeafe" :
                                          eng === "holehe" ? "#dcfce7" :
                                          eng === "maigret" ? "#fef9c3" : `${mut}22`,
                              color: eng === "onedrive_ingestor" ? "#1e40af" :
                                     eng === "holehe" ? "#166534" :
                                     eng === "maigret" ? "#854d0e" : mut }}>
                              {eng === "onedrive_ingestor" ? "📂 OneDrive" :
                               eng === "holehe" ? "📧 holehe" :
                               eng === "maigret" ? "🔍 maigret" : eng}
                            </span>
                          ))}
                          <span style={{ marginLeft: "auto", fontSize: 10, color: mut }}>
                            avg {Math.round(items.reduce((s:number,f:any) => s+(f.confidence||0),0)/items.length*100)}%
                          </span>
                        </div>
                        {/* Items */}
                        <div style={{ background: bg2 }}>
                          {items.slice(0, 5).map((f: any, i: number) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                              padding: "7px 12px", borderBottom: i < Math.min(items.length,5)-1 ? `0.5px solid ${bdr}` : "none" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px",
                                borderRadius: 20, background: `${PLAT_COLORS[plat] || mut}22`,
                                color: PLAT_COLORS[plat] || mut, flexShrink: 0 }}>
                                {Math.round((f.confidence||0)*100)}%
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 12, color: txt, margin: 0,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {f.title || f.found_username || f.found_email || f.url || "Finding"}
                                </p>
                                {f.url && (
                                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 10, color: acc, textDecoration: "none",
                                      overflow: "hidden", textOverflow: "ellipsis",
                                      whiteSpace: "nowrap", display: "block" }}>
                                    {f.url.substring(0, 60)}{f.url.length > 60 ? "…" : ""}
                                  </a>
                                )}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                              <span style={{ fontSize: 10, color: mut }}>{f.finding_type?.replace("_"," ")}</span>
                              <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 20,
                                background: f.validation_status === "confirmed" ? "#dcfce7" :
                                            f.validation_status === "rejected"  ? "#fee2e2" :
                                            f.validation_status === "partial"   ? "#fef9c3" :
                                            f.validation_status === "private"   ? "#dbeafe" : "transparent",
                                color: f.validation_status === "confirmed" ? "#166534" :
                                       f.validation_status === "rejected"  ? "#991b1b" :
                                       f.validation_status === "partial"   ? "#854d0e" :
                                       f.validation_status === "private"   ? "#1e40af" : mut }}>
                                {f.validation_status === "confirmed" ? "✓ verified" :
                                 f.validation_status === "rejected"  ? "✗ not found" :
                                 f.validation_status === "partial"   ? "~ partial" :
                                 f.validation_status === "private"   ? "🔒 private" : ""}
                              </span>
                            </div>
                            </div>
                          ))}
                          {items.length > 5 && (
                            <div style={{ padding: "6px 12px", fontSize: 11, color: sec }}>
                              +{items.length - 5} more findings on {plat}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Prior surveillance */}
            {histTab === "surveillance" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* ── Investigator summaries from email ── */}
                <SummariesBlock invId={inv?.id} isDark={isDark} acc={_acc} sec={_sec} txt={_txt} bg1={_bg1} bg2={_bg2} bdr={_bdr} mut={_mut} />

                {/* Prior surveillance days — chronological history */}
                {(() => {
                  const priorDays = (meta?.prior_surveillance_days || []) as any[];
                  if (priorDays.length === 0) return null;
                  return (
                    <div style={{ border: `1px solid ${bdr}`, borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ padding: "10px 14px", background: isDark ? "rgba(245,158,11,0.12)" : "#fffbeb",
                        borderBottom: `1px solid ${bdr}`, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em",
                          color: isDark ? "#f59e0b" : "#92400e", fontWeight: 700 }}>
                          📋 Historical surveillance days ({priorDays.length})
                        </span>
                        <span style={{ fontSize: 10, color: mut }}>from prior case</span>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: bg2 }}>
                            {["Date","Start","End","Hours","Observed"].map(h => (
                              <th key={h} style={{ padding: "6px 12px", fontSize: 9, fontWeight: 700,
                                textTransform: "uppercase", color: mut, textAlign: "left",
                                borderBottom: `1px solid ${bdr}`, whiteSpace: "nowrap" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {priorDays.map((d: any, i: number) => {
                            const observed = d.recorded === true || d.recorded === "true";
                            const startStr = d.start ? String(d.start).substring(0,5) : "—";
                            const endStr   = d.end   ? String(d.end).substring(0,5)   : "—";
                            const rowBg    = i % 2 === 1 ? bg2 : bg1;
                            return (
                              <tr key={i} style={{ background: rowBg }}>
                                <td style={{ padding: "7px 12px", color: txt, borderBottom: `0.5px solid ${bdr}`, whiteSpace: "nowrap" }}>
                                  {d.date || "—"}
                                </td>
                                <td style={{ padding: "7px 12px", color: sec, borderBottom: `0.5px solid ${bdr}` }}>
                                  {startStr}
                                </td>
                                <td style={{ padding: "7px 12px", color: sec, borderBottom: `0.5px solid ${bdr}` }}>
                                  {endStr}
                                </td>
                                <td style={{ padding: "7px 12px", color: sec, borderBottom: `0.5px solid ${bdr}` }}>
                                  {d.hours > 0 ? `${d.hours}h` : "—"}
                                </td>
                                <td style={{ padding: "7px 12px", borderBottom: `0.5px solid ${bdr}` }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px",
                                    borderRadius: 20,
                                    background: observed ? "#dcfce7" : "#fee2e2",
                                    color:      observed ? "#166534" : "#991b1b" }}>
                                    {observed ? "Yes" : "No"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {/* Prior case cards */}
                {priorSurv.length === 0 && (meta?.prior_surveillance_days || []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 16px", border: `1px dashed ${bdr}`, borderRadius: 8 }}>
                    <p style={{ fontSize: 32, margin: "0 0 8px" }}>📋</p>
                    <p style={{ fontSize: 13, color: sec, margin: 0 }}>No prior surveillance found for this subject.</p>
                  </div>
                ) : priorSurv.length > 0 ? priorSurv.map((s: any, i: number) => (
                  <div key={i} style={{ border: `1px solid ${bdr}`, borderRadius: 8,
                    padding: "12px 14px", background: bg2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: s.status === "completed" ? "#dcfce7" : "#dbeafe",
                        color: s.status === "completed" ? "#166534" : "#1e40af" }}>
                        {(s.status || "unknown").toUpperCase()}
                      </span>
                      {s.date && <span style={{ fontSize: 11, color: sec }}>{s.date}</span>}
                      {s.claim && <span style={{ fontSize: 11, color: mut }}>Claim: {s.claim}</span>}
                      {s.days && s.days !== "0" && <span style={{ fontSize: 11, color: mut }}>{s.days}d</span>}
                    </div>
                    {s.source === "db" ? (
                      <>
                        <p style={{ fontSize: 13, fontWeight: 500, color: txt, margin: "0 0 3px" }}>{s.subject_name}</p>
                        {s.email_subject && <p style={{ fontSize: 11, color: sec, margin: "0 0 5px" }}>{s.email_subject}</p>}
                        <a href={`/investigations/${s.inv_id}`}
                          style={{ fontSize: 12, color: acc, fontWeight: 600, textDecoration: "none" }}>
                          → View Inv #{s.inv_id}
                        </a>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 12, color: txt, margin: "0 0 2px" }}>
                          {s.filename?.replace(/^COMPLETED - /,"").substring(0,80)}
                        </p>
                        {s.due_date && <p style={{ fontSize: 11, color: sec, margin: 0 }}>Due: {s.due_date}</p>}
                        <p style={{ fontSize: 10, color: mut, margin: "3px 0 0" }}>📂 OneDrive / CLOSED SURVEILLANCE</p>
                      </>
                    )}
                  </div>
                )) : null}
              </div>
            )}
          </div>
        );
      })()}

      {/* AUDIT */}
      {tab === "documents" && (
        <DocumentsTab inv={inv} meta={meta} isDark={isDark} acc={_acc} sec={_sec} txt={_txt} bg1={_bg1} bg2={_bg2} bdr={_bdr} mut={_mut} />
      )}

      {tab === "email" && (
        <EmailTab inv={inv} meta={meta} isDark={isDark} acc={_acc} sec={_sec} txt={_txt} bg1={_bg1} bg2={_bg2} bdr={_bdr} />
      )}
      {tab === "template" && (
        <TemplateTab inv={inv} meta={meta} isDark={isDark} acc={_acc} sec={_sec} txt={_txt} bg1={_bg1} bg2={_bg2} bdr={_bdr} />
      )}


      {tab === "audit" && (() => {
        const EXPECTED_FIELDS = [
          { key: "claim_number",        label: "Claim #",              source: "docx" },
          { key: "adjuster_name",       label: "Adjuster name",        source: "docx" },
          { key: "adjuster_phone",      label: "Adjuster phone",       source: "docx" },
          { key: "adjuster_ext",        label: "Adjuster ext",         source: "docx" },
          { key: "adjuster_email",      label: "Adjuster email",       source: "docx" },
          { key: "client_company",      label: "Client company",       source: "docx" },
          { key: "employer_name",       label: "Employer name",        source: "docx" },
          { key: "employer_contact",    label: "Employer contact",     source: "docx" },
          { key: "employer_phone",      label: "Employer phone",       source: "docx" },
          { key: "subject_job",         label: "Job title",            source: "docx" },
          { key: "employment_status",   label: "Employment status",    source: "docx" },
          { key: "primary_language",    label: "Primary language",     source: "docx" },
          { key: "date_of_injury",      label: "Date of injury",       source: "docx" },
          { key: "body_parts",          label: "Body parts injured",   source: "docx" },
          { key: "restrictions",        label: "Restrictions",         source: "docx" },
          { key: "is_represented",      label: "Represented by atty?", source: "docx" },
          { key: "defense_attorney",    label: "Defense attorney",     source: "docx" },
          { key: "defense_law_firm",    label: "Defense law firm",     source: "docx" },
          { key: "defense_phone",       label: "Defense phone",        source: "docx" },
          { key: "surveillance_days",   label: "Surveillance days",    source: "docx" },
          { key: "report_due_date",     label: "Report due date",      source: "docx" },
          { key: "instructions",        label: "Instructions",         source: "docx" },
          { key: "subject_name",        label: "Subject name",         source: "both" },
          { key: "subject_dob",         label: "Date of birth",        source: "both" },
          { key: "subject_ssn",         label: "SSN",                  source: "both" },
          { key: "subject_phones",      label: "Phone numbers",        source: "tlo" },
          { key: "subject_emails",      label: "Email addresses",      source: "tlo" },
          { key: "subject_addresses",   label: "Addresses",            source: "both" },
          // Litigation / non-standard cases
          { key: "attorney_plaintiff",   label: "Plaintiff attorney",   source: "docx" },
          { key: "incident_location",    label: "Incident location",    source: "docx" },
          { key: "incident_description", label: "Incident description", source: "docx" },
        ];

        const filled   = EXPECTED_FIELDS.filter(f => {
          if (f.key === "subject_phones")    return (inv?.subject_phones?.length || 0) > 0;
          if (f.key === "subject_emails")    return (inv?.subject_emails?.length || 0) > 0;
          if (f.key === "subject_addresses") return (inv?.subject_addresses?.length || 0) > 0;
          if (f.key === "subject_name")      return !!inv?.subject_name;
          if (f.key === "subject_dob")       return !!inv?.subject_dob;
          return !!(meta as any)?.[f.key];
        });
        const missing  = EXPECTED_FIELDS.filter(f => !filled.includes(f));
        const pct = Math.round((filled.length / EXPECTED_FIELDS.length) * 100);

        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                Extraction completeness
              </p>
              <button
                onClick={runEnrichment}
                disabled={enriching}
                style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "6px 14px",
                  cursor: enriching ? "wait" : "pointer",
                  background: enriching ? "#9ca3af" : "#6366f1",
                  color: "white", border: "none", borderRadius: 7,
                  display: "flex", alignItems: "center", gap: 5 }}
                title="Run OSINT engines to fill in missing data">
                {enriching ? "⏳ Running..." : "🔍 Enrich missing data"}
              </button>
              {enrichMsg && (
                <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 500 }}>{enrichMsg}</span>
              )}
              <div style={{ flex: 1, height: 8, background: "var(--surface-0)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`,
                  background: pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444",
                  borderRadius: 4, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700,
                color: pct >= 80 ? "#166534" : pct >= 50 ? "#92400e" : "#991b1b" }}>
                {pct}%
              </span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {filled.length}/{EXPECTED_FIELDS.length} fields
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {EXPECTED_FIELDS.map(f => {
                const isFilled = filled.includes(f);
                let val = (meta as any)?.[f.key];
                if (f.key === "subject_name")      val = inv?.subject_name;
                if (f.key === "subject_dob")       val = inv?.subject_dob;
                if (f.key === "subject_phones")    val = (inv?.subject_phones || []).join(", ");
                if (f.key === "subject_emails")    val = (inv?.subject_emails || []).join(", ");
                if (f.key === "subject_addresses") val = (inv?.subject_addresses || []).join("; ");
                return (
                  <div key={f.key} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "5px 8px",
                    borderRadius: 6, background: isFilled ? "var(--surface-1)" : "var(--bg-error, #fef2f2)",
                    border: `0.5px solid ${isFilled ? "var(--border)" : "#fecaca"}` }}>
                    <span style={{ fontSize: 13, marginTop: 1 }}>{isFilled ? "✅" : "⚠️"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em",
                        color: isFilled ? "var(--text-secondary)" : "#991b1b", margin: "0 0 1px", fontWeight: 600 }}>
                        {f.label}
                        <span style={{ fontWeight: 400, marginLeft: 4, opacity: 0.6 }}>({f.source})</span>
                      </p>
                      {isFilled && (
                        <p style={{ fontSize: 11, color: "var(--text-primary)", margin: 0, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {String(val || "").substring(0, 60)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ASSIGNMENT */}
      {tab === "assignment" && (() => {
        const bdr = _bdr, bg1 = _bg1, bg2 = _bg2, txt = _txt, sec = _sec, mut = _mut, acc = _acc;

        const Blk = ({ title, children }: { title: string; children: React.ReactNode }) => (
          <div style={{ border: `1px solid ${bdr}`, borderRadius: 8, padding: "12px 14px", background: bg2 }}>
            <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: mut, fontWeight: 700, margin: "0 0 10px" }}>{title}</p>
            {children}
          </div>
        );

        const FRow = ({ fields }: { fields: { label: string; value: string|null; key: string }[] }) => (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${fields.length}, 1fr)`, gap: 8 }}>
            {fields.map(f => <Field key={f.label} label={f.label} value={f.value} onEdit={save(f.key)} />)}
          </div>
        );

        const emailClass = meta?.email_classification || "";
        const isReopen   = emailClass === "followup";
        const prevDays   = meta?.days_previously_completed;
        const reqDate    = meta?.request_date || meta?.email_received_at;
        const dueDate    = meta?.report_due_date;
        const survDays   = meta?.surveillance_days;
        const instructions = meta?.instructions;
        const claimNo    = meta?.claim_number;
        const adjuster   = meta?.adjuster_name;
        const adjPhone   = meta?.adjuster_phone;
        const adjExt     = meta?.adjuster_ext;

        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Left: Current assignment */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700,
                color: sec, margin: 0, paddingBottom: 8, borderBottom: `2px solid ${bdr}` }}>
                Current assignment
                {isReopen && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, padding: "2px 8px",
                    borderRadius: 20, background: "#fef9c3", color: "#854d0e", border: "1px solid #fde047" }}>
                    ⟳ Reopened{prevDays && prevDays !== "0" ? ` — ${prevDays}d prior` : ""}
                  </span>
                )}
                {!isReopen && emailClass === "new_case" && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, padding: "2px 8px",
                    borderRadius: 20, background: "#dcfce7", color: "#166534", border: "1px solid #86efac" }}>
                    ✨ New case
                  </span>
                )}
              </p>

              <Blk title="Assignment details">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Field label="Claim #"          value={claimNo}    onEdit={save("claim_number")} />
                  <Field label="Days requested"   value={survDays}   onEdit={save("surveillance_days")} />
                  <Field label="Request date"     value={reqDate ? new Date(reqDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : null} onEdit={save("request_date")} />
                  <Field label="Report due"       value={dueDate}    onEdit={save("report_due_date")} />
                </div>
              </Blk>

              <Blk title="Requestor">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Field label="Adjuster"         value={adjuster}   onEdit={save("adjuster_name")} />
                  <Field label="Phone / Ext"      value={adjPhone ? `${adjPhone}${adjExt ? ` ext ${adjExt}` : ""}` : null} onEdit={save("adjuster_phone")} />
                </div>
              </Blk>

              {instructions && (
                <div style={{ border: `1px solid #f59e0b`, borderRadius: 8, padding: "10px 14px", background: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb" }}>
                  <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: "#92400e", fontWeight: 700, margin: "0 0 6px" }}>
                    ⚠️ Instructions
                  </p>
                  <p style={{ fontSize: 12, color: txt, margin: 0, lineHeight: 1.5 }}>{instructions.substring(0,400)}</p>
                </div>
              )}

              {/* Extra rows for additional assignments */}
              <Blk title="Add assignment">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 140px 1fr", gap: 8 }}>
                  {["Date assigned","Complete by","Priority","Requestor","Assignment"].map(h => (
                    <Field key={h} label={h} value={null} onEdit={()=>{}} />
                  ))}
                </div>
                <button style={{ marginTop: 10, fontSize: 12, padding: "5px 14px", cursor: "pointer",
                  background: bg2, border: `1px solid ${bdr}`, borderRadius: 6, color: txt }}>
                  + Add another assignment
                </button>
              </Blk>
            </div>

            {/* Right: Prior surveillance history */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700,
                color: sec, margin: 0, paddingBottom: 8, borderBottom: `2px solid ${bdr}` }}>
                Surveillance history for {inv?.subject_name?.split(" ").pop()}
              </p>

              {(!meta?.prior_surveillance || meta.prior_surveillance.length === 0) ? (
                <div style={{ border: `1px solid ${bdr}`, borderRadius: 8, padding: "24px 16px",
                  background: bg2, textAlign: "center" }}>
                  <p style={{ fontSize: 24, margin: "0 0 8px" }}>📋</p>
                  <p style={{ fontSize: 13, color: sec, margin: 0 }}>
                    {isReopen ? "No prior cases found in this system — may be in CROSStrax." : "First surveillance for this subject."}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(meta.prior_surveillance as any[]).map((s: any, i: number) => (
                    <div key={i} style={{ border: `1px solid ${bdr}`, borderRadius: 8, padding: "12px 14px", background: bg2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: s.status === "completed" ? "#dcfce7" : s.status === "draft" ? "#dbeafe" : "#fef9c3",
                          color: s.status === "completed" ? "#166534" : s.status === "draft" ? "#1e40af" : "#854d0e" }}>
                          {(s.status || "unknown").toUpperCase()}
                        </span>
                        {s.date && <span style={{ fontSize: 11, color: sec }}>{s.date}</span>}
                        {s.claim && <span style={{ fontSize: 11, color: mut }}>Claim: {s.claim}</span>}
                        {s.days && s.days !== "0" && <span style={{ fontSize: 11, color: mut }}>{s.days}d</span>}
                      </div>
                      {s.source === "db" ? (
                        <>
                          <p style={{ fontSize: 13, color: txt, fontWeight: 500, margin: "0 0 3px" }}>{s.subject_name}</p>
                          {s.email_subject && <p style={{ fontSize: 11, color: sec, margin: "0 0 4px" }}>{s.email_subject}</p>}
                          <a href={`/investigations/${s.inv_id}`}
                            style={{ fontSize: 12, color: acc, textDecoration: "none", fontWeight: 600 }}>
                            → View Inv #{s.inv_id}
                          </a>
                        </>
                      ) : (
                        <>
                          {s.claim && <p style={{ fontSize: 12, fontWeight: 600, color: txt, margin: "0 0 3px" }}>Claim: {s.claim}</p>}
                          {s.filename && <p style={{ fontSize: 12, color: txt, margin: "0 0 2px" }}>{s.filename?.replace(/^COMPLETED - /,"").replace(/^CALENDERED - /,"").substring(0,80)}</p>}
                          {s.due_date && <p style={{ fontSize: 11, color: sec, margin: "0 0 3px" }}>Due: {s.due_date}</p>}
                          {s.notes && <p style={{ fontSize: 11, color: sec, margin: "0 0 4px" }}>{s.notes}</p>}
                          {(s.photos_found?.length > 0 || s.profiles_found?.length > 0 || s.vehicles_found?.length > 0) && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                              {s.photos_found?.length > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                                  background: "#dbeafe", color: "#1e40af" }}>📷 {s.photos_found.length} photos</span>
                              )}
                              {s.profiles_found?.length > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                                  background: "#dcfce7", color: "#166534" }}>👤 {s.profiles_found.filter((f: string) => f.toLowerCase().endsWith('.pdf')).length} profiles</span>
                              )}
                              {s.vehicles_found?.length > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                                  background: "#fef9c3", color: "#854d0e" }}>🚗 {s.vehicles_found.length} vehicles</span>
                              )}
                            </div>
                          )}
                          <p style={{ fontSize: 10, color: mut, margin: "4px 0 0" }}>📂 OneDrive / CLOSED SURVEILLANCE</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isReopen && prevDays && prevDays !== "0" && (
                <div style={{ border: `1px solid #f59e0b`, borderRadius: 8, padding: "10px 14px",
                  background: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#92400e", margin: "0 0 2px" }}>
                    ⚠️ {prevDays} days of surveillance already completed
                  </p>
                  <p style={{ fontSize: 11, color: sec, margin: 0 }}>
                    Review prior surveillance records before scheduling new dates.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}


    </div>
  );
}

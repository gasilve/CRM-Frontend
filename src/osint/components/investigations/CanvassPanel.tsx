// @ts-nocheck

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface Facility {
  id: string; name: string; address: string; city: string; state: string;
  zip: string; phone: string; distance_mi: number;
  type: "hospital" | "urgent_care" | "pharmacy" | "psychiatric" | "other";
  status: "pending" | "no_record" | "with_record" | "chart_only" | "dismissed";
  record_note?: RecordNote;
}

interface RecordEntry {
  last_visit: string; first_visit: string; confirmed_by_dept: string; criteria: string[];
  record_name_variant?: string;
  service_type: string; notes: string;
}
// record_note is now an array of entries (multi-visit support)
interface RecordNote {
  entries: RecordEntry[];
  account_info?: string;
}

interface CanvassFacilityResult {
  facility_id: string; status: "no_record" | "with_record" | "pending" | "chart_only" | "dismissed";
  record_note?: RecordNote; notes?: string;
}

const TYPE_CFG: Record<string, {
  label: string; dot: string;
  chipOnLight: string; chipTextLight: string;
  chipOnDark: string;  chipTextDark: string;
  defaultOn?: boolean;
}> = {
  hospital:         { label: "Hospital",          dot: "#e5484d", defaultOn: true,  chipOnLight: "#ffeaea", chipTextLight: "#9b1e23", chipOnDark: "rgba(229,72,77,0.22)",   chipTextDark: "#f87171" },
  urgent_care:      { label: "Urgent care",       dot: "#f76b15", defaultOn: true,  chipOnLight: "#fff3ed", chipTextLight: "#9a3412", chipOnDark: "rgba(247,107,21,0.22)",  chipTextDark: "#fb923c" },
  pharmacy:         { label: "Pharmacy",           dot: "#1a9a6c", defaultOn: true,  chipOnLight: "#edfaf5", chipTextLight: "#10613e", chipOnDark: "rgba(26,154,108,0.22)",  chipTextDark: "#34d399" },
  imaging:          { label: "Diagnostic imaging", dot: "#6366f1", defaultOn: false, chipOnLight: "#eef2ff", chipTextLight: "#3730a3", chipOnDark: "rgba(99,102,241,0.22)",  chipTextDark: "#818cf8" },
  orthopedic:       { label: "Orthopedic",         dot: "#f59e0b", defaultOn: false, chipOnLight: "#fffbeb", chipTextLight: "#78350f", chipOnDark: "rgba(245,158,11,0.22)",  chipTextDark: "#fbbf24" },
  physical_therapy: { label: "Physical therapy",   dot: "#14b8a6", defaultOn: false, chipOnLight: "#f0fdfa", chipTextLight: "#134e4a", chipOnDark: "rgba(20,184,166,0.22)",  chipTextDark: "#2dd4bf" },
  pain_management:  { label: "Pain management",    dot: "#ef4444", defaultOn: false, chipOnLight: "#fef2f2", chipTextLight: "#7f1d1d", chipOnDark: "rgba(239,68,68,0.22)",   chipTextDark: "#fca5a5" },
  neurology:        { label: "Neurology",           dot: "#a855f7", defaultOn: false, chipOnLight: "#faf5ff", chipTextLight: "#581c87", chipOnDark: "rgba(168,85,247,0.22)",  chipTextDark: "#d8b4fe" },
  surgery_center:   { label: "Surgery center",     dot: "#dc2626", defaultOn: false, chipOnLight: "#fff1f2", chipTextLight: "#881337", chipOnDark: "rgba(220,38,38,0.22)",   chipTextDark: "#fda4af" },
  lab:              { label: "Lab / Blood work",   dot: "#64748b", defaultOn: false, chipOnLight: "#f8fafc", chipTextLight: "#1e293b", chipOnDark: "rgba(100,116,139,0.22)", chipTextDark: "#94a3b8" },
  psychiatric:      { label: "Psychiatric",         dot: "#8b5cf6", defaultOn: false, chipOnLight: "#f5f0ff", chipTextLight: "#5b21b6", chipOnDark: "rgba(139,92,246,0.22)",  chipTextDark: "#a78bfa" },
  mental_health:    { label: "Mental health",       dot: "#ec4899", defaultOn: false, chipOnLight: "#fdf2f8", chipTextLight: "#831843", chipOnDark: "rgba(236,72,153,0.22)",  chipTextDark: "#f9a8d4" },
  chiropractor:     { label: "Chiropractor",        dot: "#7c3aed", defaultOn: false, chipOnLight: "#f3e8ff", chipTextLight: "#6b21a8", chipOnDark: "rgba(124,58,237,0.22)",  chipTextDark: "#c4b5fd" },
  primary_care:     { label: "Primary care",        dot: "#0ea5e9", defaultOn: false, chipOnLight: "#e0f2fe", chipTextLight: "#0c4a6e", chipOnDark: "rgba(14,165,233,0.22)",  chipTextDark: "#38bdf8" },
};

const DEPTS = ["Billing", "Administration", "Reception", "Medical Records", "Nursing"];
const CRITERIA_OPTS = ["Name", "Date of birth", "Phone", "Address", "SSN"];

// Format phone number for tel: link (strip non-digits, add +1 if US)
function formatTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `tel:+1${digits}` : `tel:+${digits}`;
}

// Phone display component with tel: link + 📞 icon
function PhoneLink({ phone, acc }: { phone: string; acc: string }) {
  if (!phone) return null;
  const href = formatTelHref(phone);
  return (
    <a href={href} style={{
      fontSize: 12, color: acc, marginTop: 1, display: "inline-flex",
      alignItems: "center", gap: 4, textDecoration: "none",
      cursor: "pointer",
    }}
    title="Click to call (opens Vonage or phone app)">
      📞 {phone}
    </a>
  );
}


// ── Service types list ──────────────────────────────────────────────────────
const SERVICE_TYPES = [
  "Emergency care", "Orthopedic surgery", "Physical therapy", "Chiropractic",
  "Pain management", "Neurology", "Neurosurgery", "Spine surgery",
  "Occupational therapy", "MRI / Imaging", "X-Ray", "CT Scan",
  "General surgery", "Pharmacy / Medication", "Primary care",
  "Urgent care", "Rehabilitation", "Psychiatry / Mental health",
  "Podiatry", "Ophthalmology", "Cardiology", "Pulmonology",
  "Internal medicine", "Acupuncture", "Injection / Epidural",
];

// ── Mini calendar component ──────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];

function MiniCalendar({ value, onChange, isDark, acc, bdr, txt, sec, mut }: {
  value: string; onChange: (v: string) => void;
  isDark: boolean; acc: string; bdr: string; txt: string; sec: string; mut: string;
}) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [showCal, setShowCal] = useState(false);

  // Parse existing value
  const parsed = value ? value.trim() : "";

  const bg = isDark ? "#0f172a" : "#f8fafc";
  const bg2 = isDark ? "#1e2433" : "#ffffff";
  const border = `1px solid ${isDark ? "#334155" : "#e2e8f0"}`;

  // Days in month grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number|null)[] = [...Array(firstDay).fill(null),
                                   ...Array.from({length: daysInMonth}, (_,i) => i+1)];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const selectDay = (d: number) => {
    const label = `${MONTH_FULL[month]} ${d}, ${year}`;
    onChange(label);
    setShowCal(false);
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };

  return (
    <div style={{ position: "relative" }}>
      {/* Input + calendar toggle */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g. March 2024"
          style={{ flex: 1, padding: "7px 10px", fontSize: 13, borderRadius: 7,
            border, background: bg, color: txt, outline: "none" }}
        />
        <button
          onClick={() => setShowCal(v => !v)}
          title="Pick date"
          style={{ padding: "7px 10px", borderRadius: 7, border, background: showCal ? acc : bg,
            color: showCal ? "white" : sec, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>
          📅
        </button>
      </div>

      {/* Calendar dropdown */}
      {showCal && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 10,
          background: bg2, border, borderRadius: 10, padding: 12, width: 240,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>

          {/* Month/Year nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button onClick={prevMonth}
              style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 16, color: sec, padding: "0 4px" }}>‹</button>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                style={{ fontSize: 12, fontWeight: 600, color: txt, background: bg, border,
                  borderRadius: 5, padding: "2px 4px", cursor: "pointer" }}>
                {MONTHS.map((m,i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                style={{ fontSize: 12, fontWeight: 600, color: txt, background: bg, border,
                  borderRadius: 5, padding: "2px 4px", cursor: "pointer" }}>
                {Array.from({length: 10}, (_,i) => now.getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button onClick={nextMonth}
              style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 16, color: sec, padding: "0 4px" }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, marginBottom: 4 }}>
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, color: mut, fontWeight: 700, padding: "2px 0" }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const label = `${MONTH_FULL[month]} ${d}, ${year}`;
              const isSelected = value === label;
              const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
              return (
                <button key={i} onClick={() => selectDay(d)}
                  style={{ padding: "4px 0", borderRadius: 5, border: "none", cursor: "pointer",
                    fontSize: 12, textAlign: "center",
                    background: isSelected ? acc : isToday ? `${acc}33` : "transparent",
                    color: isSelected ? "white" : isToday ? acc : txt,
                    fontWeight: isSelected || isToday ? 700 : 400 }}>
                  {d}
                </button>
              );
            })}
          </div>

          {/* Quick: "Unknown date" */}
          <button onClick={() => { onChange("Date unknown"); setShowCal(false); }}
            style={{ marginTop: 8, width: "100%", padding: "4px", borderRadius: 6, border,
              background: "transparent", color: sec, cursor: "pointer", fontSize: 11 }}>
            Date unknown
          </button>
        </div>
      )}
    </div>
  );
}

// ── Service type combo (dropdown + free text) ─────────────────────────────────
function ServiceTypeCombo({ value, onChange, isDark, acc, bdr, txt, sec, mut }: {
  value: string; onChange: (v: string) => void;
  isDark: boolean; acc: string; bdr: string; txt: string; sec: string; mut: string;
}) {
  const [showDrop, setShowDrop] = useState(false);
  const bg = isDark ? "#0f172a" : "#f8fafc";
  const bg2 = isDark ? "#1e2433" : "#ffffff";
  const border = `1px solid ${isDark ? "#334155" : "#e2e8f0"}`;
  const filtered = SERVICE_TYPES.filter(s =>
    !value || s.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setShowDrop(true); }}
          onFocus={() => setShowDrop(true)}
          placeholder="Type or select service…"
          style={{ flex: 1, padding: "7px 10px", fontSize: 13, borderRadius: 7,
            border, background: bg, color: txt, outline: "none" }}
        />
        <button onClick={() => setShowDrop(v => !v)}
          style={{ padding: "7px 10px", borderRadius: 7, border, background: showDrop ? acc : bg,
            color: showDrop ? "white" : sec, cursor: "pointer", fontSize: 12 }}>▾</button>
      </div>
      {showDrop && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10,
          background: bg2, border, borderRadius: 8, overflow: "hidden",
          boxShadow: "0 8px 20px rgba(0,0,0,0.3)", maxHeight: 200, overflowY: "auto" }}>
          {filtered.map(s => (
            <div key={s} onClick={() => { onChange(s); setShowDrop(false); }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: txt,
                background: value === s ? `${acc}22` : "transparent",
                fontWeight: value === s ? 600 : 400 }}
              onMouseEnter={e => (e.currentTarget.style.background = `${acc}15`)}
              onMouseLeave={e => (e.currentTarget.style.background = value === s ? `${acc}22` : "transparent")}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Record modal ─────────────────────────────────────────────────────────────

// ── Name Variant Selector ─────────────────────────────────────────────────────
// Generates name variants from subject full name for the "Found under name" picker
function generateNameVariants(fullName: string): string[] {
  if (!fullName) return [];
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return [fullName];
  const first = parts[0];
  const rest  = parts.slice(1);
  const variants: string[] = [fullName]; // full name always first
  if (rest.length === 1) {
    // "Jane Doe" -- just full name
  } else if (rest.length === 2) {
    // "Karen Suley Cisneros" → Karen Cisneros, Karen Suley
    variants.push(`${first} ${rest[1]}`); // first + last
    variants.push(`${first} ${rest[0]}`); // first + middle
  } else {
    // "Maria Elena Garcia Lopez" → first + each remaining word
    for (let i = rest.length - 1; i >= 0; i--) {
      const v = `${first} ${rest[i]}`;
      if (!variants.includes(v)) variants.push(v);
    }
    // Also add first + last two words for compound surname cases
    if (rest.length >= 2) {
      const v2 = `${first} ${rest[rest.length-2]} ${rest[rest.length-1]}`;
      if (!variants.includes(v2)) variants.push(v2);
    }
  }
  return variants;
}

function NameVariantSelect({ subjectName, value, onChange, isDark, acc, bdr, txt, sec, mut }: {
  subjectName: string; value: string; onChange: (v: string) => void;
  isDark: boolean; acc: string; bdr: string; txt: string; sec: string; mut: string;
}) {
  const variants = React.useMemo(() => generateNameVariants(subjectName), [subjectName]);
  const inp: React.CSSProperties = {
    width: "100%", padding: "7px 10px", fontSize: 13, borderRadius: 7,
    border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
    background: isDark ? "#0f172a" : "#f8fafc",
    color: isDark ? "#f1f5f9" : "#1e293b", outline: "none",
  };
  return (
    <div>
      <select style={inp} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— no specific name (no suffix in report) —</option>
        {variants.map(v => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <p style={{ fontSize: 10, color: mut, margin: "3px 0 0" }}>
        Selected name appears in report heading: "FACILITIES WITH RECORDS{value ? ` - ${value}` : ""}"
      </p>
    </div>
  );
}

const EMPTY_ENTRY = (): RecordEntry => ({
  last_visit: "", first_visit: "", confirmed_by_dept: "Billing", criteria: [], service_type: "", notes: "", record_name_variant: "",
});

function RecordEntryForm({ entry, idx, total, onChange, onRemove, acc, bdr, bg1, txt, sec, mut, isDark }: {
  entry: RecordEntry & { _subjectName?: string }; idx: number; total: number;
  onChange: (e: RecordEntry) => void; onRemove: () => void;
  acc: string; bdr: string; bg1: string; txt: string; sec: string; mut: string; isDark: boolean;
}) {
  const set = (k: keyof RecordEntry) => (v: any) => onChange({ ...entry, [k]: v });
  const toggleCrit = (c: string) => onChange({
    ...entry, criteria: entry.criteria.includes(c) ? entry.criteria.filter(x => x !== c) : [...entry.criteria, c],
  });
  const lbl: React.CSSProperties = { fontSize: 10, color: mut, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600, marginBottom: 3, display: "block" };
  const inp: React.CSSProperties = { width: "100%", padding: "7px 10px", fontSize: 13, borderRadius: 7, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, background: isDark ? "#0f172a" : "#f8fafc", color: isDark ? "#f1f5f9" : "#1e293b", outline: "none" };

  return (
    <div style={{ border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 10, padding: 14, background: isDark ? "#0f172a22" : "#f8fafc", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Record header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: acc }}>Record {idx + 1}</span>
        {total > 1 && (
          <button onClick={onRemove} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, color: "#ef4444", padding: "2px 6px", borderRadius: 5 }}>
            × Remove
          </button>
        )}
      </div>

      {/* Name variant used to find record */}
      <div>
        <label style={lbl}>Found under name</label>
        <NameVariantSelect
          subjectName={entry._subjectName || ""}
          value={entry.record_name_variant || ""}
          onChange={set("record_name_variant")}
          isDark={isDark} acc={acc} bdr={bdr} txt={txt} sec={sec} mut={mut}
        />
      </div>

      {/* Last visit */}
      <div>
        <label style={lbl}>Last visit</label>
        <MiniCalendar value={entry.last_visit} onChange={set("last_visit")}
          isDark={isDark} acc={acc} bdr={bdr} txt={txt} sec={sec} mut={mut} />
      </div>

      {/* First visit */}
      <div>
        <label style={lbl}>First visit</label>
        <MiniCalendar value={entry.first_visit || ""} onChange={set("first_visit")}
          isDark={isDark} acc={acc} bdr={bdr} txt={txt} sec={sec} mut={mut} />
      </div>

      {/* Type of service */}
      <div>
        <label style={lbl}>Type of service</label>
        <ServiceTypeCombo value={entry.service_type} onChange={set("service_type")}
          isDark={isDark} acc={acc} bdr={bdr} txt={txt} sec={sec} mut={mut} />
      </div>

      {/* Confirmed by */}
      <div>
        <label style={lbl}>Confirmed by</label>
        <select style={inp} value={entry.confirmed_by_dept} onChange={e => set("confirmed_by_dept")(e.target.value)}>
          {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Criteria */}
      <div>
        <label style={lbl}>Criteria confirmed</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          {CRITERIA_OPTS.map(c => (
            <button key={c} onClick={() => toggleCrit(c)} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: 600, background: entry.criteria.includes(c) ? acc : "transparent", color: entry.criteria.includes(c) ? "white" : sec, border: `1px solid ${entry.criteria.includes(c) ? acc : bdr}` }}>{c}</button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label style={lbl}>Notes</label>
        <textarea style={{ ...inp, height: 48, resize: "vertical" }} placeholder="Additional info..." value={entry.notes} onChange={e => set("notes")(e.target.value)} />
      </div>
    </div>
  );
}


function NoRecordListModal({ facilities, results, onClose, onRestore,
  headerLabel, headerSub, restoreLabel, cardBg, cardBorder,
  acc, bdr, bg1, bg2, txt, sec, mut, isDark }: {
  facilities: Facility[];
  results: Record<string, any>;
  onClose: () => void;
  onRestore: (f: Facility) => void;
  headerLabel?: string; headerSub?: string; restoreLabel?: string;
  cardBg?: string; cardBorder?: string;
  acc: string; bdr: string; bg1: string; bg2: string;
  txt: string; sec: string; mut: string; isDark: boolean;
}) {
  const tabBdr = isDark ? "#334155" : "#e2e8f0";
  const redDot = "#ef4444";

  return createPortal(
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:99999,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: isDark ? "#1e2433" : "#ffffff",
        border:`1px solid ${tabBdr}`, borderRadius:14, padding:20,
        width:480, maxWidth:"95vw", maxHeight:"80vh",
        display:"flex", flexDirection:"column", gap:0,
        boxShadow:"0 25px 60px rgba(0,0,0,0.6)" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          marginBottom:14 }}>
          <div>
            <span style={{ fontSize:14, fontWeight:700, color:txt }}>
              {headerLabel || `✕ No Record (${facilities.length})`}
            </span>
            <p style={{ fontSize:11, color:sec, margin:"2px 0 0" }}>
              {headerSub || "Facilities confirmed — no records found"}
            </p>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none",
            cursor:"pointer", fontSize:22, color:sec, lineHeight:1 }}>×</button>
        </div>

        {/* List */}
        <div style={{ overflowY:"auto", flex:1, display:"flex", flexDirection:"column", gap:6 }}>
          {facilities.map(f => {
            const note = results[f.id]?.notes || (f as any).canvass_note || "";
            const cfg  = TYPE_CFG[f.type] || TYPE_CFG.other;
            return (
              <div key={f.id} style={{ padding:"10px 12px", borderRadius:8,
                background: cardBg || (isDark ? "rgba(239,68,68,0.06)" : "#fff5f5"),
                border:`1px solid ${cardBorder || (isDark ? "rgba(239,68,68,0.2)" : "#fecaca")}`,
                display:"flex", gap:10, alignItems:"flex-start" }}>
                {/* Type dot */}
                <span style={{ width:8, height:8, borderRadius:"50%", flexShrink:0,
                  background:cfg.dot, marginTop:4 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  {/* Name + distance */}
                  <div style={{ display:"flex", justifyContent:"space-between",
                    alignItems:"baseline", gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:txt,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {f.name}
                    </span>
                    <span style={{ fontSize:11, color:mut, flexShrink:0 }}>
                      {f.distance_mi ? `${Number(f.distance_mi).toFixed(1)}mi` : ""}
                    </span>
                  </div>
                  {/* Address */}
                  <p style={{ fontSize:11, color:sec, margin:"2px 0 0" }}>
                    {[f.address, f.city, f.state].filter(Boolean).join(", ")}
                  </p>
                  {/* Phone */}
                  {f.phone && (
                    <p style={{ fontSize:11, color:acc, margin:"2px 0 0" }}>
                      📞 {f.phone}
                    </p>
                  )}
                  {/* Notes */}
                  {note && (
                    <p style={{ fontSize:11, color:mut, margin:"4px 0 0",
                      padding:"4px 8px", borderRadius:5,
                      background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                      fontStyle:"italic" }}>
                      💬 {note}
                    </p>
                  )}
                  {/* Restore to pending */}
                  <button
                    onClick={() => onRestore(f)}
                    style={{ marginTop:6, fontSize:11, padding:"3px 10px",
                      borderRadius:6, cursor:"pointer", background:"transparent",
                      border:`1px dashed ${bdr}`, color:mut }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color=txt}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color=mut}>
                    {restoreLabel || "↩ Move back to list"}
                  </button>
                </div>
              </div>
            );
          })}
          {facilities.length === 0 && (
            <p style={{ textAlign:"center", color:mut, fontSize:13, padding:24 }}>
              No facilities marked as no record yet
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop:12, borderTop:`1px solid ${tabBdr}`, paddingTop:10 }}>
          <button onClick={onClose} style={{ width:"100%", padding:"9px",
            borderRadius:8, border:`1px solid ${tabBdr}`, background:"transparent",
            cursor:"pointer", color:sec, fontSize:13 }}>Close</button>
        </div>
      </div>
    </div>
  , document.body);
}


const NOTE_QUICK_OPTIONS = [
  "Voicemail / WTA — will try again",
  "Busy line — call back later",
  "Check phone number",
  "Transferred — try again",
  "Doesn't treat this condition",
  "Psychiatric / special facility — won't share",
  "Request denied",
  "Only billing / wrong dept",
  "Goes straight to voicemail",
  "No answer after multiple attempts",
];

function NoteModal({ facility, onSave, onClose, acc, bdr, bg1, bg2, txt, sec, mut, isDark, existingNote }: {
  facility: Facility; onSave: (note: string) => void; onClose: () => void;
  acc: string; bdr: string; bg1: string; bg2: string; txt: string; sec: string; mut: string; isDark: boolean;
  existingNote?: string;
}) {
  // Parse existing note back into quick options + custom text
  const initSelected = React.useMemo(() => {
    if (!existingNote) return [];
    return existingNote.split(" · ").filter(p => NOTE_QUICK_OPTIONS.includes(p));
  }, [existingNote]);

  const initCustom = React.useMemo(() => {
    if (!existingNote) return "";
    const parts = existingNote.split(" · ");
    return parts.filter(p => !NOTE_QUICK_OPTIONS.includes(p)).join(" · ");
  }, [existingNote]);

  const [selected, setSelected] = useState<string[]>(initSelected);
  const [custom, setCustom] = useState(initCustom);
  const tabBdr = isDark ? "#334155" : "#e2e8f0";

  const handleSave = () => {
    const parts = [...selected];
    if (custom.trim()) parts.push(custom.trim());
    if (parts.length === 0) { onClose(); return; }
    onSave(parts.join(" · "));
  };

  const toggle = (opt: string) =>
    setSelected(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: isDark ? "#1e2433" : "#ffffff", border: `1px solid ${tabBdr}`,
        borderRadius: 14, padding: 20, width: 420, maxWidth: "95vw", maxHeight: "85vh",
        overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: txt }}>📋 Add note</div>
            <div style={{ fontSize: 12, color: sec, marginTop: 2 }}>{facility.name}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none",
            cursor: "pointer", fontSize: 22, color: sec, lineHeight: 1 }}>×</button>
        </div>

        {/* Quick options */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: sec, textTransform: "uppercase",
            letterSpacing: ".06em", margin: "0 0 8px" }}>Quick options</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {NOTE_QUICK_OPTIONS.map(opt => {
              const on = selected.includes(opt);
              return (
                <button key={opt} onClick={() => toggle(opt)} style={{
                  textAlign: "left", padding: "7px 11px", borderRadius: 7, cursor: "pointer",
                  fontSize: 12, fontWeight: on ? 600 : 400,
                  background: on ? `${acc}18` : (isDark ? "#0f172a" : "#f8fafc"),
                  border: `1px solid ${on ? acc : tabBdr}`,
                  color: on ? acc : txt, transition: "all 0.1s",
                }}>
                  {on ? "✓ " : ""}{opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Free text */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: sec, textTransform: "uppercase",
            letterSpacing: ".06em", margin: "0 0 6px" }}>Additional notes</p>
          <textarea value={custom} onChange={e => setCustom(e.target.value)}
            placeholder="e.g. Spoke with Cristian, ext. 304 — call back Thursday"
            rows={3} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px",
              borderRadius: 7, border: `1px solid ${bdr}`, background: isDark ? "#0f172a" : "#f8fafc",
              color: txt, fontSize: 12, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px", borderRadius: 8,
            border: `1px solid ${tabBdr}`, background: "transparent", cursor: "pointer",
            color: sec, fontSize: 13 }}>Cancel</button>
          <button onClick={handleSave} style={{ flex: 2, padding: "9px", borderRadius: 8,
            border: "none", background: acc, cursor: "pointer", color: "white",
            fontSize: 13, fontWeight: 700 }}>Save note</button>
        </div>
      </div>
    </div>
  , document.body);
}


// ── Chart Only Modal ──────────────────────────────────────────────────────────
const CHART_QUICK_NOTES: Record<string, string[]> = {
  hospital: [
    "Has a chart.",
    "No additional information permitted.",
    "(member of Valley Health System)",
    "(member of Dignity Health)",
    "(member of Kaiser Permanente)",
    "(member of CommonSpirit Health)",
    "Records retention: 7 years.",
    "Records retention: 10 years.",
    "Has a chart. No additional information permitted.",
  ],
  pharmacy: [
    "Has an account.",
    "No prescription filled for the past two years.  Records retention 2 years of records.",
    "No prescription filled for the past year.  Keeps 1 year of records.",
    "Has an account.  No fills on record.",
    "Has an account.  Records retention 2 years.",
  ],
  urgent_care: [
    "Has a chart.",
    "No additional information permitted.",
    "Chart only — patient confirmed in system.",
    "No appointment yet.  No visits yet.",
    "Referral only — no treatment confirmed.",
    "Has a chart. No additional information permitted.",
  ],
  other: [
    "Has a chart.",
    "Has an account.",
    "No additional information permitted.",
    "No records available.",
    "Information not available by phone.",
  ],
  psychiatric: [
    "Has a chart.",
    "No additional information permitted.",
    "Chart only — patient confirmed in system.",
    "No appointment yet.  No visits yet.",
    "Has a chart. No additional information permitted.",
    "Records retention: 7 years.",
  ],
};

function ChartOnlyModal({ facility, inv, onSave, onClose, acc, bdr, bg1, bg2, txt, sec, mut, isDark }: {
  facility: Facility; inv: any;
  onSave: (data: { has_type: string; notes: string; confirmed_by: string; account_info: string; record_name_variant: string }) => void;
  onClose: () => void;
  acc: string; bdr: string; bg1: string; bg2: string; txt: string; sec: string; mut: string; isDark: boolean;
}) {
  const isPharm = facility.type === "pharmacy";
  const [hasType, setHasType] = React.useState(isPharm ? "account" : "chart");
  const [notes, setNotes] = React.useState("");
  const [confirmedBy, setConfirmedBy] = React.useState("Appointment");
  const [accountInfo, setAccountInfo] = React.useState("");
  const [nameVariant, setNameVariant] = React.useState("");

  // Subject data for autocomplete buttons
  const subjName  = inv?.subject_name || "";
  const subjDob   = inv?.subject_dob
    ? new Date(inv.subject_dob + "T00:00:00").toLocaleDateString("en-US",
        { month: "long", day: "numeric", year: "numeric" })
    : "";
  const subjPhone = inv?.subject_phones?.[0] || inv?.subject_phone || "";
  const subjAddr  = (() => {
    const addrs: string[] = inv?.subject_addresses || [];
    const first = addrs[0] || "";
    if (first && first === first.toUpperCase()) {
      // title-case ALL CAPS address from TLOxP
      return first.split(" ").map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
    }
    return first;
  })();

  // Name variants -- per Todd: "first + each word" as possible surname combos
  // "Karen Suley Cisneros" → ["Karen Suley Cisneros", "Karen Cisneros", "Karen Suley"]
  // "Ana Sol Nolan"        → ["Ana Sol Nolan", "Ana Nolan", "Ana Sol"]
  // "Maria Elena Garcia Lopez" → [full, "Maria Lopez", "Maria Garcia", "Maria Elena"]
  const nameVariants: string[] = React.useMemo(() => {
    if (!subjName) return [];
    const parts = subjName.trim().split(/\s+/);
    if (parts.length < 2) return [subjName];
    const first = parts[0];
    const rest  = parts.slice(1); // everything after first name
    const variants: string[] = [subjName]; // always include full name first
    if (rest.length === 1) {
      // "Jane Doe" -- only one variant
    } else if (rest.length === 2) {
      // "Karen Suley Cisneros": first+last, first+middle
      variants.push(first + " " + rest[1]); // first + last word
      variants.push(first + " " + rest[0]); // first + middle (possible 2nd surname)
    } else if (rest.length >= 3) {
      // "Maria Elena Garcia Lopez": first+each remaining word
      for (let i = rest.length - 1; i >= 0; i--) {
        variants.push(first + " " + rest[i]);
      }
    }
    return [...new Set(variants)];
  }, [subjName]);

  const buildAccount = (name: string) => {
    const parts: string[] = [name + "."];
    if (subjPhone) parts.push("  " + subjPhone + ".");
    if (subjAddr)  parts.push("  " + subjAddr + ".");
    if (subjDob)   parts.push("  DOB: " + subjDob + ".");
    setAccountInfo(parts.join(""));
  };

  const addQuick = (q: string) => setNotes((n: string) => n ? n + "  " + q : q);

  const fType = facility.type || "other";
  const quickNotes = CHART_QUICK_NOTES[fType as keyof typeof CHART_QUICK_NOTES] || CHART_QUICK_NOTES.other;

  const inp: React.CSSProperties = { width:"100%", boxSizing:"border-box" as any, padding:"8px 10px", borderRadius:7, border:`1px solid ${bdr}`, background:bg1, color:txt, fontSize:13, outline:"none" };
  const lbl: React.CSSProperties = { fontSize:10, textTransform:"uppercase" as any, letterSpacing:".06em", color:mut, fontWeight:700, marginBottom:4, display:"block" };
  const quickBtn: React.CSSProperties = { fontSize:11, padding:"5px 10px", borderRadius:6, cursor:"pointer", background:isDark?"rgba(255,255,255,0.06)":"#f8fafc", border:`1px solid ${bdr}`, color:sec, textAlign:"left" as any, whiteSpace:"normal" as any, lineHeight:1.4 };
  const acctBtn = (bg: string, border: string, color: string): React.CSSProperties => ({ fontSize:11, padding:"4px 10px", borderRadius:6, cursor:"pointer", background:bg, border:`1px solid ${border}`, color, fontWeight:600 });

  return createPortal(
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:isDark?"#1e2433":"#fff", border:`1px solid ${isDark?"rgba(234,179,8,0.4)":"#fde68a"}`, borderRadius:14, padding:20, width:520, maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", display:"flex", flexDirection:"column", gap:14 }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:txt }}>📋 Chart / Account Only</div>
            <div style={{ fontSize:12, color:sec, marginTop:2 }}>{facility.name}</div>
            <div style={{ fontSize:11, color:mut, marginTop:1 }}>{facility.address}, {facility.city}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:22, color:sec }}>×</button>
        </div>

        {/* Has chart / Has account */}
        <div>
          <span style={lbl}>Type of confirmation</span>
          <div style={{ display:"flex", gap:8 }}>
            {([["chart","📄 Has a chart"],["account","💊 Has an account"]] as [string,string][]).map(([t,label]) => (
              <button key={t} onClick={() => setHasType(t)} style={{ flex:1, padding:"8px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600, border:`1px solid ${hasType===t?(isDark?"rgba(234,179,8,0.6)":"#fde68a"):bdr}`, background:hasType===t?(isDark?"rgba(234,179,8,0.15)":"#fefce8"):"transparent", color:hasType===t?(isDark?"#fde047":"#854d0e"):sec }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Quick notes */}
        <div>
          <span style={lbl}>Quick responses — click to add</span>
          <div style={{ display:"flex", flexDirection:"column" as any, gap:4 }}>
            {quickNotes.map((q: string, i: number) => (
              <button key={i} onClick={() => addQuick(q)} style={quickBtn}>{q}</button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <span style={lbl}>Notes (will appear in report)</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            style={{ ...inp, resize:"vertical" as any }}
            placeholder="e.g. No prescription filled for the past two years..." />
        </div>

        {/* Found under name */}
        <div style={{ marginBottom: 12 }}>
          <span style={lbl}>Found under name</span>
          <NameVariantSelect
            subjectName={subjName}
            value={nameVariant}
            onChange={setNameVariant}
            isDark={isDark} acc={acc} bdr={bdr} txt={txt} sec={sec} mut={mut}
          />
        </div>

        {/* Confirmed by — same options as RecordEntryForm */}
        <div>
          <span style={lbl}>Confirmed by</span>
          <select value={confirmedBy} onChange={e => setConfirmedBy(e.target.value)} style={inp}>
            {["Appointment","Billing","Administration","Reception","Medical Records",
              "Nursing","Pharmacy","Operator","ER","Admitting","Radiology"].map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Criteria confirmed */}
        <div>
          <span style={lbl}>Criteria confirmed</span>
          <div style={{ display:"flex", flexWrap:"wrap" as any, gap:6, marginTop:2 }}>
            {["Name", "Date of birth", "Phone", "Address", "SSN"].map((c: string) => (
              <button key={c} onClick={() => {
                const cur = (accountInfo || "").split(",").map((s: string) => s.trim()).filter(Boolean);
                const next = cur.includes(c) ? cur.filter((x: string) => x !== c) : [...cur, c];
                setAccountInfo(next.join(", "));
              }} style={{
                padding:"4px 10px", borderRadius:20, fontSize:12, cursor:"pointer", fontWeight:600,
                background: (accountInfo || "").split(",").map((s: string) => s.trim()).includes(c) ? acc : "transparent",
                color: (accountInfo || "").split(",").map((s: string) => s.trim()).includes(c) ? "white" : sec,
                border: `1px solid ${(accountInfo || "").split(",").map((s: string) => s.trim()).includes(c) ? acc : bdr}`,
              }}>{c}</button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:8, marginTop:4 }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:8, border:`1px solid ${bdr}`, background:"transparent", cursor:"pointer", color:sec, fontSize:13 }}>Cancel</button>
          <button onClick={() => onSave({ has_type:hasType, notes, confirmed_by:confirmedBy, account_info:accountInfo, record_name_variant:nameVariant })}
            style={{ flex:2, padding:"10px", borderRadius:8, border:"none", background:isDark?"rgba(234,179,8,0.8)":"#ca8a04", cursor:"pointer", color:"white", fontSize:13, fontWeight:700 }}>
            Save Chart Only
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

function RecordModal({ facility, inv, onSave, onClose, acc, bdr, bg1, bg2, txt, sec, mut, isDark }: {
  facility: Facility; inv?: any; onSave: (note: RecordNote) => void; onClose: () => void;
  acc: string; bdr: string; bg1: string; bg2: string; txt: string; sec: string; mut: string; isDark: boolean;
}) {
  const existing = facility.record_note?.entries;
  const subjectName = inv?.subject_name || "";
  const [entries, setEntries] = useState<RecordEntry[]>(
    existing && existing.length > 0
      ? existing.map((e: RecordEntry) => ({ ...e, _subjectName: subjectName }))
      : [{ ...EMPTY_ENTRY(), _subjectName: subjectName }]
  );
  const [activeTab, setActiveTab] = useState(0);
  // account_info removed from with_record -- now only in chart_only

  const updateEntry = (i: number, e: RecordEntry) =>
    setEntries(prev => prev.map((x, idx) => idx === i ? e : x));
  const removeEntry = (i: number) => {
    setEntries(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      setActiveTab(t => Math.min(t, next.length - 1));
      return next;
    });
  };
  const addEntry = () => {
    setEntries(prev => { setActiveTab(prev.length); return [...prev, { ...EMPTY_ENTRY(), _subjectName: subjectName }]; });
  };

  const handleSave = () => {
    const valid = entries.filter(e => e.last_visit || e.service_type || e.confirmed_by_dept);
    if (valid.length === 0) return;
    onSave({ entries: valid });
  };

  const tabBdr = isDark ? "#334155" : "#e2e8f0";
  const tabBg  = isDark ? "#0f172a" : "#f8fafc";

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: isDark ? "#1e2433" : "#ffffff", border: `1px solid ${tabBdr}`, borderRadius: 14, padding: 20, width: 480, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: txt }}>✅ Records found</div>
            <div style={{ fontSize: 12, color: sec, marginTop: 2 }}>{facility.name}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 22, color: sec, lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs row */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", borderBottom: `1px solid ${tabBdr}`, paddingBottom: 8 }}>
          {entries.map((_, i) => (
            <button key={i} onClick={() => setActiveTab(i)} style={{
              padding: "5px 14px", borderRadius: "6px 6px 0 0", fontSize: 12, fontWeight: 700,
              cursor: "pointer", border: `1px solid ${i === activeTab ? acc : tabBdr}`,
              borderBottom: i === activeTab ? `1px solid ${isDark ? "#1e2433" : "#ffffff"}` : `1px solid ${tabBdr}`,
              background: i === activeTab ? acc : tabBg,
              color: i === activeTab ? "#ffffff" : sec,
              transition: "all 0.12s",
              marginBottom: -1,
            }}>
              #{i + 1}{entries[i].last_visit ? ` · ${entries[i].last_visit.split(",")[0]}` : ""}
            </button>
          ))}
          {/* Add tab button */}
          <button onClick={addEntry} style={{
            padding: "5px 10px", borderRadius: "6px 6px 0 0", fontSize: 12, fontWeight: 700,
            cursor: "pointer", border: `1px dashed ${tabBdr}`, background: "transparent",
            color: acc, marginBottom: -1,
          }} title="Add another visit">＋</button>
        </div>

        {/* Active entry form */}
        {entries[activeTab] && (
          <RecordEntryForm
            key={activeTab}
            entry={entries[activeTab]}
            idx={activeTab}
            total={entries.length}
            onChange={e => updateEntry(activeTab, e)}
            onRemove={() => removeEntry(activeTab)}
            acc={acc} bdr={bdr} bg1={bg1} txt={txt} sec={sec} mut={mut} isDark={isDark}
          />
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${tabBdr}`, background: "transparent", cursor: "pointer", color: sec, fontSize: 13 }}>Cancel</button>
          <button onClick={handleSave} style={{ flex: 2, padding: "10px", borderRadius: 8, border: "none", background: acc, cursor: "pointer", color: "white", fontSize: 13, fontWeight: 700 }}>
            Save {entries.length > 1 ? `${entries.length} records` : "record"}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

export function CanvassPanel({ inv, meta, isDark, acc, sec, txt, bg1, bg2, bdr, mut, base, onFacilitiesChange, radius: radiusProp, onRadiusChange, canSeePII, userRole }: any) {
  const DEFAULT_TYPES = Object.entries(TYPE_CFG).filter(([,v]) => v.defaultOn).map(([k]) => k);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(DEFAULT_TYPES));
  const [radius, setRadius]                  = useState<number>(typeof radiusProp === 'number' ? radiusProp : 30);
  const [committedRadius, setCommittedRadius] = useState<number>(typeof radiusProp === 'number' ? radiusProp : 30);
  // Sync prop → local when parent changes
  React.useEffect(() => { if (typeof radiusProp === 'number') { setRadius(radiusProp); setCommittedRadius(radiusProp); } }, [radiusProp]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalFac, setModalFac] = useState<Facility | null>(null);
  const [chartOnlyFac, setChartOnlyFac] = useState<Facility | null>(null);
  const [noteFac, setNoteFac] = useState<Facility | null>(null);
  const [showNoRecordList, setShowNoRecordList] = useState(false);
  const [showDismissedList, setShowDismissedList] = useState(false);
  const [showOnlyNotes, setShowOnlyNotes] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Record<string, CanvassFacilityResult>>({});
  const [addressChanged, setAddressChanged] = useState<{mi: number; cached: string} | null>(null);
  const [invalidating, setInvalidating] = useState(false);

  // Clean addresses — filter garbage from people-search snippets
  const cleanAddresses = (addrs: string[]) =>
    (addrs || []).filter((a: string) =>
      a && a.length > 10 && a[0] >= "0" && a[0] <= "9"
      && !a.includes("people named") && !a.includes("locations")
      && !a.includes("other states") && !a.includes("People Search")
      && !a.includes("RESIDES IN") && !a.includes("LOCATIONS")
    );
  // primary_address from TLO import (most recent) — stored in extra_metadata
  // canvass_address persisted by Sol takes priority over primary_address
  const primaryAddress = (meta as any)?.canvass_address
    || (inv?.extra_metadata as any)?.canvass_address
    || (meta as any)?.primary_address
    || (inv?.extra_metadata as any)?.primary_address
    || cleanAddresses(inv?.subject_addresses || [])[0]
    || "";
  const defaultAddress = primaryAddress;
  const [canvassAddress, setCanvassAddress] = React.useState<string>(defaultAddress);
  const [editingAddr, setEditingAddr]       = React.useState(false);
  const [addingAddr, setAddingAddr]         = React.useState(false);
  const [newAddrDraft, setNewAddrDraft]     = React.useState("");
  const [addrDraft, setAddrDraft]           = React.useState(defaultAddress);
  // Update if inv changes (re-import TLO etc.)
  React.useEffect(() => {
    const a = (meta as any)?.canvass_address
      || (inv?.extra_metadata as any)?.canvass_address
      || (meta as any)?.primary_address
      || (inv?.extra_metadata as any)?.primary_address
      || cleanAddresses(inv?.subject_addresses || [])[0]
      || "";
    setCanvassAddress(a); setAddrDraft(a);
  }, [inv?.id, (inv?.extra_metadata as any)?.canvass_address, (inv?.extra_metadata as any)?.primary_address]);
  const address = canvassAddress;
  const dob = inv?.subject_dob ? new Date(inv.subject_dob + "T00:00:00").toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "—";
  // Highest confidence phone = first in subject_phones (sorted on TLO import)
  const phone = (inv?.subject_phones?.[0]) || inv?.subject_phone || meta?.subject_phone || "—";
  // SSN: use full SSN (e.g. "620-74-3621") → show as "XXX-XX-3621"
  const ssnFull: string | undefined = (inv as any)?.subject_ssn;
  const ssnLast4: string | undefined = inv?.subject_ssn_last4;
  // Admin and medical_canvass users see full SSN, others see masked
  const canSeeFullSSN = canSeePII || userRole === "admin" || userRole === "medical_canvass";
  const ssn = (() => {
    if (!ssnFull && !ssnLast4) return "—";
    if (canSeeFullSSN && ssnFull && /^\d{3}-\d{2}-\d{4}$/.test(ssnFull))
      return ssnFull;  // full: "620-74-3621"
    // Masked: XXX-XX-3621
    if (ssnFull && /^\d{3}-\d{2}-\d{4}$/.test(ssnFull))
      return `XXX-XX-${ssnFull.split("-")[2]}`;
    return ssnLast4 ? `XXX-XX-${ssnLast4}` : "—";
  })();
  const claimNo = inv?.extra_metadata?.claim_number || meta?.claim_number || "";

  useEffect(() => {
    if (!inv?.id) return;
    fetch(`${base}/api/investigations/${inv.id}/canvass-results`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.results) {
          const map: Record<string, CanvassFacilityResult> = {};
          d.results.forEach((r: CanvassFacilityResult) => { map[r.facility_id] = r; });
          setResults(map);
        }
      }).catch(() => {});
  }, [inv?.id]);

  useEffect(() => {
    if (!address || !inv?.id) return;
    const types = Array.from(activeTypes).join(",");
    setLoading(true);
    // Use AbortController with 120s timeout (first fetch builds Google Places cache ~30s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    const addrParam = address ? `&address_override=${encodeURIComponent(address)}` : "";
    fetch(`${base}/api/investigations/${inv.id}/canvass-facilities?types=${types}&limit=500${addrParam}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        if (d.facilities) {
          // Sort: with_record → bottom, pending → top, no_record → middle
          const sorted = [...d.facilities].sort((a: any, b: any) => {
            const order: Record<string,number> = { pending: 0, no_record: 1, with_record: 2 };
            return (order[a.status] ?? 0) - (order[b.status] ?? 0);
          });
          setFacilities(sorted);
          if (onFacilitiesChange) onFacilitiesChange(sorted);
          // Address-change warning
          if (d.address_changed && d.address_change_mi > 0) {
            setAddressChanged({ mi: d.address_change_mi, cached: d.cached_address || "" });
          } else {
            setAddressChanged(null);
          }
        }
      })
      .catch((err) => {
        // On error keep existing facilities if any, don't wipe the list
        console.warn("canvass-facilities fetch error:", err);
      })
      .finally(() => { clearTimeout(timeout); setLoading(false); });
  }, [inv?.id, address, committedRadius, Array.from(activeTypes).sort().join(","), facilities.length === 0]);

  // Inline status resolution — always reads from latest results
  const getFacStatus = React.useCallback((f: Facility): "pending" | "no_record" | "with_record" =>
    (results[f.id]?.status as any) || f.status || "pending",
  [results]);
  const getFacNote = (f: Facility) => results[f.id]?.record_note || f.record_note;

  // Handle cache invalidation when address changed
  const handleInvalidateCache = async () => {
    if (!inv?.id) return;
    setInvalidating(true);
    try {
      const r = await fetch(`${base}/api/investigations/${inv.id}/canvass-invalidate`, {
        method: "POST", credentials: "include",
      });
      if (r.ok) {
        setAddressChanged(null);
        setFacilities([]);
        // Re-trigger fetch by toggling a dummy state or just re-fetching
        // The useEffect will re-run since facilities is now empty
        // Force re-fetch:
        const types = Array.from(activeTypes).join(",");
        const res = await fetch(`${base}/api/investigations/${inv.id}/canvass-facilities?types=${types}&limit=500${address ? `&address_override=${encodeURIComponent(address)}` : ""}`, {
          credentials: "include",
        });
        if (res.ok) {
          const d = await res.json();
          if (d.facilities) {
            const sorted = [...d.facilities].sort((a: any, b: any) => {
              const order: Record<string,number> = { pending: 0, no_record: 1, with_record: 2 };
              return (order[a.status] ?? 0) - (order[b.status] ?? 0);
            });
            setFacilities(sorted);
            if (onFacilitiesChange) onFacilitiesChange(sorted);
          }
        }
      }
    } finally {
      setInvalidating(false);
    }
  };

  // Filter by active type chips — clicking a chip hides/shows that facility type
  const visibleFacilities = React.useMemo(() =>
    facilities.filter(f => activeTypes.has(f.type || "other")),
    [facilities, activeTypes]);
  const pending    = React.useMemo(() => visibleFacilities.filter(f => getFacStatus(f) === "pending"),     [visibleFacilities, results, getFacStatus]);
  const withRecord = React.useMemo(() => visibleFacilities.filter(f => getFacStatus(f) === "with_record"),  [visibleFacilities, results, getFacStatus]);
  const chartOnly  = React.useMemo(() => visibleFacilities.filter(f => getFacStatus(f) === "chart_only"),   [visibleFacilities, results, getFacStatus]);
  const noRecord   = React.useMemo(() => visibleFacilities.filter(f => getFacStatus(f) === "no_record"),    [visibleFacilities, results, getFacStatus]);
  const dismissed  = React.useMemo(() => visibleFacilities.filter(f => getFacStatus(f) === "dismissed"),   [visibleFacilities, results, getFacStatus]);
  const withNotes  = React.useMemo(() => pending.filter(f => {
    const note = results[f.id]?.notes || (f as any).canvass_note || "";
    return note.trim().length > 0;
  }), [pending, results]);

  const saveNote = (f: Facility, note: string) => {
    fetch(`${base}/api/investigations/${inv.id}/canvass-result`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facility_id: f.id, status: "pending", notes: note }),
    }).catch(() => {});
    setResults(r => ({ ...r, [f.id]: { ...r[f.id], facility_id: f.id, status: (r[f.id]?.status || "pending") as any, notes: note } }));
    setNoteFac(null);
  };

  const markNoRecord = (f: Facility) => {
    setResults(r => {
      const next = { ...r, [f.id]: { facility_id: f.id, status: "no_record" as const } };
      if (onFacilitiesChange) onFacilitiesChange(facilities, next);
      return next;
    });
    fetch(`${base}/api/investigations/${inv.id}/canvass-result`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facility_id: f.id, status: "no_record" }) }).catch(() => {});
  };

  const markDismissed = (f: Facility) => {
    setResults(r => {
      const next = { ...r, [f.id]: { facility_id: f.id, status: "dismissed" as const } };
      if (onFacilitiesChange) onFacilitiesChange(facilities, next);
      return next;
    });
    fetch(`${base}/api/investigations/${inv.id}/canvass-result`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facility_id: f.id, status: "dismissed" }) }).catch(() => {});
  };

  const markChartOnly = (f: Facility) => {
    setChartOnlyFac(f);
  };

  const saveChartOnly = (f: Facility, data: { has_type: string; notes: string; confirmed_by: string; account_info: string; record_name_variant: string }) => {
    const noteText = [
      data.has_type === "account" ? "Has an account." : "Has a chart.",
      data.notes,
    ].filter(Boolean).join("  ");
    setResults(r => {
      const next = { ...r, [f.id]: {
        facility_id: f.id, status: "chart_only" as const,
        notes: noteText,
        confirmed_by_dept: data.confirmed_by,
        account_info: data.account_info,
      }};
      if (onFacilitiesChange) onFacilitiesChange(facilities, next);
      return next;
    });
    setChartOnlyFac(null);
    fetch(`${base}/api/investigations/${inv.id}/canvass-result`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facility_id: f.id, status: "chart_only",
        notes: noteText,
        record_name_variant: data.record_name_variant || "",
        record_note: { confirmed_by_dept: data.confirmed_by, notes: noteText, account_info: data.account_info, record_name_variant: data.record_name_variant || "" },
      }),
    }).catch(() => {});
  };

  const markWithRecord = (f: Facility, note: RecordNote) => {
    setResults(r => {
      const next = { ...r, [f.id]: { facility_id: f.id, status: "with_record" as const, record_note: note } };
      // Notify parent so CanvassRightPanel shows the Generate report button
      if (onFacilitiesChange) onFacilitiesChange(facilities, next);
      return next;
    });
    setModalFac(null);
    const _nv = (note.entries?.[0]?.record_name_variant || "").trim();
    // Flatten first entry into top-level fields so backend can read them
    // even if the entries-flatten logic in backend has an issue (belt+suspenders)
    const _e0 = note.entries?.[0] || {};
    const _flatNote = {
      ...note,
      record_name_variant: _nv,
      last_visit:        _e0.last_visit        || "",
      first_visit:       _e0.first_visit       || "",
      confirmed_by_dept: _e0.confirmed_by_dept || "",
      service_type:      _e0.service_type      || "",
      criteria:          _e0.criteria          || [],
      notes:             _e0.notes             || "",
    };
    fetch(`${base}/api/investigations/${inv.id}/canvass-result`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facility_id: f.id, status: "with_record", record_name_variant: _nv, record_note: _flatNote }) }).catch(() => {});
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`${base}/api/investigations/${inv.id}/canvass-report-docx`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (r.ok) {
        const blob = await r.blob(); const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; const cd = r.headers.get("content-disposition") || "";
        let fname = `canvass_report_${claimNo || inv.id}.docx`;
        const cdM = cd.match(/filename="([^"]+)"/i);
        if (cdM) try { fname = decodeURIComponent(cdM[1]); } catch {}
        a.download = fname; a.click(); URL.revokeObjectURL(url);
      } else { alert("Error generating report"); }
    } catch (e: any) { alert("Error: " + e.message); } finally { setGenerating(false); }
  };

  const toggleType = (t: string) => setActiveTypes(prev => { const n = new Set(prev); if (n.has(t)) { if (n.size > 1) n.delete(t); } else n.add(t); return n; });

  const card: React.CSSProperties = { border: `1px solid ${bdr}`, borderRadius: 8, padding: "10px 12px", background: bg2 };
  const Lbl: React.CSSProperties = { fontSize: 9, textTransform: "uppercase", letterSpacing: ".07em", color: mut, fontWeight: 700, margin: "0 0 7px" };

  return (
    <>
      {chartOnlyFac && <ChartOnlyModal facility={chartOnlyFac} inv={inv} onSave={data => saveChartOnly(chartOnlyFac, data)} onClose={() => setChartOnlyFac(null)} acc={acc} bdr={bdr} bg1={bg1} bg2={bg2} txt={txt} sec={sec} mut={mut} isDark={isDark} canSeePII={canSeePII} />}
      {modalFac && <RecordModal facility={modalFac} inv={inv} onSave={note => markWithRecord(modalFac, note)} onClose={() => setModalFac(null)} acc={acc} bdr={bdr} bg1={bg1} bg2={bg2} txt={txt} sec={sec} mut={mut} isDark={isDark} />}
      {showDismissedList && (
        <NoRecordListModal
          facilities={dismissed}
          results={results}
          onClose={() => setShowDismissedList(false)}
          headerLabel="🗑 Erased"
          headerSub="Not medical — removed from list"
          restoreLabel="↩ Restore to list"
          cardBg={isDark ? "rgba(107,114,128,0.08)" : "#f9fafb"}
          cardBorder={isDark ? "rgba(107,114,128,0.2)" : "#e5e7eb"}
          onRestore={(f: Facility) => {
            setResults(r => ({ ...r, [f.id]: { ...r[f.id], facility_id: f.id, status: "pending" as const } }));
            fetch(`${base}/api/investigations/${inv.id}/canvass-result`, {
              method:"POST", credentials:"include",
              headers:{"Content-Type":"application/json"},
              body: JSON.stringify({ facility_id: f.id, status: "pending" }),
            }).catch(()=>{});
          }}
          acc={acc} bdr={bdr} bg1={bg1} bg2={bg2} txt={txt} sec={sec} mut={mut} isDark={isDark} />
      )}
      {showNoRecordList && (
        <NoRecordListModal
          facilities={noRecord}
          results={results}
          onClose={() => setShowNoRecordList(false)}
          onRestore={(f: Facility) => {
            setResults(r => ({ ...r, [f.id]: { ...r[f.id], facility_id: f.id, status: "pending" as const } }));
            fetch(`${base}/api/investigations/${inv.id}/canvass-result`, {
              method:"POST", credentials:"include",
              headers:{"Content-Type":"application/json"},
              body: JSON.stringify({ facility_id: f.id, status: "pending" }),
            }).catch(()=>{});
          }}
          acc={acc} bdr={bdr} bg1={bg1} bg2={bg2} txt={txt} sec={sec} mut={mut} isDark={isDark} />
      )}
      {noteFac && <NoteModal facility={noteFac} onSave={note => saveNote(noteFac, note)} onClose={() => setNoteFac(null)} acc={acc} bdr={bdr} bg1={bg1} bg2={bg2} txt={txt} sec={sec} mut={mut} isDark={isDark} existingNote={results[noteFac.id]?.notes || (noteFac as any).canvass_note || ""} />}

      {/* PII strip */}
      <div data-canvass-section="subject" style={card}>
        <p style={Lbl}>Subject info — for calling</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[{ label: "Date of birth", val: dob }, { label: "SSN", val: ssn }].map(({ label, val }) => (
            <div key={label} style={{ background: bg1, border: `1px solid ${bdr}`, borderRadius: 7, padding: "7px 10px" }}>
              <div style={{ fontSize: 9, color: mut, textTransform: "uppercase" as const, letterSpacing: ".06em", fontWeight: 600, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: txt }}>{val}</div>
            </div>
          ))}
          {/* Phone — dropdown if multiple phones available */}
          <div style={{ background: bg1, border: `1px solid ${bdr}`, borderRadius: 7, padding: "7px 10px" }}>
            <div style={{ fontSize: 9, color: mut, textTransform: "uppercase" as const, letterSpacing: ".06em", fontWeight: 600, marginBottom: 2 }}>Phone</div>
            {(inv?.subject_phones?.length || 0) > 1 ? (
              <div style={{ position: "relative" }}>
                <select
                  value={phone === "—" ? "" : phone}
                  onChange={e => {
                    const newPhone = e.target.value;
                    // Update local phone state
                    if (inv) (inv as any)._selectedPhone = newPhone;
                  }}
                  style={{
                    width: "100%", fontSize: 13, fontWeight: 700, color: txt,
                    background: bg1, border: "none", outline: "none",
                    fontFamily: "inherit", cursor: "pointer", appearance: "none" as const,
                    paddingRight: 16,
                  }}>
                  {(inv?.subject_phones || []).map((ph: string, i: number) => {
                    const conf = (inv as any)?.subject_phones_meta?.[ph];
                    return (
                      <option key={i} value={ph}>
                        {ph}{conf ? ` (${conf}%)` : i === 0 ? " ★" : ""}
                      </option>
                    );
                  })}
                </select>
                <span style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: mut, pointerEvents: "none" }}>▾</span>
              </div>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 700, color: txt }}>{phone}</div>
            )}
          </div>
        </div>
        {/* Address used for radius — editable inline */}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${bdr}` }}>
          <div style={{ fontSize: 9, color: mut, textTransform: "uppercase" as const,
            letterSpacing: ".06em", fontWeight: 600, marginBottom: 4 }}>
            Address used for radius
          </div>
          {editingAddr ? (
            <div style={{ display: "flex", gap: 4 }}>
              <input
                autoFocus
                value={addrDraft}
                onChange={e => setAddrDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { setCanvassAddress(addrDraft); setEditingAddr(false); }
                  if (e.key === "Escape") setEditingAddr(false);
                }}
                style={{ flex: 1, fontSize: 12, padding: "3px 7px", borderRadius: 5,
                  border: `1px solid ${acc}`, background: bg1, color: txt,
                  outline: "none", fontFamily: "inherit" }}
              />
              <button onClick={() => { setCanvassAddress(addrDraft); setEditingAddr(false); }}
                style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5,
                  background: acc, color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>
                ✓
              </button>
              <button onClick={() => { setAddrDraft(canvassAddress); setEditingAddr(false); }}
                style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5,
                  background: "transparent", color: sec, border: `1px solid ${bdr}`, cursor: "pointer" }}>
                ✗
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Dropdown if multiple addresses */}
              {(inv?.subject_addresses?.length ?? 0) > 1 ? (
                <select
                  value={canvassAddress}
                  onChange={e => { setCanvassAddress(e.target.value); setAddrDraft(e.target.value); }}
                  style={{ flex: 1, fontSize: 12, fontWeight: 600, color: txt,
                    padding: "3px 6px", borderRadius: 5, border: `1px solid ${bdr}`,
                    background: bg1, cursor: "pointer", fontFamily: "inherit" }}
                  onChange={async e => {
                    const newAddr = e.target.value;
                    setCanvassAddress(newAddr); setAddrDraft(newAddr);
                    setFacilities([]);
                    setEditingAddr(false);
                    try {
                      await fetch(`${base}/api/investigations/${inv.id}/canvass-address`,{
                        method:"POST",credentials:"include",
                        headers:{"Content-Type":"application/json"},
                        body:JSON.stringify({address:newAddr}),
                      });
                    } catch(e){}
                  }}>
                  {cleanAddresses(inv.subject_addresses as string[]).map((a: string, i: number) => (
                    <option key={i} value={a}>{i === 0 ? "★ " : ""}{a}</option>
                  ))}
                </select>
              ) : (
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600,
                  color: canvassAddress ? txt : mut,
                  fontStyle: canvassAddress ? "normal" : "italic" }}>
                  <select
                    value={canvassAddress}
                    onChange={async e => {
                      const newAddr = e.target.value;
                      setCanvassAddress(newAddr);
                      setAddrDraft(newAddr);
                      setFacilities([]);
                      // Persist selected address to backend
                      // This also migrates legacy fetched_types to per-address dict
                      try {
                        await fetch(`${base}/api/investigations/${inv.id}/canvass-address`, {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ address: newAddr }),
                        });
                      } catch(e) { console.warn("canvass-address save failed", e); }
                    }}
                    style={{ background:"transparent", border:"none", color:"inherit",
                      fontSize:"inherit", cursor:"pointer", maxWidth:300,
                      outline:"none" }}
                  >
                    {(cleanAddresses(inv?.subject_addresses || [])).map((a,i) => (
                      <option key={i} value={a}>{a}</option>
                    ))}
                    {canvassAddress && !cleanAddresses(inv?.subject_addresses||[]).includes(canvassAddress) && (
                      <option value={canvassAddress}>{canvassAddress}</option>
                    )}
                  </select>
                </span>
              )}
              <button onClick={() => setEditingAddr(true)}
                style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5,
                  background: "transparent", color: sec, border: `1px solid ${bdr}`,
                  cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                ✏ Edit
              </button>
              <button onClick={() => { setAddingAddr(true); setNewAddrDraft(""); }}
                style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5,
                  background: "transparent", color: acc, border: `1px solid ${acc}`,
                  cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                + Add
              </button>
            </div>
          )}

          {/* Add new address panel */}
          {addingAddr && (
            <div style={{ display:"flex", gap:6, marginTop:6, alignItems:"center" }}>
              <input
                autoFocus
                value={newAddrDraft}
                onChange={e => setNewAddrDraft(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === "Enter" && newAddrDraft.trim().length > 10) {
                    const a = newAddrDraft.trim();
                    setCanvassAddress(a);
                    setAddrDraft(a);
                    setFacilities([]);
                    setAddingAddr(false);
                    setNewAddrDraft("");
                    try {
                      await fetch(`${base}/api/investigations/${inv.id}/canvass-address`, {
                        method: "POST", credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ address: a }),
                      });
                    } catch(e) { console.warn("save addr failed", e); }
                  } else if (e.key === "Escape") {
                    setAddingAddr(false); setNewAddrDraft("");
                  }
                }}
                placeholder="e.g. 123 Main St, Queens, NY 11421"
                style={{ flex:1, fontSize:12, padding:"4px 8px",
                  border:`1px solid ${acc}`, borderRadius:5,
                  background:bg1, color:txt, outline:"none" }}
              />
              <button
                disabled={newAddrDraft.trim().length < 10}
                onClick={async () => {
                  const a = newAddrDraft.trim();
                  if (a.length < 10) return;
                  setCanvassAddress(a);
                  setAddrDraft(a);
                  setFacilities([]);
                  setAddingAddr(false);
                  setNewAddrDraft("");
                  try {
                    await fetch(`${base}/api/investigations/${inv.id}/canvass-address`, {
                      method: "POST", credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ address: a }),
                    });
                  } catch(e) { console.warn("save addr failed", e); }
                }}
                style={{ fontSize:11, padding:"4px 10px", borderRadius:5,
                  background: newAddrDraft.trim().length >= 10 ? acc : mut,
                  color:"white", border:"none", cursor:"pointer", flexShrink:0 }}>
                Search
              </button>
              <button onClick={() => { setAddingAddr(false); setNewAddrDraft(""); }}
                style={{ fontSize:11, padding:"4px 8px", borderRadius:5,
                  background:"transparent", color:sec,
                  border:`1px solid ${bdr}`, cursor:"pointer", flexShrink:0 }}>
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chips + radius */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(TYPE_CFG).map(([k, cfg]) => {
          const on = activeTypes.has(k);
          const bgCol  = on ? (isDark ? cfg.chipOnDark  : cfg.chipOnLight)  : "transparent";
          const txtCol = on ? (isDark ? cfg.chipTextDark : cfg.chipTextLight) : (isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)");
          const bdCol  = on ? cfg.dot : bdr;
          return (
            <button key={k} onClick={() => toggleType(k)}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px",
                borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: bgCol, color: txtCol, border: `1px solid ${bdCol}`,
                opacity: on ? 1 : 0.7 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot,
                display: "inline-block", opacity: on ? 1 : 0.5 }} />
              {cfg.label}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 11, color: sec, whiteSpace: "nowrap" }}>Radius</span>
          <input type="range" min={1} max={50} step={1} value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            onMouseUp={e => {
              const v = Number((e.target as HTMLInputElement).value);
              setCommittedRadius(v);
              if (onRadiusChange) onRadiusChange(v);
            }}
            onTouchEnd={e => {
              const v = Number((e.target as HTMLInputElement).value);
              setCommittedRadius(v);
              if (onRadiusChange) onRadiusChange(v);
            }}
            style={{ width: 80 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: acc, minWidth: 40 }}>{radius} mi</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 10, background: `${acc}22`, color: acc, border: `1px solid ${acc}44`, whiteSpace: "nowrap" }}>
          {loading ? "Loading…" : <>
            {`${visibleFacilities.length} facilities · ${pending.length} pending · ${withRecord.length} ✓ record · ${chartOnly.length} chart · `}
<span onClick={() => noRecord.length > 0 && setShowNoRecordList(true)}
              style={{ cursor: noRecord.length > 0 ? "pointer" : "default",
                textDecoration: noRecord.length > 0 ? "underline dotted" : "none",
                textUnderlineOffset: 2 }}>
              {`${noRecord.length} no record`}
            </span>
            {dismissed.length > 0 && <>
              {" · "}
              <span onClick={() => setShowDismissedList(true)}
                style={{ cursor:"pointer", textDecoration:"underline dotted",
                  textUnderlineOffset:2, color:mut }}>
                {`🗑 ${dismissed.length} erased`}
              </span>
            </>}
            {withNotes.length > 0 && <>
              {" · "}
              <span onClick={() => setShowOnlyNotes(v => !v)}
                style={{ cursor:"pointer", textDecoration:"underline dotted",
                  textUnderlineOffset:2,
                  color: showOnlyNotes ? acc : "inherit",
                  fontWeight: showOnlyNotes ? 700 : "inherit" }}>
                {`📋 ${withNotes.length} notes`}
              </span>
            </>}

          </>}
        </span>
      </div>

      {/* Address-changed warning banner */}
      {addressChanged && !loading && (
        <div style={{
          background: isDark ? "rgba(234,179,8,0.12)" : "#fefce8",
          border: "1px solid",
          borderColor: isDark ? "rgba(234,179,8,0.35)" : "#fde68a",
          borderRadius: 8, padding: "10px 14px",
          display: "flex", alignItems: "flex-start", gap: 10,
          fontSize: 12,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: isDark ? "#fde68a" : "#92400e", marginBottom: 3 }}>
              Subject address changed since last search ({addressChanged.mi} mi away)
            </div>
            {addressChanged.cached && (
              <div style={{ color: isDark ? "#fcd34d" : "#a16207", marginBottom: 6 }}>
                Searched at: {addressChanged.cached}
              </div>
            )}
            <div style={{ color: isDark ? "#d1d5db" : "#57534e", marginBottom: 8 }}>
              Facilities with records already worked are safe. Only pending results will be refreshed.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleInvalidateCache}
                disabled={invalidating}
                style={{
                  background: isDark ? "rgba(234,179,8,0.25)" : "#fde68a",
                  border: "1px solid",
                  borderColor: isDark ? "rgba(234,179,8,0.5)" : "#f59e0b",
                  borderRadius: 5, padding: "4px 10px",
                  fontSize: 11, fontWeight: 600,
                  color: isDark ? "#fde68a" : "#92400e",
                  cursor: invalidating ? "not-allowed" : "pointer",
                  opacity: invalidating ? 0.6 : 1,
                }}
              >
                {invalidating ? "Re-searching…" : "🔄 Re-search with current address"}
              </button>
              <button
                onClick={() => setAddressChanged(null)}
                style={{
                  background: "transparent",
                  border: "1px solid",
                  borderColor: isDark ? "rgba(156,163,175,0.3)" : "#d1d5db",
                  borderRadius: 5, padding: "4px 10px",
                  fontSize: 11, color: sec, cursor: "pointer",
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Facility list */}
      <div data-canvass-section="facilities" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {loading && <div style={{ ...card, textAlign: "center", padding: 24, color: sec, fontSize: 13 }}>⏳ Loading facilities…</div>}
        {!loading && facilities.length === 0 && <div style={{ ...card, textAlign: "center", padding: 24 }}><div style={{ fontSize: 32, opacity: 0.15, marginBottom: 8 }}>🏥</div><div style={{ fontSize: 13, color: sec }}>{address ? "No facilities found — try increasing the radius" : "No address set for this case yet"}</div></div>}

        {(showOnlyNotes ? pending.filter(f => !!(results[f.id]?.notes || (f as any).canvass_note)) : pending).map(f => { const cfg = TYPE_CFG[f.type] || TYPE_CFG.other; return (
          <div key={f.id} style={{ ...card, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: cfg.dot, flexShrink: 0, marginTop: 4 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: txt }}>{f.name}</span>
                {(f as any).same_address_count > 1 && (
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8,
                    background: `${acc}22`, color: acc, border: `1px solid ${acc}44` }}>
                    +{(f as any).same_address_count - 1} more at this address
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: sec, marginTop: 1 }}>{[f.address, f.city, f.state].filter(Boolean).join(", ")}{f.distance_mi > 0 ? ` · ${f.distance_mi.toFixed(1)} mi` : ""}</div>
              <PhoneLink phone={f.phone} acc={acc} />
              {/* Show saved note if exists */}
              {(results[f.id]?.notes || (f as any).canvass_note) && (
                <div style={{ marginTop: 5, padding: "5px 8px", borderRadius: 5,
                  background: isDark ? "rgba(250,204,21,0.1)" : "#fefce8",
                  border: `1px solid ${isDark ? "rgba(250,204,21,0.3)" : "#fde68a"}`,
                  fontSize: 11, color: isDark ? "#fde68a" : "#92400e",
                  display: "flex", alignItems: "flex-start", gap: 4 }}>
                  <span>📋</span>
                  <span>{results[f.id]?.notes || (f as any).canvass_note}</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
                <button onClick={() => setModalFac({...f, record_note: getFacNote(f) || f.record_note})} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, background: isDark ? "rgba(22,101,52,0.2)" : "#f0fdf4", color: isDark ? "#4ade80" : "#166534", border: "1px solid #86efac" }}>✓ With record</button>
                <button onClick={() => markChartOnly(f)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, background: isDark ? "rgba(234,179,8,0.15)" : "#fefce8", color: isDark ? "#fde047" : "#854d0e", border: `1px solid ${isDark ? "rgba(234,179,8,0.4)" : "#fde68a"}` }}>📋 Chart only</button>
                <button onClick={() => markNoRecord(f)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer", background: "transparent", color: sec, border: `1px solid ${bdr}` }}>✕ No record</button>
                <button onClick={() => setNoteFac(f)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer", background: "transparent", color: isDark ? "#94a3b8" : "#64748b", border: `1px solid ${bdr}` }}>📋 {results[f.id]?.notes ? "Edit note" : "Note"}</button>
                <button onClick={() => markDismissed(f)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer", background: "transparent", color: isDark ? "#6b7280" : "#9ca3af", border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}` }} title="Not a medical facility — remove from list">🗑 Erase</button>
              </div>
            </div>
          </div>
        ); })}

        <div data-canvass-section="results">{/* results-wrapper */}{null}</div>
        {!showOnlyNotes && withRecord.map(f => { const note = getFacNote(f); const cfg = TYPE_CFG[f.type] || TYPE_CFG.other; return (
          <div key={f.id} style={{ border: "1px solid #86efac", borderRadius: 8, padding: "10px 12px", background: isDark ? "rgba(22,101,52,0.15)" : "#f0fdf4", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: cfg.dot, flexShrink: 0, marginTop: 4 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: txt }}>{f.name}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: isDark ? "rgba(22,101,52,0.3)" : "#dcfce7", color: isDark ? "#4ade80" : "#166534", border: "1px solid #86efac" }}>✓ Record found</span>
              </div>
              <div style={{ fontSize: 12, color: sec, marginTop: 1 }}>{[f.address, f.city, f.state].filter(Boolean).join(", ")}{f.distance_mi > 0 ? ` · ${f.distance_mi.toFixed(1)} mi` : ""}</div>
              <PhoneLink phone={f.phone} acc={acc} />
              {note?.entries && note.entries.length > 0 && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #86efac", display: "flex", flexDirection: "column", gap: 5 }}>
                  {note.entries.map((e, i) => (
                    <div key={i} style={{ fontSize: 11, color: sec }}>
                      {note.entries.length > 1 && <span style={{ fontWeight: 700, color: isDark ? "#4ade80" : "#166534", marginRight: 4 }}>#{i+1}</span>}
                      {e.last_visit && <span>📅 {e.last_visit}</span>}
                      {e.service_type && <span> · {e.service_type}</span>}
                      {e.confirmed_by_dept && <span> · {e.confirmed_by_dept}</span>}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setModalFac({...f, record_note: getFacNote(f) || f.record_note})} style={{ marginTop: 6, fontSize: 11, padding: "3px 8px", borderRadius: 5, cursor: "pointer", background: "transparent", border: "1px solid #86efac", color: isDark ? "#4ade80" : "#166534" }}>Edit records</button>
            </div>
          </div>
        ); })}

        {/* chart_only facilities */}
        {!showOnlyNotes && chartOnly.map(f => { const cfg = TYPE_CFG[f.type] || TYPE_CFG.other; return (
          <div key={f.id} style={{ border: `1px solid ${isDark ? "rgba(234,179,8,0.4)" : "#fde68a"}`, borderRadius: 8, padding: "10px 12px", background: isDark ? "rgba(234,179,8,0.08)" : "#fefce8", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: cfg.dot, flexShrink: 0, marginTop: 4 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: txt }}>{f.name}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: isDark ? "rgba(234,179,8,0.25)" : "#fef9c3", color: isDark ? "#fde047" : "#854d0e", border: `1px solid ${isDark ? "rgba(234,179,8,0.5)" : "#fde68a"}` }}>📋 Chart / Account only</span>
              </div>
              <div style={{ fontSize: 12, color: sec, marginTop: 1 }}>{[f.address, f.city, f.state].filter(Boolean).join(", ")}{f.distance_mi > 0 ? ` · ${f.distance_mi.toFixed(1)} mi` : ""}</div>
              <PhoneLink phone={f.phone} acc={acc} />
              {(results[f.id]?.notes || (f as any).canvass_note) && (
                <div style={{ marginTop: 5, padding: "5px 8px", borderRadius: 5, background: isDark ? "rgba(250,204,21,0.1)" : "#fefce8", border: `1px solid ${isDark ? "rgba(250,204,21,0.3)" : "#fde68a"}`, fontSize: 11, color: isDark ? "#fde68a" : "#92400e" }}>
                  {results[f.id]?.notes || (f as any).canvass_note}
                </div>
              )}
              {(results[f.id] as any)?.account_info && (
                <div style={{ marginTop: 3, fontSize: 11, color: sec }}>
                  Account: {(results[f.id] as any).account_info}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={() => setNoteFac(f)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, cursor: "pointer", background: "transparent", border: `1px solid ${isDark ? "rgba(234,179,8,0.4)" : "#fde68a"}`, color: isDark ? "#fde047" : "#854d0e" }}>📋 {results[f.id]?.notes ? "Edit note" : "Add note"}</button>
                <button onClick={() => setModalFac({...f, record_note: getFacNote(f) || f.record_note})} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, cursor: "pointer", background: "transparent", border: "1px solid #86efac", color: isDark ? "#4ade80" : "#166534" }}>↑ Move to With Record</button>
                <button onClick={() => { setResults(r => ({ ...r, [f.id]: { ...r[f.id], facility_id: f.id, status: "pending" as const } })); fetch(`${base}/api/investigations/${inv.id}/canvass-result`, { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ facility_id: f.id, status: "pending" }) }).catch(()=>{}); }} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, cursor: "pointer", background: "transparent", border: `1px solid ${bdr}`, color: sec }}>↩ Undo</button>
              </div>
            </div>
          </div>
        ); })}

        {/* no_record facilities hidden from view — stored in DB for report */}
      </div>

    </>
  );
}

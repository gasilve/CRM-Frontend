// @ts-nocheck

import React, { lazy, Suspense } from "react";
;

const InvestigationMap = lazy(() => import("@/osint/components/investigations/InvestigationMap"));

// ── Report preview helper components ────────────────────────────────────────

function EditableText({
  value, onChange, multiline, style, placeholder,
}: {
  value: string; onChange: (v:string)=>void;
  multiline?: boolean; style?: React.CSSProperties; placeholder?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const baseStyle: React.CSSProperties = {
    cursor: "text", borderRadius: 3,
    transition: "background 0.1s",
    minWidth: 40,
    ...style,
  };
  if (!editing) {
    return (
      <span
        title="Click to edit"
        onClick={() => setEditing(true)}
        style={{
          ...baseStyle,
          background: "transparent",
          outline: "1px dashed transparent",
          display: multiline ? "block" : "inline",
        }}
        onMouseEnter={e => (e.currentTarget.style.outline = "1px dashed #94a3b8")}
        onMouseLeave={e => (e.currentTarget.style.outline = "1px dashed transparent")}
      >
        {value || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>{placeholder || "click to edit"}</span>}
      </span>
    );
  }
  if (multiline) {
    return (
      <textarea
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        rows={4}
        style={{
          ...baseStyle,
          width: "100%", boxSizing: "border-box",
          fontSize: "inherit", fontFamily: "inherit", lineHeight: "inherit",
          color: "inherit", background: "rgba(59,130,246,0.06)",
          border: "1px solid #3b82f6", outline: "none",
          padding: "2px 4px", resize: "vertical",
        }}
      />
    );
  }
  return (
    <input
      autoFocus
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={e => e.key === "Enter" && setEditing(false)}
      style={{
        ...baseStyle,
        fontSize: "inherit", fontFamily: "inherit", color: "inherit",
        background: "rgba(59,130,246,0.06)",
        border: "none", borderBottom: "1px solid #3b82f6",
        outline: "none", padding: "0 2px",
        minWidth: 80, width: Math.max(80, (value?.length || 0) * 7 + 20),
      }}
    />
  );
}

function ReportSection({ label, children, accent }: { label:string; children:React.ReactNode; accent?:boolean }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: accent ? "#3b82f6" : "#64748b",
        textTransform: "uppercase", letterSpacing: ".07em",
        borderBottom: `1px solid ${accent ? "#3b82f6" : "#e2e8f0"}`,
        paddingBottom: 4, marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  );
}

function PreviewRow({ label, val, onChange }: { label:string; val?:string; onChange:(v:string)=>void }) {
  if (!val && !onChange) return null;
  return (
    <div style={{ display: "flex", gap: 0, fontSize: 11, marginBottom: 3, lineHeight: 1.5 }}>
      <span style={{ minWidth: 110, fontWeight: 600, color: "#475569", fontFamily: "monospace" }}>{label}</span>
      <span style={{ color: "#334155" }}>:&nbsp;&nbsp;
        <EditableText
          value={val || ""}
          onChange={onChange}
          placeholder="—"
          style={{ fontSize: 11, color: "#334155" }}
        />
      </span>
    </div>
  );
}

function IntroPreview({ fields, facilities, allFacilities, onIntroChange }: {
  fields: Record<string,string>;
  facilities: any[];
  allFacilities: any[];
  onIntroChange: (v:string) => void;
}) {
  const subj  = fields.subject_name || "the subject";
  const dob   = fields.dob ? ` born on ${fields.dob}` : "";
  const total = allFacilities.length || 0;
  const found = facilities.length;
  const typeLabels: Record<string,string> = {
    hospital:"hospitals", urgent_care:"urgent care clinics", pharmacy:"pharmacies",
    chiropractor:"chiropractors", doctor:"primary care physicians",
    physical_therapy:"physical therapy centers", orthopedic:"orthopedic specialists",
    imaging:"imaging centers", primary_care:"primary care physicians",
  };
  const types = [...new Set(allFacilities.map((f:any) => f.type || "").filter(Boolean))];
  const typeNames = types.map((t:string) => typeLabels[t] || t.replace(/_/g," "));
  const typesStr = typeNames.length === 0
    ? "hospitals, urgent care clinics, primary care physicians, imaging centers, and pharmacies"
    : typeNames.length === 1 ? typeNames[0]
    : typeNames.length === 2 ? `${typeNames[0]} and ${typeNames[1]}`
    : typeNames.slice(0,-1).join(", ") + `, and ${typeNames[typeNames.length-1]}`;

  // Use override if set, else auto-generate
  const autoIntro = `This comprehensive medical canvass investigation was developed from a list of ${typesStr} within a reasonable distance from the subject's home address. Subsequently, we located facilities with a patient record of ${subj}${dob}, in their system. After canvassing ${total} facilities, we found ${found} facilit${found===1?"y":"ies"} with their records. We sorted the facilities by patient record name and ones that would only confirm an account or chart without acknowledging treatment. Medical facilities make a chart (medical providers) or account (pharmacies) for patients with an appointment or a doctor referral regardless of receiving treatment. Please consider that businesses have record retention limits when requesting records. Our research revealed the following:`;

  const displayText = fields._intro_override || autoIntro;

  return (
    <EditableText
      value={displayText}
      onChange={onIntroChange}
      multiline
      placeholder="Intro paragraph…"
      style={{ fontSize: 11, lineHeight: 1.65, color: "#334155", fontFamily: "serif" }}
    />
  );
}

function FacilityPreview({ f, results, fields, onFacilityChange }: {
  f: any; results: any; fields: Record<string,string>;
  onFacilityChange: (fid:string, field:string, val:string) => void;
}) {
  const note = f.record_note || results?.[f.id]?.record_note || {};
  const entries: any[] = note.entries || (note.last_visit || note.service_type ? [note] : []);
  const subj = fields.subject_name || "";
  const dob  = fields.dob ? `DOB ${fields.dob}.` : "";
  const addr = [f.address, f.city, f.state, f.zip].filter(Boolean).join(", ");

  // Editable overrides stored in fields as _fac_{id}_{field}
  const getFacField = (field: string, fallback: string) =>
    fields[`_fac_${f.id}_${field}`] ?? fallback;
  const setFacField = (field: string, val: string) =>
    onFacilityChange(f.id, field, val);

  return (
    <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", fontFamily: "serif", marginBottom: 2 }}>
        <EditableText value={getFacField("name", f.name)} onChange={v => setFacField("name",v)}
          style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", fontFamily: "serif" }} />
      </div>
      <div style={{ fontSize: 11, color: "#334155", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
        <EditableText value={getFacField("address", addr)} onChange={v => setFacField("address",v)}
          style={{ fontSize: 11, color: "#334155" }} />
        {f.phone && (
          <EditableText value={getFacField("phone", f.phone)} onChange={v => setFacField("phone",v)}
            style={{ fontSize: 11, color: "#64748b" }} />
        )}
      </div>
      {entries.length === 0 && (
        <div style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic" }}>No record details entered</div>
      )}
      {entries.map((entry: any, ei: number) => {
        const criteria: string[] = Array.isArray(entry.criteria) ? entry.criteria : [];
        const defaultCrit = criteria.length > 0 ? criteria.join(", ") : `${subj}. ${dob}`.trim();
        return (
          <div key={ei} style={{ fontSize: 11, color: "#334155", lineHeight: 1.7, marginTop: 4 }}>
            {(entry.last_visit || true) && (
              <div><b>Last visit:</b>{" "}
                <EditableText value={getFacField(`e${ei}_last_visit`, entry.last_visit || "")}
                  onChange={v => setFacField(`e${ei}_last_visit`,v)} placeholder="date" style={{ fontSize:11, color:"#334155" }} />
              </div>
            )}
            {(entry.confirmed_by_dept || true) && (
              <div><b>Confirmed by:</b>{" "}
                <EditableText value={getFacField(`e${ei}_confirmed`, entry.confirmed_by_dept || "")}
                  onChange={v => setFacField(`e${ei}_confirmed`,v)} placeholder="department" style={{ fontSize:11, color:"#334155" }} />
              </div>
            )}
            {(entry.service_type || true) && (
              <div><b>Service type:</b>{" "}
                <EditableText value={getFacField(`e${ei}_service`, entry.service_type || "")}
                  onChange={v => setFacField(`e${ei}_service`,v)} placeholder="type" style={{ fontSize:11, color:"#334155" }} />
              </div>
            )}
            <div><b>Criteria:</b>{" "}
              <EditableText value={getFacField(`e${ei}_criteria`, defaultCrit)}
                onChange={v => setFacField(`e${ei}_criteria`,v)} placeholder="criteria" style={{ fontSize:11, color:"#334155" }} />
            </div>
            {(entry.notes || true) && (
              <div>
                <EditableText value={getFacField(`e${ei}_notes`, entry.notes || "")}
                  onChange={v => setFacField(`e${ei}_notes`,v)}
                  placeholder="add notes…" multiline
                  style={{ fontSize:11, color:"#64748b", fontStyle: getFacField(`e${ei}_notes`, entry.notes||"") ? "normal" : "italic" }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


export function CanvassRightPanel({ inv, meta, isDark, acc, sec, txt, bg1, bg2, bdr, mut, base,
  facilities, radius, results }: any) {

  const [generating, setGenerating] = React.useState(false);
  const [sessionUser, setSessionUser] = React.useState<string>("");
  const claimNo  = inv?.extra_metadata?.claim_number || meta?.claim_number || "";
  const client   = meta?.client_company || "";

  // Fetch logged-in user name for Investigated by field
  React.useEffect(() => {
    fetch(`${base}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.authenticated && d?.name) setSessionUser(d.name); })
      .catch(() => {});
  }, [base]);

  const saveToShare = async () => {
    setShareStatus("Loading...");
    setShowShareModal(true);
    try {
      const r = await fetch(`${base}/api/investigations/${inv.id}/canvass-report-save-to-share`,
        { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body:"{}" });
      const d = await r.json();
      setShareFolders(d.folders || []);
      setShareName(d.suggested_name || "");
      setShareStatus("");
    } catch(e:any) { setShareStatus("Error: "+e.message); }
  };

  const doSaveToFolder = async (wsl: string) => {
    setShareStatus("Saving...");
    try {
      const r = await fetch(`${base}/api/investigations/${inv.id}/canvass-report-save-to-share`,
        { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ save_folder_wsl: wsl }) });
      const d = await r.json();
      setShareStatus(d.ok ? "✅ Saved: "+d.saved_to : "❌ "+(d.detail||"Error"));
    } catch(e:any) { setShareStatus("❌ "+e.message); }
  };

  const [showShareModal, setShowShareModal] = React.useState(false);
  const [shareFolders, setShareFolders]  = React.useState<{path:string;wsl:string;label:string}[]>([]);
  const [shareStatus, setShareStatus]    = React.useState("");
  const [shareName, setShareName]        = React.useState("");



  const generateReport = async (fmt: "docx"|"pdf" = "docx") => {
    setGenerating(true);
    try {
      const endpoint = fmt === "pdf"
        ? `/api/investigations/${inv.id}/canvass-report-pdf`
        : `/api/investigations/${inv.id}/canvass-report-docx`;
      const r = await fetch(`${base}${endpoint}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: reportFields }),
      });
      if (r.ok) {
        const blob = await r.blob();
        // Use filename from Content-Disposition header (has proper name)
        const cd = r.headers.get("content-disposition") || "";
        let fname = `canvass_${reportFields.claim_number || inv.id}.${fmt}`;
        const cdP = cd.split(";");
        for (const part of cdP) {
          const p = part.trim();
          if (p.toLowerCase().startsWith("filename=")) {
            fname = p.slice(9).replace(/^"|"$/g, "").trim(); break;
          }
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fname;
        a.click(); URL.revokeObjectURL(url);
      } else {
        const err = await r.json().catch(() => ({}));
        alert("Error: " + (err.detail || r.statusText));
      }
    } catch (e: any) { alert("Error: " + e.message); }
    finally { setGenerating(false); }
  };
  const doi      = meta?.date_of_injury || "";
  const adjuster = meta?.adjuster_name || "";
  const dueDate  = meta?.report_due_date || "";

  const withRecord = (facilities || []).filter((f: any) =>
    results?.[f.id]?.status === "with_record" || f.status === "with_record"
  );

  // Report preview modal
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [reportFields, setReportFields] = React.useState<Record<string,string>>({});

  const openReportModal = () => {
    const dob = inv?.subject_dob;
    let dobStr = "";
    if (dob) {
      try { dobStr = new Date(dob + "T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}); }
      catch { dobStr = String(dob); }
    }
    setReportFields({
      subject_name:    inv?.subject_name || "",
      dob:             dobStr,
      // Full masked SSN: if subject_ssn available use XXX-XX-last4, else just last4
      ssn_last4:       (() => {
        const full = (inv as any)?.subject_ssn;
        const last4 = inv?.subject_ssn_last4;
        if (full && full.match(/^\d{3}-\d{2}-\d{4}$/)) {
          return `XXX-XX-${full.split('-')[2]}`;
        }
        return last4 ? `XXX-XX-${last4}` : "";
      })(),
      // Highest confidence phone = first (sorted by TLO import)
      phone:           (inv?.subject_phones || [])[0] || "",
      // Use primary_address from TLO import (most recent) or first address
      address:         (meta as any)?.primary_address || (inv?.subject_addresses || []).find((a: string) =>
                         a && a.length > 10 && /^\d/.test(a) && !a.includes("people named")
                       ) || "",
      claim_number:    meta?.claim_number || "",
      client_company:  meta?.client_company || "",
      date_of_injury:  meta?.date_of_injury || "",
      adjuster_name:   meta?.adjuster_name || "",
      report_due_date: meta?.report_due_date || "",
      state:           meta?.canvass_state || "",
      investigator:    sessionUser || "",
    });
    setShowReportModal(true);
  };

  const card: React.CSSProperties = { border: `1px solid ${bdr}`, borderRadius: 8, background: bg2 };
  const Lbl: React.CSSProperties  = { fontSize: 9, textTransform: "uppercase", letterSpacing: ".07em", color: mut, fontWeight: 700, margin: "0 0 4px" };
  const Val: React.CSSProperties  = { fontSize: 13, fontWeight: 600, color: txt };

  return (
    <>
      {/* Map with facility markers */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "6px 10px", borderBottom: `1px solid ${bdr}`, background: bg1 }}>
          <p style={{ ...Lbl, margin: 0 }}>
            Canvass radius — {radius} mi
            {facilities?.length > 0 && (
              <span style={{ marginLeft: 8, color: acc, fontWeight: 700 }}>
                {facilities.length} facilities
              </span>
            )}
          </p>
        </div>
        <InvestigationMap
          addresses={inv?.subject_addresses ?? []}
          subjectName={inv?.subject_name || ""}
          investigationId={inv?.id}
          canvassFacilities={facilities || []}
          canvassRadius={radius}
          canvassMode={true}
        />
      </div>

      {/* Case quick-ref */}
      <div style={{ ...card, padding: "12px 14px" }}>
        <p style={Lbl}>Case</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {[
            { label: "Claim #",        val: claimNo  },
            { label: "Client",         val: client   },
            { label: "Date of injury", val: doi      },
            { label: "Adjuster",       val: adjuster },
            { label: "Due date",       val: dueDate, danger: true },
          ].map(({ label, val, danger }) => val ? (
            <div key={label}>
              <p style={Lbl}>{label}</p>
              <p style={{ ...Val, color: (danger as boolean) ? "var(--text-danger,#dc2626)" : txt, margin: 0 }}>{val}</p>
            </div>
          ) : null)}
        </div>
      </div>

      {/* Generate report button */}
      <button
        onClick={openReportModal}
        disabled={generating || withRecord.length === 0}
        style={{
          width: "100%", padding: "11px 14px",
          background: withRecord.length > 0 ? acc : (isDark ? "#1e293b" : "#f1f5f9"),
          color: withRecord.length > 0 ? "white" : sec,
          border: `1px solid ${withRecord.length > 0 ? acc : bdr}`,
          borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: generating || withRecord.length === 0 ? "default" : "pointer",
          opacity: generating ? 0.7 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "all 0.15s",
        }}>
        {generating ? (
          <>⏳ Generating…</>
        ) : withRecord.length > 0 ? (
          <>📄 Generate report — {withRecord.length} record{withRecord.length !== 1 ? "s" : ""}</>
        ) : (
          <>📄 Generate report<br /><span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>Mark facilities with records first</span></>
        )}
      </button>
    {/* ── Report Preview & Edit Modal ────────────────────────────── */}
    {showReportModal && (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }} onClick={e => { if (e.target === e.currentTarget) setShowReportModal(false); }}>
        <div style={{
          background: bg1, border: `1px solid ${bdr}`, borderRadius: 12,
          width: "min(680px,98vw)", maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{
            padding: "18px 20px 14px", borderBottom: `1px solid ${bdr}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            position: "sticky", top: 0, background: bg1, zIndex: 1,
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: txt }}>
                📄 Review before generating
              </div>
              <div style={{ fontSize: 11, color: sec, marginTop: 3 }}>
                Edit any fields — changes apply to this report only
              </div>
            </div>
            <button onClick={() => setShowReportModal(false)} style={{
              background: "none", border: "none", color: sec, fontSize: 20,
              cursor: "pointer", padding: "2px 6px", borderRadius: 4, lineHeight: 1,
            }}>×</button>
          </div>

          {/* Two-panel: fields | preview */}
          <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

            {/* LEFT — editable fields */}
            <div style={{
              width: 300, flexShrink: 0, overflowY: "auto",
              padding: "14px 16px", borderRight: `1px solid ${bdr}`,
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: sec, textTransform: "uppercase", letterSpacing: ".06em" }}>Fields</div>
              {([
                { key: "subject_name",    label: "Subject Name"      },
                { key: "dob",             label: "Date of Birth"      },
                { key: "ssn_last4",       label: "SSN"                },
                { key: "phone",           label: "Phone"              },
                { key: "address",         label: "Address"            },
                { key: "claim_number",    label: "Claim #"            },
                { key: "client_company",  label: "Client"             },
                { key: "date_of_injury",  label: "Date of Injury"     },
                { key: "adjuster_name",   label: "Adjuster"           },
                { key: "report_due_date", label: "Report Due Date"    },
                { key: "state",           label: "State (2-letter)"   },
                { key: "investigator",    label: "Investigator Name"  },
              ] as {key:string;label:string}[]).map(({ key, label }) => (
                <div key={key}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: mut, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{label}</div>

                  {/* Phone field: dropdown with all subject phones */}
                  {key === "phone" && (inv?.subject_phones?.length || 0) > 1 ? (
                    <div style={{ position: "relative" }}>
                      <select
                        value={reportFields.phone || ""}
                        onChange={e => setReportFields((p: Record<string,string>) => ({...p, phone: e.target.value}))}
                        style={{
                          width: "100%", boxSizing: "border-box",
                          padding: "6px 9px", borderRadius: 5, fontSize: 12,
                          border: `1px solid ${reportFields.phone ? acc+"55" : bdr}`,
                          background: bg2, color: txt, outline: "none", fontFamily: "inherit",
                          cursor: "pointer", appearance: "none",
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
                      <div style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", fontSize:10, color: mut }}>▾</div>
                    </div>
                  ) : key === "address" && (inv?.subject_addresses?.filter((a:string) =>
                      a && a.length > 10 && /^\d/.test(a) && !a.includes("people named") && !a.includes("locations")
                    ).length || 0) > 1 ? (
                    // Address dropdown — sorted most recent first (from TLO import)
                    <div style={{ position: "relative" }}>
                      <select
                        value={reportFields.address || ""}
                        onChange={e => setReportFields((p: Record<string,string>) => ({...p, address: e.target.value}))}
                        style={{
                          width: "100%", boxSizing: "border-box",
                          padding: "6px 9px", borderRadius: 5, fontSize: 12,
                          border: `1px solid ${reportFields.address ? acc+"55" : bdr}`,
                          background: bg2, color: txt, outline: "none", fontFamily: "inherit",
                          cursor: "pointer", appearance: "none",
                        }}>
                        {(inv?.subject_addresses || [])
                          .filter((a: string) => a && a.length > 10 && /^\d/.test(a)
                            && !a.includes("people named") && !a.includes("locations")
                            && !a.includes("other states") && !a.includes("People Search"))
                          .map((addr: string, i: number) => (
                            <option key={i} value={addr}>
                              {i === 0 ? "★ " : ""}{addr}
                            </option>
                          ))}
                      </select>
                      <div style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", fontSize:10, color: mut }}>▾</div>
                    </div>
                  ) : key === "address" && (inv?.subject_addresses?.filter((a: string) =>
                      a && a.length > 10 && a[0] >= "0" && a[0] <= "9"
                      && !a.includes("people named") && !a.includes("locations")
                    ).length || 0) > 1 ? (
                    <div style={{ position: "relative" }}>
                      <select
                        value={reportFields.address || ""}
                        onChange={e => setReportFields((p: Record<string,string>) => ({...p, address: e.target.value}))}
                        style={{
                          width: "100%", boxSizing: "border-box",
                          padding: "6px 9px", borderRadius: 5, fontSize: 12,
                          border: `1px solid ${reportFields.address ? acc+"55" : bdr}`,
                          background: bg2, color: txt, outline: "none", fontFamily: "inherit",
                          cursor: "pointer", appearance: "none" as const,
                        }}>
                        {(inv?.subject_addresses || [])
                          .filter((a: string) => a && a.length > 10
                            && a[0] >= "0" && a[0] <= "9"
                            && !a.includes("people named") && !a.includes("locations")
                            && !a.includes("other states") && !a.includes("People Search"))
                          .map((addr: string, i: number) => (
                            <option key={i} value={addr}>
                              {i === 0 ? "★ " : ""}{addr}
                            </option>
                          ))}
                      </select>
                      <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 10, color: mut }}>▾</div>
                    </div>
                  ) : (
                    <input
                      value={reportFields[key] || ""}
                      onChange={e => setReportFields((p: Record<string,string>) => ({...p, [key]: e.target.value}))}
                      placeholder="—"
                      style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "6px 9px", borderRadius: 5, fontSize: 12,
                        border: `1px solid ${reportFields[key] ? acc+"55" : bdr}`,
                        background: bg2, color: txt, outline: "none", fontFamily: "inherit",
                      }}
                      onFocus={e => (e.target.style.borderColor = acc)}
                      onBlur={e => (e.target.style.borderColor = reportFields[key] ? acc+"55" : bdr)}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* RIGHT — report preview */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", background: isDark ? "#0f172a" : "#f8fafc" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: sec, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>Report preview</div>

              {/* Section 1 — Case info block */}
              <ReportSection label="Case Info">
                <PreviewRow label="Re"           val={reportFields.subject_name}   onChange={v => setReportFields(p=>({...p,subject_name:v}))} />
                <PreviewRow label="Claim"         val={reportFields.claim_number}   onChange={v => setReportFields(p=>({...p,claim_number:v}))} />
                <PreviewRow label="Date of Loss"  val={reportFields.date_of_injury} onChange={v => setReportFields(p=>({...p,date_of_injury:v}))} />
                <PreviewRow label="Adjuster"      val={reportFields.adjuster_name}  onChange={v => setReportFields(p=>({...p,adjuster_name:v}))} />
                <PreviewRow label="Client"        val={reportFields.client_company} onChange={v => setReportFields(p=>({...p,client_company:v}))} />
              </ReportSection>

              {/* Section 2 — Intro paragraph */}
              <ReportSection label="Intro Paragraph">
                <IntroPreview
                  fields={reportFields}
                  facilities={withRecord}
                  allFacilities={facilities || []}
                  onIntroChange={v => setReportFields(p=>({...p, _intro_override: v}))}
                />
              </ReportSection>

              {/* Section 3 — Facilities with records */}
              {withRecord.length > 0 && (
                <ReportSection label={`Facilities With Records — ${(reportFields.subject_name || "").toUpperCase()}`} accent>
                  {withRecord.map((f: any) => (
                    <FacilityPreview
                      key={f.id} f={f} results={results} fields={reportFields}
                      onFacilityChange={(fid, field, val) =>
                        setReportFields(p => ({...p, [`_fac_${fid}_${field}`]: val}))
                      }
                    />
                  ))}
                </ReportSection>
              )}

              {/* Section 4 — No records */}
              {(facilities || []).filter((f:any) => results?.[f.id]?.status === "no_record" || f.status === "no_record").length > 0 && (
                <ReportSection label="No Records Found (Chart/Account Only)">
                  {(facilities || [])
                    .filter((f:any) => results?.[f.id]?.status === "no_record" || f.status === "no_record")
                    .map((f:any) => (
                      <div key={f.id} style={{ fontSize: 11, color: "#64748b", padding: "3px 0" }}>
                        — {f.name}{f.address ? `, ${f.address}` : ""}
                      </div>
                    ))}
                </ReportSection>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div style={{
            padding: "14px 20px", borderTop: `1px solid ${bdr}`,
            display: "flex", gap: 10, justifyContent: "flex-end",
            position: "sticky", bottom: 0, background: bg1,
          }}>
            <button onClick={() => setShowReportModal(false)} style={{
              padding: "9px 18px", borderRadius: 7, fontSize: 13, fontWeight: 500,
              background: "transparent", color: sec,
              border: `1px solid ${bdr}`, cursor: "pointer",
            }}>Cancel</button>
            <button
              onClick={() => { setShowReportModal(false); generateReport("docx"); }}
              disabled={generating}
              style={{
                padding: "9px 18px", borderRadius: 7, fontSize: 13, fontWeight: 700,
                background: acc, color: "white", border: "none", cursor: "pointer",
                opacity: generating ? 0.7 : 1,
              }}>
              {generating ? "⏳ Generating…" : "📝 Word (.docx)"}
            </button>
            <button
              onClick={() => { setShowReportModal(false); generateReport("pdf"); }}
              disabled={generating}
              style={{
                padding: "9px 18px", borderRadius: 7, fontSize: 13, fontWeight: 700,
                background: "transparent", color: acc,
                border: `1px solid ${acc}`, cursor: "pointer",
                opacity: generating ? 0.7 : 1,
              }}>
              {generating ? "⏳…" : "📄 PDF"}
            </button>
            <button
              onClick={() => { setShowReportModal(false); saveToShare(); }}
              disabled={generating}
              style={{
                padding: "9px 18px", borderRadius: 7, fontSize: 13, fontWeight: 700,
                background: "transparent", color: "#8b5cf6",
                border: "1px solid #8b5cf6", cursor: "pointer",
              }}>
              💾 W:
            </button>
          </div>
        </div>
      </div>
    )}
    {showShareModal && (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:999999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
        onClick={e => { if(e.target===e.currentTarget){setShowShareModal(false);setShareStatus("");} }}>
        <div style={{background:isDark?"#1e2433":"#fff",border:`1px solid ${bdr}`,borderRadius:14,padding:20,width:480,maxWidth:"95vw",boxShadow:"0 25px 60px rgba(0,0,0,0.6)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:14,fontWeight:700,color:txt}}>💾 Save to shared drive (W:)</span>
            <button onClick={()=>{setShowShareModal(false);setShareStatus("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:sec}}>×</button>
          </div>
          {shareName && <div style={{fontSize:11,color:mut,marginBottom:10,fontFamily:"monospace",padding:"4px 8px",background:isDark?"rgba(255,255,255,0.05)":"#f8fafc",borderRadius:5}}>{shareName}</div>}
          {shareStatus && <div style={{fontSize:12,padding:"6px 10px",borderRadius:6,marginBottom:8,
            background:shareStatus.startsWith("✅")?(isDark?"rgba(34,197,94,0.1)":"#f0fdf4"):isDark?"rgba(255,255,255,0.05)":"#f8fafc",
            color:shareStatus.startsWith("✅")?"#22c55e":shareStatus.startsWith("❌")?"#ef4444":sec}}>{shareStatus}</div>}
          <div style={{display:"flex",flexDirection:"column" as any,gap:6,maxHeight:300,overflowY:"auto" as any}}>
            {shareFolders.map((f,i) => (
              <button key={i} onClick={()=>doSaveToFolder(f.wsl)}
                style={{textAlign:"left" as any,padding:"10px 14px",borderRadius:8,border:`1px solid ${bdr}`,background:"transparent",cursor:"pointer",fontSize:12,color:txt}}
                onMouseEnter={e=>(e.currentTarget.style.background=isDark?"rgba(255,255,255,0.07)":"#f1f5f9")}
                onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                <div style={{fontWeight:600}}>{f.label}</div>
                <div style={{fontSize:10,color:mut,marginTop:2}}>{f.path}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )}
    {showShareModal && (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:999999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
        onClick={e => { if(e.target===e.currentTarget){setShowShareModal(false);setShareStatus("");} }}>
        <div style={{background:isDark?"#1e2433":"#fff",border:`1px solid ${bdr}`,borderRadius:14,padding:20,width:480,maxWidth:"95vw",boxShadow:"0 25px 60px rgba(0,0,0,0.6)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:14,fontWeight:700,color:txt}}>💾 Save to W: drive</span>
            <button onClick={()=>{setShowShareModal(false);setShareStatus("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:sec}}>×</button>
          </div>
          {shareName && <div style={{fontSize:11,color:mut,marginBottom:10,fontFamily:"monospace",padding:"4px 8px",background:isDark?"rgba(255,255,255,0.05)":"#f8fafc",borderRadius:5}}>{shareName}</div>}
          {shareStatus && <div style={{fontSize:12,padding:"6px 10px",borderRadius:6,marginBottom:8,color:shareStatus.startsWith("✅")?"#22c55e":shareStatus.startsWith("❌")?"#ef4444":sec}}>{shareStatus}</div>}
          <div style={{display:"flex",flexDirection:"column" as any,gap:6,maxHeight:300,overflowY:"auto" as any}}>
            {shareFolders.map((f,i) => (
              <button key={i} onClick={()=>doSaveToFolder(f.wsl)}
                style={{textAlign:"left" as any,padding:"10px 14px",borderRadius:8,border:`1px solid ${bdr}`,background:"transparent",cursor:"pointer",fontSize:12,color:txt}}
                onMouseEnter={e=>(e.currentTarget.style.background=isDark?"rgba(255,255,255,0.07)":"#f1f5f9")}
                onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                <div style={{fontWeight:600}}>{f.label}</div>
                <div style={{fontSize:10,color:mut,marginTop:2}}>{f.path}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// @ts-nocheck

import { useState, useEffect } from "react";
import { isGlassTheme } from "@/lib/theme";

const BASE = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname)
  ? "" : "http://localhost:8000";

interface Capture {
  id: number;
  url: string;
  page_title: string;
  url_hash: string;
  content_hash: string | null;
  captured_at: string;
  collector_name: string;
  notes: string | null;
  has_screenshot: boolean;
  has_html: boolean;
  tags: string[];
  is_relevant: boolean | null;
  selector_matches: any[];
  images_extracted: {src:string;alt:string;width:number;height:number}[];
  has_video: boolean;
  media_type: string;
  video_duration: number | null;
  has_page_text: boolean;
  page_text: string | null;
}

interface Monitor {
  id: number;
  url: string;
  page_title: string | null;
  last_checked_at: string | null;
  last_changed_at: string | null;
  change_count: number;
}

export function CapturesTab({ invId, isGL }: { invId: number; isGL: boolean }) {
  const [captures, setCaptures]  = useState<Capture[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{url:string;name:string;hash:string;reused?:boolean;exportedAt?:string}|null>(null);
  const [exportHistory, setExportHistory] = useState<{id:number;zip_name:string;zip_hash:string;zip_size:number;captures:number;exported_by:string;download_url:string;created_at:string}[]>([]);
  const [showHistory,   setShowHistory]   = useState(false);
  const [emailModal, setEmailModal]   = useState(false);
  const [emailTo,    setEmailTo]      = useState("");
  const [emailMsg,   setEmailMsg]     = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent,  setEmailSent]    = useState(false);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<"captures" | "monitors" | "automation">("captures");
  const [selected, setSelected] = useState<Capture | null>(null);
  const [editNotes, setEditNotes] = useState<Record<number,string>>({});
  const [queue, setQueue]         = useState<any[]>([]);
  const [newUrl, setNewUrl]       = useState("");
  const [newLabel, setNewLabel]   = useState("");
  const [addingUrl, setAddingUrl] = useState(false);
  const gl = isGL || isGlassTheme();

  const bdr = gl ? "rgba(255,255,255,0.12)" : "#e2e8f0";
  const bg1 = gl ? "rgba(255,255,255,0.05)" : "#f8fafc";
  const bg2 = gl ? "rgba(255,255,255,0.08)" : "#ffffff";
  const txt = gl ? "rgba(218,234,255,0.95)" : "#0f172a";
  const sec = gl ? "rgba(160,185,240,0.70)" : "#64748b";
  const acc = gl ? "#6a8fff" : "#1e40af";

  useEffect(() => {
    if (invId && invId > 0) load();
    else setLoading(false);
  }, [invId]);

  async function load() {
    setLoading(true);
    try {
      const [cr, mr, qr, er] = await Promise.all([
        fetch(`${BASE}/api/forensic/captures?investigation_id=${invId}`, { credentials: "include" }),
        fetch(`${BASE}/api/forensic/monitors?investigation_id=${invId}`, { credentials: "include" }),
        fetch(`${BASE}/api/forensic/queue?investigation_id=${invId}`, { credentials: "include" }),
        fetch(`${BASE}/api/forensic/exports/${invId}`, { credentials: "include" }),
      ]);
      if (!cr.ok) { console.error("Captures fetch failed:", cr.status); setLoading(false); return; }
      const cd = await cr.json();
      const md = mr.ok ? await mr.json() : { monitors: [] };
      const qd = qr && qr.ok ? await qr.json() : { items: [] };
      const ed = er && er.ok ? await er.json() : { exports: [] };
      console.log("[CapturesTab] invId:", invId, "captures:", cd.total);
      setCaptures(cd.captures || []);
      setMonitors(md.monitors || []);
      setQueue(qd.items || []);
      setExportHistory(ed.exports || []);
    } catch(e) {
      console.error("[CapturesTab] error:", e);
    }
    setLoading(false);
  }

  async function saveNotes(id: number, notes: string) {
    await fetch(`${BASE}/api/forensic/captures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ notes }),
    });
  }

  async function setRelevant(id: number, val: boolean | null) {
    await fetch(`${BASE}/api/forensic/captures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_relevant: val }),
    });
    setCaptures(prev => prev.map(c => c.id === id ? { ...c, is_relevant: val } : c));
  }

  async function deleteCapture(id: number) {
    setConfirmDeleteId(id);
  }

  async function emptyTrash() {
    const r = await fetch(`${BASE}/api/forensic/captures/empty-trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ investigation_id: invId }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      if (d.deleted > 0) {
        alert(`🗑️ ${d.deleted} capture(s) permanently deleted from staging.`);
      } else {
        alert("No removed captures to delete. Remove captures first using the Remove button.");
      }
      load();
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await fetch(`${BASE}/api/forensic/captures/${id}`, {
        method: "DELETE", credentials: "include"
      });
      setCaptures(prev => prev.filter(c => c.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch(e: any) {
      console.error("Delete error:", e);
    }
  }

  async function removeMonitor(id: number) {
    await fetch(`${BASE}/api/forensic/monitors/${id}`, {
      method: "DELETE", credentials: "include"
    });
    setMonitors(prev => prev.filter(m => m.id !== id));
  }

  async function exportCollection() {
    setExporting(true); setExportResult(null);
    try {
      const r = await fetch(`${BASE}/api/forensic/export/${invId}`,
        {method:"POST",credentials:"include"});
      const d = await r.json();
      if (d.ok) {
        setExportResult({url:d.download_url,name:d.zip_name,hash:d.zip_hash,
          reused:d.reused, exportedAt:d.exported_at});
        // Refresh history
        const er = await fetch(`${BASE}/api/forensic/exports/${invId}`, {credentials:"include"});
        if (er.ok) { const ed = await er.json(); setExportHistory(ed.exports||[]); }
      } else alert("Export failed: "+(d.detail||"unknown"));
    } catch(e:any){alert("Error: "+e.message);}
    finally{setExporting(false);}
  }

  const [generatingReport, setGeneratingReport] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number|null>(null);
  const [generatingWord, setGeneratingWord] = useState(false);
  const [showSigModal, setShowSigModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string|null>(null);
  const [aiInjury, setAiInjury] = useState("");
  const [aiCaseType, setAiCaseType] = useState("workers_comp");
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [certList, setCertList] = useState<{filename:string,label:string,size:number}[]>([]);
  const [sigPreview, setSigPreview] = useState<string|null>(null);
  const [sigMode, setSigMode] = useState<string>("font");
  const [sigFont, setSigFont] = useState<string>("BlackPen");
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontList, setFontList] = useState<{id:string,label:string,builtin:boolean,file?:string}[]>([
    {id:"BlackPen", label:"Black Pen", builtin:true},
    {id:"rotherland", label:"Rotherland", builtin:true},
    {id:"PinyonScript", label:"Pinyon Script", builtin:true},
  ]);
  async function generateReport() {
    setGeneratingReport(true);
    try {
      // Start async generation
      const r = await fetch(`${BASE}/api/forensic/report-async`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ investigation_id: invId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.job_id) {
        alert("Report failed to start: " + (d.detail || r.statusText));
        setGeneratingReport(false);
        return;
      }
      // Poll for completion
      const jobId = d.job_id;
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const sr = await fetch(`${BASE}/api/forensic/report-status/${jobId}`, { credentials: "include" });
        const sd = await sr.json().catch(() => ({}));
        if (sd.status === "done") {
          clearInterval(poll);
          // Download the PDF
          const a = document.createElement("a");
          a.href = `${BASE}/api/forensic/report-download/${jobId}`;
          a.download = `ForensicReport_${invId}.pdf`;
          a.click();
          setGeneratingReport(false);
        } else if (sd.status === "failed" || attempts > 60) {
          clearInterval(poll);
          alert("Report generation failed. Please try again.");
          setGeneratingReport(false);
        }
      }, 3000);
    } catch (e: any) {
      alert("Report error: " + e.message);
      setGeneratingReport(false);
    }
  }

  const [showExportModal, setShowExportModal] = useState(false);

  async function exportCase(source: "staging" | "evidence" = "staging") {
    setShowExportModal(false);
    const relevant = captures.filter(c => c.is_relevant === true);
    if (relevant.length === 0) {
      alert("No captures marked as relevant. Mark with ⭐ first.");
      return;
    }
    // Start export job
    const r = await fetch(`${BASE}/api/forensic/export-case`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ investigation_id: invId, source }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.job_id) {
      alert("Export failed to start: " + (d.detail || r.statusText));
      return;
    }
    alert(`📦 Export started — ${relevant.length} captures. This may take 1-2 minutes. You'll get a download link when ready.`);
    const jobId = d.job_id;
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const sr = await fetch(`${BASE}/api/forensic/export-status/${jobId}`, { credentials: "include" });
      const sd = await sr.json().catch(() => ({}));
      if (sd.status === "done" && sd.download_url) {
        clearInterval(poll);
        // Open download directly in new tab
        window.open(sd.download_url, "_blank");
        alert("✅ Export ready! The ZIP download has started in a new tab.");
      } else if (sd.status === "failed" || attempts > 60) {
        clearInterval(poll);
        alert("Export failed. Please try again.");
      }
    }, 5000);
  }

  async function promoteToEvidence() {
    const relevantCaptures = captures.filter(c => c.is_relevant === true);
    if (relevantCaptures.length === 0) {
      alert("No captures marked as relevant. Mark at least one capture with ⭐ first.");
      return;
    }
    if (!confirm(`Promote ${relevantCaptures.length} relevant capture(s) to evidence bucket? This action cannot be undone.`)) return;
    try {
      const r = await fetch(`${BASE}/api/forensic/promote-to-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ investigation_id: invId, capture_ids: relevantCaptures.map(c => c.id) }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        alert(`✅ ${d.promoted || relevantCaptures.length} capture(s) promoted to evidence bucket.`);
      } else {
        alert("Error: " + (d.detail || "Unknown error"));
      }
    } catch(e: any) {
      alert("Error: " + e.message);
    }
  }

  async function generateReportOnly() {
    setGeneratingReport(true);
    try {
      const r = await fetch(`${BASE}/api/forensic/report-async`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ investigation_id: invId, report_type: "report-only" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.job_id) {
        alert("Report failed to start: " + (d.detail || r.statusText));
        setGeneratingReport(false);
        return;
      }
      const jobId = d.job_id;
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const sr = await fetch(`${BASE}/api/forensic/report-status/${jobId}`, { credentials: "include" });
        const sd = await sr.json().catch(() => ({}));
        if (sd.status === "done") {
          clearInterval(poll);
          const a = document.createElement("a");
          a.href = `${BASE}/api/forensic/report-download/${jobId}`;
          a.download = `ForensicReport_${invId}.pdf`;
          a.click();
          setGeneratingReport(false);
        } else if (sd.status === "failed" || attempts > 60) {
          clearInterval(poll);
          alert("Report generation failed. Please try again.");
          setGeneratingReport(false);
        }
      }, 3000);
    } catch (e: any) {
      alert("Report error: " + e.message);
      setGeneratingReport(false);
    }
  }

  async function generateWord() {
    setGeneratingWord(true);
    try {
      const r = await fetch(`${BASE}/api/forensic/report-word`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ investigation_id: invId }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: "Unknown error" }));
        alert("Word report failed: " + (err.detail || r.statusText));
        return;
      }
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `ForensicReport_${invId}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Word error: " + e.message);
    } finally {
      setGeneratingWord(false);
    }
  }

  async function uploadSignature(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = (e.target?.result as string).split(",")[1];
      setSigPreview(e.target?.result as string);
      setSigMode("image");
      try {
        const r = await fetch(`${BASE}/api/forensic/signature`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ collector_name: "Guillermo Silvero", signature_b64: b64, mode: "image" }),
        });
        if (!r.ok) alert("Error saving signature");
      } catch(e: any) { alert("Error: " + e.message); }
    };
    reader.readAsDataURL(file);
  }

  async function saveSigMode(mode: string, font?: string) {
    try {
      await fetch(`${BASE}/api/forensic/signature`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ collector_name: "Guillermo Silvero", mode, sig_font: font || sigFont }),
      });
      setSigMode(mode);
      if (font) setSigFont(font);
      setShowSigModal(false);
    } catch(e: any) { alert("Error: " + e.message); }
  }

  async function loadCerts() {
    try {
      const r = await fetch(`${BASE}/api/forensic/certificates`, { credentials:"include" });
      if (r.ok) { const d = await r.json(); setCertList(d.certificates); }
    } catch {}
  }

  async function uploadCert(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = (e.target?.result as string);
      try {
        const r = await fetch(`${BASE}/api/forensic/certificates`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          credentials:"include",
          body: JSON.stringify({ filename: file.name, data_b64: b64 }),
        });
        if (r.ok) { await loadCerts(); }
        else alert("Upload failed");
      } catch(e:any) { alert("Error: "+e.message); }
    };
    reader.readAsDataURL(file);
  }

  async function deleteCert(filename: string) {
    if (!confirm(`Remove ${filename} from appendix?`)) return;
    await fetch(`${BASE}/api/forensic/certificates/${encodeURIComponent(filename)}`,
      { method:"DELETE", credentials:"include" });
    await loadCerts();
  }

  async function runAIAnalysis() {
    if (!aiInjury.trim()) { alert("Describe the claimed injury first"); return; }
    setAiRunning(true); setAiResults([]);
    try {
      const r = await fetch(`${BASE}/api/forensic/ai-analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          investigation_id: invId,
          injury_description: aiInjury,
          case_type: aiCaseType,
          max_captures: 5,
        }),
      });
      const text = await r.text();
      let d: any;
      try { d = JSON.parse(text); } catch(pe) {
        throw new Error(`Server returned non-JSON (status ${r.status}): ${text.slice(0,200)}`);
      }
      if (!r.ok) throw new Error(d.detail || "Analysis failed");
      setAiResults(d.results || []);
      setAiSummary({ total: d.total_analyzed, critical: d.critical_findings });
    } catch(e: any) { alert("AI Error: " + e.message);
    } finally { setAiRunning(false); }
  }

  async function loadSigFonts(forceReload = false) {
    if (fontsLoaded && !forceReload) return;
    try {
      // Fetch full font list from server
      const listR = await fetch(`${BASE}/api/forensic/fonts`, { credentials: "include" });
      if (listR.ok) {
        const listData = await listR.json();
        setFontList(listData.fonts);
        // Load each font into browser
        for (const f of listData.fonts) {
          try {
            const r = await fetch(`${BASE}/api/forensic/font/${f.id}`, { credentials: "include" });
            if (!r.ok) continue;
            const data = await r.json();
            const ext  = f.file?.endsWith(".otf") ? "opentype" : "truetype";
            const css  = `@font-face { font-family: '${f.id}'; src: url('data:font/${ext};base64,${data.font_b64}') format('${ext}'); font-weight: 400; }`;
            const style = document.createElement("style");
            style.textContent = css;
            document.head.appendChild(style);
          } catch {}
        }
      }
    } catch {}
    setFontsLoaded(true);
  }

  async function uploadFont(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64   = (e.target?.result as string).split(",")[1];
      const ext   = file.name.split(".").pop()?.toLowerCase() || "ttf";
      const name  = file.name.replace(/\.(ttf|otf)$/i, "");
      try {
        const r = await fetch(`${BASE}/api/forensic/font`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ font_name: name, font_b64: b64, font_ext: ext }),
        });
        if (r.ok) {
          const data = await r.json();
          setSigFont(data.font_name);
          await loadSigFonts(true);  // reload list with new font
        } else alert("Error uploading font");
      } catch (e: any) { alert("Upload error: " + e.message); }
    };
    reader.readAsDataURL(file);
  }

  function timeAgo(iso: string) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return "just now";
    if (diff < 3600)  return Math.round(diff/60) + "m ago";
    if (diff < 86400) return Math.round(diff/3600) + "h ago";
    return Math.round(diff/86400) + "d ago";
  }

  const card: React.CSSProperties = {
    background: bg2, border: `1px solid ${bdr}`, borderRadius: 10,
    padding: "10px 12px", marginBottom: 6,
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: 40, color: sec }}>Loading captures…</div>
  );

  return (
    <>
    <div style={{ display: "flex", gap: 8, height: 560 }}>

      {/* FAR LEFT: action buttons sidebar */}
      <div style={{ width: 90, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4,
        paddingTop: 2 }}>

        {/* Relevant summary */}
        {(() => {
          const rel = captures.filter(c => c.is_relevant === true);
          return rel.length > 0 ? (
            <div style={{ padding: "5px 6px", borderRadius: 7, marginBottom: 4,
              background: gl ? "rgba(255,200,50,0.1)" : "#fffbeb",
              border: `1px solid ${gl ? "rgba(255,200,50,0.2)" : "#fde68a"}`,
              textAlign: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: gl ? "rgba(255,220,100,0.9)" : "#92400e" }}>
                📋 {rel.length} for report
              </div>
              {(() => {
                const byType = rel.reduce((acc: any, c) => { acc[c.media_type] = (acc[c.media_type]||0)+1; return acc; }, {});
                const icons: any = { recording:"🎞️", expanded:"📜", screenshot:"📷", video:"🎬" };
                return Object.entries(byType).map(([t,n]: any) => (
                  <div key={t} style={{ fontSize: 9, color: gl ? "rgba(220,180,80,0.8)" : "#78350f" }}>
                    {icons[t]||"📄"} {n} {t}
                  </div>
                ));
              })()}
            </div>
          ) : (
            <div style={{ padding: "5px 6px", borderRadius: 7, marginBottom: 4,
              background: gl ? "rgba(100,100,100,0.08)" : "#f9fafb",
              border: `1px solid ${bdr}`, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: sec }}>☆ Mark relevant<br/>to include</div>
            </div>
          );
        })()}

        {[
          { label: "PDF + Certs", icon: "📄", onClick: generateReport, disabled: generatingReport, color: "#3b82f6" },
          { label: "PDF only", icon: "📋", onClick: generateReportOnly, disabled: generatingReport, color: "#6b7280" },
          { label: "Word", icon: "📝", onClick: generateWord, disabled: generatingWord, color: "#2563eb" },
          { label: "Export 📦", icon: "📦", onClick: () => setShowExportModal(true), disabled: false, color: "#7c3aed" },
          { label: "Promote ⭐", icon: "🔒", onClick: promoteToEvidence, disabled: false, color: "#d97706" },
        ].map(btn => (
          <button key={btn.label} onClick={btn.onClick} disabled={btn.disabled}
            style={{ width: "100%", padding: "7px 4px", borderRadius: 8, cursor: btn.disabled ? "not-allowed" : "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              background: gl ? "rgba(255,255,255,0.04)" : "#ffffff",
              border: `1px solid ${btn.label.includes("Promote") ? "#fbbf24" : bdr}`,
              opacity: btn.disabled ? 0.5 : 1, transition: "all 0.15s" }}>
            <span style={{ fontSize: 16 }}>{btn.icon}</span>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: btn.label.includes("Promote") ? "#92400e" : sec,
              textAlign: "center", lineHeight: 1.2 }}>{btn.label}</span>
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Sign button */}
        <button onClick={() => { setShowSigModal(true); loadSigFonts(); }}
          style={{ width: "100%", padding: "7px 4px", borderRadius: 8, cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: gl ? "rgba(255,255,255,0.04)" : "#ffffff",
            border: `1px solid ${bdr}` }}>
          <span style={{ fontSize: 16 }}>✍️</span>
          <span style={{ fontSize: 9.5, fontWeight: 600, color: sec, textAlign: "center", lineHeight: 1.2 }}>Sign</span>
        </button>

        {/* Empty Trash button - always visible */}
        <button onClick={emptyTrash}
          style={{ width: "100%", padding: "7px 4px", borderRadius: 8, cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: gl ? "rgba(255,80,80,0.08)" : "#fff5f5",
            border: "1px solid rgba(255,80,80,0.25)" }}>
          <span style={{ fontSize: 16 }}>🗑️</span>
          <span style={{ fontSize: 9.5, fontWeight: 600, color: "#dc2626", textAlign: "center", lineHeight: 1.2 }}>
            Empty<br/>Trash
          </span>
        </button>
      </div>

      {/* MIDDLE: captures list */}
      <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {(["captures", "monitors", "automation"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ flex: 1, padding: "5px 0", borderRadius: 8, cursor: "pointer",
                background: view === v ? `rgba(${gl?"100,150,255":"30,64,175"},0.${gl?"18":"1"})` : "transparent",
                border: view === v ? `1px solid ${acc}44` : `1px solid ${bdr}`,
                color: view === v ? acc : sec, fontSize: 11.5, fontWeight: 600 }}>
              {v === "captures" ? `📷 Captures (${captures.length})` : v === "monitors" ? `🔔 Monitors (${monitors.length})` : `⚡ Queue (${queue.filter((q:any)=>q.status==="pending").length})`}
            </button>
          ))}
        </div>

        {/* Action buttons moved to sidebar */}
        <div style={{ display: "none" }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-start" }}>

            <button onClick={generateReport} disabled={generatingReport}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:5, padding:"10px 14px", borderRadius:10, cursor:"pointer", minWidth:72,
                border:"1px solid #e5e7eb", background:"#ffffff", opacity: generatingReport ? 0.6 : 1,
                transition:"all 0.15s" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>
              <span style={{ fontSize:11, color:"#374151", fontWeight:500, whiteSpace:"nowrap" }}>{generatingReport ? "..." : "PDF + Certs"}</span>
            </button>

            <button onClick={generateReportOnly} disabled={generatingReport}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:5, padding:"10px 14px", borderRadius:10, cursor:"pointer", minWidth:72,
                border:"1px solid #e5e7eb", background:"#ffffff", opacity: generatingReport ? 0.6 : 1,
                transition:"all 0.15s" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{ fontSize:11, color:"#374151", fontWeight:500, whiteSpace:"nowrap", lineHeight:1.2 }}>PDF only</span>
            </button>

            <button onClick={generateWord} disabled={generatingWord}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:5, padding:"10px 14px", borderRadius:10, cursor:"pointer", minWidth:72,
                border:"1px solid #e5e7eb", background:"#ffffff", opacity: generatingWord ? 0.6 : 1,
                transition:"all 0.15s" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8l2.5 8L12 10l2.5 6L17 8"/></svg>
              <span style={{ fontSize:11, color:"#374151", fontWeight:500, whiteSpace:"nowrap", lineHeight:1.2 }}>{generatingWord ? "..." : "Word"}</span>
            </button>

            <button onClick={promoteToEvidence}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:5, padding:"10px 14px", borderRadius:10, cursor:"pointer", minWidth:72,
                border:"1px solid #fbbf24",
                background: gl ? "rgba(251,191,36,0.1)" : "#fffbeb",
                transition:"all 0.15s" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.6">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
              <span style={{ fontSize:11, color:"#92400e", fontWeight:600, whiteSpace:"nowrap", lineHeight:1.2 }}>Promote</span>
            </button>

            <div style={{ width:"1px", background:"#e5e7eb", alignSelf:"stretch", margin:"4px 0" }} />

            <button onClick={() => { setShowSigModal(true); loadSigFonts(); }}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:5, padding:"10px 14px", borderRadius:10, cursor:"pointer", minWidth:72,
                border:"1px solid #e5e7eb", background:"#ffffff", transition:"all 0.15s" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.6"><path d="M3 17c3-3 5-5 8-2s5 3 8-2"/><path d="M3 17l2-7 3 4 3-8 3 8 3-5 2 1"/></svg>
              <span style={{ fontSize:11, color:"#374151", fontWeight:500, whiteSpace:"nowrap", lineHeight:1.2 }}>Signature</span>
            </button>

            <button onClick={() => { setShowCertModal(true); loadCerts(); }}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:5, padding:"10px 14px", borderRadius:10, cursor:"pointer", minWidth:72,
                border:"1px solid #e5e7eb", background:"#ffffff", transition:"all 0.15s" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.6"><circle cx="12" cy="8" r="5"/><path d="M9 21l3-3 3 3"/><path d="M9 13.5V21"/><path d="M15 13.5V21"/></svg>
              <span style={{ fontSize:11, color:"#374151", fontWeight:500, whiteSpace:"nowrap", lineHeight:1.2 }}>Certificates</span>
            </button>

          </div>

        </div>

          {showSigModal && (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ background:"#fff", borderRadius:12, padding:24, width:380, boxShadow:"0 20px 60px rgba(0,0,0,0.3)", maxHeight:"80vh", overflowY:"auto" }}>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Signature settings</div>
                <div style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:14, marginBottom:12, background: sigMode==="font" ? "#eff6ff" : "#fafafa", cursor:"pointer" }} onClick={() => setSigMode("font")}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <input type="radio" readOnly checked={sigMode==="font"} />
                    <span style={{ fontWeight:600, fontSize:13 }}>Font signature</span>
                  </div>
                  <div style={{ maxHeight:180, overflowY:"auto", border:"1px solid #e5e7eb", borderRadius:6, marginBottom:6 }}>
                    {fontList.map(f => (
                      <label key={f.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 10px", cursor:"pointer", borderBottom:"1px solid #f3f4f6", background: sigFont===f.id && sigMode==="font" ? "#dbeafe" : "white" }}>
                        <input type="radio" name="sigFont" readOnly checked={sigFont===f.id && sigMode==="font"} onChange={() => { setSigFont(f.id); setSigMode("font"); }} />
                        <span style={{ fontFamily:`'${f.id}', cursive`, fontSize:21, flex:1, lineHeight:1.3, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>Guillermo Silvero</span>
                        <span style={{ fontSize:9, color:"#9ca3af", whiteSpace:"nowrap" }}>{f.label}{!f.builtin ? " ✦" : ""}</span>
                      </label>
                    ))}
                  </div>
                  <label style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 10px", borderRadius:6, border:"1px dashed #d1d5db", cursor:"pointer" }}>
                    <span style={{ fontSize:11, color:"#6b7280" }}>➕ Upload font (.ttf / .otf)</span>
                    <input type="file" accept=".ttf,.otf" style={{ display:"none" }} onChange={e => e.target.files?.[0] && uploadFont(e.target.files[0])} />
                  </label>
                </div>
                <div style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:14, marginBottom:16, background: sigMode==="image" ? "#eff6ff" : "#fafafa" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, cursor:"pointer" }} onClick={() => setSigMode("image")}>
                    <input type="radio" readOnly checked={sigMode==="image"} />
                    <span style={{ fontWeight:600, fontSize:13 }}>Upload image signature</span>
                  </div>
                  {sigPreview && <img src={sigPreview} alt="sig" style={{ width:"100%", marginBottom:10, border:"1px solid #e5e7eb", borderRadius:6, maxHeight:80, objectFit:"contain" }} />}
                  <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadSignature(e.target.files[0])} style={{ width:"100%", fontSize:12 }} />
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => setShowSigModal(false)} style={{ flex:1, padding:"8px 0", borderRadius:8, border:"1px solid #e5e7eb", background:"#f9fafb", cursor:"pointer", fontSize:13 }}>Cancel</button>
                  <button onClick={() => saveSigMode(sigMode, sigFont)} style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", background:"#1d4ed8", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>Save</button>
                </div>
              </div>
            </div>
          )}

          {showAIModal && (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ background:"#fff", borderRadius:12, padding:24, width:520,
                boxShadow:"0 20px 60px rgba(0,0,0,0.4)", maxHeight:"85vh", overflowY:"auto" }}>
                <div style={{ fontSize:16, fontWeight:700, marginBottom:4, color:"#1B1C21" }}>
                  🧠 AI Inconsistency Detector
                </div>
                <div style={{ fontSize:11, color:"#6b7280", marginBottom:16 }}>
                  Local AI (llava:13b) analyzes screenshots for activities inconsistent with claimed injuries.
                  All processing stays on the server — no data sent externally.
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#7798C1", letterSpacing:1,
                    textTransform:"uppercase", marginBottom:6 }}>Case Type</div>
                  <select value={aiCaseType} onChange={e => setAiCaseType(e.target.value)}
                    style={{ width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid #e5e7eb",
                      fontSize:13, outline:"none" }}>
                    <option value="workers_comp">Workers&apos; Compensation</option>
                    <option value="personal_injury">Personal Injury</option>
                    <option value="disability">Disability Claim</option>
                    <option value="general">General Investigation</option>
                  </select>
                </div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#7798C1", letterSpacing:1,
                    textTransform:"uppercase", marginBottom:6 }}>Claimed Injury / Disability</div>
                  <textarea value={aiInjury} onChange={e => setAiInjury(e.target.value)} rows={3}
                    placeholder="e.g. Cannot lift more than 5 lbs, severe lower back injury, unable to walk more than 100 feet without pain..."
                    style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #e5e7eb",
                      fontSize:12, outline:"none", resize:"none", lineHeight:1.6, boxSizing:"border-box" }} />
                </div>
                <button onClick={runAIAnalysis} disabled={aiRunning}
                  style={{ width:"100%", padding:"12px", borderRadius:8, border:"none",
                    background: aiRunning ? "#a78bfa" : "#7c3aed", color:"white",
                    fontSize:13, fontWeight:600, cursor: aiRunning ? "not-allowed" : "pointer",
                    marginBottom:16 }}>
                  {aiRunning ? "⏳ Analyzing captures with llava:13b..." : "🔍 Analyze All Captures"}
                </button>
                {aiSummary && (
                  <div style={{ marginBottom:16, padding:"12px 14px", borderRadius:8,
                    background: aiSummary.critical > 0 ? "#fef2f2" : "#f0fdf4",
                    border: `1px solid ${aiSummary.critical > 0 ? "#fca5a5" : "#86efac"}` }}>
                    <span style={{ fontWeight:700, color: aiSummary.critical > 0 ? "#dc2626" : "#16a34a" }}>
                      {aiSummary.critical > 0 ? `⚠️ ${aiSummary.critical} significant finding(s)` : "✅ No significant inconsistencies"}
                    </span>
                    <span style={{ fontSize:11, color:"#6b7280", marginLeft:8 }}>
                      from {aiSummary.total} captures analyzed
                    </span>
                  </div>
                )}
                {aiResults.map((r: any, i: number) => r.inconsistency_level !== "NONE" && (
                  <div key={i} style={{ marginBottom:10, padding:"12px 14px", borderRadius:8,
                    border:"1px solid #e5e7eb", background:"#fafafa" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <span style={{ fontSize:11, fontWeight:700,
                        color: ["CRITICAL","SIGNIFICANT","HIGH"].includes(r.inconsistency_level) ? "#dc2626" :
                               ["MODERATE","MEDIUM"].includes(r.inconsistency_level) ? "#d97706" : "#6b7280" }}>
                        {r.inconsistency_level} — {r.platform || "Web"}
                      </span>
                      <span style={{ fontSize:10, color:"#9ca3af" }}>{r.captured_at?.slice(0,10)}</span>
                    </div>
                    <div style={{ fontSize:12, color:"#374151", marginBottom:4 }}>{r.summary}</div>
                    {r.findings?.slice(0,3).map((f: string, j: number) => (
                      <div key={j} style={{ fontSize:11, color:"#6b7280", paddingLeft:12,
                        borderLeft:"2px solid #e5e7eb", marginBottom:2 }}>• {f}</div>
                    ))}
                    {r.relevant_text && (
                      <div style={{ fontSize:11, fontStyle:"italic", color:"#7c3aed", marginTop:4 }}>
                        Visible text: "{r.relevant_text.slice(0,100)}"
                      </div>
                    )}
                    {r.url && <div style={{ fontSize:10, color:"#3b82f6", marginTop:4,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.url}</div>}
                  </div>
                ))}
                <button onClick={() => { setShowAIModal(false); setAiResults([]); setAiSummary(null); }}
                  style={{ width:"100%", padding:"8px 0", borderRadius:8, border:"1px solid #e5e7eb",
                    background:"#f9fafb", cursor:"pointer", fontSize:13 }}>Close</button>
              </div>
            </div>
          )}

          {showCertModal && (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ background:"#fff", borderRadius:12, padding:24, width:420, boxShadow:"0 20px 60px rgba(0,0,0,0.3)", maxHeight:"80vh", overflowY:"auto" }}>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Report appendix — certificates</div>
                <div style={{ fontSize:11, color:"#6b7280", marginBottom:16 }}>These PDFs are automatically appended to every generated report.</div>
                {certList.length === 0
                  ? <div style={{ fontSize:12, color:"#9ca3af", marginBottom:16, textAlign:"center", padding:"20px 0" }}>No certificates yet.</div>
                  : certList.map(cert => (
                    <div key={cert.filename} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, border:"1px solid #e5e7eb", marginBottom:8, background:"#f9fafb" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"#1B1C21" }}>{cert.label}</div>
                        <div style={{ fontSize:10, color:"#9ca3af" }}>{(cert.size/1024).toFixed(0)} KB</div>
                      </div>
                      <button onClick={() => deleteCert(cert.filename)} style={{ padding:"3px 10px", borderRadius:6, border:"1px solid #fca5a5", background:"#fff5f5", color:"#dc2626", fontSize:11, cursor:"pointer" }}>Remove</button>
                    </div>
                  ))
                }
                <label style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8, border:"2px dashed #d1d5db", cursor:"pointer", marginBottom:16, justifyContent:"center" }}>
                  <span style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>➕ Upload PDF certificate</span>
                  <input type="file" accept=".pdf" style={{ display:"none" }} onChange={e => e.target.files?.[0] && uploadCert(e.target.files[0])} />
                </label>
                <button onClick={() => setShowCertModal(false)} style={{ width:"100%", padding:"8px 0", borderRadius:8, border:"1px solid #e5e7eb", background:"#f9fafb", cursor:"pointer", fontSize:13 }}>Close</button>
              </div>
            </div>
          )}

        {/* Export result */}
        {exportResult && (
          <div style={{margin:"12px 16px",padding:"14px",borderRadius:10,
            background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.3)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <p style={{fontSize:13,fontWeight:700,color:"#7c3aed",margin:0}}>✅ Export ready</p>
              {exportResult.reused && (
                <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:12,
                  background:"rgba(5,150,105,0.12)",color:"#059669",border:"1px solid #6ee7b7"}}>
                  ♻ reused — no new captures
                </span>
              )}
            </div>
            <p style={{fontSize:11,color:"#6b7280",margin:"0 0 4px",fontFamily:"monospace"}}>{exportResult.name}</p>
            <p style={{fontSize:10,color:"#9ca3af",margin:"0 0 10px"}}>SHA256: {exportResult.hash}</p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap" as any}}>
              <a href={exportResult.url} target="_blank" rel="noreferrer"
                style={{padding:"8px 16px",borderRadius:7,fontSize:12,fontWeight:700,
                  background:"#7c3aed",color:"white",textDecoration:"none"}}>⬇ Download ZIP</a>
              <button onClick={()=>navigator.clipboard.writeText(exportResult!.url)}
                style={{padding:"8px 16px",borderRadius:7,fontSize:12,fontWeight:600,
                  background:"transparent",color:"#7c3aed",
                  border:"1px solid #7c3aed",cursor:"pointer"}}>📋 Copy link for client</button>
              <button onClick={()=>{setEmailTo("");setEmailMsg("");setEmailSent(false);setEmailModal(true);}}
                style={{padding:"8px 16px",borderRadius:7,fontSize:12,fontWeight:600,
                  background:"transparent",color:"#059669",
                  border:"1px solid #059669",cursor:"pointer"}}>📧 Send by email</button>
            </div>
            <p style={{fontSize:10,color:"#9ca3af",marginTop:8}}>Link expires in 30 days</p>
          </div>
        )}

        {/* Export history */}
        {exportHistory.length > 0 && (
          <div style={{margin:"4px 16px 8px"}}>
            <button onClick={()=>setShowHistory(h=>!h)}
              style={{fontSize:11,color:sec,background:"transparent",border:"none",
                cursor:"pointer",padding:"4px 0",textDecoration:"underline"}}>
              {showHistory ? "▲ Hide" : "▼ Show"} export history ({exportHistory.length})
            </button>
            {showHistory && (
              <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:4}}>
                {exportHistory.map(ex => (
                  <div key={ex.id} style={{padding:"8px 10px",borderRadius:7,
                    background:gl?"rgba(255,255,255,0.05)":"#f8fafc",
                    border:`1px solid ${bdr}`,fontSize:11}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                      <span style={{color:txt,fontWeight:600,fontFamily:"monospace",fontSize:10,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
                        {ex.zip_name}
                      </span>
                      <a href={ex.download_url} target="_blank" rel="noreferrer"
                        style={{fontSize:10,color:acc,textDecoration:"none",flexShrink:0}}>⬇</a>
                    </div>
                    <div style={{color:sec,fontSize:10,marginTop:2}}>
                      {ex.captures} captures · {ex.exported_by} · {new Date(ex.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {view === "captures" && (
            captures.length === 0
              ? <div style={{ textAlign: "center", color: sec, padding: 20, fontSize: 12 }}>
                  No captures yet.<br/>Use the Firefox extension to capture pages.
                </div>
              : captures.map(c => (
                <div key={c.id}
                  onClick={() => setSelected(c)}
                  style={{ ...card, cursor: "pointer", padding: 0, overflow: "hidden",
                    background: selected?.id === c.id ? (gl ? "rgba(100,150,255,0.15)" : "#eff6ff") : bg2,
                    borderColor: selected?.id === c.id ? acc+"44" : bdr }}>
                  {/* Thumbnail */}
                  <div style={{ position: "relative", width: "100%", height: 100,
                    background: gl ? "rgba(0,0,0,0.4)" : "#e5e7eb", overflow: "hidden",
                    flexShrink: 0 }}>
                    {c.has_screenshot ? (
                      <img
                        src={`${BASE}/api/forensic/captures/${c.id}/screenshot`}
                        alt=""
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover",
                          objectPosition: "top" }}
                        onError={e => { (e.target as HTMLImageElement).style.display="none"; }}
                      />
                    ) : (
                      <div style={{ width:"100%", height:"100%", display:"flex",
                        alignItems:"center", justifyContent:"center", fontSize: 28 }}>
                        {c.media_type === "video" ? "🎬" : c.media_type === "expanded" ? "📜" : c.media_type === "recording" ? "🎞️" : "📷"}
                      </div>
                    )}
                    {/* Media type badge */}
                    <div style={{ position:"absolute", top: 4, left: 4, padding:"1px 6px",
                      borderRadius: 4, fontSize: 9, fontWeight: 700,
                      background: c.media_type === "video" ? "rgba(220,50,50,0.85)" :
                                  c.media_type === "expanded" ? "rgba(20,160,80,0.85)" :
                                  c.media_type === "recording" ? "rgba(120,50,200,0.85)" : "rgba(30,70,150,0.75)",
                      color: "white" }}>
                      {c.media_type === "video" ? "VIDEO" :
                       c.media_type === "expanded" ? "THREAD" :
                       c.media_type === "recording" ? "RECORD" : "CAPTURE"}
                    </div>
                    {c.is_relevant && (
                      <div style={{ position:"absolute", top: 4, right: 4, fontSize: 12 }}>⭐</div>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ padding: "6px 8px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: txt,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginBottom: 2 }}>
                      {c.page_title || c.url}
                    </div>
                    <div style={{ fontSize: 9.5, color: sec }}>
                      {c.collector_name} · {timeAgo(c.captured_at)}
                    </div>
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 8.5, color: sec,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    opacity: 0.7 }}>
                    {c.url_hash.substring(0, 24)}…
                  </div>
                </div>
              ))
          )}

          {view === "monitors" && (
            monitors.length === 0
              ? <div style={{ textAlign: "center", color: sec, padding: 20, fontSize: 12 }}>
                  No monitors. Use the extension to add pages to monitor.
                </div>
              : monitors.map(m => (
                <div key={m.id} style={card}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>🔔</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: txt,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.page_title || m.url}
                      </div>
                      <div style={{ fontSize: 9.5, color: sec, marginTop: 2 }}>
                        {m.change_count > 0
                          ? <span style={{ color: "rgba(255,180,80,0.9)", fontWeight: 700 }}>
                              ⚠ Changed {m.change_count}x
                            </span>
                          : "No changes detected"
                        }
                        {m.last_checked_at && ` · Checked ${timeAgo(m.last_checked_at)}`}
                      </div>
                    </div>
                    <button onClick={() => removeMonitor(m.id)}
                      style={{ background: "none", border: "none", cursor: "pointer",
                        color: sec, fontSize: 13 }}>×</button>
                  </div>
                </div>
              ))
          )}

          {view === "automation" && (
            <div style={{ display:"flex", flexDirection:"column", gap:6, flex:1 }}>
              {/* Add URL form */}
              <div style={{ background:bg2, border:`1px solid ${bdr}`, borderRadius:10, padding:"10px 12px" }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
                  letterSpacing:"0.07em", color:sec, marginBottom:6 }}>Add URL to queue</div>
                <div style={{ display:"flex", gap:6 }}>
                  <input value={newUrl} onChange={e=>setNewUrl(e.target.value)}
                    placeholder="https://facebook.com/..."
                    style={{ flex:2, padding:"5px 8px", borderRadius:7, background:gl?"rgba(255,255,255,0.07)":"white",
                      border:`1px solid ${bdr}`, color:txt, fontSize:11.5, outline:"none" }} />
                  <input value={newLabel} onChange={e=>setNewLabel(e.target.value)}
                    placeholder="Label (optional)"
                    style={{ flex:1, padding:"5px 8px", borderRadius:7, background:gl?"rgba(255,255,255,0.07)":"white",
                      border:`1px solid ${bdr}`, color:txt, fontSize:11.5, outline:"none" }} />
                  <button disabled={addingUrl||!newUrl.trim()} onClick={async()=>{
                    if(!newUrl.trim())return;
                    setAddingUrl(true);
                    await fetch(`${BASE}/api/forensic/queue`,{
                      method:"POST",credentials:"include",
                      headers:{"Content-Type":"application/json"},
                      body:JSON.stringify({investigation_id:invId,url:newUrl.trim(),label:newLabel.trim()||undefined})
                    });
                    setNewUrl("");setNewLabel("");
                    setAddingUrl(false);
                    load();
                  }}
                    style={{ padding:"5px 12px", borderRadius:7, cursor:"pointer",
                      background:acc, border:"none", color:"white", fontSize:11, fontWeight:600 }}>
                    {addingUrl?"...": "+ Add"}
                  </button>
                </div>
                <div style={{ fontSize:9.5, color:sec, marginTop:4 }}>
                  The extension will capture these URLs automatically when connected to this case.
                </div>
              </div>

              {/* Queue list */}
              <div style={{ flex:1, overflowY:"auto" }}>
                {queue.length===0 ? (
                  <div style={{ textAlign:"center", color:sec, padding:20, fontSize:12 }}>
                    No URLs queued. Add URLs above and the extension will capture them automatically.
                  </div>
                ) : queue.map((item:any) => {
                  const statusColor = item.status==="done"?"rgba(80,220,150,0.9)":
                    item.status==="failed"?"rgba(255,120,100,0.9)":
                    item.status==="processing"?"rgba(255,200,80,0.9)":sec;
                  return (
                    <div key={item.id} style={{ background:bg2, border:`1px solid ${bdr}`,
                      borderRadius:9, padding:"7px 10px", marginBottom:4,
                      display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:13 }}>
                        {item.status==="done"?"✓":item.status==="failed"?"✗":
                         item.status==="processing"?"⏳":"⏸"}
                      </span>
                      <div style={{ flex:1, minWidth:0 }}>
                        {item.label && <div style={{ fontSize:10.5, fontWeight:600, color:txt }}>{item.label}</div>}
                        <div style={{ fontSize:9.5, color:sec, overflow:"hidden",
                          textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.url}</div>
                      </div>
                      <span style={{ fontSize:9, fontWeight:700, color:statusColor,
                        padding:"2px 6px", borderRadius:20,
                        background:statusColor.replace("0.9","0.12"),
                        border:`1px solid ${statusColor.replace("0.9","0.25")}` }}>
                        {item.status}
                      </span>
                      <button onClick={async()=>{
                        await fetch(`${BASE}/api/forensic/queue/${item.id}`,{method:"DELETE",credentials:"include"});
                        load();
                      }} style={{ background:"none",border:"none",cursor:"pointer",color:sec,fontSize:13 }}>×</button>
                    </div>
                  );
                })}
              </div>

              {/* Clear done/failed */}
              {queue.some((q:any)=>q.status==="done"||q.status==="failed") && (
                <button onClick={async()=>{
                  await fetch(`${BASE}/api/forensic/queue/clear`,{
                    method:"POST",credentials:"include",
                    headers:{"Content-Type":"application/json"},
                    body:JSON.stringify({investigation_id:invId})
                  });
                  load();
                }}
                  style={{ padding:"5px 0", borderRadius:8, cursor:"pointer",
                    background:"transparent", border:`1px solid ${bdr}`,
                    color:sec, fontSize:11 }}>
                  Clear completed / failed
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: detail viewer */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {selected ? (
          <>
            {/* Header */}
            <div style={{ ...card, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 2 }}>
                    {selected.page_title || "Untitled page"}
                  </div>
                  <div style={{ fontSize: 10.5, color: sec, wordBreak: "break-all" }}>
                    {selected.url}
                  </div>
                </div>
                <button onClick={() => deleteCapture(selected.id)}
                  style={{ padding: "3px 8px", borderRadius: 6, cursor: "pointer",
                    background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.2)",
                    color: "rgba(255,130,120,0.9)", fontSize: 10 }}>
                  Remove
                </button>
              </div>

              {/* Chain of custody */}
              <div style={{ background: gl ? "rgba(40,200,130,0.08)" : "#f0fdf4",
                border: `1px solid ${gl ? "rgba(40,200,130,0.18)" : "#bbf7d0"}`,
                borderRadius: 8, padding: "6px 10px", marginBottom: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: gl ? "rgba(80,220,160,0.9)" : "#166534",
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                  🔐 Chain of custody
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 9, color: gl ? "rgba(120,210,170,0.75)" : "#374151", lineHeight: 1.6 }}>
                  <div>SHA-256 URL: {selected.url_hash}</div>
                  {selected.content_hash && <div>SHA-256 Content: {selected.content_hash}</div>}
                  <div>Captured: {new Date(selected.captured_at).toLocaleString()} by {selected.collector_name}</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {selected.has_screenshot && (
                  <a href={`${BASE}/api/forensic/captures/${selected.id}/screenshot`} target="_blank" rel="noreferrer"
                    style={{ padding: "3px 9px", borderRadius: 7, textDecoration: "none",
                      background: gl ? "rgba(100,150,255,0.15)" : "#eff6ff",
                      border: `1px solid ${gl ? "rgba(100,150,255,0.25)" : "#bfdbfe"}`,
                      color: gl ? "rgba(160,200,255,0.9)" : "#1e40af", fontSize: 10, fontWeight: 600 }}>
                    {selected.media_type === "expanded" ? "📷 Viewport" : "📷 Screenshot"}
                  </a>
                )}
                {selected.has_html && selected.media_type !== "recording" && (
                  <a href={`${BASE}/api/forensic/captures/${selected.id}/html`} target="_blank" rel="noreferrer"
                    style={{ padding: "3px 9px", borderRadius: 7, textDecoration: "none",
                      background: gl ? "rgba(100,200,100,0.15)" : "#f0fdf4",
                      border: `1px solid ${gl ? "rgba(100,200,100,0.25)" : "#bbf7d0"}`,
                      color: gl ? "rgba(100,220,100,0.9)" : "#15803d", fontSize: 10, fontWeight: 600 }}>
                    🌐 View HTML
                  </a>
                )}
                {selected.media_type === "recording" && (
                  <a href={`${BASE}/api/forensic/captures/${selected.id}/download-zip`}
                    download={`prodigy_capture_${selected.id}.zip`}
                    style={{ padding: "3px 9px", borderRadius: 7, textDecoration: "none",
                      background: gl ? "rgba(120,50,200,0.15)" : "#faf5ff",
                      border: `1px solid ${gl ? "rgba(120,50,200,0.3)" : "#e9d5ff"}`,
                      color: gl ? "rgba(180,140,255,0.9)" : "#7c3aed", fontSize: 10, fontWeight: 600 }}>
                    📦 Download ZIP
                  </a>
                )}
                {selected.has_html && (
                  <button onClick={() => { setShowAIModal(true); }}
                    style={{ padding: "3px 9px", borderRadius: 7, cursor: "pointer",
                      background: gl ? "rgba(124,58,237,0.15)" : "#f5f3ff",
                      border: `1px solid ${gl ? "rgba(124,58,237,0.3)" : "#ddd6fe"}`,
                      color: gl ? "rgba(180,140,255,0.9)" : "#6d28d9", fontSize: 10, fontWeight: 600 }}>
                    🧠 AI Analyze
                  </button>
                )}
                {selected.has_video && (
                  <a href={`${BASE}/api/forensic/captures/${selected.id}/video`} target="_blank" rel="noreferrer"
                    style={{ padding: "3px 9px", borderRadius: 7, textDecoration: "none",
                      background: gl ? "rgba(255,100,100,0.15)" : "#fff1f0",
                      border: `1px solid ${gl ? "rgba(255,100,100,0.25)" : "#ffa39e"}`,
                      color: gl ? "rgba(255,160,160,0.9)" : "#cf1322", fontSize: 10, fontWeight: 600 }}>
                    🎬 Video {selected.video_duration ? `(${Math.round(selected.video_duration)}s)` : ""}
                  </a>
                )}
                {selected.has_html && selected.media_type !== "recording" && (
                  <a href={`${BASE}/api/forensic/captures/${selected.id}/html`} target="_blank" rel="noreferrer"
                    style={{ padding: "3px 9px", borderRadius: 7, textDecoration: "none",
                      background: gl ? "rgba(100,150,255,0.15)" : "#eff6ff",
                      border: `1px solid ${gl ? "rgba(100,150,255,0.25)" : "#bfdbfe"}`,
                      color: gl ? "rgba(160,200,255,0.9)" : "#1e40af", fontSize: 10, fontWeight: 600 }}>
                    📄 Archived HTML
                  </a>
                )}
                <button onClick={() => setRelevant(selected.id, selected.is_relevant === true ? null : true)}
                  style={{ padding: "3px 9px", borderRadius: 7, cursor: "pointer",
                    background: selected.is_relevant ? "rgba(255,200,50,0.2)" : "transparent",
                    border: `1px solid ${selected.is_relevant ? "rgba(255,200,50,0.35)" : bdr}`,
                    color: selected.is_relevant ? "rgba(255,220,100,0.95)" : sec, fontSize: 10, fontWeight: 600 }}>
                  {selected.is_relevant ? "⭐ Relevant" : "☆ Mark relevant"}
                </button>
              </div>
            </div>

            {/* Video player or screenshot preview */}
            {selected.has_video ? (
              <div style={{ flex: 1, border: `1px solid ${bdr}`, borderRadius: 10, overflow: "hidden",
                background: "#000" }}>
                <video controls style={{ width: "100%", maxHeight: 340, display: "block" }}
                  src={`${BASE}/api/forensic/captures/${selected.id}/video`}>
                  Your browser does not support the video tag.
                </video>
                {selected.has_screenshot && (
                  <div style={{ padding: "6px 10px", borderTop: `1px solid ${bdr}` }}>
                    <img src={`${BASE}/api/forensic/captures/${selected.id}/screenshot`}
                      alt="Thumbnail" style={{ height: 60, borderRadius: 4, objectFit: "cover" }} />
                    <span style={{ fontSize: 10, color: "var(--text-secondary)", marginLeft: 8 }}>Thumbnail</span>
                  </div>
                )}
              </div>
            ) : selected.has_screenshot ? (
              <div style={{ flex: 1, border: `1px solid ${bdr}`, borderRadius: 10,
                overflow: (selected.media_type === "expanded" || selected.media_type === "recording") ? "auto" : "hidden",
                background: gl ? "rgba(10,15,40,0.5)" : "#f8fafc",
                maxHeight: (selected.media_type === "expanded" || selected.media_type === "recording") ? 480 : undefined,
                cursor: selected.media_type === "expanded" ? "ns-resize" : "default" }}>
                <img src={`${BASE}/api/forensic/captures/${selected.id}/screenshot`}
                  alt="Screenshot"
                  style={{ width: "100%", height: selected.media_type === "expanded" ? "auto" : "100%",
                    objectFit: (selected.media_type === "expanded" || selected.media_type === "recording") ? "fill" : "contain",
                    display: "block" }} />
              </div>
            ) : null}

            {/* Page text panel for expanded captures */}
            {selected.has_page_text && selected.page_text && (
              <div style={{ border:`1px solid ${bdr}`, borderRadius:10,
                overflow:"hidden", marginTop:8 }}>
                <div style={{ padding:"8px 14px", borderBottom:`1px solid ${bdr}`,
                  background: gl ? "rgba(100,200,100,0.08)" : "#f0fdf4",
                  display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:11, fontWeight:700,
                    color: gl ? "rgba(100,220,100,0.9)" : "#15803d" }}>
                    📜 Thread text — {selected.page_text.length.toLocaleString()} chars
                  </span>
                  <button onClick={() => {
                    const blob = new Blob([selected.page_text || ""], {type:"text/plain"});
                    const url2 = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url2; a.download = `thread_${selected.id}.txt`; a.click();
                    URL.revokeObjectURL(url2);
                  }} style={{ fontSize:10, padding:"2px 8px", borderRadius:4,
                    border:`1px solid ${bdr}`, background:"transparent",
                    color: gl ? "rgba(100,220,100,0.9)" : "#15803d", cursor:"pointer" }}>
                    ⬇ Download .txt
                  </button>
                </div>
                <div style={{ padding:"12px 14px", maxHeight:280, overflowY:"auto",
                  fontSize:12, lineHeight:1.7, whiteSpace:"pre-wrap",
                  color: gl ? "rgba(200,220,200,0.9)" : "#1B1C21",
                  background: gl ? "rgba(0,0,0,0.15)" : "#fafff8" }}>
                  {selected.page_text}
                </div>
              </div>
            )}

            {/* Notes */}
            <div style={{ marginTop: 8 }}>
              <textarea
                value={editNotes[selected.id] ?? selected.notes ?? ""}
                onChange={e => setEditNotes(p => ({ ...p, [selected.id]: e.target.value }))}
                onBlur={() => saveNotes(selected.id, editNotes[selected.id] ?? selected.notes ?? "")}
                placeholder="Notes on this capture..."
                rows={2}
                style={{ width: "100%", padding: "6px 9px", borderRadius: 8,
                  background: gl ? "rgba(255,255,255,0.07)" : "white",
                  border: `1px solid ${bdr}`, color: txt, fontSize: 11.5,
                  resize: "none", outline: "none", fontFamily: "inherit" }}
              />
            </div>

            {/* Selector matches */}
            {selected.selector_matches?.length > 0 && (
              <div style={{ ...card, marginTop: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.07em", color: "rgba(255,180,80,0.9)", marginBottom: 6 }}>
                  ⚠ Keyword matches
                </div>
                {selected.selector_matches.map((m: any, i: number) => (
                  <div key={i} style={{ fontSize: 11, color: txt, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: acc }}>"{m.keyword}"</span>
                    {" "}×{m.count} — <span style={{ color: sec, fontStyle: "italic" }}>{m.context?.substring(0,100)}…</span>
                  </div>
                ))}
              </div>
            )}

            {/* Images extracted from page */}
            {selected.images_extracted?.length > 0 && (
              <div style={{ background:bg2, border:'1px solid '+bdr, borderRadius:10, padding:'10px 12px', marginTop:6 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'0.07em', color:sec, marginBottom:8 }}>
                  🖼 Images extracted ({selected.images_extracted.length})
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:8 }}>
                  {selected.images_extracted.filter((img: any) => (img.src||img.minio_key) && img.width > 40 && img.height > 40).map((img: any, i: number) => {
                    // Use MinIO-stored image if available (preserved), else external URL
                    const imgSrc = img.minio_key
                      ? `${BASE}/api/forensic/image/${img.minio_key}`
                      : img.src;
                    return (
                    <div key={i} onClick={() => setLightboxSrc(imgSrc)}
                      title={img.alt || 'Click to enlarge'}
                      style={{ display:'block', aspectRatio:'1', borderRadius:7, overflow:'hidden',
                        border:'1px solid '+bdr, background:bg1, cursor:'zoom-in',
                        transition:'transform 0.15s', position:'relative' }}
                      onMouseOver={e => (e.currentTarget.style.transform='scale(1.03)')}
                      onMouseOut={e => (e.currentTarget.style.transform='scale(1)')}>
                      <img
                        src={imgSrc}
                        alt={img.alt || ''}
                        loading='lazy'
                        onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display='none'; }}
                        style={{ width:'100%', height:'100%', objectFit:'cover' }}
                      />
                    </div>
                  );
                  })}
                </div>
                <div style={{ fontSize:10, color:sec, marginTop:6 }}>
                  Click any image to open full size · Images load from original source
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            color: sec, fontSize: 13, textAlign: "center", border: `1px dashed ${bdr}`,
            borderRadius: 12 }}>
            ← Select a capture to view details
          </div>
        )}
      </div>
    </div>

    {/* ── Email modal ── */}
    {emailModal && exportResult && (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",
        zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}
        onClick={()=>setEmailModal(false)}>
        <div style={{background:"#ffffff",borderRadius:14,padding:"28px 32px",
          width:460,maxWidth:"94vw",boxShadow:"0 24px 60px rgba(0,0,0,0.25)"}}
          onClick={e=>e.stopPropagation()}>
          <h3 style={{margin:"0 0 6px",fontSize:17,color:"#1e293b",fontWeight:700}}>
            📧 Send forensic package
          </h3>
          <p style={{margin:"0 0 20px",fontSize:12,color:"#64748b"}}>
            The recipient will get an email with the secure Wasabi download link (expires 30 days).
          </p>

          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:4}}>
            To (email)
          </label>
          <input
            type="email"
            value={emailTo}
            onChange={e=>setEmailTo(e.target.value)}
            placeholder="attorney@lawfirm.com"
            style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",
              border:"1px solid #d1d5db",borderRadius:7,fontSize:13,
              marginBottom:14,outline:"none"}}
          />

          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:4}}>
            Optional note (shown in email)
          </label>
          <textarea
            value={emailMsg}
            onChange={e=>setEmailMsg(e.target.value)}
            placeholder="e.g. Please find attached the forensic evidence package for claim #…"
            rows={3}
            style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",
              border:"1px solid #d1d5db",borderRadius:7,fontSize:13,
              marginBottom:20,resize:"vertical",outline:"none"}}
          />

          {emailSent && (
            <div style={{padding:"10px 14px",background:"#ecfdf5",border:"1px solid #6ee7b7",
              borderRadius:7,marginBottom:14,fontSize:13,color:"#065f46",fontWeight:600}}>
              ✅ Email sent to {emailTo}
            </div>
          )}

          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={()=>setEmailModal(false)}
              style={{padding:"9px 20px",borderRadius:7,fontSize:13,fontWeight:600,
                background:"transparent",color:"#6b7280",border:"1px solid #d1d5db",cursor:"pointer"}}>
              {emailSent ? "Close" : "Cancel"}
            </button>
            {!emailSent && (
              <button
                disabled={emailSending || !emailTo.includes("@")}
                onClick={async()=>{
                  setEmailSending(true);
                  try {
                    const r = await fetch(`${BASE}/api/forensic/send-zip-email`, {
                      method:"POST", credentials:"include",
                      headers:{"Content-Type":"application/json"},
                      body: JSON.stringify({
                        investigation_id: invId,
                        to_email: emailTo,
                        download_url: exportResult!.url,
                        zip_name: exportResult!.name,
                        message: emailMsg,
                      })
                    });
                    const d = await r.json();
                    if (d.ok) { setEmailSent(true); }
                    else { alert("Error: " + (d.error || "unknown")); }
                  } catch(e:any){ alert("Error: "+e.message); }
                  finally{ setEmailSending(false); }
                }}
                style={{padding:"9px 20px",borderRadius:7,fontSize:13,fontWeight:700,
                  background: emailSending ? "#9ca3af" : "linear-gradient(135deg,#059669,#047857)",
                  color:"white",border:"none",cursor:"pointer"}}>
                {emailSending ? "Sending…" : "Send email"}
              </button>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Lightbox */}
    {lightboxSrc && (
      <div onClick={() => setLightboxSrc(null)}
        style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:2000,
          display:"flex", alignItems:"center", justifyContent:"center", cursor:"zoom-out" }}>
        <div style={{ position:"relative", maxWidth:"90vw", maxHeight:"90vh" }}>
          <img src={lightboxSrc} alt="Evidence"
            style={{ maxWidth:"90vw", maxHeight:"90vh", borderRadius:8,
              boxShadow:"0 25px 80px rgba(0,0,0,0.8)", objectFit:"contain" }} />
          <a href={lightboxSrc} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ position:"absolute", top:8, right:8, padding:"5px 12px",
              background:"rgba(0,0,0,0.6)", color:"white", borderRadius:6,
              textDecoration:"none", fontSize:12, fontWeight:600 }}>
            ↗ Open full size
          </a>
          <div style={{ position:"absolute", top:8, left:8, padding:"5px 10px",
            background:"rgba(0,0,0,0.5)", color:"rgba(255,255,255,0.7)",
            borderRadius:6, fontSize:11 }}>
            Click anywhere to close
          </div>
        </div>
      </div>
    )}
    {/* Export source modal */}
    {showExportModal && (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:2000,
        display:"flex", alignItems:"center", justifyContent:"center" }}
        onClick={() => setShowExportModal(false)}>
        <div style={{ background:"#fff", borderRadius:12, padding:"24px 28px", minWidth:320,
          boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>📦 Export Case</div>
          <div style={{ fontSize:12, color:"#6b7280", marginBottom:20 }}>
            Choose which bucket to export from:
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button onClick={() => exportCase("staging")}
              style={{ padding:"10px 16px", borderRadius:8, border:"1px solid #e5e7eb",
                background:"#f9fafb", cursor:"pointer", fontSize:13, textAlign:"left" }}>
              <div style={{ fontWeight:600 }}>🗂️ Staging</div>
              <div style={{ fontSize:11, color:"#6b7280" }}>All relevant captures from staging bucket</div>
            </button>
            <button onClick={() => exportCase("evidence")}
              style={{ padding:"10px 16px", borderRadius:8, border:"1px solid #fbbf24",
                background:"#fffbeb", cursor:"pointer", fontSize:13, textAlign:"left" }}>
              <div style={{ fontWeight:600 }}>🔒 Evidence</div>
              <div style={{ fontSize:11, color:"#92400e" }}>Only promoted captures from secure evidence bucket</div>
            </button>
            <button onClick={() => setShowExportModal(false)}
              style={{ padding:"8px 0", borderRadius:8, border:"1px solid #e5e7eb",
                background:"#f9fafb", cursor:"pointer", fontSize:13 }}>Cancel</button>
          </div>
        </div>
      </div>
    )}

    {/* Confirm delete modal */}
    {confirmDeleteId && (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:2000,
        display:"flex", alignItems:"center", justifyContent:"center" }}
        onClick={() => setConfirmDeleteId(null)}>
        <div style={{ background:"#fff", borderRadius:12, padding:"24px 28px", minWidth:300,
          boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>Remove capture?</div>
          <div style={{ fontSize:12, color:"#6b7280", marginBottom:20 }}>
            This will delete the capture permanently.
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => setConfirmDeleteId(null)}
              style={{ flex:1, padding:"8px 0", borderRadius:8, border:"1px solid #e5e7eb",
                background:"#f9fafb", cursor:"pointer", fontSize:13 }}>Cancel</button>
            <button onClick={confirmDelete}
              style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none",
                background:"#ef4444", color:"white", cursor:"pointer", fontSize:13, fontWeight:600 }}>
              Remove
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

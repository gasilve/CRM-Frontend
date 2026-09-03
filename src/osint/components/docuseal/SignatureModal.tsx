
import { useState, useEffect } from "react";
import { FileSignature, Send, X, CheckCircle, Clock, AlertCircle, Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API = typeof window !== "undefined" ? (!["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000") : "";

interface Template { id: number; name: string; created_at: string; }
interface Submission {
  docuseal_id: number; submitter_name: string; submitter_email: string;
  status: string; created_at: string; completed_at: string | null; signing_url: string | null;
}
interface Props {
  onClose: () => void;
  caseId?: number;
  investigationId?: number;
  defaultName?: string;
  defaultEmail?: string;
}

export function SignatureModal({ onClose, caseId, investigationId, defaultName, defaultEmail }: Props) {
  const [tab, setTab]                 = useState<"send"|"history">("send");
  const [templates, setTemplates]     = useState<Template[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [message, setMessage]         = useState("");
  const [submitters, setSubmitters]   = useState([
    { name: defaultName || "", email: defaultEmail || "" }
  ]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const qs = caseId ? `?case_id=${caseId}` : investigationId ? `?investigation_id=${investigationId}` : "";
      const [t, s] = await Promise.all([
        fetch(`${API}/api/docuseal/templates`).then(r => r.json()),
        fetch(`${API}/api/docuseal/submissions${qs}`).then(r => r.json()),
      ]);
      setTemplates(t.data || []);
      setSubmissions(s.local || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const addSubmitter    = () => setSubmitters(s => [...s, { name: "", email: "" }]);
  const removeSubmitter = (i: number) => setSubmitters(s => s.filter((_, j) => j !== i));
  const updateSubmitter = (i: number, field: "name"|"email", val: string) =>
    setSubmitters(s => s.map((x, j) => j === i ? { ...x, [field]: val } : x));

  const handleSend = async () => {
    if (!selectedTemplate) { toast.error("Select a template first"); return; }
    if (submitters.some(s => !s.email.trim())) { toast.error("All signers need an email"); return; }
    setSending(true);
    try {
      const r = await fetch(`${API}/api/docuseal/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selectedTemplate, submitters,
          case_id: caseId, investigation_id: investigationId,
          message: message || undefined, send_email: true,
        }),
      });
      if (r.ok) { toast.success("Document sent for signature!"); setTab("history"); fetchData(); }
      else { const err = await r.json(); toast.error(err.detail || "Failed to send"); }
    } catch { toast.error("Send error"); }
    finally { setSending(false); }
  };

  return (
    <div style={{ minHeight: 500, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 540, margin: "0 1rem", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-slate-800">Send for signature</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex border-b">
          {(["send","history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab===t ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}>
              {t === "send" ? "Send document" : `History (${submissions.length})`}
            </button>
          ))}
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" /></div>
          ) : tab === "send" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Document template</label>
                {templates.length === 0 ? (
                  <div className="border border-dashed border-slate-200 rounded-lg p-4 text-center space-y-1">
                    <p className="text-xs text-slate-400">No templates yet.</p>
                    <a href="http://localhost:3003" target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />Upload templates in DocuSeal
                    </a>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {templates.map(t => (
                      <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${selectedTemplate===t.id ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 hover:border-slate-300 text-slate-700"}`}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-600">Signers</label>
                  <button onClick={addSubmitter} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
                    <Plus className="h-3 w-3" />Add signer
                  </button>
                </div>
                <div className="space-y-2">
                  {submitters.map((s, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input placeholder="Full name" value={s.name} onChange={e => updateSubmitter(i,"name",e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                      <input placeholder="Email" value={s.email} onChange={e => updateSubmitter(i,"email",e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                      {submitters.length > 1 && <button onClick={() => removeSubmitter(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Message (optional)</label>
                <textarea rows={2} placeholder="Please review and sign..." value={message} onChange={e => setMessage(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <Button onClick={handleSend} disabled={sending || !selectedTemplate || templates.length === 0} className="w-full gap-2">
                <Send className="h-4 w-4" />{sending ? "Sending..." : "Send for signature"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {submissions.length === 0 ? <p className="text-center text-sm text-slate-400 py-8">No documents sent yet</p>
              : submissions.map((s, i) => (
                <div key={i} className="border border-slate-100 rounded-xl p-3.5 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {s.status==="completed" ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" /> : <Clock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                      <span className="text-sm font-medium text-slate-800 truncate">{s.submitter_name||s.submitter_email}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{s.submitter_email}</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">Sent {new Date(s.created_at).toLocaleDateString()}{s.completed_at && ` · Signed ${new Date(s.completed_at).toLocaleDateString()}`}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${s.status==="completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{s.status}</span>
                    {s.signing_url && s.status!=="completed" && <a href={s.signing_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5"><ExternalLink className="h-3 w-3" />Sign</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

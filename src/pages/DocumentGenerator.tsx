import { useState } from "react";
import { FileText, Download, Loader2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

const CRM_API = import.meta.env.VITE_CRM_API_URL ?? "http://localhost:3000";

interface CaseMetadata {
  subjectName: string;
  claimNo: string;
  employer: string;
  dateOfInjury: string;
  dateAssigned: string;
  dueDate: string;
  adjuster: string;
  assignment: string;
  status: string;
  investigatorNames: string;
  licenseState: string;
  licenseNumber: string;
}

const DEFAULT_METADATA: CaseMetadata = {
  subjectName: "",
  claimNo: "",
  employer: "",
  dateOfInjury: "",
  dateAssigned: "",
  dueDate: "",
  adjuster: "",
  assignment: "Surveillance",
  status: "Closed",
  investigatorNames: "",
  licenseState: "New Jersey",
  licenseNumber: "9626",
};

export default function DocumentGenerator() {
  const [summary, setSummary] = useState("");
  const [meta, setMeta] = useState<CaseMetadata>(DEFAULT_METADATA);
  const [metaOpen, setMetaOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState("investigation-report.pdf");

  const setField = (key: keyof CaseMetadata) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMeta((prev) => ({ ...prev, [key]: e.target.value }));

  const handleGenerate = async () => {
    if (!summary.trim()) { setError("Please paste a summary before generating."); return; }
    setLoading(true);
    setError(null);
    if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }

    try {
      const body: Record<string, unknown> = { summary: summary.trim() };

      const hasCase = Object.values(meta).some((v) => v.trim() !== "" && v !== DEFAULT_METADATA.assignment && v !== DEFAULT_METADATA.status && v !== DEFAULT_METADATA.licenseState && v !== DEFAULT_METADATA.licenseNumber);

      body.metadata = {
        licenseState: meta.licenseState || "New Jersey",
        licenseNumber: meta.licenseNumber || "9626",
        ...(meta.investigatorNames && { investigatorNames: meta.investigatorNames }),
        ...(hasCase && {
          caseInfo: {
            subjectName: meta.subjectName || "Unknown Subject",
            ...(meta.claimNo && { claimNo: meta.claimNo }),
            ...(meta.employer && { employer: meta.employer }),
            ...(meta.dateOfInjury && { dateOfInjury: meta.dateOfInjury }),
            ...(meta.dateAssigned && { dateAssigned: meta.dateAssigned }),
            ...(meta.dueDate && { dueDate: meta.dueDate }),
            ...(meta.adjuster && { adjuster: meta.adjuster }),
            ...(meta.assignment && { assignment: meta.assignment }),
            ...(meta.status && { status: meta.status }),
          }
        })
      };

      const response = await fetch(`${CRM_API}/reports/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        let msg = `Server error ${response.status}`;
        try { msg = JSON.parse(text)?.message ?? msg; } catch {}
        throw new Error(msg);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename = `report-${meta.subjectName ? meta.subjectName.replace(/\s+/g, "-") : "unknown"}-${Date.now()}.pdf`;
      setPdfUrl(url);
      setPdfFilename(filename);
    } catch (e: any) {
      setError(e.message ?? "Unexpected error. Is the CRM API running?");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = pdfFilename;
    a.click();
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto p-6 gap-6">
      {/* Header */}
      <div>
        <p className="text-text-lo text-xs uppercase tracking-widest font-[Cinzel] mb-1">System</p>
        <h1 className="text-text-hi text-2xl font-semibold font-[Cinzel] tracking-wide">
          Report Generator
        </h1>
        <p className="text-text-mid text-sm mt-1">
          Paste raw surveillance notes. The AI will rewrite them in professional investigation format and generate a formatted PDF.
        </p>
      </div>

      <div className="flex gap-6 flex-col xl:flex-row xl:items-start">
        {/* Left — Input panel */}
        <div className="flex flex-col gap-4 flex-1 min-w-0">

          {/* Summary input */}
          <div className="rounded-card bg-ink-2 border border-line p-4 flex flex-col gap-3">
            <label className="text-text-hi text-sm font-medium">
              Raw Summary / Notes
            </label>
            <textarea
              className={cn(
                "w-full h-[180px] min-h-[140px] resize-y rounded-[8px] border border-line",
                "bg-ink-1 text-text-hi text-sm leading-relaxed",
                "p-3 placeholder:text-text-lo focus:outline-none focus:border-accent",
                "transition-colors duration-150"
              )}
              placeholder="Paste the investigator's email or raw notes here…

Example:
Sunday Oct 26 — surveillance at airport 8am-11am. Subject arrived flight from LA at 9:37, picked up by Cadillac limo, went to Lincoln Financial Field for Eagles game, then to Borgata casino for the weekend. No restrictions observed throughout.

Monday Oct 27 — full day at Borgata. Subject never emerged from room during surveillance hours 9am-9pm."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          {/* Case metadata (collapsible) */}
          <div className="rounded-card bg-ink-2 border border-line overflow-hidden">
            <button
              onClick={() => setMetaOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-text-mid hover:text-text-hi transition-colors"
            >
              <span className="font-medium">Case Details <span className="text-text-lo font-normal">(optional)</span></span>
              {metaOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {metaOpen && (
              <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-line">
                {([
                  ["subjectName", "Subject Name"],
                  ["claimNo", "Claim No."],
                  ["employer", "Employer"],
                  ["dateOfInjury", "Date of Injury"],
                  ["dateAssigned", "Date Assigned"],
                  ["dueDate", "Due Date"],
                  ["adjuster", "Adjuster"],
                  ["assignment", "Assignment"],
                  ["status", "Status"],
                  ["investigatorNames", "Investigator Name(s)"],
                  ["licenseState", "License State"],
                  ["licenseNumber", "License No."],
                ] as [keyof CaseMetadata, string][]).map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1 pt-3">
                    <label className="text-text-lo text-xs">{label}</label>
                    <input
                      type="text"
                      value={meta[key]}
                      onChange={setField(key)}
                      className={cn(
                        "rounded-[8px] border border-line bg-ink-1",
                        "text-text-hi text-sm px-3 py-2",
                        "focus:outline-none focus:border-accent transition-colors"
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-[8px] bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] px-4 py-3 text-neg text-sm">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className={cn(
              "flex items-center justify-center gap-2 rounded-tile px-6 py-3",
              "bg-accent text-white font-medium text-sm",
              "hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed",
              "shadow-[0_0_24px_-8px_var(--color-accent-glow)]"
            )}
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Generating…</>
            ) : (
              <><FileText size={16} /> Generate Report</>
            )}
          </button>
        </div>

        {/* Right — PDF preview */}
        <div className="flex flex-col gap-4 xl:w-[520px] shrink-0">
          <div className="rounded-card bg-ink-2 border border-line p-4 flex flex-col gap-3 xl:h-[560px]">
            <div className="flex items-center justify-between">
              <span className="text-text-mid text-sm font-medium">Preview</span>
              {pdfUrl && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 text-xs text-accent hover:opacity-80 transition-opacity"
                >
                  <Download size={13} /> Download PDF
                </button>
              )}
            </div>

            <div
              className={cn(
                "rounded-[8px] border border-line overflow-hidden bg-ink-1 flex-1 min-h-[260px]",
                !pdfUrl && "flex items-center justify-center"
              )}
            >
              {pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full"
                  title="Report Preview"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-text-lo">
                  <FileText size={36} strokeWidth={1.2} />
                  <p className="text-sm">PDF preview will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { User, Hash, Calendar, Video, Building2, FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { PanelShell } from "@/pages/case-detail-panels";
import type { CaseDetail } from "@/lib/crm-api";
import type { VideoRecord } from "./useVideoState";

const BASE = "/api-proxy";

async function downloadEvidenceReport(invId: number, subjectName: string, setLoading: (v: boolean) => void) {
  setLoading(true);
  try {
    const r = await fetch(`${BASE}/api/video-custody/investigation/${invId}/evidence-report`, {
      credentials: "include",
    });
    if (r.ok) {
      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") ?? "";
      let fname = `video_evidence_${subjectName.replace(/\s+/g,"_")}.pdf`;
      for (const part of cd.split(";")) {
        const p = part.trim();
        if (p.toLowerCase().startsWith("filename=")) { fname = p.slice(9).replace(/^"|"$/g,"").trim(); break; }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);
    } else {
      alert("Report generation failed: " + r.status);
    }
  } catch (e: any) { alert("Error: " + e.message); }
  setLoading(false);
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="surface flex flex-col items-center gap-1 rounded-[0.625rem] py-3">
      <span className="text-[1.25rem] font-bold" style={{ color }}>{value}</span>
      <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</span>
      <span className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{value}</span>
    </div>
  );
}

export function VideoCaseInfoPanel({ kase, records }: { kase: CaseDetail; records: VideoRecord[] }) {
  const [reportLoading, setReportLoading] = useState(false);
  const invId = Number(kase.id);
  const meta = (kase as any)._prodigy_meta ?? {};
  const uploaded  = records.filter(r => r.status === "uploaded").length;
  const published = records.filter(r => r.status === "published").length;
  const delivered = records.filter(r => r.status === "delivered").length;

  return (
    <PanelShell title="Case info" icon={<Video size={11} strokeWidth={1.8} />}>
      <div className="flex flex-col gap-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Uploaded"  value={uploaded}  color="var(--color-text-mid)" />
          <Stat label="Published" value={published} color="#3b82f6" />
          <Stat label="Delivered" value={delivered} color="#10b981" />
        </div>

        {/* Case fields */}
        <div className="flex flex-col gap-2.5 border-t border-[var(--color-line)] pt-3">
          <Field label="Subject"   value={kase.subjectName} />
          <Field label="Claim #"   value={meta.claim_number ?? kase.claimNumber} />
          <Field label="Client"    value={meta.client_company ?? kase.client?.company} />
          <Field label="Adjuster"  value={meta.adjuster_name ?? kase.adjusterName} />
          <Field label="Date of injury" value={meta.date_of_injury} />
        </div>

        {/* Assignments */}
        {kase.assignments?.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-[var(--color-line)] pt-3">
            <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Investigators</span>
            {kase.assignments.map(a => (
              <div key={a.id} className="flex items-center gap-2">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))" }}>
                  {a.user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <span className="text-[0.75rem] text-[var(--color-text-hi)]">{a.user.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

        {/* Evidence Report */}
        <div className="border-t border-[var(--color-line)] pt-3">
          <button type="button"
            disabled={reportLoading || records.length === 0}
            onClick={() => {
              // Use investigation_id from first record (may differ from case ID due to multi-investigation subjects)
              const actualInvId = records.length > 0 ? records[0].investigation_id : invId;
              downloadEvidenceReport(actualInvId, kase.subjectName ?? "Subject", setReportLoading);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-[0.5rem] border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] py-2 text-[0.75rem] font-semibold text-[var(--color-text-hi)] disabled:opacity-50 transition-colors hover:border-[var(--color-accent)]/70">
            {reportLoading
              ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
              : <><FileDown size={13} /> Evidence Report (PDF)</>}
          </button>
          {records.length === 0 && (
            <p className="mt-1 text-center font-mono text-[0.5rem] text-[var(--color-text-lo)]">Upload videos first</p>
          )}
        </div>
    </PanelShell>
  );
}

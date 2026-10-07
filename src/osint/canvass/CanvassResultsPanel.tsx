import { useState } from "react";
import { FileDown, Loader2, CheckCircle2, FileText, XCircle } from "lucide-react";
import { PanelShell } from "@/pages/case-detail-panels";
import { TYPE_CFG } from "./useCanvassState";
import type { Facility, useCanvassState } from "./useCanvassState";

type State = ReturnType<typeof useCanvassState>;
const BASE = "/api-proxy";

function ResultCard({ f, label, color, note }: {
  f: Facility; label: string; color: string; note?: string;
}) {
  const cfg = TYPE_CFG[f.type] ?? TYPE_CFG.other;
  return (
    <div className="surface rounded-[0.625rem] p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: cfg.dot }} />
        <div className="min-w-0 flex-1">
          <div className="text-[0.75rem] font-semibold text-[var(--color-text-hi)]">{f.name}</div>
          <div className="text-[0.625rem] text-[var(--color-text-mid)]">
            {[f.address, f.city, f.state].filter(Boolean).join(", ")}
            {f.distance_mi > 0 && ` · ${f.distance_mi.toFixed(1)} mi`}
          </div>
          <div className="mt-1 text-[0.625rem] font-medium" style={{ color }}>{label}</div>
          {note && <div className="mt-0.5 text-[0.5625rem] italic text-[var(--color-text-lo)]">{note}</div>}
        </div>
      </div>
    </div>
  );
}

export function CanvassResultsPanel({ state, inv, meta }: {
  state: State; inv: any; meta: any;
}) {
  const [generating, setGenerating] = useState(false);

  const generate = async (fmt: "docx" | "pdf") => {
    setGenerating(true);
    try {
      const endpoint = fmt === "pdf"
        ? `/api/investigations/${inv.id}/canvass-report-pdf`
        : `/api/investigations/${inv.id}/canvass-report-docx`;
      const r = await fetch(`${BASE}${endpoint}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            subject_name: inv.subject_name ?? "",
            dob: inv.subject_dob ?? "",
            phone: (inv.subject_phones ?? [])[0] ?? "",
            address: state.canvassAddress,
            claim_number: meta?.claim_number ?? "",
            client_company: meta?.client_company ?? "",
            adjuster_name: meta?.adjuster_name ?? "",
          },
        }),
      });
      if (r.ok) {
        const blob = await r.blob();
        const cd = r.headers.get("content-disposition") ?? "";
        let fname = `canvass_${meta?.claim_number ?? inv.id}.${fmt}`;
        for (const part of cd.split(";")) {
          const p = part.trim();
          if (p.toLowerCase().startsWith("filename=")) {
            fname = p.slice(9).replace(/^"|"$/g, "").trim(); break;
          }
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fname; a.click();
        URL.revokeObjectURL(url);
      } else {
        alert(`Report failed: ${r.status}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const total = state.withRecord.length + state.chartOnly.length + state.noRecord.length;

  return (
    <PanelShell
      title="Results"
      icon={<FileText size={11} strokeWidth={1.8} />}
      action={
        <div className="flex items-center gap-1">
          <button disabled={generating} onClick={() => generate("docx")}
            className="flex items-center gap-1 rounded-[0.375rem] border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-2 py-0.5 text-[0.5625rem] font-medium text-[var(--color-text-hi)] disabled:opacity-50">
            {generating ? <Loader2 size={9} className="animate-spin"/> : <FileDown size={9}/>}
            DOCX
          </button>
          <button disabled={generating} onClick={() => generate("pdf")}
            className="flex items-center gap-1 rounded-[0.375rem] border border-[var(--color-line)] px-2 py-0.5 text-[0.5625rem] text-[var(--color-text-mid)] disabled:opacity-50">
            PDF
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Summary counters */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "With record", count: state.withRecord.length, color: "#4ade80", Icon: CheckCircle2 },
            { label: "Chart only",  count: state.chartOnly.length,  color: "#fbbf24", Icon: FileText },
            { label: "No record",   count: state.noRecord.length,   color: "var(--color-text-lo)", Icon: XCircle },
          ].map(({ label, count, color, Icon }) => (
            <div key={label} className="surface flex flex-col items-center gap-1 rounded-[0.625rem] py-2.5">
              <Icon size={14} style={{ color }} strokeWidth={1.8} />
              <span className="text-[1rem] font-bold" style={{ color }}>{count}</span>
              <span className="text-center font-mono text-[0.5rem] text-[var(--color-text-lo)]">{label}</span>
            </div>
          ))}
        </div>

        {total === 0 && (
          <div className="py-6 text-center text-[0.75rem] text-[var(--color-text-lo)]">
            No results yet — mark facilities in the Facilities panel.
          </div>
        )}

        {/* With record */}
        {state.withRecord.length > 0 && (
          <div>
            <div className="mb-2 font-mono text-[0.5rem] uppercase tracking-wider text-[#4ade80]">
              With record ({state.withRecord.length})
            </div>
            <div className="flex flex-col gap-1.5">
              {state.withRecord.map(f => (
                <ResultCard key={f.id} f={f} label="✓ With record" color="#4ade80"
                  note={state.getFacNote(f)} />
              ))}
            </div>
          </div>
        )}

        {/* Chart only */}
        {state.chartOnly.length > 0 && (
          <div>
            <div className="mb-2 font-mono text-[0.5rem] uppercase tracking-wider text-[#fbbf24]">
              Chart only ({state.chartOnly.length})
            </div>
            <div className="flex flex-col gap-1.5">
              {state.chartOnly.map(f => (
                <ResultCard key={f.id} f={f} label="📄 Chart only" color="#fbbf24"
                  note={state.getFacNote(f)} />
              ))}
            </div>
          </div>
        )}

        {/* No record */}
        {state.noRecord.length > 0 && (
          <div>
            <div className="mb-2 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
              No record ({state.noRecord.length})
            </div>
            <div className="flex flex-col gap-1.5">
              {state.noRecord.map(f => (
                <ResultCard key={f.id} f={f} label="✕ No record" color="var(--color-text-lo)" />
              ))}
            </div>
          </div>
        )}
      </div>
    </PanelShell>
  );
}

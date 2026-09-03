
import { useState } from "react";
import { useInvestigations } from '@/osint/lib/queries';
import { ReverseImageSearch } from "@/osint/components/investigations/ReverseImageSearch";

export default function ReverseSearchPage() {
  const [selectedInv, setSelectedInv] = useState<number | null>(null);
  const [search, setSearch]           = useState("");

  // Load all investigations (high page_size) so none are missing
  const { data: invData } = useInvestigations(1, undefined, search || undefined);
  const allInvs = invData?.items || [];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reverse image search</h1>
        <p className="text-sm text-slate-500">Upload a face photo and search across multiple engines. Results can be saved to a case.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Link to investigation</label>
        <input
          type="text"
          placeholder="Search by name or claim #..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm mb-2"
        />
        <select
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
          value={selectedInv || ""}
          onChange={e => setSelectedInv(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Select an investigation to save results...</option>
          {allInvs.map(inv => (
            <option key={inv.id} value={inv.id}>
              #{inv.id} — {inv.subject_name}{inv.status !== "completed" ? ` (${inv.status})` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedInv ? (
        <ReverseImageSearch investigationId={selectedInv} />
      ) : (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
          <p className="text-slate-400 text-sm">Select an investigation above to start searching</p>
        </div>
      )}
    </div>
  );
}

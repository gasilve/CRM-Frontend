import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, Plus, Play, Trash2, Eye, Radio } from "lucide-react";
import { useInvestigations, useRunInvestigation, useDeleteInvestigation } from "@/osint/lib/queries";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-slate-500/15 text-slate-300 border-slate-500/30",
  running:    "bg-amber-500/15 text-amber-300 border-amber-500/30",
  completed:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed:     "bg-red-500/15 text-red-300 border-red-500/30",
  queued:     "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

export default function Investigations() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);

  const { data, isLoading } = useInvestigations(page, status, q || undefined);
  const runMut = useRunInvestigation();
  const delMut = useDeleteInvestigation();

  const investigations = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.page_size ?? 20;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-hi)]">OSINT Investigations</h1>
          <p className="text-sm text-[var(--color-text-mid)] mt-0.5">{total} investigation{total !== 1 ? "s" : ""} total</p>
        </div>
        <Link
          to="/osint/investigations/new"
          className="flex items-center gap-2 rounded-[0.625rem] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={15} />
          New investigation
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]" />
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            placeholder="Search by name, username, email…"
            className="w-full rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-1)] pl-9 pr-3 py-2 text-sm text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <select
          value={status ?? ""}
          onChange={e => { setStatus(e.target.value || undefined); setPage(1); }}
          className="rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-1)] px-3 py-2 text-sm text-[var(--color-text-hi)] outline-none"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="surface flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-[var(--color-text-lo)]">Loading…</div>
        ) : investigations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--color-text-lo)]">
            <Search size={24} />
            <p className="text-sm">No investigations found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--color-text-lo)]">Subject</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--color-text-lo)]">Type</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--color-text-lo)]">Status</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--color-text-lo)]">Progress</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--color-text-lo)]">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {investigations.map(inv => (
                <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--color-text-hi)]">{inv.subject_name}</div>
                    {inv.case_id && <div className="text-xs text-[var(--color-text-lo)]">Case #{inv.case_id}</div>}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-mid)] capitalize">{inv.investigation_type ?? "general"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] ?? STATUS_COLORS.pending}`}>
                      {inv.status === "running" && <Radio size={10} className="animate-pulse" />}
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-[var(--color-ink-2)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                          style={{ width: `${inv.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--color-text-lo)]">{inv.progress ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-lo)]">
                    {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate(`/osint/investigations/${inv.id}`)}
                        className="rounded-lg p-1.5 text-[var(--color-text-lo)] hover:bg-white/[0.05] hover:text-[var(--color-text-hi)] transition-colors"
                        title="Open"
                      >
                        <Eye size={14} />
                      </button>
                      {(inv.status === "pending" || inv.status === "failed") && (
                        <button
                          onClick={() => runMut.mutate(inv.id)}
                          disabled={runMut.isPending}
                          className="rounded-lg p-1.5 text-[var(--color-text-lo)] hover:bg-white/[0.05] hover:text-emerald-400 transition-colors"
                          title="Run"
                        >
                          <Play size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm(`Delete investigation for ${inv.subject_name}?`)) delMut.mutate(inv.id); }}
                        className="rounded-lg p-1.5 text-[var(--color-text-lo)] hover:bg-white/[0.05] hover:text-[var(--color-neg)] transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[var(--color-text-mid)]">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs hover:bg-white/[0.03] disabled:opacity-40"
            >Prev</button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs hover:bg-white/[0.03] disabled:opacity-40"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

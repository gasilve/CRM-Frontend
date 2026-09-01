import { useState } from "react";
import { Loader2, ScrollText } from "lucide-react";
import { casesApi } from "@/lib/crm-api";
import { CaseJournalFolder } from "@/pages/case-detail-panels";
import type { CasePanelCtx } from "@/pages/case-detail-widgets";

/** Global "where things stand" debrief + per-day journal folders. */
export function CaseFolderDrawer({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  const canPost = ctx.canPostJournal;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const saveSummary = async () => {
    setBusy(true);
    try {
      await casesApi.updateSituationSummary(c.id, draft.trim() || null);
      setEditing(false);
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Situation summary */}
      <div className="rounded-[0.75rem] border border-[var(--color-line-2)] bg-[var(--color-ink-1)]/40 p-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            <ScrollText size={11} strokeWidth={1.8} />
            Situation summary
          </span>
          {canPost && !editing && (
            <button
              type="button"
              onClick={() => {
                setDraft(c.situationSummary ?? "");
                setEditing(true);
              }}
              className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-accent-2)] hover:text-[var(--color-text-hi)]"
            >
              {c.situationSummary ? "Edit" : "Write"}
            </button>
          )}
        </div>
        {editing ? (
          <div className="mt-2 flex flex-col gap-1.5">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Where does the case stand overall? Key findings, open questions, next moves…"
              className="min-h-[6rem] resize-none rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 py-2 text-[0.78125rem] leading-relaxed text-[var(--color-text-hi)] focus:outline-none"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-[0.5rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.6875rem] text-[var(--color-text-lo)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSummary}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-[0.5rem] bg-[var(--color-accent-soft)] px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--color-text-hi)] disabled:opacity-50"
              >
                {busy && <Loader2 size={11} className="animate-spin" />}
                Save summary
              </button>
            </div>
          </div>
        ) : c.situationSummary ? (
          <p className="mt-2 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">
            {c.situationSummary}
          </p>
        ) : (
          <p className="mt-2 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            No situation summary yet{canPost ? " — write one to give the team the current picture." : "."}
          </p>
        )}
      </div>

      {/* Day-by-day journal */}
      <CaseJournalFolder ctx={ctx} />
    </div>
  );
}

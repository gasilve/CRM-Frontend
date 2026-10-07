import { useState } from "react";
import { Search } from "lucide-react";
import { intelApi, type IntelResearchResult } from "@/lib/crm-api";
import { useWidgetLayout } from "@/lib/widget-layout";
import { WidgetShell } from "@/components/widgets/WidgetShell";

const SUGGESTIONS = [
  "CA surveillance privacy",
  "workers comp fraud SIU",
  "FMLA leave abuse",
  "CourtListener insurance fraud",
];

/**
 * Ask → answer against the published intel library (auto-ingested RSS),
 * cached org-wide for 2h. Live LLM research is the intended product path —
 * not wired as a free default yet.
 */
export function FraudIntelResearch() {
  const { density } = useWidgetLayout();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntelResearchResult | null>(null);

  const ask = async (override?: string) => {
    const q = (override ?? query).trim();
    if (q.length < 3 || busy) return;
    if (override) setQuery(override);
    setBusy(true);
    setError(null);
    try {
      setResult(await intelApi.research(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <WidgetShell title="Fraud Intel Research" icon={Search} eyebrow="Ask">
      <div className="flex h-full min-h-0 flex-col gap-2.5">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void ask();
            }}
            placeholder="Ask a fraud / legal question…"
            className="min-w-0 flex-1 rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 px-2.5 py-2 text-[0.75rem] text-[var(--color-text-hi)] outline-none placeholder:text-[var(--color-text-lo)] focus:border-[var(--color-line-2)]"
          />
          <button
            type="button"
            onClick={() => void ask()}
            disabled={busy || query.trim().length < 3}
            className="shrink-0 rounded-[0.5rem] border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-3 py-2 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-hi)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-40"
          >
            {busy ? "…" : "Ask"}
          </button>
        </div>

        {error && <p className="font-mono text-[0.65625rem] text-[#f59e0b]">{error}</p>}

        {!result && !error && (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
            <p className="text-center font-mono text-[0.65625rem] leading-relaxed text-[var(--color-text-lo)]">
              Answers from the published intel feed
              {density !== "dense" ? " · cached 2h org-wide" : ""}
            </p>
            {density !== "dense" && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void ask(s)}
                    className="rounded-full border border-[var(--color-line)] px-2.5 py-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="min-h-0 flex-1 overflow-auto rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/30 p-2.5">
            <div className="mb-2 flex items-center gap-2 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
              <span>{result.cached ? "Cached" : "Fresh"}</span>
              <span>·</span>
              <span>{result.remainingToday} left today</span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-[0.75rem] leading-relaxed text-[var(--color-text-hi)]">
              {result.answer}
            </pre>
            {density !== "dense" && result.citations.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 border-t border-[var(--color-line)] pt-2">
                {result.citations.map((c) => (
                  <li key={c.title}>
                    {c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[0.6875rem] text-[var(--color-accent)] hover:underline"
                      >
                        {c.title}
                      </a>
                    ) : (
                      <span className="text-[0.6875rem] text-[var(--color-text-mid)]">{c.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useWidgetNavigate } from "@/lib/widget-bridge";
import { Building2 } from "lucide-react";
import { clientsApi } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { cn } from "@/lib/cn";
import { WidgetHero } from "@/components/widgets/WidgetChrome";
import { WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

const ACCENTS = ["var(--color-accent)", "#a78bfa", "var(--color-pos)", "var(--color-warn)", "#38bdf8"];

/** Master list + detail pane for top clients. */
export function ClientMasterDetail() {
  const { density } = useWidgetLayout();
  const navigate = useWidgetNavigate();
  const { data, loading, error } = useQuery("dashboard:clients-summary", () => clientsApi.summary(), { staleMs: 60_000 });
  const clients = data?.topByOpenCases ?? [];
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (sel >= clients.length) setSel(0);
  }, [clients.length, sel]);

  const selected = clients[sel];
  const totalOpen = Math.max(1, clients.reduce((s, c) => s + c.openCases, 0));
  const detail = useQuery(
    selected ? `dashboard:client-detail:${selected.id}` : null,
    () => clientsApi.get(selected!.id),
    { staleMs: 60_000, enabled: !!selected && density !== "dense" },
  );

  const openCases = useMemo(
    () => (detail.data?.client.cases ?? []).filter((c) => c.status !== "closed").slice(0, 8),
    [detail.data],
  );

  return (
    <WidgetShell title="Client Master Detail" icon={Building2} eyebrow="Relationships">
      {loading && !data ? (
        <WidgetLoading />
      ) : error || !data ? (
        <WidgetErrorState />
      ) : clients.length === 0 ? (
        <WidgetEmpty icon={Building2} label="No clients with open cases." />
      ) : density === "dense" ? (
        <WidgetHero value={clients[0]?.company ?? "—"} label="Top client" delta={`${clients[0]?.openCases ?? 0} open`} />
      ) : (
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-2">
          <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden">
            {clients.slice(0, 6).map((c, i) => {
              const share = Math.round((c.openCases / totalOpen) * 100);
              const active = i === sel;
              const accent = ACCENTS[i % ACCENTS.length];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSel(i)}
                  className={cn(
                    "relative min-h-0 shrink overflow-hidden rounded-[0.625rem] border px-2.5 py-2 text-left transition-colors",
                    active
                      ? "border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-line)] hover:border-[var(--color-line-2)]",
                  )}
                >
                  <span
                    className="absolute inset-y-1.5 left-0 w-[0.15rem] rounded-full"
                    style={{ background: accent }}
                    aria-hidden
                  />
                  <div className="truncate pl-1.5 text-[0.78125rem] font-medium text-[var(--color-text-hi)]">{c.company}</div>
                  <div className="pl-1.5 font-mono text-[0.5rem] uppercase tracking-[0.08em] text-[var(--color-text-lo)]">
                    {share}% · {c.openCases} open
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_35%,transparent)]">
            {selected && (
              <>
                <div className="shrink-0 border-b border-[var(--color-line)] px-3 py-2.5">
                  <div className="truncate text-[0.9375rem] font-semibold text-[var(--color-text-hi)]">{selected.company}</div>
                  <div className="mt-0.5 font-mono text-[0.5rem] uppercase tracking-[0.1em] text-[var(--color-text-lo)]">
                    {Math.round((selected.openCases / totalOpen) * 100)}% of book · {selected.openCases} open
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2.5">
                  {detail.loading && !detail.data ? (
                    <WidgetLoading />
                  ) : openCases.length === 0 ? (
                    <div className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">No open cases listed.</div>
                  ) : (
                    openCases.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => navigate(`/cases/${c.id}`)}
                        className="flex min-w-0 items-center gap-2 rounded-[0.5rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-2)_40%,transparent)] px-2.5 py-2 text-left transition-colors hover:border-[var(--color-accent)]/35"
                      >
                        <span className="min-w-0 flex-1 truncate text-[0.75rem] text-[var(--color-text-hi)]">
                          {c.caseNumber}
                          <span className="text-[var(--color-text-lo)]"> · </span>
                          {c.subjectName}
                        </span>
                      </button>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/clients/${selected.id}`)}
                    className="mt-auto shrink-0 pt-1 text-left font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-[var(--color-accent-2)] hover:text-[var(--color-text-hi)]"
                  >
                    Open client →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { PATTERN_FRAME_PX } from "@/lib/pattern-size";
import { renderPattern } from "@/components/widgets/patterns";
import { WidgetSizeProvider } from "@/lib/widget-size";
import { WidgetTreeProviders } from "@/lib/widget-bridge";
import { WidgetErrorBoundary } from "@/components/widgets/WidgetErrorBoundary";
import { WIDGETS, type WidgetId } from "@/pages/dashboard-widgets";
import {
  DECIDED_SUMMARY,
  openMappings,
  type MappingProposal,
  type WidgetMapping,
} from "@/lib/widget-mapping";

function Frame({
  label,
  w,
  h,
  children,
  tone,
}: {
  label: string;
  w: number;
  h: number;
  children: React.ReactNode;
  tone?: "template" | "original" | "final";
}) {
  const border =
    tone === "original"
      ? "border-[var(--color-warn)]/35"
      : tone === "final"
        ? "border-[var(--color-pos)]/40"
        : "border-[var(--color-line)]";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</div>
      <div
        className={cn("min-w-0 overflow-hidden rounded-[0.75rem] border", border)}
        style={{ width: "100%", maxWidth: w, height: h }}
      >
        {children}
      </div>
    </div>
  );
}

function OriginalWidget({ widgetId }: { widgetId: WidgetId }) {
  const def = WIDGETS[widgetId];
  if (!def) {
    return (
      <div className="grid h-full place-items-center bg-[var(--color-ink-2)] px-3 text-center font-mono text-[0.625rem] text-[var(--color-text-lo)]">
        No live dashboard widget yet
      </div>
    );
  }
  return (
    <div className="widget-frame h-full w-full">
      <div className="widget-body h-full w-full">
        <WidgetErrorBoundary name={widgetId}>
          <WidgetTreeProviders>
            <WidgetSizeProvider>{def.render()}</WidgetSizeProvider>
          </WidgetTreeProviders>
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}

function ProposalRow({ mapping, proposal }: { mapping: WidgetMapping; proposal: MappingProposal }) {
  const { w, h } = PATTERN_FRAME_PX[proposal.size];
  const isLive = mapping.widgetId in WIDGETS;
  return (
    <div
      className={cn(
        "rounded-[0.875rem] border p-3",
        proposal.preferred
          ? "border-[var(--color-accent)]/35 bg-[color-mix(in_srgb,var(--color-accent)_6%,transparent)]"
          : "border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-2)_40%,transparent)]",
      )}
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        {proposal.preferred && (
          <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 font-mono text-[0.4375rem] uppercase tracking-wider text-[var(--color-accent-2)]">
            Preferred
          </span>
        )}
        <span className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-hi)]">
          {proposal.patternId} · {proposal.size}
        </span>
        <span className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">{proposal.rationale}</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Frame label="Template" w={w} h={h} tone="template">
          <div className="h-full w-full">{renderPattern(proposal.patternId, proposal.size, "glass")}</div>
        </Frame>
        <Frame label="Original widget" w={w} h={h} tone="original">
          {isLive ? (
            <OriginalWidget widgetId={mapping.widgetId as WidgetId} />
          ) : (
            <div className="grid h-full place-items-center bg-[var(--color-ink-2)] px-4 text-center font-mono text-[0.625rem] leading-relaxed text-[var(--color-text-lo)]">
              Not a live grid widget yet — Final is the target recipe.
            </div>
          )}
        </Frame>
        <Frame label="Final (target)" w={w} h={h} tone="final">
          <div className="h-full w-full">{renderPattern(proposal.patternId, proposal.size, "glass")}</div>
        </Frame>
      </div>
    </div>
  );
}

export function WidgetMappingLab() {
  const [showDecided, setShowDecided] = useState(false);
  const [onlyPreferred, setOnlyPreferred] = useState(false);
  const rows = useMemo(() => openMappings(showDecided), [showDecided]);
  const folders = useMemo(() => [...new Set(rows.map((m) => m.folder))], [rows]);
  const [folder, setFolder] = useState<string>("All");

  const filtered = useMemo(() => {
    return rows.filter((m) => folder === "All" || m.folder === folder);
  }, [rows, folder]);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[0.875rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-2)_50%,transparent)] p-4">
        <div className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--color-text-hi)]">Decided</div>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {DECIDED_SUMMARY.map((d) => (
            <li key={d.widget} className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">
              <span className="text-[var(--color-text-mid)]">{d.widget}</span> → {d.pattern}
              {d.note ? ` · ${d.note}` : ""}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-[0.5rem] border border-[var(--color-line)] p-0.5">
          {["All", ...folders].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFolder(f)}
              className={cn(
                "rounded-[0.375rem] px-2.5 py-1.5 font-mono text-[0.5625rem] uppercase tracking-wider transition-colors",
                folder === f
                  ? "bg-[var(--color-ink-3)] text-[var(--color-text-hi)]"
                  : "text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOnlyPreferred((v) => !v)}
          className={cn(
            "rounded-[0.5rem] border px-2.5 py-1.5 font-mono text-[0.5625rem] uppercase tracking-wider",
            onlyPreferred
              ? "border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]"
              : "border-[var(--color-line)] text-[var(--color-text-lo)]",
          )}
        >
          Preferred only
        </button>
        <button
          type="button"
          onClick={() => setShowDecided((v) => !v)}
          className={cn(
            "rounded-[0.5rem] border px-2.5 py-1.5 font-mono text-[0.5625rem] uppercase tracking-wider",
            showDecided
              ? "border-[var(--color-line-2)] text-[var(--color-text-hi)]"
              : "border-[var(--color-line)] text-[var(--color-text-lo)]",
          )}
        >
          {showDecided ? "Hide decided" : "Show decided"}
        </button>
      </div>

      <p className="max-w-3xl font-mono text-[0.625rem] leading-relaxed text-[var(--color-text-lo)]">
        Open proposals only by default. Side-by-side: Template · Original · Final (target until remapped).
      </p>

      {filtered.map((mapping) => {
        const proposals = onlyPreferred ? mapping.proposals.filter((p) => p.preferred) : mapping.proposals;
        if (proposals.length === 0) return null;
        return (
          <section key={mapping.widgetId} className="flex flex-col gap-3">
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-[var(--color-text-hi)]">
                  {mapping.label}
                </h2>
                <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                  {mapping.folder} · {mapping.widgetId}
                </span>
                {mapping.decided && (
                  <span className="rounded-full bg-[var(--color-pos)]/15 px-2 py-0.5 font-mono text-[0.4375rem] uppercase text-[var(--color-pos)]">
                    Decided
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                {mapping.decisionNote ? `Decision: ${mapping.decisionNote} · ` : ""}
                Current: {mapping.current}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {proposals.map((p) => (
                <ProposalRow key={p.id} mapping={mapping} proposal={p} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

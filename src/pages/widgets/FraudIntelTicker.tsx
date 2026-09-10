import { useEffect, useState } from "react";
import { Newspaper, Pin } from "lucide-react";
import { intelApi, type IntelCategory, type IntelItem } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { IntelCard, WidgetFeed, WidgetHero } from "@/components/widgets/WidgetChrome";
import { WidgetExpandModal } from "@/components/widgets/WidgetExpandModal";
import { Pill, WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell, relativeTime } from "@/components/widgets/WidgetShell";

const CATEGORY_LABEL: Record<IntelCategory, string> = {
  news: "News",
  case_law: "Case law",
  regulation: "Regulation",
  statute: "Statute",
  fraud_trend: "Fraud trend",
};

const CATEGORY_COLOR: Record<IntelCategory, string> = {
  news: "#38bdf8",
  case_law: "#a78bfa",
  regulation: "#f59e0b",
  statute: "#fbbf24",
  fraud_trend: "#f87171",
};

function Meta({ item }: { item: IntelItem }) {
  return (
    <>
      {item.pinned && <Pin size={10} className="text-[var(--color-accent)]" />}
      <Pill color={CATEGORY_COLOR[item.category]}>{CATEGORY_LABEL[item.category]}</Pill>
      {item.jurisdiction && (
        <span className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">{item.jurisdiction}</span>
      )}
      <span className="ml-auto shrink-0 font-mono text-[0.5625rem] text-[var(--color-text-lo)]">
        {relativeTime(item.publishedAt)}
      </span>
    </>
  );
}

/** Tabs with live sources. Statute stays out until we seed a statute feed. */
const TICKER_TABS = ["all", "news", "case_law", "regulation", "fraud_trend"] as const;
type TickerTab = (typeof TICKER_TABS)[number];

/** Cross-category headline feed — chrome tabs at XL, cards that never clip mid-line. */
export function FraudIntelTicker() {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<TickerTab>("all");
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const base = useWidgetLayout({ rowPx: 58, reservedPx: 28 });
  const chrome = useWidgetLayout({ rowPx: 72, reservedPx: 72 });
  const { density, showChrome, showSummary } = base;
  const slots = showChrome ? chrome.slots : base.slots;
  const queryKey = `intel:ticker:${tab}`;
  const { data, loading, error } = useQuery(
    queryKey,
    () =>
      intelApi.list({
        limit: 40,
        ...(tab !== "all" ? { category: tab } : {}),
      }),
    { staleMs: 60_000 },
  );
  const items = data?.items ?? [];

  useEffect(() => {
    if (density !== "dense" || items.length < 2) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % items.length), 5500);
    return () => window.clearInterval(t);
  }, [density, items.length]);

  const filtered = items.filter((item) => {
    if (!q.trim()) return true;
    const hay = `${item.title} ${item.summary ?? ""} ${item.tags.join(" ")}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const renderCard = (item: IntelItem, cozy = false) => (
    <IntelCard
      density={cozy ? "rich" : density}
      title={item.title}
      summary={cozy || showSummary ? item.summary : null}
      accent={CATEGORY_COLOR[item.category]}
      href={item.url}
      meta={<Meta item={item} />}
    />
  );

  return (
    <WidgetShell
      title="Fraud Intel Ticker"
      icon={Newspaper}
      eyebrow="Intelligence"
      onExpand={filtered.length > 0 ? () => setExpanded(true) : undefined}
    >
      {loading && !data ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetErrorState message="Intel feed unavailable." />
      ) : items.length === 0 ? (
        <WidgetEmpty icon={Newspaper} label="No published intel yet." />
      ) : density === "dense" ? (
        <WidgetHero>
          {(() => {
            const item = items[idx % items.length];
            return (
              <IntelCard
                featured
                density="dense"
                title={item.title}
                accent={CATEGORY_COLOR[item.category]}
                href={item.url}
                meta={<Meta item={item} />}
              />
            );
          })()}
        </WidgetHero>
      ) : (
        <div className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          {showChrome && (
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              {TICKER_TABS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTab(c)}
                  className={`rounded-[0.375rem] px-2 py-1 font-mono text-[0.5625rem] uppercase tracking-wider transition-colors ${
                    tab === c
                      ? "bg-[var(--color-accent)] text-[var(--color-ink-1)]"
                      : "text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]"
                  }`}
                >
                  {c === "all" ? "All" : CATEGORY_LABEL[c]}
                </button>
              ))}
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="ml-auto min-w-[7rem] flex-1 rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 px-2 py-1 text-[0.6875rem] text-[var(--color-text-hi)] outline-none placeholder:text-[var(--color-text-lo)]"
              />
            </div>
          )}
          <WidgetFeed
            items={filtered}
            slots={Math.max(2, slots)}
            scrollCap={Math.max(slots + 4, 12)}
            getKey={(i) => i.id}
            onShowMore={() => setExpanded(true)}
            empty={<WidgetEmpty icon={Newspaper} label="No matches." />}
            renderItem={(item) => renderCard(item)}
          />
        </div>
      )}
      <WidgetExpandModal title="Fraud Intel Ticker" open={expanded} onClose={() => setExpanded(false)}>
        {filtered.map((item) => (
          <div key={item.id}>{renderCard(item, true)}</div>
        ))}
      </WidgetExpandModal>
    </WidgetShell>
  );
}

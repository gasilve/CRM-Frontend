import { useState } from "react";
import { Scale } from "lucide-react";
import { intelApi } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { IntelCard, WidgetFeed, WidgetHero } from "@/components/widgets/WidgetChrome";
import { WidgetExpandModal } from "@/components/widgets/WidgetExpandModal";
import { Pill, WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell, relativeTime } from "@/components/widgets/WidgetShell";

/** Landmark Cases & Precedents — scrollable card list. */
export function LandmarkPrecedents() {
  const [expanded, setExpanded] = useState(false);
  // ~58px compact cards (meta + 1-line title); reserved for footer "+N more".
  const { density, slots, showSummary } = useWidgetLayout({ rowPx: 58, reservedPx: 28 });
  const { data, loading, error } = useQuery(
    "intel:case-law",
    () => intelApi.list({ category: "case_law", limit: 40 }),
    { staleMs: 60_000 },
  );
  const items = data?.items ?? [];

  const renderCard = (item: (typeof items)[0], cozy = false) => (
    <IntelCard
      density={cozy || showSummary ? "rich" : density}
      title={item.title}
      summary={showSummary || cozy ? item.summary : null}
      accent="#a78bfa"
      href={item.url}
      meta={
        <>
          {item.jurisdiction && <Pill color="#a78bfa">{item.jurisdiction}</Pill>}
          {item.tags.slice(0, 2).map((t) => (
            <span key={t} className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">
              {t}
            </span>
          ))}
          <span className="ml-auto shrink-0 font-mono text-[0.5625rem] text-[var(--color-text-lo)]">
            {relativeTime(item.publishedAt)}
          </span>
        </>
      }
    />
  );

  return (
    <WidgetShell
      title="Landmark Cases & Precedents"
      icon={Scale}
      eyebrow="Case law"
      onExpand={items.length > 0 ? () => setExpanded(true) : undefined}
    >
      {loading && !data ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetErrorState message="Intel feed unavailable." />
      ) : items.length === 0 ? (
        <WidgetEmpty icon={Scale} label="No precedents yet." />
      ) : density === "dense" ? (
        <WidgetHero value={items.length} label="Precedents on file" delta={items[0]?.title} accent="#a78bfa" />
      ) : (
        <WidgetFeed
          items={items}
          slots={slots}
          scrollCap={Math.max(slots + 4, 12)}
          getKey={(i) => i.id}
          onShowMore={() => setExpanded(true)}
          renderItem={(item) => renderCard(item)}
        />
      )}
      <WidgetExpandModal title="Landmark Cases & Precedents" open={expanded} onClose={() => setExpanded(false)}>
        {items.map((item) => (
          <div key={item.id}>{renderCard(item, true)}</div>
        ))}
      </WidgetExpandModal>
    </WidgetShell>
  );
}

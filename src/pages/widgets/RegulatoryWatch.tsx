import { useState } from "react";
import { Landmark } from "lucide-react";
import { intelApi } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { IntelCard, WidgetFeed, WidgetHero } from "@/components/widgets/WidgetChrome";
import { WidgetExpandModal } from "@/components/widgets/WidgetExpandModal";
import { Pill, WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell, relativeTime } from "@/components/widgets/WidgetShell";

/** Regulatory & Legislative Watch — scrollable card list (no secondary overlay). */
export function RegulatoryWatch() {
  const [expanded, setExpanded] = useState(false);
  const { density, slots, showSummary } = useWidgetLayout({ rowPx: 58, reservedPx: 28 });
  const { data, loading, error } = useQuery(
    "intel:regulatory",
    () => intelApi.list({ categories: "regulation,statute", limit: 40 }),
    { staleMs: 60_000 },
  );
  const items = data?.items ?? [];
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = items.filter((i) => i.publishedAt && new Date(i.publishedAt) >= monthStart).length;

  const renderCard = (item: (typeof items)[0], cozy = false) => (
    <IntelCard
      density={cozy || showSummary ? "rich" : density}
      title={item.title}
      summary={showSummary || cozy ? item.summary : null}
      accent={item.category === "statute" ? "#fbbf24" : "#f59e0b"}
      href={item.url}
      meta={
        <>
          <Pill color={item.category === "statute" ? "#fbbf24" : "#f59e0b"}>
            {item.category === "statute" ? "Statute" : "Regulation"}
          </Pill>
          {item.jurisdiction && (
            <span className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">{item.jurisdiction}</span>
          )}
          <span className="ml-auto shrink-0 font-mono text-[0.5625rem] text-[var(--color-text-lo)]">
            {relativeTime(item.publishedAt)}
          </span>
        </>
      }
    />
  );

  return (
    <WidgetShell
      title="Regulatory & Legislative Watch"
      icon={Landmark}
      eyebrow="Compliance"
      onExpand={items.length > 0 ? () => setExpanded(true) : undefined}
    >
      {loading && !data ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetErrorState message="Intel feed unavailable." />
      ) : items.length === 0 ? (
        <WidgetEmpty icon={Landmark} label="No regulatory items yet." />
      ) : density === "dense" ? (
        <WidgetHero
          value={thisMonth}
          label="New this month"
          delta={`${items.length} tracked`}
          accent={thisMonth > 0 ? "#f59e0b" : undefined}
        />
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
      <WidgetExpandModal title="Regulatory & Legislative Watch" open={expanded} onClose={() => setExpanded(false)}>
        {items.map((item) => (
          <div key={item.id}>{renderCard(item, true)}</div>
        ))}
      </WidgetExpandModal>
    </WidgetShell>
  );
}

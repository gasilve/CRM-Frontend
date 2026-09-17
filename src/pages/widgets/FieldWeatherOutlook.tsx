import { useMemo, useState } from "react";
import { CloudSun, Droplets, Wind } from "lucide-react";
import { weatherApi, type WeatherReading } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { cn } from "@/lib/cn";
import { weatherColor, weatherIcon, conditionLabel } from "@/components/cases/WeatherStrip";
import { WidgetHero } from "@/components/widgets/WidgetChrome";
import { WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

const mondayOf = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function fieldGo(code: number): "go" | "caution" | "hold" {
  if (code === 0 || code <= 2) return "go";
  if (code === 3 || (code >= 51 && code <= 57) || code === 45 || code === 48) return "caution";
  return "hold";
}

const GO_TONE = {
  go: "var(--color-pos)",
  caution: "var(--color-warn)",
  hold: "var(--color-neg)",
} as const;

/**
 * Weather board — all three regions at a glance; click one for detail.
 * Replaces the older list-only outlook.
 */
export function FieldWeatherOutlook() {
  const { density, showSecondary, pxWidth } = useWidgetLayout();
  const { data, loading, error } = useQuery("dashboard:weather-current", () => weatherApi.list(), { staleMs: 10 * 60_000 });
  const weekly = useQuery("dashboard:weather-weekly", () => weatherApi.weekly(mondayOf()), {
    staleMs: 10 * 60_000,
    enabled: density !== "dense",
  });

  const readings = data?.readings ?? [];
  const [sel, setSel] = useState(0);

  const ordered = useMemo(() => {
    const prefer = ["ca", "tristate", "texas"];
    return [...readings].sort((a, b) => prefer.indexOf(a.group) - prefer.indexOf(b.group));
  }, [readings]);

  const selected: WeatherReading | undefined = ordered[Math.min(sel, Math.max(0, ordered.length - 1))];
  const worst = ordered.reduce<WeatherReading | null>((acc, r) => (!acc || r.code > acc.code ? r : acc), null);
  const todayExtras = selected
    ? weekly.data?.groups.find((g) => g.group === selected.group)?.days.find((d) => d.date === todayIso())
    : undefined;

  const cols = pxWidth < 280 ? 1 : 3;

  return (
    <WidgetShell title="Field Weather Outlook" icon={CloudSun} eyebrow="Field ops">
      {loading && !data ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetErrorState />
      ) : ordered.length === 0 ? (
        <WidgetEmpty icon={CloudSun} label="No forecast available." />
      ) : density === "dense" && worst ? (
        (() => {
          const Icon = weatherIcon(worst.code, worst.isDay);
          const color = weatherColor(worst.code);
          const risk = fieldGo(worst.code);
          return (
            <WidgetHero>
              <div className="flex items-center gap-2.5">
                <Icon size={28} strokeWidth={1.6} style={{ color }} />
                <div className="min-w-0">
                  <div className="truncate text-[0.875rem] font-medium text-[var(--color-text-hi)]">
                    {worst.label} · {worst.tempF}°
                  </div>
                  <div className="font-mono text-[0.625rem] uppercase tracking-wider" style={{ color: GO_TONE[risk] }}>
                    {risk === "go" ? "Go" : risk === "caution" ? "Caution" : "Hold"} · {conditionLabel(worst.code)}
                  </div>
                </div>
              </div>
            </WidgetHero>
          );
        })()
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          <div className={cn("grid min-h-0 gap-1.5", cols === 3 ? "grid-cols-3" : "grid-cols-1", showSecondary ? "shrink-0" : "flex-1")}>
            {ordered.slice(0, 3).map((r, i) => {
              const Icon = weatherIcon(r.code, r.isDay);
              const color = weatherColor(r.code);
              const risk = fieldGo(r.code);
              const active = i === sel;
              return (
                <button
                  key={r.group}
                  type="button"
                  onClick={() => setSel(i)}
                  className={cn(
                    "flex min-h-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[0.75rem] border px-2 py-2.5 text-center transition-colors",
                    active
                      ? "border-[var(--color-accent)]/45 bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_40%,transparent)] hover:border-[var(--color-line-2)]",
                  )}
                >
                  <Icon size={22} strokeWidth={1.6} style={{ color }} />
                  <div className="truncate text-[0.75rem] font-medium text-[var(--color-text-hi)]">{r.label}</div>
                  <div className="text-[1.125rem] font-semibold tabular-nums leading-none text-[var(--color-text-hi)]">
                    {r.tempF}°
                  </div>
                  <div className="font-mono text-[0.4375rem] uppercase tracking-[0.1em]" style={{ color: GO_TONE[risk] }}>
                    {risk === "go" ? "Go" : risk === "caution" ? "Caution" : "Hold"}
                  </div>
                </button>
              );
            })}
          </div>

          {showSecondary && selected && (
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 overflow-hidden rounded-[0.75rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_35%,transparent)] px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[0.875rem] font-semibold text-[var(--color-text-hi)]">
                    {selected.label}
                    <span className="font-normal text-[var(--color-text-lo)]"> · {selected.city}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-[var(--color-text-lo)]">
                    {conditionLabel(selected.code)} · {selected.tempF}°F
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.5rem] uppercase"
                  style={{
                    color: GO_TONE[fieldGo(selected.code)],
                    background: `color-mix(in srgb, ${GO_TONE[fieldGo(selected.code)]} 16%, transparent)`,
                  }}
                >
                  {fieldGo(selected.code) === "go" ? "Go" : fieldGo(selected.code) === "caution" ? "Caution" : "Hold"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[0.6875rem] text-[var(--color-text-mid)]">
                {todayExtras?.precipChance != null && (
                  <span className="inline-flex items-center gap-1">
                    <Droplets size={12} /> {todayExtras.precipChance}% precip
                  </span>
                )}
                {todayExtras?.windMph != null && (
                  <span className="inline-flex items-center gap-1">
                    <Wind size={12} /> {todayExtras.windMph} mph
                  </span>
                )}
                {todayExtras?.highF != null && todayExtras?.lowF != null && (
                  <span>
                    H {todayExtras.highF}° / L {todayExtras.lowF}°
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

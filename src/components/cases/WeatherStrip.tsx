import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sun, Moon, Cloud, CloudSun, CloudMoon, CloudFog, CloudDrizzle, CloudRain, CloudSnow,
  CloudLightning, ChevronLeft, ChevronRight, X, Droplets, Wind, CalendarDays,
} from "lucide-react";
import { BeamLoader, LoadingCaption } from "@/components/ui/LoadingState";
import { cn } from "@/lib/cn";
import { weatherApi } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";

export function weatherIcon(code: number, isDay = true) {
  if (code === 0) return isDay ? Sun : Moon;
  if (code <= 3) return isDay ? CloudSun : CloudMoon;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

/** Accent color per WMO condition family — drives icon + card tinting. */
export function weatherColor(code: number): string {
  if (code === 0) return "#f59e0b"; // clear — amber
  if (code <= 2) return "#facc15"; // mostly clear — yellow
  if (code === 3) return "#94a3b8"; // overcast — slate
  if (code === 45 || code === 48) return "#a1a1aa"; // fog — zinc
  if (code >= 51 && code <= 57) return "#22d3ee"; // drizzle — cyan
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "#3b82f6"; // rain — blue
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "#7dd3fc"; // snow — light blue
  if (code >= 95) return "#a78bfa"; // storm — violet
  return "#94a3b8";
}

export function conditionLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Rain";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "Snow";
  if (code >= 95) return "Storms";
  return "Clouds";
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Monday of the week containing `d`, as a local YYYY-MM-DD. */
function mondayOf(d: Date): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  const m = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${copy.getFullYear()}-${m}-${day}`;
}

function shiftWeek(monday: string, weeks: number): string {
  const d = new Date(`${monday}T00:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return mondayOf(d);
}

const todayIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

function fmtRange(monday: string): string {
  const start = new Date(`${monday}T00:00:00`);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
}

// Open-Meteo serves ~12 weeks back and ~1 week forward.
const MIN_WEEK_OFFSET = -12;
const MAX_WEEK_OFFSET = 1;

// ─── Compact strip (trigger) ──────────────────────────────────────────────────

export function WeatherStrip() {
  const [open, setOpen] = useState(false);

  // Weather barely changes minute to minute — cache it so remounts are free.
  const { data } = useQuery("weather:current", () => weatherApi.list(), { staleMs: 10 * 60_000 });
  const readings = data?.readings ?? null;

  if (!readings || readings.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open weekly weather"
        className="surface flex shrink-0 items-center gap-1 px-1.5 py-1.5 transition-colors hover:border-[var(--color-line-2)]"
      >
        {readings.map((r) => {
          const Icon = weatherIcon(r.code, r.isDay);
          const color = weatherColor(r.code);
          return (
            <span key={r.group} className="flex items-center gap-2 rounded-[0.5rem] px-2.5 py-1" title={`${r.city} — ${conditionLabel(r.code)}`}>
              <Icon size={15} strokeWidth={1.6} className="shrink-0" style={{ color }} />
              <span className="leading-tight text-left">
                <span className="block text-[0.75rem] font-medium text-[var(--color-text-hi)]">{r.tempF}°</span>
                <span className="block font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                  {r.label}
                </span>
              </span>
            </span>
          );
        })}
      </button>
      {open && <WeatherModal onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── Weekly calendar modal ────────────────────────────────────────────────────

function WeatherModal({ onClose }: { onClose: () => void }) {
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const [monday, setMonday] = useState(thisMonday);

  const weekOffset = Math.round((new Date(`${monday}T00:00:00`).getTime() - new Date(`${thisMonday}T00:00:00`).getTime()) / (7 * DAY_MS));

  const weekly = useQuery(`weather:weekly:${monday}`, () => weatherApi.weekly(monday), { staleMs: 10 * 60_000 });
  const groups = weekly.data?.groups ?? (weekly.error ? [] : null);
  const loading = weekly.loading;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && weekOffset > MIN_WEEK_OFFSET) setMonday((m) => shiftWeek(m, -1));
      if (e.key === "ArrowRight" && weekOffset < MAX_WEEK_OFFSET) setMonday((m) => shiftWeek(m, 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, weekOffset]);

  const days = useMemo(() => {
    const start = new Date(`${monday}T00:00:00`);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  }, [monday]);

  const today = todayIso();

  return createPortal(
    <>
      <div className="anim-backdrop fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(64rem,94vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="surface anim-modal flex max-h-[88vh] flex-col overflow-hidden rounded-[0.875rem]">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <CalendarDays size={16} strokeWidth={1.8} className="text-[var(--color-accent-2)]" />
              <h2 className="editorial text-[1.25rem] leading-none text-[var(--color-text-hi)]">Field weather</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMonday((m) => shiftWeek(m, -1))}
                disabled={weekOffset <= MIN_WEEK_OFFSET}
                aria-label="Previous week"
                className="grid h-7 w-7 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft size={14} strokeWidth={1.8} />
              </button>
              <span className="min-w-[10.5rem] text-center font-mono text-[0.71875rem] text-[var(--color-text-mid)]">
                {fmtRange(monday)}
              </span>
              <button
                type="button"
                onClick={() => setMonday((m) => shiftWeek(m, 1))}
                disabled={weekOffset >= MAX_WEEK_OFFSET}
                aria-label="Next week"
                className="grid h-7 w-7 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronRight size={14} strokeWidth={1.8} />
              </button>
              {monday !== thisMonday && (
                <button
                  type="button"
                  onClick={() => setMonday(thisMonday)}
                  className="ml-1 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[0.65625rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
                >
                  This week
                </button>
              )}
              <button type="button" onClick={onClose} aria-label="Close" className="ml-2 text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {loading && !groups ? (
              <div className="flex h-48 flex-col items-center justify-center gap-3" role="status" aria-live="polite" aria-busy="true">
                <BeamLoader className="w-32" />
                <LoadingCaption>Loading forecast</LoadingCaption>
              </div>
            ) : !groups || groups.length === 0 || groups.every((g) => g.days.length === 0) ? (
              <div className="grid h-48 place-items-center font-mono text-[0.71875rem] text-[var(--color-text-lo)]">
                No forecast data available for this week.
              </div>
            ) : (
              <div className={cn("flex flex-col gap-6", loading && "opacity-50")}>
                {groups.map((g) => {
                  const highs = g.days.map((d) => d.highF).filter((v): v is number => v != null);
                  const lows = g.days.map((d) => d.lowF).filter((v): v is number => v != null);
                  const weekHigh = highs.length ? Math.max(...highs) : null;
                  const weekLow = lows.length ? Math.min(...lows) : null;
                  const heroDay = g.days.find((d) => d.date === today) ?? g.days[0];
                  const HeroIcon = heroDay ? weatherIcon(heroDay.code) : Cloud;
                  const heroColor = heroDay ? weatherColor(heroDay.code) : "#94a3b8";
                  return (
                    <section key={g.group}>
                      {/* Region header */}
                      <div className="mb-2.5 flex items-end justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="grid h-9 w-9 place-items-center rounded-full"
                            style={{ background: `${heroColor}1f`, boxShadow: `0 0 1.125rem ${heroColor}45` }}
                          >
                            <HeroIcon size={20} strokeWidth={1.7} style={{ color: heroColor, filter: `drop-shadow(0 0 0.375rem ${heroColor}80)` }} />
                          </span>
                          <div className="leading-tight">
                            <div className="text-[0.9375rem] font-medium text-[var(--color-text-hi)]">{g.label}</div>
                            <div className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{g.city}</div>
                          </div>
                        </div>
                        {(weekHigh != null || weekLow != null) && (
                          <div className="font-mono text-[0.6875rem] text-[var(--color-text-mid)]">
                            Max: <span className="text-[var(--color-text-hi)]">{weekHigh ?? "—"}°</span>
                            <span className="mx-1.5 text-[var(--color-text-lo)]">·</span>
                            Min: <span className="text-[var(--color-text-hi)]">{weekLow ?? "—"}°</span>
                          </div>
                        )}
                      </div>

                      {/* 7-day cards */}
                      <div className="grid grid-cols-7 gap-2">
                        {days.map((d, i) => {
                          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                          const day = g.days.find((x) => x.date === iso) ?? g.days[i];
                          const isToday = iso === today;
                          if (!day) {
                            return (
                              <div key={iso} className="grid min-h-[9rem] place-items-center rounded-[1rem] border border-dashed border-[var(--color-line)] font-mono text-[0.5625rem] text-[var(--color-text-lo)]">
                                —
                              </div>
                            );
                          }
                          const Icon = weatherIcon(day.code);
                          const color = weatherColor(day.code);
                          return (
                            <div
                              key={iso}
                              title={`${conditionLabel(day.code)}${day.windMph != null ? ` · wind ${day.windMph} mph` : ""}`}
                              className={cn(
                                "flex flex-col items-center gap-2 rounded-[1rem] border px-2 py-3 text-center transition-transform duration-150 hover:-translate-y-0.5",
                                isToday && "ring-2 ring-[var(--color-accent)]",
                              )}
                              style={{
                                background: `linear-gradient(180deg, ${color}${isToday ? "3d" : "2b"} 0%, ${color}0d 65%, transparent 100%)`,
                                borderColor: `${color}45`,
                                boxShadow: isToday ? `0 0.5rem 1.5rem ${color}30` : undefined,
                              }}
                            >
                              {/* Day label */}
                              <div className="leading-tight">
                                <div className={cn("font-mono text-[0.5625rem] uppercase tracking-widest", isToday ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-lo)]")}>
                                  {isToday ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" })}
                                </div>
                                <div className="text-[0.6875rem] font-medium text-[var(--color-text-mid)]">
                                  {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                </div>
                              </div>

                              {/* Icon */}
                              <span
                                className="grid h-11 w-11 place-items-center rounded-full"
                                style={{ background: `${color}24`, boxShadow: `0 0 1.25rem ${color}50` }}
                              >
                                <Icon size={24} strokeWidth={1.6} style={{ color, filter: `drop-shadow(0 0 0.375rem ${color}90)` }} />
                              </span>

                              {/* Temps */}
                              <div className="leading-none">
                                <span className="text-[1.0625rem] font-semibold text-[var(--color-text-hi)]">
                                  {day.highF != null ? `${day.highF}°` : "—"}
                                </span>
                                {day.lowF != null && (
                                  <span className="ml-1 text-[0.75rem] text-[var(--color-text-lo)]">{day.lowF}°</span>
                                )}
                              </div>
                              <div className="font-mono text-[0.5625rem] uppercase tracking-wide" style={{ color }}>
                                {conditionLabel(day.code)}
                              </div>

                              {/* Extras */}
                              <div className="mt-auto flex items-center gap-2 font-mono text-[0.5625rem] text-[var(--color-text-lo)]">
                                {day.precipChance != null && (
                                  <span className="inline-flex items-center gap-0.5">
                                    <Droplets size={9} strokeWidth={1.8} style={{ color: day.precipChance >= 40 ? "#3b82f6" : undefined }} />
                                    {day.precipChance}%
                                  </span>
                                )}
                                {day.windMph != null && (
                                  <span className="inline-flex items-center gap-0.5">
                                    <Wind size={9} strokeWidth={1.8} />
                                    {day.windMph}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

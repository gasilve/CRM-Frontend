import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Droplets, Film, Moon, Sun } from "lucide-react";
import {
  GLASS_BLUR_MAX,
  GLASS_BLUR_MIN,
  GLASS_FIRST_BACKGROUND,
  GLASS_FIRST_THEME,
  GLASS_OPACITY_MAX,
  GLASS_OPACITY_MIN,
  THEMES,
  consumeGlassFirstEnable,
  glassOpacityLocked,
  useTheme,
  type GlassMode,
} from "@/contexts/ThemeContext";
import type { ThemeId, ThemeMeta } from "@/contexts/ThemeContext";
import {
  BACKGROUNDS,
  BACKGROUND_CATEGORIES,
  useBackground,
  type BackgroundCategoryId,
  type BackgroundId,
} from "@/contexts/BackgroundContext";
import { BgSwatch } from "@/components/layout/BackgroundPicker";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Ref to the trigger button — excluded from outside-click detection */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  /** Where the panel opens relative to the trigger (default: below, right-aligned). */
  align?: "bottom-end" | "top-start";
};

const GLASS_MODES: { id: GlassMode; label: string; hint: string }[] = [
  { id: "off", label: "Off", hint: "Solid" },
  { id: "dark", label: "Dark", hint: "Flat" },
  { id: "tinted", label: "Tinted", hint: "Wash" },
  { id: "frosted", label: "Frosted", hint: "Blur HUD" },
];

function glassModeHint(mode: GlassMode): string {
  switch (mode) {
    case "frosted":
      return "Frosted HUD over a live scene";
    case "tinted":
      return "Off chrome + translucent cards with gradient wash";
    case "dark":
      return "Off chrome + flat dark translucent cards";
    default:
      return "Solid surfaces, no scene plate";
  }
}

export function ThemePicker({ open, onClose, triggerRef, align = "bottom-end" }: Props) {
  const {
    themeId,
    setTheme,
    glass,
    glassMode,
    setGlassMode,
    glassOpacity,
    setGlassOpacity,
    glassBlur,
    setGlassBlur,
  } = useTheme();
  const { backgroundId, backgroundMeta, setBackground } = useBackground();
  const panelRef = useRef<HTMLDivElement>(null);
  const isLight = themeId.startsWith("light");
  const frosted = glassMode === "frosted";
  const opacityLocked = glassOpacityLocked(glassMode);
  const opacityControlsActive = frosted;
  const displayOpacity = opacityLocked ? GLASS_OPACITY_MAX : glassOpacity;
  const [category, setCategory] = useState<BackgroundCategoryId>(() =>
    backgroundMeta.category === "still" ? "cities" : backgroundMeta.category,
  );

  const pickGlassMode = (mode: GlassMode) => {
    if (mode !== "off" && glassMode === "off" && consumeGlassFirstEnable()) {
      setTheme(GLASS_FIRST_THEME);
      setBackground(GLASS_FIRST_BACKGROUND);
    }
    setGlassMode(mode);
  };

  useEffect(() => {
    if (!open) return;
    if (backgroundMeta.category !== "still") {
      setCategory(backgroundMeta.category);
    }
  }, [open, backgroundMeta.category]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insidePanel = panelRef.current?.contains(target);
      const insideTrigger = triggerRef.current?.contains(target);
      if (!insidePanel && !insideTrigger) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, triggerRef]);

  const inCategory = useMemo(
    () => BACKGROUNDS.filter((b) => b.category === category),
    [category],
  );

  if (!open) return null;

  const darkThemes = THEMES.filter((t) => t.mode === "dark");
  const lightThemes = THEMES.filter((t) => t.mode === "light");

  const pickTheme = (id: ThemeId) => {
    setTheme(id);
  };

  const pickBg = (id: BackgroundId) => {
    setBackground(id);
  };

  return (
    <div
      ref={panelRef}
      className={`theme-picker-panel absolute z-50 w-[min(54rem,calc(100vw-1.5rem))] overflow-hidden rounded-[0.875rem] border border-[var(--color-line-2)] bg-[var(--color-ink-1)] shadow-[0_1.25rem_3rem_-0.75rem_rgba(0,0,0,var(--shadow-alpha-heavy))] ${
        align === "top-start" ? "anim-popover-bottom bottom-full left-0 mb-2" : "right-0 top-full mt-2"
      }`}
      role="dialog"
      aria-label="Theme and background"
    >
      <div className="grid max-h-[min(52rem,92vh)] grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
        {/* ── Left: glass + palette — sized to content, no scroll ── */}
        <div className="flex flex-col border-b border-[var(--color-line)] lg:border-b-0 lg:border-r">
          <div className="border-b border-[var(--color-line)] px-3.5 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[var(--color-text-lo)]">
                <Droplets size={13} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <div
                  className="text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-[var(--color-text-hi)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Glass
                </div>
                <div
                  className="text-[0.625rem] text-[var(--color-text-lo)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {glassModeHint(glassMode)}
                </div>
              </div>
            </div>

            <div
              className="mt-3 grid grid-cols-4 gap-1 rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-2)]/50 p-1"
              role="radiogroup"
              aria-label="Glass mode"
            >
              {GLASS_MODES.map((m) => {
                const active = glassMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pickGlassMode(m.id)}
                    className={cn(
                      "rounded-[0.5rem] px-2 py-1.5 text-center transition-colors",
                      active
                        ? "bg-[var(--color-ink-3)] text-[var(--color-text-hi)] shadow-[inset_0_0_0_0.0625rem_var(--color-line-2)]"
                        : "text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]",
                    )}
                  >
                    <div
                      className="text-[0.6875rem] font-medium"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      {m.label}
                    </div>
                    <div
                      className="mt-0.5 text-[0.53125rem] uppercase tracking-[0.14em] text-[var(--color-text-lo)]"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      {m.hint}
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              className="mt-3 space-y-3 transition-opacity duration-150"
              style={{ opacity: glass ? 1 : 0.38, pointerEvents: glass ? "auto" : "none" }}
            >
              <div style={{ opacity: opacityControlsActive ? 1 : 0.45 }}>
                <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                  <span
                    className="text-[0.625rem] font-medium uppercase tracking-[0.2em] text-[var(--color-text-lo)]"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    Backdrop opacity{opacityLocked ? " (locked)" : ""}
                  </span>
                  <span
                    className="tabular-nums text-[0.625rem] text-[var(--color-text-mid)]"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {displayOpacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={GLASS_OPACITY_MIN}
                  max={GLASS_OPACITY_MAX}
                  step={1}
                  value={displayOpacity}
                  disabled={!opacityControlsActive}
                  aria-label="Backdrop opacity"
                  onChange={(e) => setGlassOpacity(Number(e.target.value))}
                  className="glass-opacity-slider w-full cursor-pointer disabled:cursor-not-allowed"
                />
              </div>

              <div style={{ opacity: frosted ? 1 : 0.45 }}>
                <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                  <span
                    className="text-[0.625rem] font-medium uppercase tracking-[0.2em] text-[var(--color-text-lo)]"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    Blur {frosted ? "" : "(frosted only)"}
                  </span>
                  <span
                    className="tabular-nums text-[0.625rem] text-[var(--color-text-mid)]"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {glassBlur}px
                  </span>
                </div>
                <input
                  type="range"
                  min={GLASS_BLUR_MIN}
                  max={GLASS_BLUR_MAX}
                  step={1}
                  value={glassBlur}
                  disabled={!frosted}
                  aria-label="Glass blur"
                  onChange={(e) => setGlassBlur(Number(e.target.value))}
                  className="glass-opacity-slider w-full cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <Section
            label="Dark"
            icon={<Moon size={11} strokeWidth={1.8} />}
            themes={darkThemes}
            current={themeId}
            onPick={pickTheme}
          />
          <div className="mx-3 h-[0.0625rem] bg-[var(--color-line)]" />
          <Section
            label="Light"
            icon={<Sun size={11} strokeWidth={1.8} />}
            themes={lightThemes}
            current={themeId}
            onPick={pickTheme}
          />
        </div>

        {/* ── Right: scene background ── */}
        <div
          className="flex min-h-0 max-h-[min(52rem,92vh)] flex-col overflow-hidden transition-opacity duration-150 lg:max-h-none"
          style={{ opacity: glass ? 1 : 0.55 }}
        >
          <div className="shrink-0 border-b border-[var(--color-line)] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-lo)]">
                <Film size={13} strokeWidth={1.8} />
              </span>
              <div>
                <div
                  className="text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-[var(--color-text-hi)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Scene background
                </div>
                <div
                  className="text-[0.625rem] text-[var(--color-text-lo)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {glass ? "Live plate behind translucent panels" : "Enable glass to use video scenes"}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {BACKGROUND_CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className="rounded-full border px-2.5 py-1 text-[0.625rem] font-medium uppercase tracking-[0.14em] transition-colors"
                    style={{
                      fontFamily: "var(--font-sans)",
                      borderColor: active
                        ? "color-mix(in srgb, var(--color-accent) 65%, transparent)"
                        : "var(--color-line)",
                      background: active
                        ? "color-mix(in srgb, var(--color-accent) 22%, transparent)"
                        : "transparent",
                      color: active ? "var(--color-text-hi)" : "var(--color-text-lo)",
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3">
            <div
              className="mb-2 mt-3 text-[0.5625rem] font-medium uppercase tracking-[0.2em] text-[var(--color-text-lo)]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {BACKGROUND_CATEGORIES.find((c) => c.id === category)?.blurb}
            </div>
            <div
              className="grid grid-cols-2 gap-2 pb-3"
              style={{
                pointerEvents: glass || category === "plates" ? "auto" : "none",
                opacity: glass || category === "plates" ? 1 : 0.4,
              }}
            >
              {inCategory.map((bg) => (
                <BgSwatch
                  key={bg.id}
                  bg={bg}
                  active={backgroundId === bg.id}
                  onSelect={() => pickBg(bg.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  icon,
  themes,
  current,
  onPick,
}: {
  label: string;
  icon: React.ReactNode;
  themes: ThemeMeta[];
  current: ThemeId;
  onPick: (id: ThemeId) => void;
}) {
  return (
    <div className="px-3 py-3">
      <div className="mb-2.5 flex items-center gap-1.5 px-1">
        <span className="text-[var(--color-text-lo)]">{icon}</span>
        <span
          className="text-[0.625rem] font-medium uppercase tracking-[0.28em] text-[var(--color-text-lo)]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {label}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {themes.map((t) => (
          <Swatch key={t.id} theme={t} active={current === t.id} onSelect={() => onPick(t.id)} />
        ))}
      </div>
    </div>
  );
}

function Swatch({
  theme,
  active,
  onSelect,
}: {
  theme: ThemeMeta;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={theme.name}
      className="group flex flex-col items-center gap-1.5 outline-none"
    >
      <div
        className="relative h-10 w-10 rounded-[0.625rem] transition-transform duration-100 group-hover:scale-105 group-focus-visible:ring-2"
        style={{
          background: theme.bg,
          border: active
            ? `0.125rem solid ${theme.accent}`
            : "0.0625rem solid rgba(128,128,128,0.2)",
          boxShadow: active
            ? `0 0 0 0.1875rem ${theme.accent}28, 0 0.25rem 0.75rem -0.25rem rgba(0,0,0,0.4)`
            : "0 0.125rem 0.375rem -0.125rem rgba(0,0,0,0.25)",
        }}
      >
        <span
          className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full shadow-sm"
          style={{ background: theme.accent }}
        />
        {active && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Check size={13} strokeWidth={2.5} style={{ color: theme.accent }} />
          </span>
        )}
      </div>
      <span
        className="text-[0.5625rem] font-medium uppercase tracking-wide text-[var(--color-text-lo)]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {theme.name}
      </span>
    </button>
  );
}

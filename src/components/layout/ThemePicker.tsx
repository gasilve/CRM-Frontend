import { useEffect, useRef } from "react";
import { Check, Droplets, Moon, Sun } from "lucide-react";
import {
  GLASS_BLUR_MAX,
  GLASS_BLUR_MIN,
  GLASS_FIRST_BACKGROUND,
  GLASS_FIRST_THEME,
  GLASS_OPACITY_MAX,
  GLASS_OPACITY_MIN,
  THEMES,
  consumeGlassFirstEnable,
  useTheme,
} from "@/contexts/ThemeContext";
import type { ThemeId, ThemeMeta } from "@/contexts/ThemeContext";
import { useBackground } from "@/contexts/BackgroundContext";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Ref to the trigger button — excluded from outside-click detection */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
};

export function ThemePicker({ open, onClose, triggerRef }: Props) {
  const {
    themeId,
    setTheme,
    glass,
    setGlass,
    glassOpacity,
    setGlassOpacity,
    glassBlur,
    setGlassBlur,
  } = useTheme();
  const { setBackground } = useBackground();
  const panelRef = useRef<HTMLDivElement>(null);

  const toggleGlass = () => {
    const next = !glass;
    if (next && consumeGlassFirstEnable()) {
      setTheme(GLASS_FIRST_THEME);
      setBackground(GLASS_FIRST_BACKGROUND);
    }
    setGlass(next);
  };

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

  if (!open) return null;

  const darkThemes = THEMES.filter((t) => t.mode === "dark");
  const lightThemes = THEMES.filter((t) => t.mode === "light");

  const pick = (id: ThemeId) => {
    setTheme(id);
    onClose();
  };

  return (
    <div
      ref={panelRef}
      className="theme-picker-panel absolute right-0 top-full z-50 mt-2 w-[28rem] overflow-hidden rounded-[14px] border border-[var(--color-line-2)] bg-[var(--color-ink-1)] shadow-[0_20px_48px_-12px_rgba(0,0,0,var(--shadow-alpha-heavy))]"
      role="dialog"
      aria-label="Theme selector"
    >
      <div className="border-b border-[var(--color-line)] px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--color-text-lo)]">
              <Droplets size={13} strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <div
                className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-hi)]"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Glass
              </div>
              <div
                className="text-[10px] text-[var(--color-text-lo)]"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Frosted HUD over a live scene
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={glass}
            aria-label="Toggle glass theme"
            onClick={toggleGlass}
            className="relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
            style={{
              background: glass
                ? "color-mix(in srgb, var(--color-accent) 55%, transparent)"
                : "var(--color-ink-3)",
              borderColor: glass
                ? "color-mix(in srgb, var(--color-accent) 70%, transparent)"
                : "var(--color-line-2)",
              boxShadow: glass
                ? "inset 0 1px 0 rgba(255,255,255,0.25), 0 0 16px -4px var(--color-accent-glow)"
                : "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <span
              className="absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{
                width: 18,
                height: 18,
                transform: glass ? "translateX(20px)" : "translateX(0)",
                background: glass
                  ? "linear-gradient(180deg, #fff, color-mix(in srgb, var(--color-accent-2) 35%, #fff))"
                  : "#e8eef8",
              }}
            />
          </button>
        </div>

        <div
          className="mt-3 space-y-3 transition-opacity duration-150"
          style={{ opacity: glass ? 1 : 0.38, pointerEvents: glass ? "auto" : "none" }}
        >
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
              <span
                className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--color-text-lo)]"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Backdrop opacity
              </span>
              <span
                className="tabular-nums text-[10px] text-[var(--color-text-mid)]"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {glassOpacity}%
              </span>
            </div>
            <input
              type="range"
              min={GLASS_OPACITY_MIN}
              max={GLASS_OPACITY_MAX}
              step={1}
              value={glassOpacity}
              disabled={!glass}
              aria-label="Backdrop opacity"
              onChange={(e) => setGlassOpacity(Number(e.target.value))}
              className="glass-opacity-slider w-full cursor-pointer disabled:cursor-not-allowed"
            />
            <div
              className="mt-1 flex justify-between px-0.5 text-[9px] uppercase tracking-[0.16em] text-[var(--color-text-lo)]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <span>Clear</span>
              <span>Dense</span>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
              <span
                className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--color-text-lo)]"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Blur
              </span>
              <span
                className="tabular-nums text-[10px] text-[var(--color-text-mid)]"
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
              disabled={!glass}
              aria-label="Glass blur"
              onChange={(e) => setGlassBlur(Number(e.target.value))}
              className="glass-opacity-slider w-full cursor-pointer disabled:cursor-not-allowed"
            />
            <div
              className="mt-1 flex justify-between px-0.5 text-[9px] uppercase tracking-[0.16em] text-[var(--color-text-lo)]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <span>Sharp</span>
              <span>Frost</span>
            </div>
          </div>
        </div>
      </div>

      <Section
        label="Dark"
        icon={<Moon size={11} strokeWidth={1.8} />}
        themes={darkThemes}
        current={themeId}
        onPick={pick}
      />
      <div className="mx-3 h-px bg-[var(--color-line)]" />
      <Section
        label="Light"
        icon={<Sun size={11} strokeWidth={1.8} />}
        themes={lightThemes}
        current={themeId}
        onPick={pick}
      />
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
          className="text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--color-text-lo)]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {label}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {themes.map((t) => (
          <Swatch
            key={t.id}
            theme={t}
            active={current === t.id}
            onSelect={() => onPick(t.id)}
          />
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
      onClick={onSelect}
      title={theme.name}
      className="group flex flex-col items-center gap-1.5 outline-none"
    >
      <div
        className="relative h-10 w-10 rounded-[10px] transition-transform duration-100 group-hover:scale-105 group-focus-visible:ring-2"
        style={{
          background: theme.bg,
          border: active
            ? `2px solid ${theme.accent}`
            : "1px solid rgba(128,128,128,0.2)",
          boxShadow: active
            ? `0 0 0 3px ${theme.accent}28, 0 4px 12px -4px rgba(0,0,0,0.4)`
            : "0 2px 6px -2px rgba(0,0,0,0.25)",
        }}
      >
        {/* accent dot */}
        <span
          className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full shadow-sm"
          style={{ background: theme.accent }}
        />
        {active && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Check
              size={13}
              strokeWidth={2.5}
              style={{ color: theme.accent }}
            />
          </span>
        )}
      </div>
      <span
        className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-text-lo)]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {theme.name}
      </span>
    </button>
  );
}

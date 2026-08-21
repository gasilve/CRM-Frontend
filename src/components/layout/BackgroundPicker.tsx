import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Film, MapPin } from "lucide-react";
import {
  BACKGROUNDS,
  BACKGROUND_CATEGORIES,
  useBackground,
  type BackgroundCategoryId,
  type BackgroundId,
  type BackgroundMeta,
} from "@/contexts/BackgroundContext";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  /** Where the panel opens relative to the trigger (default: below, right-aligned). */
  align?: "bottom-end" | "top-start";
};

export function BackgroundPicker({ open, onClose, triggerRef, align = "bottom-end" }: Props) {
  const { backgroundId, backgroundMeta, setBackground } = useBackground();
  const { glass } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState<BackgroundCategoryId>(() =>
    backgroundMeta.category === "still" ? "cities" : backgroundMeta.category,
  );

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

  const still = useMemo((): BackgroundMeta => {
    const base = BACKGROUNDS.find((b) => b.id === "static")!;
    if (glass) return base;
    return {
      ...base,
      subtitle: "Theme backdrop",
      thumb: "",
    };
  }, [glass]);
  const inCategory = useMemo(
    () => BACKGROUNDS.filter((b) => b.category === category),
    [category],
  );

  if (!open) return null;

  const pick = (id: BackgroundId) => {
    setBackground(id);
    onClose();
  };

  return (
    <div
      ref={panelRef}
      className={`theme-picker-panel absolute z-50 w-[26rem] overflow-hidden rounded-[0.875rem] border border-[var(--color-line-2)] bg-[var(--color-ink-1)] shadow-[0_1.25rem_3rem_-0.75rem_rgba(0,0,0,var(--shadow-alpha-heavy))] ${
        align === "top-start" ? "anim-popover-bottom bottom-full left-0 mb-2" : "right-0 top-full mt-2"
      }`}
      role="dialog"
      aria-label="Background selector"
    >
      <div className="border-b border-[var(--color-line)] px-3.5 py-3">
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
              1080p Mixkit CDN loops · Cities has 20
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
                  color: active
                    ? "var(--color-text-hi)"
                    : "var(--color-text-lo)",
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-3 pt-3">
        <BgSwatch
          bg={still}
          active={backgroundId === still.id}
          onSelect={() => pick(still.id)}
          wide
          themePlate={!glass}
        />
      </div>

      <div className="px-3 pb-1 pt-2">
        <div
          className="mb-2 text-[0.5625rem] font-medium uppercase tracking-[0.2em] text-[var(--color-text-lo)]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {BACKGROUND_CATEGORIES.find((c) => c.id === category)?.blurb}
        </div>
        <div className="grid max-h-[22rem] grid-cols-2 gap-2 overflow-y-auto pb-3">
          {inCategory.map((bg) => (
            <BgSwatch
              key={bg.id}
              bg={bg}
              active={backgroundId === bg.id}
              onSelect={() => pick(bg.id)}
            />
          ))}
        </div>
      </div>

      <div
        className="border-t border-[var(--color-line)] px-3.5 py-2.5 text-[0.5625rem] leading-relaxed text-[var(--color-text-lo)]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        Royalty-free Mixkit MP4s loaded by URL (not stored in the repo). Muted,
        looping — first play needs network, then browser-cached.
      </div>
    </div>
  );
}

function BgSwatch({
  bg,
  active,
  onSelect,
  wide,
  themePlate,
}: {
  bg: BackgroundMeta;
  active: boolean;
  onSelect: () => void;
  wide?: boolean;
  /** Still preview: solid theme radial instead of the glass city plate */
  themePlate?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${bg.name} — ${bg.subtitle}`}
      className={
        wide
          ? "group flex w-full overflow-hidden rounded-[0.75rem] border text-left outline-none transition-transform duration-100 hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
          : "group flex flex-col overflow-hidden rounded-[0.75rem] border text-left outline-none transition-transform duration-100 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
      }
      style={{
        borderColor: active
          ? "color-mix(in srgb, var(--color-accent) 70%, transparent)"
          : "var(--color-line)",
        boxShadow: active
          ? "0 0 0 0.125rem color-mix(in srgb, var(--color-accent) 28%, transparent)"
          : undefined,
      }}
    >
      <div
        className={
          wide
            ? "relative aspect-[21/7] w-full overflow-hidden bg-[var(--color-ink-2)]"
            : "relative aspect-[16/10] overflow-hidden bg-[var(--color-ink-2)]"
        }
      >
        {bg.videoSrc ? (
          <video
            src={bg.videoSrc}
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
            onMouseEnter={(e) => {
              void e.currentTarget.play().catch(() => {});
            }}
            onMouseLeave={(e) => {
              e.currentTarget.pause();
              e.currentTarget.currentTime = 0;
            }}
          />
        ) : themePlate ? (
          <div
            aria-hidden
            className="h-full w-full opacity-95 transition-opacity group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(58% 44% at 50% 56%, var(--color-bg-tint), var(--color-ink-1) 62%, var(--color-ink-0) 100%), var(--color-ink-0)",
            }}
          />
        ) : (
          <img
            src={bg.thumb}
            alt=""
            className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
            loading="lazy"
          />
        )}
        {bg.videoSrc && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[0.5rem] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
            1080p
          </span>
        )}
        {active && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <Check size={16} strokeWidth={2.5} className="text-white drop-shadow" />
          </span>
        )}
      </div>
      <div className={`flex items-start gap-1.5 ${wide ? "px-3 py-2" : "px-2 py-1.5"}`}>
        <MapPin
          size={11}
          strokeWidth={1.8}
          className="mt-0.5 shrink-0 text-[var(--color-text-lo)]"
        />
        <div className="min-w-0">
          <div
            className="truncate text-[0.6875rem] font-medium text-[var(--color-text-hi)]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {bg.name}
          </div>
          <div
            className="truncate text-[0.5625rem] text-[var(--color-text-lo)]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {bg.subtitle}
          </div>
        </div>
      </div>
    </button>
  );
}

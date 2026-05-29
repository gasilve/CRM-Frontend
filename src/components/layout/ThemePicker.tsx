import { useEffect, useRef } from "react";
import { Check, Moon, Sun } from "lucide-react";
import { THEMES, useTheme } from "@/contexts/ThemeContext";
import type { ThemeId, ThemeMeta } from "@/contexts/ThemeContext";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Ref to the trigger button — excluded from outside-click detection */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
};

export function ThemePicker({ open, onClose, triggerRef }: Props) {
  const { themeId, setTheme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

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

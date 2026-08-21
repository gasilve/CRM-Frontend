/**
 * Temporary chooser for the pending-case detail layouts. Sits above the page so
 * the designs can be compared on real data; drop it once one is picked.
 */
import { useEffect, useState } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import { cn } from "@/lib/cn";
import { DEFAULT_DESIGN, PENDING_CASE_DESIGNS, isDesignId, type DesignId } from "./designs";

const STORAGE_KEY = "accenty.pendingCaseDesign";

export const loadDesign = (): DesignId => {
  if (typeof window === "undefined") return DEFAULT_DESIGN;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isDesignId(stored) ? stored : DEFAULT_DESIGN;
};

export const saveDesign = (id: DesignId): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private browsing and similar — the choice just will not persist.
  }
};

export function DesignSwitcher({ value, onChange }: { value: DesignId; onChange: (id: DesignId) => void }) {
  const [open, setOpen] = useState(false);
  const active = PENDING_CASE_DESIGNS.find((entry) => entry.id === value) ?? PENDING_CASE_DESIGNS[0];
  const activeIndex = PENDING_CASE_DESIGNS.indexOf(active);

  // 1–6 jump straight to a design; ⌥/Alt + arrows step through them.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      if (event.altKey && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        event.preventDefault();
        const step = event.key === "ArrowRight" ? 1 : -1;
        const next = (activeIndex + step + PENDING_CASE_DESIGNS.length) % PENDING_CASE_DESIGNS.length;
        onChange(PENDING_CASE_DESIGNS[next].id);
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const slot = Number.parseInt(event.key, 10);
      if (Number.isNaN(slot) || slot < 1 || slot > PENDING_CASE_DESIGNS.length) return;
      onChange(PENDING_CASE_DESIGNS[slot - 1].id);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, onChange]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="surface anim-popover-bottom w-[19rem] overflow-hidden p-1.5 shadow-[0_1.5rem_3rem_-1rem_rgba(0,0,0,0.7)]">
          <div className="px-2.5 py-2">
            <span className="eyebrow">Pick a layout</span>
            <p className="mt-1 text-[0.65625rem] leading-snug text-[var(--color-text-lo)]">
              Press 1–6, or ⌥← / ⌥→ to cycle. Your pick is remembered.
            </p>
          </div>

          <div className="flex flex-col gap-0.5">
            {PENDING_CASE_DESIGNS.map((entry, index) => {
              const selected = entry.id === value;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onChange(entry.id)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-[0.5rem] px-2.5 py-2 text-left transition-colors",
                    selected ? "bg-[var(--color-accent-soft)]" : "hover:bg-white/[0.04]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-px grid h-4 w-4 shrink-0 place-items-center rounded-[0.25rem] font-mono text-[0.5625rem]",
                      selected
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[var(--color-ink-4)] text-[var(--color-text-lo)]",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-[0.78125rem]",
                        selected ? "text-[var(--color-text-hi)]" : "text-[var(--color-text-mid)]",
                      )}
                    >
                      {entry.name}
                    </span>
                    <span className="mt-0.5 block text-[0.625rem] leading-snug text-[var(--color-text-lo)]">
                      {entry.blurb}
                    </span>
                  </span>
                  {selected && <Check size={12} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[var(--color-accent-2)]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="surface inline-flex items-center gap-2 rounded-full py-2 pl-3 pr-2.5 text-[0.75rem] text-[var(--color-text-mid)] shadow-[0_1rem_2rem_-0.75rem_rgba(0,0,0,0.7)] transition-colors hover:text-[var(--color-text-hi)]"
      >
        <Palette size={13} strokeWidth={1.8} className="text-[var(--color-accent-2)]" />
        <span className="font-mono text-[0.6875rem] uppercase tracking-wider">{active.name}</span>
        <span className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">
          {activeIndex + 1}/{PENDING_CASE_DESIGNS.length}
        </span>
        <ChevronDown size={13} strokeWidth={1.8} className={cn("anim-rotate", open && "rotate-180")} />
      </button>
    </div>
  );
}

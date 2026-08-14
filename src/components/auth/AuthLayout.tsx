import { useRef, useState, type ReactNode } from "react";
import { Palette } from "lucide-react";
import { LiveBackground } from "@/components/layout/LiveBackground";
import { ThemePicker } from "@/components/layout/ThemePicker";

export default function AuthLayout({
  children,
  eyebrow,
  title,
  subtitle,
  maxWidth = "32rem",
  maxHeight,
  showThemePicker = false,
}: {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  /** Caps card height (e.g. "calc(100vh - 4rem)") and makes it internally scrollable — for content-heavy screens. */
  maxHeight?: string;
  showThemePicker?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const themeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[var(--color-ink-0)] px-4 py-10 text-[var(--color-text-hi)]">
      <LiveBackground />
      <div className="atmo atmo-glass-scene" aria-hidden />
      <div className="atmo atmo-radial" aria-hidden />
      <div className="atmo atmo-vignette" aria-hidden />

      {showThemePicker ? (
        <div className="absolute right-4 top-4 z-20">
          <div className="relative">
            <button
              ref={themeButtonRef}
              type="button"
              aria-label="Choose theme"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-1)]/70 text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] aria-expanded:border-[var(--color-line-3)] aria-expanded:text-[var(--color-text-hi)]"
            >
              <Palette size={16} strokeWidth={1.6} />
            </button>
            <ThemePicker open={pickerOpen} onClose={() => setPickerOpen(false)} triggerRef={themeButtonRef} />
          </div>
        </div>
      ) : null}

      <div className="relative z-10 w-full" style={{ maxWidth }}>
        <div
          className="surface auth-surface p-7 sm:p-10"
          style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
        >
          {eyebrow ? <div className="eyebrow mb-2 text-center">{eyebrow}</div> : null}
          <h1 className="editorial text-center text-[1.75rem] leading-tight text-[var(--color-text-hi)] sm:text-[2.25rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-center text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)] sm:text-[0.9375rem]">
              {subtitle}
            </p>
          ) : null}
          <div className="mt-6 sm:mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

import { Image, Palette, Search } from "lucide-react";
import { useRef, useState } from "react";
import { BackgroundPicker } from "./BackgroundPicker";
import { ThemePicker } from "./ThemePicker";

export default function TopBar() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const bgButtonRef = useRef<HTMLButtonElement>(null);

  const chromeActiveStyle = (on: boolean) =>
    on
      ? {
          borderColor: "color-mix(in srgb, var(--color-accent) 55%, var(--color-line))",
          color: "var(--color-text-hi)",
          boxShadow:
            "inset 0 1px 0 var(--color-surface-shine), 0 0 18px -6px var(--color-accent-glow)",
          background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
        }
      : undefined;

  return (
    <header className="app-topbar relative z-40 flex h-[var(--shell-chrome-height)] shrink-0 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-ink-0)] px-6">
      {/* Search */}
      <div className="group relative flex h-10 w-full max-w-[800px] flex-1 items-center gap-3 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-ink-2)]/70 px-3.5 transition-colors focus-within:border-[var(--color-line-2)]">
        <Search size={15} strokeWidth={1.6} className="shrink-0 text-[var(--color-text-lo)]" />
        <input
          type="search"
          placeholder="Search investigators, cases, clients…"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Theme picker trigger */}
        <div className="relative">
          <button
            ref={themeButtonRef}
            aria-label="Choose theme"
            aria-expanded={pickerOpen}
            onClick={() => {
              setPickerOpen((v) => !v);
              setBgOpen(false);
            }}
            className="grid h-10 w-10 place-items-center rounded-[10px] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] aria-expanded:border-[var(--color-line-3)] aria-expanded:text-[var(--color-text-hi)]"
            style={chromeActiveStyle(pickerOpen)}
          >
            <Palette size={16} strokeWidth={1.6} />
          </button>
          <ThemePicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            triggerRef={themeButtonRef}
          />
        </div>

        {/* Live background picker */}
        <div className="relative">
          <button
            ref={bgButtonRef}
            aria-label="Choose background"
            aria-expanded={bgOpen}
            onClick={() => {
              setBgOpen((v) => !v);
              setPickerOpen(false);
            }}
            className="grid h-10 w-10 place-items-center rounded-[10px] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] aria-expanded:border-[var(--color-line-3)] aria-expanded:text-[var(--color-text-hi)]"
            style={chromeActiveStyle(bgOpen)}
          >
            <Image size={16} strokeWidth={1.6} />
          </button>
          <BackgroundPicker
            open={bgOpen}
            onClose={() => setBgOpen(false)}
            triggerRef={bgButtonRef}
          />
        </div>

        {/* Profile */}
        <div className="ml-1 flex h-10 items-center gap-3 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-ink-2)]/60 py-1 pl-1 pr-3.5">
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-medium text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))",
            }}
          >
            TM
          </div>
          <div className="hidden text-left leading-tight lg:block">
            <div className="text-[13.5px] font-medium text-[var(--color-text-hi)]">
              Todd Montgomery
            </div>
            <div className="text-[11px] text-[var(--color-text-lo)]">President</div>
          </div>
        </div>
      </div>
    </header>
  );
}

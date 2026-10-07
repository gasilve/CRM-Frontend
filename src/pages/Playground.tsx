import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { PATTERN_FRAME_PX, PATTERN_GRID_CELLS, type PatternTheme } from "@/lib/pattern-size";
import { catalogForTheme, renderPattern } from "@/components/widgets/patterns";
import { PatternPlayground } from "@/components/widgets/patterns/PatternPlayground";
import { WidgetMappingLab } from "@/components/widgets/patterns/WidgetMappingLab";
import { WidgetSizeProvider } from "@/lib/widget-size";
import { WidgetBridgeSync, WidgetTreeProviders } from "@/lib/widget-bridge";
import { WidgetErrorBoundary } from "@/components/widgets/WidgetErrorBoundary";
import { WIDGET_LIST, type WidgetDef } from "@/pages/dashboard-widgets";

type MainTab = "playground" | "catalog" | "mapping";
type CatalogKind = "templates" | "widgets";

/**
 * Developer Playground — GridStack sandbox + template/widget galleries + mapping lab.
 * Dev + Valentin only (see canAccessPatternLab).
 */
export default function Playground() {
  const [mainTab, setMainTab] = useState<MainTab>("playground");
  const [catalogKind, setCatalogKind] = useState<CatalogKind>("templates");
  const [theme, setTheme] = useState<PatternTheme>("glass");
  const catalog = useMemo(() => catalogForTheme(theme), [theme]);

  return (
    <div className="flex flex-col gap-8 pb-16">
      <WidgetBridgeSync />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Playground</h1>
          <p className="mt-2 max-w-2xl font-mono text-[0.6875rem] leading-relaxed text-[var(--color-text-lo)]">
            Drag-resize sandbox, template & widget galleries, and widget→template mapping proposals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[0.5rem] border border-[var(--color-line)] p-0.5">
            {(
              [
                ["playground", "Playground"],
                ["catalog", "Catalog"],
                ["mapping", "Mapping"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMainTab(id)}
                className={cn(
                  "rounded-[0.375rem] px-2.5 py-1.5 font-mono text-[0.5625rem] uppercase tracking-wider transition-colors",
                  mainTab === id
                    ? "bg-[var(--color-accent)] text-[var(--color-ink-1)]"
                    : "text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {mainTab === "playground" ? (
        <div className="flex flex-col gap-4">
          <div className="flex self-start rounded-[0.5rem] border border-[var(--color-line)] p-0.5">
            {(
              [
                ["glass", "Theme A · Glass"],
                ["buzz", "Theme B · Buzz"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={cn(
                  "rounded-[0.375rem] px-2.5 py-1.5 font-mono text-[0.5625rem] uppercase tracking-wider transition-colors",
                  theme === id
                    ? "bg-[var(--color-ink-3)] text-[var(--color-text-hi)]"
                    : "text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <PatternPlayground theme={theme} />
        </div>
      ) : mainTab === "mapping" ? (
        <WidgetMappingLab />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-[0.5rem] border border-[var(--color-line)] p-0.5">
              {(
                [
                  ["templates", "A · Templates"],
                  ["widgets", "Widgets"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCatalogKind(id)}
                  className={cn(
                    "rounded-[0.375rem] px-2.5 py-1.5 font-mono text-[0.5625rem] uppercase tracking-wider transition-colors",
                    catalogKind === id
                      ? "bg-[var(--color-ink-3)] text-[var(--color-text-hi)]"
                      : "text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {catalogKind === "templates" && (
              <div className="flex rounded-[0.5rem] border border-[var(--color-line)] p-0.5">
                {(
                  [
                    ["glass", "Theme A · Glass"],
                    ["buzz", "Theme B · Buzz"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTheme(id)}
                    className={cn(
                      "rounded-[0.375rem] px-2.5 py-1.5 font-mono text-[0.5625rem] uppercase tracking-wider transition-colors",
                      theme === id
                        ? "bg-[var(--color-accent)] text-[var(--color-ink-1)]"
                        : "text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {catalogKind === "templates"
            ? catalog.map((pattern) => (
                <section key={pattern.id} className="flex flex-col gap-3">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h2 className="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-[var(--color-text-hi)]">
                        {pattern.label}
                      </h2>
                      <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                        {pattern.folder}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[0.625rem] text-[var(--color-text-lo)]">{pattern.blurb}</p>
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
                    {pattern.sizes.map((size) => {
                      const { w, h } = PATTERN_FRAME_PX[size];
                      const cells = PATTERN_GRID_CELLS[size];
                      return (
                        <div
                          key={size}
                          className="flex flex-col gap-1.5"
                          style={{ gridColumn: `span ${Math.min(12, cells.cols)}` }}
                        >
                          <div className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                            {pattern.id} · {size} · ~{cells.cols}×{cells.rows} cells
                          </div>
                          <div style={{ width: "100%", maxWidth: w, height: h }} className="min-w-0">
                            {renderPattern(pattern.id, size, theme)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            : WIDGET_LIST.map((widget) => <WidgetGalleryRow key={widget.id} widget={widget} />)}
        </div>
      )}
    </div>
  );
}

function WidgetGalleryRow({ widget }: { widget: WidgetDef }) {
  const footprints = [
    { label: "S", cols: Math.max(widget.minW, 3), rows: Math.max(widget.minH, 2) },
    { label: "M", cols: widget.defaultW, rows: widget.defaultH },
    {
      label: "L",
      cols: Math.min(12, Math.max(widget.defaultW + 2, 6)),
      rows: Math.max(widget.defaultH + 1, 4),
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-[var(--color-text-hi)]">
            {widget.label}
          </h2>
          <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            {widget.folder}
          </span>
        </div>
        <p className="mt-1 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
          {widget.id} · min {widget.minW}×{widget.minH} · default {widget.defaultW}×{widget.defaultH}
        </p>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
        {footprints.map((fp) => {
          const w = Math.round((fp.cols / 12) * 960);
          const h = fp.rows * 84 - 8;
          return (
            <div
              key={fp.label}
              className="flex flex-col gap-1.5"
              style={{ gridColumn: `span ${Math.min(12, fp.cols)}` }}
            >
              <div className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                {widget.id} · {fp.label} · ~{fp.cols}×{fp.rows} cells
              </div>
              <div
                style={{ width: "100%", maxWidth: w, height: h }}
                className="min-w-0 overflow-hidden rounded-[0.75rem] border border-[var(--color-line)]"
              >
                <div className="widget-frame h-full w-full">
                  <div className="widget-body h-full w-full">
                    <WidgetErrorBoundary name={widget.id}>
                      <WidgetTreeProviders>
                        <WidgetSizeProvider>{widget.render()}</WidgetSizeProvider>
                      </WidgetTreeProviders>
                    </WidgetErrorBoundary>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

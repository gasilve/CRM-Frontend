import { useState, type ReactNode } from "react";
import { CloudSun, Layers, MapPin, Pause, Play, Search, SkipBack, SkipForward, ZoomIn } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PatternDef, PatternId, PatternSize } from "@/lib/pattern-size";
import { slotsForSize } from "@/lib/pattern-size";
import {
  MockBar,
  MockMetric,
  MockPill,
  MockRailRow,
  MoreFooter,
  PatternExpandModal,
  PatternFrame,
} from "./PatternChrome";

const NAMES = ["Tomas Herrera", "Steven Quinones", "Avery Cole", "Jordan Lee", "Sam Okonkwo", "Riley Chen"];
const CASES = ["C-5001", "C-5008", "C-5012", "C-5019", "C-5022", "C-5030"];
const COMPANIES = ["Hartford", "Travelers", "Applied UW", "Liberty", "AmTrust", "Gallagher"];
const HEADLINES = [
  "NDIS data may have ended up in Palantir systems",
  "Vasquez v. Aguilar — surveillance privacy holding",
  "Four SoCal drivers accused in staged collision ring",
  "DOI bulletin: SIU referral thresholds updated",
  "Wiretap evidence suppressed in multi-claim fraud probe",
  "Carrier intel brief: synthetic identity rings in TX",
];

const TIMELINE = [
  { time: "09:14", title: "SIU referral opened", detail: "C-5001 · staged loss pattern" },
  { time: "10:42", title: "Surveillance footage ingested", detail: "3 clips · Hartford claim" },
  { time: "13:05", title: "Cross-carrier match flagged", detail: "Jordan Lee · prior C-4892" },
  { time: "15:30", title: "DOI bulletin correlated", detail: "SIU thresholds updated" },
  { time: "16:18", title: "Analyst note added", detail: "Fraud ring probability ↑" },
  { time: "17:02", title: "Field interview scheduled", detail: "Tomas Herrera · tomorrow" },
];

const KEY_VALUES = [
  { label: "Claimant", value: "Tomas Herrera" },
  { label: "Case ID", value: "C-5001" },
  { label: "Carrier", value: "Hartford" },
  { label: "Loss date", value: "2024-11-12" },
  { label: "SIU status", value: "Active review" },
  { label: "Referral", value: "Staged collision" },
  { label: "Jurisdiction", value: "CA · SoCal" },
  { label: "Analyst", value: "Riley Chen" },
];

const STAGES = ["Intake", "Triage", "Surveillance", "SIU", "Legal", "Closed"];
const SPARKLINE = [18, 16, 19, 17, 22, 21, 26, 24, 29, 31, 30, 38];

function takeSlots(size: PatternSize, rowPx = 48, reserved = 56) {
  return slotsForSize(size, rowPx, reserved);
}

function Sparkline({ className, strokeWidth = 1.75 }: { className?: string; strokeWidth?: number }) {
  // Mild upward trend with a mid dip — reads as a pulse at any aspect ratio.
  const series = SPARKLINE;
  const w = 100;
  const h = 40;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;
  const points = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("h-full w-full text-[var(--color-accent)]", className)}
      aria-hidden
    >
      <polygon fill="currentColor" opacity="0.12" points={area} />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function FocalStat({ size }: { size: PatternSize }) {
  // M fills the box: hero + two companion stats (avoids a lonely number in a tall void).
  if (size === "M") {
    return (
      <PatternFrame title="Focal Stat" size={size}>
        <div className="grid h-full min-h-0 grid-cols-[1.2fr_1fr] gap-2">
          <div className="flex min-h-0 flex-col justify-center gap-1.5 rounded-[0.75rem] border border-[var(--color-line-2)] bg-[color-mix(in_srgb,var(--color-ink-3)_45%,transparent)] px-3 py-2">
            <div className="editorial text-[2.25rem] leading-none tabular-nums text-[var(--color-text-hi)]">47</div>
            <div className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-[var(--color-text-lo)]">Open cases</div>
          </div>
          <div className="grid min-h-0 grid-rows-2 gap-2">
            <MockMetric value="12" label="Rush" tone="#f59e0b" dense />
            <MockMetric value="8" label="Overdue" tone="#f87171" dense />
          </div>
        </div>
      </PatternFrame>
    );
  }
  return (
    <PatternFrame title="Focal Stat" size={size}>
      <div className="flex h-full min-h-0 flex-col justify-center gap-2">
        <div
          className={cn(
            "editorial leading-none tracking-tight tabular-nums text-[var(--color-text-hi)]",
            size === "XS" ? "text-[1.75rem]" : "text-[2.5rem]",
          )}
        >
          47
        </div>
        <div className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--color-text-lo)]">Open cases</div>
        {size === "S" && <div className="text-[0.75rem] text-[var(--color-text-mid)]">12 rush · 8 overdue</div>}
      </div>
    </PatternFrame>
  );
}

function FocalFeature({ size }: { size: PatternSize }) {
  return (
    <PatternFrame title="Focal Feature" size={size} padded={false}>
      <button
        type="button"
        className="relative flex h-full min-h-0 w-full flex-col justify-end overflow-hidden bg-[linear-gradient(165deg,#0f172a_0%,#1e3a5f_55%,#0ea5e9_140%)] text-left"
      >
        <div className="absolute inset-0 opacity-35" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #38bdf8 0%, transparent 50%)" }} />
        <div className="relative z-10 w-full border-t border-white/10 bg-[linear-gradient(to_top,rgba(15,23,42,0.92),rgba(15,23,42,0.55))] px-3 py-2.5 backdrop-blur-sm">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <MockPill>Intel</MockPill>
            <span className="font-mono text-[0.5rem] text-white/60">2h ago</span>
          </div>
          <div
            className={cn(
              "font-medium leading-snug text-white",
              size === "XS" ? "line-clamp-2 text-[0.75rem]" : "line-clamp-3 text-[0.875rem]",
            )}
          >
            {HEADLINES[0]}
          </div>
        </div>
      </button>
    </PatternFrame>
  );
}

function MetricStrip({ size }: { size: PatternSize }) {
  const metrics = [
    { v: "47", l: "Open" },
    { v: "8", l: "Overdue", t: "#f87171" },
    { v: "12", l: "Rush", t: "#f59e0b" },
    { v: "3", l: "Suspended" },
  ];
  if (size === "L") {
    return (
      <PatternFrame title="Metric Strip" size={size}>
        <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-2">
          {metrics.map((m) => (
            <MockMetric key={m.l} value={m.v} label={m.l} tone={m.t} />
          ))}
        </div>
      </PatternFrame>
    );
  }
  const count = size === "S" ? 2 : 3;
  const row = metrics.slice(0, count);
  return (
    <PatternFrame title="Metric Strip" size={size}>
      <div className="grid h-full min-h-0 gap-1.5" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {row.map((m) => (
          <MockMetric key={m.l} value={m.v} label={m.l} tone={m.t} dense />
        ))}
      </div>
    </PatternFrame>
  );
}

function StackList({ size }: { size: PatternSize }) {
  const [open, setOpen] = useState(false);
  const cozy = size === "L";
  const rowPx = cozy ? 52 : 48;
  const reserved = cozy ? 64 : size === "S" ? 40 : 56;
  const n = takeSlots(size, rowPx, reserved);
  const items = NAMES.map((name, i) => ({
    name,
    caseId: CASES[i],
    accent: i === 0 ? "#f87171" : "var(--color-accent)",
    meta: i === 0 ? <MockPill color="#f87171">40d late</MockPill> : undefined,
  }));
  const visible = items.slice(0, n);
  const overflow = items.length - n;

  return (
    <PatternFrame title="Stack List" size={size}>
      <div className={cn("flex min-h-0 flex-1 flex-col", cozy ? "gap-2" : "gap-1.5")}>
        {visible.map((item) => (
          <MockRailRow
            key={item.name}
            title={item.name}
            subtitle={`${item.caseId} · Workers Comp`}
            accent={item.accent}
            meta={item.meta}
            cozy={cozy}
            onClick={() => setOpen(true)}
          />
        ))}
        <MoreFooter count={overflow} onClick={() => setOpen(true)} />
      </div>
      <PatternExpandModal title="Stack List" open={open} onClose={() => setOpen(false)}>
        {items.map((item) => (
          <MockRailRow
            key={item.name}
            title={item.name}
            subtitle={`${item.caseId} · Workers Comp`}
            accent={item.accent}
            meta={item.meta}
            cozy
          />
        ))}
      </PatternExpandModal>
    </PatternFrame>
  );
}

function CardList({ size }: { size: PatternSize }) {
  const [open, setOpen] = useState(false);
  // Fit content to band height: S/M keep titles readable; summary only when XL has room.
  const showSummary = size === "XL";
  const n = size === "S" ? 2 : size === "M" ? 2 : size === "L" ? 3 : 3;
  const titleClamp = size === "S" ? "line-clamp-1" : "line-clamp-2";
  const cards = HEADLINES.map((h, i) => ({
    headline: h,
    pill: i % 2 ? "Case law" : "Regulation",
    color: i % 2 ? "#a78bfa" : "var(--color-warn)",
    ago: `${i + 1}h ago`,
  }));
  const visible = cards.slice(0, n);
  const overflow = cards.length - n;

  return (
    <PatternFrame title="Card List" size={size}>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        {visible.map((card) => (
          <button
            key={card.headline}
            type="button"
            onClick={() => setOpen(true)}
            className="relative flex min-h-0 w-full flex-1 flex-col justify-center overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_40%,transparent)] px-2.5 py-1.5 text-left transition-colors hover:border-[var(--color-line-2)]"
          >
            <span className="absolute inset-y-1.5 left-0 w-[0.18rem] rounded-full" style={{ background: card.color }} aria-hidden />
            <div className="flex shrink-0 items-center gap-1.5 pl-2">
              <MockPill color={card.color}>{card.pill}</MockPill>
              <span className="ml-auto shrink-0 font-mono text-[0.5rem] text-[var(--color-text-lo)]">{card.ago}</span>
            </div>
            <div className={cn("mt-0.5 pl-2 text-[0.75rem] font-medium leading-snug text-[var(--color-text-hi)]", titleClamp)}>
              {card.headline}
            </div>
            {showSummary && (
              <div className="mt-0.5 line-clamp-1 pl-2 text-[0.625rem] leading-snug text-[var(--color-text-mid)]">
                Fraud intel cross-reference — supporting summary when height allows.
              </div>
            )}
          </button>
        ))}
        <MoreFooter count={overflow} onClick={() => setOpen(true)} />
      </div>
      <PatternExpandModal title="Card List" open={open} onClose={() => setOpen(false)}>
        {cards.map((card) => (
          <div
            key={card.headline}
            className="relative overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_40%,transparent)] px-2.5 py-2"
          >
            <span className="absolute inset-y-1.5 left-0 w-[0.18rem] rounded-full" style={{ background: card.color }} aria-hidden />
            <div className="mb-1 flex gap-1.5 pl-2">
              <MockPill color={card.color}>{card.pill}</MockPill>
              <span className="ml-auto font-mono text-[0.5rem] text-[var(--color-text-lo)]">{card.ago}</span>
            </div>
            <div className="pl-2 text-[0.78125rem] font-medium leading-snug text-[var(--color-text-hi)]">{card.headline}</div>
          </div>
        ))}
      </PatternExpandModal>
    </PatternFrame>
  );
}

function SplitPrimarySecondary({ size }: { size: PatternSize }) {
  // Always side-by-side at L+ with ~50/50 so secondary isn't crushed.
  return (
    <PatternFrame title="Split Primary / Secondary" size={size}>
      <div className="flex h-full min-h-0 flex-row gap-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
          <div className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Primary</div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5">
            <MockMetric value="47" label="Open" />
            <MockMetric value="8" label="Overdue" tone="#f87171" />
            <MockMetric value="12" label="Rush" tone="#f59e0b" />
            <MockMetric value="3" label="Suspended" />
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 border-l border-[var(--color-line)] pl-3">
          <div className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Secondary</div>
          <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1">
            <MockBar label="Surveil" value={18} max={18} />
            <MockBar label="WC" value={12} max={18} />
            <MockBar label="Social" value={7} max={18} />
            <MockBar label="FMLA" value={4} max={18} />
            {size === "XL" && (
              <>
                <MockBar label="BG" value={5} max={18} />
                <MockBar label="Other" value={2} max={18} />
              </>
            )}
          </div>
        </div>
      </div>
    </PatternFrame>
  );
}

function MetricOverList({ size }: { size: PatternSize }) {
  const [open, setOpen] = useState(false);
  // Keep metrics compact; list gets the leftover height (M was overlapping before).
  const listSlots = size === "M" ? 2 : size === "L" ? 3 : 4;
  const items = NAMES.map((name, i) => ({ name, company: COMPANIES[i] }));
  const visible = items.slice(0, listSlots);
  const overflow = items.length - listSlots;

  return (
    <PatternFrame title="Metric over List" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-1.5">
        <div className="grid shrink-0 grid-cols-3 gap-1.5">
          <MockMetric value="1" label="Pending" tone="var(--color-warn)" align="center" dense />
          <MockMetric value="12" label="Active" align="center" dense />
          <MockMetric value="8" label="Overdue" tone="var(--color-neg)" align="center" dense />
        </div>
        <div className="shrink-0 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Inbox</div>
        <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1 overflow-hidden">
          {visible.map((item) => (
            <MockRailRow
              key={item.name}
              title={item.name}
              subtitle={`${item.company} · 2d ago`}
              accent="var(--color-warn)"
              cozy
              onClick={() => setOpen(true)}
            />
          ))}
          <MoreFooter count={overflow} onClick={() => setOpen(true)} />
        </div>
      </div>
      <PatternExpandModal title="Metric over List" open={open} onClose={() => setOpen(false)}>
        {items.map((item) => (
          <MockRailRow key={item.name} title={item.name} subtitle={`${item.company} · 2d ago`} accent="var(--color-warn)" cozy />
        ))}
      </PatternExpandModal>
    </PatternFrame>
  );
}

function MetricOverBars({ size }: { size: PatternSize }) {
  const bars = size === "M" ? 3 : size === "L" ? 4 : 6;
  const data = [
    ["Local", 42],
    ["Wasabi", 18],
    ["None", 4],
    ["Archive", 9],
    ["Vault", 6],
    ["Other", 2],
  ] as const;
  return (
    <PatternFrame title="Metric over Bars" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-1.5">
        {/* Metrics stay a short strip; bars own the vertical growth on L/XL */}
        <div className="grid shrink-0 grid-cols-3 gap-1.5">
          <MockMetric value="64" label="Total" align="center" dense />
          <MockMetric value="4" label="24h" align="center" dense />
          <MockMetric value="4" label="Failed" tone="var(--color-neg)" align="center" dense />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="shrink-0 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Storage</div>
          <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1.5">
            {data.slice(0, bars).map(([l, v]) => (
              <MockBar key={l} label={l} value={v} max={42} />
            ))}
          </div>
        </div>
      </div>
    </PatternFrame>
  );
}

function BarsFill({ size }: { size: PatternSize }) {
  const n = size === "S" ? 4 : size === "M" ? 6 : 9;
  const data = [
    ["Pending", 1],
    ["Fetched", 7],
    ["In progress", 3],
    ["Completed", 12],
    ["Skipped", 2],
    ["Stuck", 1],
    ["Queued", 4],
    ["Review", 5],
    ["Archived", 8],
  ] as const;
  return (
    <PatternFrame title="Bars Fill" size={size}>
      <div className="flex h-full min-h-0 flex-col justify-evenly gap-1">
        {data.slice(0, n).map(([l, v]) => (
          <MockBar key={l} label={l} value={v} max={12} />
        ))}
      </div>
    </PatternFrame>
  );
}

function MediaBleed({ size }: { size: PatternSize }) {
  return (
    <PatternFrame title="Media Bleed" size={size} padded={false}>
      <div className="relative h-full min-h-0 w-full overflow-hidden bg-[linear-gradient(145deg,#0f172a,#1e293b_40%,#0ea5e9_140%)]">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 40%, #38bdf8 0%, transparent 45%), radial-gradient(circle at 70% 60%, #64748b 0%, transparent 40%)",
          }}
        />
        <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-2)]/90 p-1 backdrop-blur">
          {["All", "CA", "TX"].map((r, i) => (
            <span
              key={r}
              className={cn(
                "rounded-[0.5rem] px-2 py-1 font-mono text-[0.5625rem] uppercase tracking-wider",
                i === 0 ? "bg-[var(--color-accent)] text-[var(--color-ink-1)]" : "text-[var(--color-text-mid)]",
              )}
            >
              {r}
            </span>
          ))}
        </div>
        <div className="absolute bottom-3 left-3 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 font-mono text-[0.5625rem] text-white/90 backdrop-blur">
          12 pins · mock map plane
        </div>
        {(size === "L" || size === "XL") && (
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f87171] shadow-[0_0_0_6px_rgba(248,113,113,0.25)]" />
        )}
      </div>
    </PatternFrame>
  );
}

function Roster({ size }: { size: PatternSize }) {
  const n = takeSlots(size, 40, 40);
  const centered = size === "L" || size === "XL";
  return (
    <PatternFrame title="Roster" size={size}>
      <div className={cn("flex min-h-0 flex-1 flex-col gap-1", centered && "justify-center")}>
        {NAMES.slice(0, n).map((name, i) => (
          <div key={name} className="flex min-w-0 items-center justify-between gap-2 rounded-[0.5rem] px-1 py-1.5">
            <span className="truncate text-[0.78125rem] text-[var(--color-text-hi)]">{name}</span>
            <span className="shrink-0 font-mono text-[0.5625rem] text-[var(--color-text-lo)]">{CASES[i]}</span>
          </div>
        ))}
      </div>
    </PatternFrame>
  );
}

function Ask({ size }: { size: PatternSize }) {
  const showAnswer = size === "XL";
  const showChips = size === "M" || size === "L";
  const centerS = size === "S";
  const chips = ["CA privacy", "SIU fraud", "FMLA abuse", "workers comp SIU"];
  return (
    <PatternFrame title="Ask" size={size}>
      <div className={cn("flex h-full min-h-0 flex-col gap-2.5", centerS && "justify-center")}>
        <div className="flex shrink-0 gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 px-2.5 py-2 text-[0.75rem] text-[var(--color-text-lo)]">
            <Search size={12} className="shrink-0 opacity-60" />
            <span className="truncate">e.g. CA surveillance privacy…</span>
          </div>
          <div className="shrink-0 rounded-[0.5rem] border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-3 py-2 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-hi)]">
            Ask
          </div>
        </div>
        {showChips && !showAnswer && (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
            <p className="text-center font-mono text-[0.625rem] text-[var(--color-text-lo)]">
              Searches published intel · cached 48h · no AI cost by default
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {chips.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-[var(--color-line)] px-2.5 py-1 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-mid)]"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {showAnswer && (
          <div className="min-h-0 flex-1 overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/30 p-2.5">
            <div className="mb-2 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
              Cached · 11 left today
            </div>
            <p className="text-[0.75rem] leading-relaxed text-[var(--color-text-hi)]">
              Based on the curated library (not a live model call): Vasquez v. Aguilar is the leading post-2020 holding
              for SIU teams on CA surveillance privacy…
            </p>
            <ul className="mt-3 space-y-1 border-t border-[var(--color-line)] pt-2">
              {HEADLINES.slice(0, 2).map((h) => (
                <li key={h} className="truncate text-[0.6875rem] text-[var(--color-accent)]">{h}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </PatternFrame>
  );
}

function ChromeFeed({ size }: { size: PatternSize }) {
  const isXl = size === "XL";
  const tabs = isXl
    ? ["All", "News", "Case law", "Regulation", "Statute", "Fraud trend"]
    : ["All", "News", "Case law", "Regulation"];
  const n = isXl ? 4 : size === "L" ? 3 : 2;
  const cards = HEADLINES.map((h, i) => ({
    title: h,
    summary: "Fraud intel cross-reference — short supporting line under the title.",
    pill: i % 2 ? "Case law" : "News",
    ago: `${i + 1}h ago`,
  }));
  return (
    <PatternFrame title="Chrome Feed" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {tabs.map((t, i) => (
            <span
              key={t}
              className={cn(
                "rounded-[0.375rem] px-2 py-1 font-mono text-[0.5rem] uppercase tracking-wider",
                i === 0 ? "bg-[var(--color-accent)] text-[var(--color-ink-1)]" : "text-[var(--color-text-lo)]",
              )}
            >
              {t}
            </span>
          ))}
          <div className="ml-auto min-w-[7rem] flex-1 rounded-[0.5rem] border border-[var(--color-line)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-lo)]">
            Search…
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
          {cards.slice(0, n).map((c) => (
            <div
              key={c.title}
              className="relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] px-2.5 py-2"
            >
              <span className="absolute inset-y-1.5 left-0 w-[0.18rem] rounded-full bg-[#38bdf8]" aria-hidden />
              <div className="mb-0.5 flex shrink-0 items-center gap-1.5 pl-2">
                <MockPill color={c.pill === "Case law" ? "#a78bfa" : "#38bdf8"}>{c.pill}</MockPill>
                <span className="ml-auto font-mono text-[0.5rem] text-[var(--color-text-lo)]">{c.ago}</span>
              </div>
              <div className={cn("min-h-0 pl-2 font-medium text-[var(--color-text-hi)]", isXl ? "line-clamp-1 text-[0.78125rem]" : "line-clamp-2 text-[0.78125rem]")}>
                {c.title}
              </div>
              {(isXl || size === "L") && (
                <div className="mt-0.5 line-clamp-1 pl-2 text-[0.625rem] leading-snug text-[var(--color-text-mid)]">{c.summary}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function TimelineSpine({ size }: { size: PatternSize }) {
  const n = size === "S" ? 2 : size === "M" ? 3 : size === "L" ? 4 : 6;
  const entries = TIMELINE.slice(0, n);
  return (
    <PatternFrame title="Timeline Spine" size={size}>
      <div className="flex min-h-0 flex-1 flex-col justify-evenly overflow-hidden">
        {entries.map((entry, i) => (
          <div key={entry.title} className="relative flex min-h-0 gap-2.5">
            {i < entries.length - 1 && (
              <span className="absolute left-[0.3125rem] top-3 bottom-[-50%] w-px bg-[var(--color-line)]" aria-hidden />
            )}
            <span
              className={cn(
                "relative z-[1] mt-1.5 h-2 w-2 shrink-0 rounded-full border-2",
                i === 0 ? "border-[var(--color-accent)] bg-[var(--color-accent)]" : "border-[var(--color-line-2)] bg-[var(--color-ink-2)]",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[0.5rem] tabular-nums text-[var(--color-text-lo)]">{entry.time}</span>
                <span className="truncate text-[0.75rem] font-medium text-[var(--color-text-hi)]">{entry.title}</span>
              </div>
              <div className="truncate font-mono text-[0.5625rem] text-[var(--color-text-lo)]">{entry.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </PatternFrame>
  );
}

function KeyValueSheet({ size }: { size: PatternSize }) {
  const n = size === "S" ? 4 : size === "M" ? 5 : 6;
  const pairs = KEY_VALUES.slice(0, n);
  return (
    <PatternFrame title="Key-Value Sheet" size={size}>
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-0.5 py-1">
        {pairs.map((pair) => (
          <div
            key={pair.label}
            className="flex min-w-0 items-baseline justify-between gap-3 border-b border-[var(--color-line)]/60 py-2 last:border-0"
          >
            <span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-[0.1em] text-[var(--color-text-lo)]">{pair.label}</span>
            <span className="min-w-0 truncate text-right text-[0.75rem] text-[var(--color-text-hi)]">{pair.value}</span>
          </div>
        ))}
      </div>
    </PatternFrame>
  );
}

function StageRail({ size }: { size: PatternSize }) {
  const active = size === "S" ? 2 : size === "M" ? 3 : 4;
  const visible = size === "S" ? STAGES.slice(0, 4) : size === "M" ? STAGES.slice(0, 5) : STAGES;
  return (
    <PatternFrame title="Stage Rail" size={size}>
      <div className="flex h-full min-h-0 flex-col justify-center">
        {/* Equal flex columns; connector spans center→center of neighbors (fixes last-gap bug). */}
        <div className="flex w-full min-w-0">
          {visible.map((stage, i) => (
            <div key={stage} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
              {i < visible.length - 1 && (
                <span
                  className={cn(
                    "pointer-events-none absolute left-1/2 top-[0.625rem] h-px w-full",
                    i < active ? "bg-[var(--color-accent)]" : "bg-[var(--color-line)]",
                  )}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "relative z-[1] grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[0.5rem] font-semibold",
                  i < active && "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-ink-1)]",
                  i === active &&
                    "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] text-[var(--color-accent)]",
                  i > active && "border-[var(--color-line)] bg-[var(--color-ink-3)] text-[var(--color-text-lo)]",
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "w-full truncate px-0.5 text-center font-mono text-[0.4375rem] uppercase tracking-wider",
                  i <= active ? "text-[var(--color-text-hi)]" : "text-[var(--color-text-lo)]",
                )}
                title={stage}
              >
                {stage}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function MediaToolbar({ size }: { size: PatternSize }) {
  return (
    <PatternFrame title="Media Toolbar" size={size} padded={false}>
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-[var(--color-line)] bg-[var(--color-ink-2)]/95 px-2 py-1.5 backdrop-blur">
          {[
            { icon: ZoomIn, label: "Zoom" },
            { icon: Layers, label: "Layers" },
            { icon: MapPin, label: "Pins" },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              className="flex items-center gap-1 rounded-[0.375rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/50 px-2 py-1 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-mid)] transition-colors hover:text-[var(--color-text-hi)]"
            >
              <Icon size={11} />
              {size !== "M" && label}
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            {["All", "CA"].map((r, i) => (
              <span
                key={r}
                className={cn(
                  "rounded-[0.375rem] px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-wider",
                  i === 0 ? "bg-[var(--color-accent)] text-[var(--color-ink-1)]" : "text-[var(--color-text-lo)]",
                )}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(145deg,#0f172a,#1e293b_40%,#0ea5e9_140%)]">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 40%, #38bdf8 0%, transparent 45%), radial-gradient(circle at 70% 60%, #64748b 0%, transparent 40%)",
            }}
          />
          <div className="absolute bottom-2 left-2 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 font-mono text-[0.5rem] text-white/90 backdrop-blur">
            12 pins · evidence map
          </div>
          {(size === "L" || size === "XL") && (
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f87171] shadow-[0_0_0_5px_rgba(248,113,113,0.25)]" />
          )}
        </div>
      </div>
    </PatternFrame>
  );
}

function TrendPulse({ size }: { size: PatternSize }) {
  const numClass =
    size === "L" ? "text-[2.5rem]" : size === "M" ? "text-[2rem]" : "text-[1.625rem]";
  const sparkH = size === "L" ? "h-[4.5rem]" : size === "M" ? "h-[3.25rem]" : "h-[2.25rem]";
  return (
    <PatternFrame title="Trend Pulse" size={size}>
      <div className="flex h-full min-h-0 items-center gap-3">
        <div className="min-w-0 shrink-0">
          <div className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--color-text-lo)]">SIU referrals</div>
          <div className={cn("editorial mt-1 leading-none tabular-nums text-[var(--color-text-hi)]", numClass)}>38</div>
          <div className="mt-1.5 font-mono text-[0.5625rem] text-[var(--color-pos)]">+12% vs prior week</div>
        </div>
        <div className={cn("min-w-0 flex-1", sparkH)}>
          <Sparkline strokeWidth={size === "S" ? 1.5 : 2} />
        </div>
      </div>
    </PatternFrame>
  );
}

function CompareTwin({ size }: { size: PatternSize }) {
  // Top KPI per column + distributed rows so L/XL don't leave a dead floor.
  const rows = size === "M" ? 3 : size === "L" ? 4 : 5;
  const left = NAMES.slice(0, rows);
  const right = CASES.slice(0, rows);
  return (
    <PatternFrame title="Compare Twin" size={size}>
      <div className="grid h-full min-h-0 grid-cols-2 gap-2">
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_35%,transparent)] p-2.5">
          <div className="mb-2 shrink-0 border-b border-[var(--color-line)] pb-2">
            <div className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Claimants</div>
            <div className="mt-0.5 text-[1.25rem] font-semibold tabular-nums text-[var(--color-text-hi)]">{left.length}</div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-1">
            {left.map((name) => (
              <div key={name} className="truncate text-[0.75rem] text-[var(--color-text-hi)]">{name}</div>
            ))}
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_35%,transparent)] p-2.5">
          <div className="mb-2 shrink-0 border-b border-[var(--color-line)] pb-2">
            <div className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Cases</div>
            <div className="mt-0.5 text-[1.25rem] font-semibold tabular-nums text-[var(--color-text-hi)]">{right.length}</div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-1">
            {right.map((caseId) => (
              <div key={caseId} className="truncate font-mono text-[0.75rem] text-[var(--color-text-hi)]">{caseId}</div>
            ))}
          </div>
        </div>
      </div>
    </PatternFrame>
  );
}

/* ─── Dashboard-inspired + video recipes ─── */

const DUAL_A = [42, 48, 45, 52, 58, 55, 62, 68, 64, 72, 70, 78];
const DUAL_B = [38, 40, 42, 41, 44, 48, 46, 50, 52, 51, 54, 56];
const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

function DualTrend({ size }: { size: PatternSize }) {
  const showLegend = size !== "S";
  const showAxis = size === "L" || size === "XL";
  const w = 200;
  const h = 72;
  const max = 80;
  const toPts = (series: number[]) =>
    series
      .map((v, i) => {
        const x = (i / (series.length - 1)) * w;
        const y = h - (v / max) * (h - 8) - 4;
        return `${x},${y}`;
      })
      .join(" ");
  const areaA = `0,${h} ${toPts(DUAL_A)} ${w},${h}`;
  return (
    <PatternFrame title="Dual Trend" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
          <div>
            <div className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--color-text-lo)]">Closed ARR · trailing 12mo</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="editorial text-[1.75rem] leading-none tabular-nums text-[var(--color-text-hi)]">$332k</span>
              <span className="rounded-full bg-[color-mix(in_srgb,var(--color-pos)_18%,transparent)] px-1.5 py-0.5 font-mono text-[0.5rem] text-[var(--color-pos)]">
                +4.4%
              </span>
            </div>
          </div>
          {showLegend && (
            <div className="text-right">
              <div className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Active pipeline</div>
              <div className="text-[1rem] font-semibold tabular-nums text-[var(--color-pos)]">$438k</div>
            </div>
          )}
        </div>
        <div className="relative min-h-0 flex-1">
          <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden>
            <polygon fill="var(--color-accent)" opacity="0.14" points={areaA} />
            <polyline
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              points={toPts(DUAL_A)}
            />
            <polyline
              fill="none"
              stroke="var(--color-pos)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              strokeDasharray={size === "S" ? undefined : "4 3"}
              points={toPts(DUAL_B)}
            />
          </svg>
        </div>
        {showAxis && (
          <div className="flex shrink-0 justify-between font-mono text-[0.4375rem] text-[var(--color-text-lo)]">
            {MONTHS.filter((_, i) => i % 2 === 0).map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        )}
      </div>
    </PatternFrame>
  );
}

function MiniSpark({ values, tone }: { values: number[]; tone: string }) {
  const w = 48;
  const h = 16;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 2) - 1}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-4 w-12" aria-hidden>
      <polyline fill="none" stroke={tone} strokeWidth="1.5" strokeLinecap="round" points={pts} />
    </svg>
  );
}

function SparkMetricGrid({ size }: { size: PatternSize }) {
  const tiles = [
    { label: "Active clients", value: "248", delta: "+4.2%", tone: "var(--color-pos)", spark: [12, 14, 13, 16, 18, 17, 20] },
    { label: "Open cases", value: "31", delta: "−2.1%", tone: "var(--color-neg)", spark: [22, 20, 21, 19, 18, 17, 16] },
    { label: "MRR", value: "$32.4k", delta: "+6.8%", tone: "var(--color-pos)", spark: [10, 11, 12, 14, 13, 15, 17] },
    { label: "Conversion", value: "23.1%", delta: "+1.4%", tone: "var(--color-pos)", spark: [8, 9, 9, 10, 11, 11, 12] },
  ];
  const n = size === "S" ? 2 : 4;
  return (
    <PatternFrame title="Spark Metric Grid" size={size}>
      <div className={cn("grid h-full min-h-0 gap-2", size === "S" ? "grid-cols-2" : "grid-cols-2 grid-rows-2")}>
        {tiles.slice(0, n).map((t) => (
          <div
            key={t.label}
            className="flex min-h-0 flex-col justify-between rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_45%,transparent)] px-2.5 py-2"
          >
            <div className="font-mono text-[0.4375rem] uppercase tracking-wider text-[var(--color-text-lo)]">{t.label}</div>
            <div className="flex items-end justify-between gap-1">
              <div>
                <div className="text-[1.125rem] font-semibold tabular-nums leading-none text-[var(--color-text-hi)]">{t.value}</div>
                <span className="mt-1 inline-block font-mono text-[0.5rem]" style={{ color: t.tone }}>
                  {t.delta}
                </span>
              </div>
              <MiniSpark values={t.spark} tone={t.tone} />
            </div>
          </div>
        ))}
      </div>
    </PatternFrame>
  );
}

function DonutLegend({ size }: { size: PatternSize }) {
  const slices = [
    { label: "Inbound", pct: 42, color: "var(--color-accent)" },
    { label: "Referral", pct: 27, color: "#a78bfa" },
    { label: "Outbound", pct: 19, color: "var(--color-pos)" },
    { label: "Partner", pct: 12, color: "var(--color-warn)" },
  ];
  // Conic gradient donut
  let cursor = 0;
  const stops = slices
    .map((s) => {
      const start = cursor;
      cursor += s.pct;
      return `${s.color} ${start}% ${cursor}%`;
    })
    .join(", ");
  const horizontal = size === "L" || size === "XL";
  return (
    <PatternFrame title="Donut Legend" size={size}>
      <div className={cn("flex h-full min-h-0 gap-3", horizontal ? "flex-row items-center" : "flex-col items-center justify-center")}>
        <div className="relative shrink-0">
          <div
            className={cn("rounded-full", size === "S" ? "h-20 w-20" : "h-28 w-28")}
            style={{ background: `conic-gradient(${stops})` }}
          />
          <div className="absolute inset-[22%] grid place-items-center rounded-full bg-[var(--color-ink-2)]">
            <div className="text-center">
              <div className="font-mono text-[0.4375rem] uppercase text-[var(--color-text-lo)]">Total</div>
              <div className="text-[0.875rem] font-semibold text-[var(--color-text-hi)]">100%</div>
            </div>
          </div>
        </div>
        <div className={cn("flex min-w-0 flex-1 flex-col justify-center gap-1.5", !horizontal && "w-full")}>
          {slices.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-[0.75rem] text-[var(--color-text-hi)]">{s.label}</span>
              <span className="font-mono text-[0.625rem] tabular-nums text-[var(--color-text-lo)]">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function ActivityFeed({ size }: { size: PatternSize }) {
  const [open, setOpen] = useState(false);
  const n = size === "S" ? 3 : size === "M" ? 4 : size === "L" ? 5 : 6;
  const items = [
    { initials: "MW", color: "var(--color-warn)", title: "M. Webb · Video obtained — C-4705", meta: "Note · 12m ago" },
    { initials: "KT", color: "#a78bfa", title: "K. Torres · Deposition scheduled — C-4688", meta: "Meeting · 34m ago" },
    { initials: "JL", color: "var(--color-accent)", title: "J. Lee · Face match ran — C-5012", meta: "Match · 1h ago" },
    { initials: "AC", color: "var(--color-pos)", title: "A. Cole · Field check-in — C-5001", meta: "Field · 2h ago" },
    { initials: "SO", color: "var(--color-neg)", title: "S. Okonkwo · Rush flag raised — C-5019", meta: "Alert · 3h ago" },
    { initials: "RC", color: "var(--color-accent-2)", title: "R. Chen · Client note filed — C-5008", meta: "Note · 5h ago" },
  ];
  return (
    <PatternFrame title="Activity Feed" size={size}>
      <div className="flex h-full min-h-0 flex-col justify-evenly overflow-hidden">
        {items.slice(0, n).map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-w-0 items-center gap-2.5 border-b border-[var(--color-line)]/50 py-1.5 text-left last:border-0 hover:bg-[color-mix(in_srgb,var(--color-ink-3)_30%,transparent)]"
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.5625rem] font-semibold text-white"
              style={{ background: `color-mix(in srgb, ${item.color} 55%, #0a101c)` }}
            >
              {item.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.75rem] font-medium text-[var(--color-text-hi)]">{item.title}</div>
              <div className="truncate font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">{item.meta}</div>
            </div>
          </button>
        ))}
        <MoreFooter count={items.length - n} onClick={() => setOpen(true)} />
      </div>
      <PatternExpandModal title="Activity Feed" open={open} onClose={() => setOpen(false)}>
        {items.map((item) => (
          <div key={item.title} className="flex gap-2.5 border-b border-[var(--color-line)] py-2 last:border-0">
            <span className="grid h-7 w-7 place-items-center rounded-full text-[0.5625rem] font-semibold text-white" style={{ background: item.color }}>
              {item.initials}
            </span>
            <div>
              <div className="text-[0.8125rem] text-[var(--color-text-hi)]">{item.title}</div>
              <div className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">{item.meta}</div>
            </div>
          </div>
        ))}
      </PatternExpandModal>
    </PatternFrame>
  );
}

function Checklist({ size }: { size: PatternSize }) {
  const items = [
    { label: "Send May invoice", done: false },
    { label: "Confirm deposition date", done: false },
    { label: "Upload surveillance package", done: true },
    { label: "Client weekly brief", done: true },
    { label: "SIU referral packet", done: true },
    { label: "Field schedule confirm", done: true },
  ];
  const remaining = items.filter((i) => !i.done).length;
  const n = size === "S" ? 3 : size === "M" ? 4 : 6;
  return (
    <PatternFrame title="Checklist" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-center justify-between">
          <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">{remaining} remaining</span>
          <span className="grid h-5 w-5 place-items-center rounded-[0.375rem] border border-[var(--color-line)] font-mono text-[0.625rem] text-[var(--color-text-mid)]">
            +
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1 overflow-hidden">
          {items.slice(0, n).map((item) => (
            <div key={item.label} className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[0.25rem] border",
                  item.done
                    ? "border-[var(--color-pos)] bg-[var(--color-pos)] text-[var(--color-ink-1)]"
                    : "border-[var(--color-line-2)]",
                )}
              >
                {item.done && <span className="text-[0.5rem] leading-none">✓</span>}
              </span>
              <span
                className={cn(
                  "truncate text-[0.75rem]",
                  item.done ? "text-[var(--color-text-lo)] line-through" : "text-[var(--color-text-hi)]",
                )}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function StatusRoster({ size }: { size: PatternSize }) {
  const n = size === "S" ? 3 : size === "M" ? 4 : 5;
  const people = [
    { name: "Maya Webb", cases: 4, loc: "SoCal", status: "Clocked in", tone: "var(--color-pos)" },
    { name: "Ken Torres", cases: 2, loc: "Bay Area", status: "On case", tone: "#a78bfa" },
    { name: "Avery Cole", cases: 3, loc: "TX", status: "Clocked in", tone: "var(--color-pos)" },
    { name: "Jordan Lee", cases: 1, loc: "NV", status: "Off duty", tone: "var(--color-text-lo)" },
    { name: "Sam Okonkwo", cases: 5, loc: "AZ", status: "On case", tone: "#a78bfa" },
  ];
  return (
    <PatternFrame title="Status Roster" size={size}>
      <div className="flex h-full min-h-0 flex-col justify-evenly overflow-hidden">
        {people.slice(0, n).map((p) => (
          <div key={p.name} className="flex min-w-0 items-center gap-2 py-0.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[0.5rem] font-semibold text-[var(--color-accent-2)]">
              {p.name
                .split(" ")
                .map((w) => w[0])
                .join("")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.75rem] text-[var(--color-text-hi)]">{p.name}</div>
              <div className="truncate font-mono text-[0.5rem] text-[var(--color-text-lo)]">
                {p.cases} open · {p.loc}
              </div>
            </div>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.4375rem] uppercase tracking-wider"
              style={{ color: p.tone, background: `color-mix(in srgb, ${p.tone} 16%, transparent)` }}
            >
              {p.status}
            </span>
          </div>
        ))}
      </div>
    </PatternFrame>
  );
}

function AgendaStrip({ size }: { size: PatternSize }) {
  const events = [
    { time: "09:20", title: "Case review", detail: "C-5001 · Hartford" },
    { time: "10:35", title: "Deposition prep", detail: "C-4705 · Kowalski" },
    { time: "13:00", title: "Field brief", detail: "SoCal unit · Zoom" },
    { time: "15:45", title: "SIU sync", detail: "Internal · Room B" },
  ];
  const n = size === "S" ? 2 : size === "M" ? 2 : 3;
  return (
    <PatternFrame title="Agenda Strip" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-center justify-between">
          <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Wed, 28 May</span>
          <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-accent-2)]">View all</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1 overflow-hidden">
          {events.slice(0, n).map((e) => (
            <div key={e.time + e.title} className="flex min-w-0 items-start gap-3">
              <span className="w-10 shrink-0 font-mono text-[0.875rem] tabular-nums text-[var(--color-text-hi)]">{e.time}</span>
              <div className="min-w-0 flex-1 border-l border-[var(--color-line)] pl-2.5">
                <div className="truncate text-[0.75rem] font-medium text-[var(--color-text-hi)]">{e.title}</div>
                <div className="truncate font-mono text-[0.5rem] text-[var(--color-text-lo)]">{e.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function WeatherBand({ size }: { size: PatternSize }) {
  const days = [
    { d: "Mon", t: "72°", risk: "Clear", tone: "var(--color-pos)" },
    { d: "Tue", t: "68°", risk: "Wind", tone: "var(--color-warn)" },
    { d: "Wed", t: "64°", risk: "Rain", tone: "var(--color-accent)" },
    { d: "Thu", t: "70°", risk: "Clear", tone: "var(--color-pos)" },
    { d: "Fri", t: "66°", risk: "Fog", tone: "var(--color-text-mid)" },
  ];
  const n = size === "S" ? 3 : size === "M" ? 4 : 5;
  return (
    <PatternFrame title="Weather Band" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <CloudSun size={18} className="text-[var(--color-warn)]" />
          <div>
            <div className="text-[0.875rem] font-medium text-[var(--color-text-hi)]">Partly cloudy · SoCal</div>
            <div className="font-mono text-[0.5rem] uppercase text-[var(--color-text-lo)]">Worst risk · wind Tue</div>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5 sm:grid-cols-5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {days.slice(0, n).map((day) => (
            <div
              key={day.d}
              className="flex min-h-0 flex-col items-center justify-center rounded-[0.5rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_40%,transparent)] px-1 py-1.5"
            >
              <span className="font-mono text-[0.4375rem] uppercase text-[var(--color-text-lo)]">{day.d}</span>
              <span className="text-[0.875rem] font-semibold tabular-nums text-[var(--color-text-hi)]">{day.t}</span>
              <span className="font-mono text-[0.4375rem]" style={{ color: day.tone }}>
                {day.risk}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function VideoStage({ size }: { size: PatternSize }) {
  return (
    <PatternFrame title="Video Stage" size={size} padded={false}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative min-h-0 flex-1 bg-[linear-gradient(145deg,#0a101c,#1e293b_50%,#0f172a)]">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 40% 45%, #38bdf8 0%, transparent 50%)" }} />
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur">
              <Play size={18} fill="currentColor" />
            </span>
          </div>
          <div className="absolute left-2 top-2 rounded-[0.375rem] bg-black/50 px-2 py-0.5 font-mono text-[0.5rem] uppercase text-white/80 backdrop-blur">
            Surveil · Clip 03
          </div>
          <div className="absolute bottom-2 right-2 font-mono text-[0.5rem] tabular-nums text-white/70">04:12 / 12:48</div>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t border-[var(--color-line)] bg-[var(--color-ink-2)]/95 px-2.5 py-2">
          <SkipBack size={12} className="text-[var(--color-text-lo)]" />
          <Play size={12} className="text-[var(--color-text-hi)]" />
          <SkipForward size={12} className="text-[var(--color-text-lo)]" />
          <div className="mx-1 h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-ink-3)]">
            <div className="h-full w-[34%] rounded-full bg-[var(--color-accent)]" />
          </div>
          {size !== "S" && <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">1×</span>}
        </div>
      </div>
    </PatternFrame>
  );
}

function VideoPlaylist({ size }: { size: PatternSize }) {
  const clips = [
    { id: "03", label: "Front entrance · AM", dur: "12:48", active: true },
    { id: "04", label: "Parking lot · PM", dur: "08:22", active: false },
    { id: "05", label: "Side alley · dusk", dur: "15:01", active: false },
    { id: "06", label: "Lobby · night", dur: "06:40", active: false },
  ];
  const listN = size === "M" ? 2 : size === "L" ? 3 : 4;
  return (
    <PatternFrame title="Video Playlist" size={size} padded={false}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-line)] px-2.5 py-1.5">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 px-2 py-1 text-left"
          >
            <span className="truncate text-[0.6875rem] text-[var(--color-text-hi)]">C-5001 · Tomas Herrera</span>
            <span className="shrink-0 font-mono text-[0.5rem] text-[var(--color-text-lo)]">▾</span>
          </button>
          {size !== "M" && (
            <span className="shrink-0 font-mono text-[0.4375rem] uppercase text-[var(--color-accent-2)]">Recent</span>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-row">
          <div className="relative min-h-0 min-w-0 flex-[1.4] bg-[linear-gradient(145deg,#0a101c,#1e293b)]">
            <div className="absolute inset-0 grid place-items-center">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/40 text-white">
                <Pause size={14} fill="currentColor" />
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
              <div className="h-full w-[34%] bg-[var(--color-accent)]" />
            </div>
          </div>
          <div className="flex min-h-0 w-[42%] flex-col gap-1 overflow-hidden border-l border-[var(--color-line)] p-2">
            <div className="shrink-0 font-mono text-[0.4375rem] uppercase tracking-wider text-[var(--color-text-lo)]">Clips</div>
            <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1 overflow-hidden">
              {clips.slice(0, listN).map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "rounded-[0.5rem] border px-2 py-1.5",
                    c.active
                      ? "border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_35%,transparent)]",
                  )}
                >
                  <div className="truncate text-[0.6875rem] text-[var(--color-text-hi)]">
                    {c.id} · {c.label}
                  </div>
                  <div className="font-mono text-[0.4375rem] text-[var(--color-text-lo)]">{c.dur}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PatternFrame>
  );
}

function VideoTheater({ size }: { size: PatternSize }) {
  return (
    <PatternFrame title="Video Theater" size={size} padded={false}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-line)] px-3 py-1.5">
          <div className="min-w-0">
            <div className="truncate text-[0.75rem] font-medium text-[var(--color-text-hi)]">C-5001 · Tomas Herrera</div>
            <div className="font-mono text-[0.4375rem] uppercase text-[var(--color-text-lo)]">Surveillance · Clip 03 of 6</div>
          </div>
          <MockPill>Evidence</MockPill>
        </div>
        <div className="relative min-h-0 flex-1 bg-[linear-gradient(160deg,#05080f,#152033_55%,#0a1528)]">
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 55% 40%, #38bdf8 0%, transparent 45%)" }} />
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-white/30 bg-black/50 text-white backdrop-blur">
              <Play size={20} fill="currentColor" />
            </span>
          </div>
        </div>
        <div className="shrink-0 space-y-1.5 border-t border-[var(--color-line)] bg-[var(--color-ink-2)]/95 px-3 py-2">
          <div className="h-1 overflow-hidden rounded-full bg-[var(--color-ink-3)]">
            <div className="h-full w-[34%] rounded-full bg-[var(--color-accent)]" />
          </div>
          <div className="flex items-center gap-2">
            <SkipBack size={12} className="text-[var(--color-text-lo)]" />
            <Play size={12} className="text-[var(--color-text-hi)]" />
            <SkipForward size={12} className="text-[var(--color-text-lo)]" />
            <span className="ml-1 font-mono text-[0.5rem] tabular-nums text-[var(--color-text-lo)]">04:12 / 12:48</span>
            {(size === "L" || size === "XL") && (
              <span className="ml-auto truncate font-mono text-[0.5rem] text-[var(--color-text-lo)]">Front entrance · 2024-11-12</span>
            )}
          </div>
        </div>
      </div>
    </PatternFrame>
  );
}

/* ─── Round-2 recipes (client expand, aging, notes, weather, coverage, scope) ─── */

const CLIENTS = [
  { name: "Hartford", share: 28, cases: ["C-5001", "C-5008", "C-5012"] },
  { name: "Travelers", share: 22, cases: ["C-5019", "C-5022"] },
  { name: "Liberty", share: 18, cases: ["C-5030"] },
  { name: "AmTrust", share: 15, cases: ["C-4892", "C-4901"] },
  { name: "Gallagher", share: 17, cases: ["C-4770"] },
];

function ClientAccordion({ size }: { size: PatternSize }) {
  const [open, setOpen] = useState(0);
  const n = size === "M" ? 3 : size === "L" ? 4 : 5;
  return (
    <PatternFrame title="Client Accordion" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-1 overflow-hidden">
        {CLIENTS.slice(0, n).map((c, i) => (
          <div key={c.name} className="min-h-0 overflow-hidden rounded-[0.5rem] border border-[var(--color-line)]">
            <button
              type="button"
              onClick={() => setOpen(i === open ? -1 : i)}
              className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-[color-mix(in_srgb,var(--color-ink-3)_40%,transparent)]"
            >
              <span className="truncate text-[0.75rem] font-medium text-[var(--color-text-hi)]">{c.name}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">{c.share}%</span>
                <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">{open === i ? "▴" : "▾"}</span>
              </span>
            </button>
            {open === i && (
              <div className="space-y-1 border-t border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_30%,transparent)] px-2.5 py-1.5">
                {c.cases.map((id) => (
                  <div key={id} className="font-mono text-[0.6875rem] text-[var(--color-accent-2)]">
                    {id}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </PatternFrame>
  );
}

function ClientMasterDetail({ size }: { size: PatternSize }) {
  const [sel, setSel] = useState(0);
  const client = CLIENTS[sel];
  const accents = ["var(--color-accent)", "#a78bfa", "var(--color-pos)", "var(--color-warn)", "#38bdf8"];
  return (
    <PatternFrame title="Client Master Detail" size={size}>
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-2">
        <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden">
          {CLIENTS.map((c, i) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setSel(i)}
              className={cn(
                "relative min-h-0 shrink overflow-hidden rounded-[0.625rem] border px-2.5 py-2 text-left transition-colors",
                i === sel
                  ? "border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)]"
                  : "border-[var(--color-line)] hover:border-[var(--color-line-2)]",
              )}
            >
              <span
                className="absolute inset-y-1.5 left-0 w-[0.15rem] rounded-full"
                style={{ background: accents[i % accents.length] }}
                aria-hidden
              />
              <div className="truncate pl-1.5 text-[0.75rem] font-medium text-[var(--color-text-hi)]">{c.name}</div>
              <div className="pl-1.5 font-mono text-[0.5rem] uppercase tracking-[0.08em] text-[var(--color-text-lo)]">
                {c.share}% · {c.cases.length} open
              </div>
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_35%,transparent)]">
          <div className="shrink-0 border-b border-[var(--color-line)] px-3 py-2.5">
            <div className="text-[0.9375rem] font-semibold text-[var(--color-text-hi)]">{client.name}</div>
            <div className="mt-0.5 font-mono text-[0.5rem] uppercase tracking-[0.1em] text-[var(--color-text-lo)]">
              {client.share}% of book
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden p-2.5">
            {client.cases.map((id) => (
              <div
                key={id}
                className="rounded-[0.5rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-2)_40%,transparent)] px-2.5 py-2 text-[0.75rem] text-[var(--color-text-hi)]"
              >
                {id} · Workers Comp
              </div>
            ))}
            {size === "XL" && client.cases.length < 3 && (
              <div className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">+ related closed cases…</div>
            )}
          </div>
        </div>
      </div>
    </PatternFrame>
  );
}

function ClientDrawer({ size }: { size: PatternSize }) {
  const [open, setOpen] = useState(false);
  const n = size === "S" ? 3 : 4;
  return (
    <PatternFrame title="Client Drawer" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-hidden">
        {CLIENTS.slice(0, n).map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center justify-between rounded-[0.5rem] border border-[var(--color-line)] px-2.5 py-2 text-left hover:border-[var(--color-line-2)]"
          >
            <span className="truncate text-[0.75rem] text-[var(--color-text-hi)]">{c.name}</span>
            <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">{c.cases.length} cases →</span>
          </button>
        ))}
      </div>
      <PatternExpandModal title="Hartford · open cases" open={open} onClose={() => setOpen(false)}>
        {CLIENTS[0].cases.map((id) => (
          <div key={id} className="rounded-[0.5rem] border border-[var(--color-line)] px-3 py-2 text-[0.8125rem] text-[var(--color-text-hi)]">
            {id} · Workers Comp · Active
          </div>
        ))}
      </PatternExpandModal>
    </PatternFrame>
  );
}

function AgingBuckets({ size }: { size: PatternSize }) {
  const buckets = [
    { label: "0–7d", value: 14, tone: "var(--color-pos)" },
    { label: "8–14d", value: 9, tone: "var(--color-accent)" },
    { label: "15–30d", value: 6, tone: "var(--color-warn)" },
    { label: "30d+", value: 4, tone: "var(--color-neg)" },
  ];
  return (
    <PatternFrame title="Aging Buckets" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-baseline justify-between">
          <div>
            <div className="font-mono text-[0.5rem] uppercase text-[var(--color-text-lo)]">Avg turnaround</div>
            <div className="text-[1.25rem] font-semibold tabular-nums text-[var(--color-text-hi)]">11.4d</div>
          </div>
          {size !== "S" && (
            <span className="font-mono text-[0.5rem] text-[var(--color-pos)]">−1.2d vs prior</span>
          )}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5">
          {buckets.map((b) => (
            <div
              key={b.label}
              className="flex flex-col items-center justify-center rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_40%,transparent)]"
            >
              <div className="text-[1.125rem] font-semibold tabular-nums" style={{ color: b.tone }}>
                {b.value}
              </div>
              <div className="font-mono text-[0.4375rem] uppercase text-[var(--color-text-lo)]">{b.label}</div>
            </div>
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function AgingFunnel({ size }: { size: PatternSize }) {
  const rows = [
    ["0–7 days", 14, 14],
    ["8–14 days", 9, 14],
    ["15–30 days", 6, 14],
    ["30+ days", 4, 14],
  ] as const;
  return (
    <PatternFrame title="Aging Funnel" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="grid shrink-0 grid-cols-3 gap-1.5">
          <MockMetric value="11.4d" label="Avg" dense />
          <MockMetric value="18d" label="P95" dense />
          <MockMetric value="4" label="30d+" tone="var(--color-neg)" dense />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1.5">
          {rows.map(([l, v, max]) => (
            <MockBar key={l} label={l} value={v} max={max} />
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function AgingCohort({ size }: { size: PatternSize }) {
  const rows = [
    ["Surveillance", "9.2d", 12],
    ["Workers Comp", "14.1d", 18],
    ["Social", "7.8d", 6],
    ["FMLA", "16.4d", 4],
  ];
  return (
    <PatternFrame title="Aging Cohort" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="relative min-h-0 flex-[0.85]">
          <Sparkline className="h-full" />
        </div>
        <div className="shrink-0 font-mono text-[0.5rem] uppercase text-[var(--color-text-lo)]">Avg days by service</div>
        <div className="flex min-h-0 flex-1 flex-col justify-evenly overflow-hidden">
          {rows.slice(0, size === "L" ? 3 : 4).map(([svc, avg, n]) => (
            <div key={svc} className="flex items-baseline justify-between gap-2 border-b border-[var(--color-line)]/50 py-1 last:border-0">
              <span className="truncate text-[0.75rem] text-[var(--color-text-hi)]">{svc}</span>
              <span className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">{n} cases</span>
              <span className="font-semibold tabular-nums text-[var(--color-text-hi)]">{avg}</span>
            </div>
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function NotesPad({ size }: { size: PatternSize }) {
  return (
    <PatternFrame title="Notes Pad" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-center justify-between">
          <span className="font-mono text-[0.5rem] uppercase text-[var(--color-text-lo)]">Personal · private</span>
          <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">Saved</span>
        </div>
        <div className="min-h-0 flex-1 rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_35%,transparent)] p-2.5 text-[0.75rem] leading-relaxed text-[var(--color-text-mid)]">
          Call Hartford on C-5001 referral packet…
          {size !== "S" && (
            <>
              <br />
              <br />
              Deposition prep notes for Kowalski — bring clip 03.
            </>
          )}
        </div>
      </div>
    </PatternFrame>
  );
}

function NotesChecklist({ size }: { size: PatternSize }) {
  return (
    <PatternFrame title="Notes + Checklist" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="min-h-0 flex-[0.9] rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_35%,transparent)] p-2 text-[0.6875rem] text-[var(--color-text-mid)]">
          Scratch notes for today…
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1">
          {[
            ["Send May invoice", false],
            ["Confirm deposition", false],
            ["Upload package", true],
          ].map(([label, done]) => (
            <div key={String(label)} className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-3.5 w-3.5 place-items-center rounded-[0.25rem] border",
                  done ? "border-[var(--color-pos)] bg-[var(--color-pos)]" : "border-[var(--color-line-2)]",
                )}
              />
              <span className={cn("truncate text-[0.75rem]", done ? "text-[var(--color-text-lo)] line-through" : "text-[var(--color-text-hi)]")}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function InvestigatorScope({ size }: { size: PatternSize }) {
  return (
    <PatternFrame title="Investigator Scope" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <button
          type="button"
          className="flex shrink-0 items-center justify-between rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 px-2.5 py-2 text-left"
        >
          <div>
            <div className="font-mono text-[0.4375rem] uppercase text-[var(--color-text-lo)]">Investigator</div>
            <div className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">Maya Webb</div>
          </div>
          <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">Change ▾</span>
        </button>
        <div className="grid shrink-0 grid-cols-3 gap-1.5">
          <MockMetric value="42" label="Files" dense />
          <MockMetric value="3" label="Failed" tone="var(--color-neg)" dense />
          <MockMetric value="2" label="24h" dense />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1">
          <MockBar label="Local" value={28} max={42} />
          <MockBar label="Wasabi" value={11} max={42} />
          {(size === "L" || size === "XL") && <MockBar label="None" value={3} max={42} />}
        </div>
      </div>
    </PatternFrame>
  );
}

function CoverageHybrid({ size }: { size: PatternSize }) {
  const compact = size === "XS" || size === "S" || size === "M";
  if (compact) {
    return (
      <PatternFrame title="Coverage Hybrid" size={size}>
        <div className="flex h-full flex-col justify-center gap-2">
          <div className="editorial text-[2rem] leading-none text-[var(--color-text-hi)]">7</div>
          <div className="font-mono text-[0.5625rem] uppercase text-[var(--color-text-lo)]">In field today</div>
          <div className="text-[0.75rem] text-[var(--color-text-mid)]">4 clocked in · 3 on case</div>
        </div>
      </PatternFrame>
    );
  }
  return (
    <PatternFrame title="Coverage Hybrid" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="grid shrink-0 grid-cols-3 gap-1.5">
          <MockMetric value="7" label="In field" dense />
          <MockMetric value="4" label="Clocked in" tone="var(--color-pos)" dense />
          <MockMetric value="3" label="On case" dense />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-evenly overflow-hidden">
          {[
            ["Maya Webb", "Clocked in", "var(--color-pos)"],
            ["Ken Torres", "On case", "#a78bfa"],
            ["Avery Cole", "Clocked in", "var(--color-pos)"],
            ["Jordan Lee", "Off duty", "var(--color-text-lo)"],
          ].map(([name, status, tone]) => (
            <div key={name} className="flex items-center justify-between gap-2">
              <span className="truncate text-[0.75rem] text-[var(--color-text-hi)]">{name}</span>
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[0.4375rem] uppercase"
                style={{ color: tone, background: `color-mix(in srgb, ${tone} 16%, transparent)` }}
              >
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function WeatherOps({ size }: { size: PatternSize }) {
  const regions = [
    { r: "SoCal", cond: "Clear", go: true },
    { r: "Bay Area", cond: "Wind", go: false },
    { r: "TX Gulf", cond: "Rain", go: false },
    { r: "AZ", cond: "Clear", go: true },
  ];
  return (
    <PatternFrame title="Weather Ops" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-center gap-2 rounded-[0.625rem] border border-[var(--color-warn)]/30 bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] px-2.5 py-2">
          <CloudSun size={16} className="text-[var(--color-warn)]" />
          <div className="min-w-0">
            <div className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">Wind advisory · Bay Area</div>
            <div className="font-mono text-[0.5rem] uppercase text-[var(--color-text-lo)]">Worst risk for field today</div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-evenly overflow-hidden">
          {regions.slice(0, size === "S" ? 2 : 4).map((row) => (
            <div key={row.r} className="flex items-center justify-between gap-2">
              <span className="text-[0.75rem] text-[var(--color-text-hi)]">{row.r}</span>
              <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">{row.cond}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[0.4375rem] uppercase",
                  row.go ? "bg-[color-mix(in_srgb,var(--color-pos)_16%,transparent)] text-[var(--color-pos)]" : "bg-[color-mix(in_srgb,var(--color-neg)_16%,transparent)] text-[var(--color-neg)]",
                )}
              >
                {row.go ? "Go" : "Hold"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function WeatherWeek({ size }: { size: PatternSize }) {
  const days = [
    { d: "Mon", risk: "Go", tone: "var(--color-pos)" },
    { d: "Tue", risk: "Hold", tone: "var(--color-neg)" },
    { d: "Wed", risk: "Go", tone: "var(--color-pos)" },
    { d: "Thu", risk: "Caution", tone: "var(--color-warn)" },
    { d: "Fri", risk: "Go", tone: "var(--color-pos)" },
  ];
  return (
    <PatternFrame title="Weather Week" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="font-mono text-[0.5rem] uppercase text-[var(--color-text-lo)]">Field week · SoCal unit</div>
        <div className="grid min-h-0 flex-1 grid-cols-5 gap-1.5">
          {days.map((day) => (
            <div
              key={day.d}
              className="flex flex-col items-center justify-center rounded-[0.5rem] border border-[var(--color-line)] px-1"
            >
              <span className="font-mono text-[0.4375rem] uppercase text-[var(--color-text-lo)]">{day.d}</span>
              <span className="mt-1 font-mono text-[0.5rem] font-semibold uppercase" style={{ color: day.tone }}>
                {day.risk}
              </span>
            </div>
          ))}
        </div>
        {size !== "S" && (
          <div className="shrink-0 text-[0.6875rem] text-[var(--color-text-mid)]">Tue wind advisory — reschedule outdoor surveil.</div>
        )}
      </div>
    </PatternFrame>
  );
}

function WeatherAlert({ size }: { size: PatternSize }) {
  return (
    <PatternFrame title="Weather Alert" size={size}>
      <div className="flex h-full flex-col justify-center gap-2">
        <div className="flex items-center gap-2">
          <CloudSun size={22} className="text-[var(--color-warn)]" />
          <div>
            <div className="text-[0.875rem] font-medium text-[var(--color-text-hi)]">Wind · Bay Area</div>
            <div className="font-mono text-[0.5rem] uppercase text-[var(--color-neg)]">Hold field work</div>
          </div>
        </div>
      </div>
    </PatternFrame>
  );
}

function WeatherBoard({ size }: { size: PatternSize }) {
  const regions = [
    { label: "CA", temp: "72°", cond: "Clear", go: "Go", tone: "var(--color-pos)", color: "#f59e0b" },
    { label: "Tri-State", temp: "58°", cond: "Wind", go: "Hold", tone: "var(--color-neg)", color: "#94a3b8" },
    { label: "TX", temp: "81°", cond: "Storms", go: "Hold", tone: "var(--color-neg)", color: "#a78bfa" },
  ];
  const [sel, setSel] = useState(0);
  const active = regions[sel];
  return (
    <PatternFrame title="Weather Board" size={size}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="grid shrink-0 grid-cols-3 gap-1.5">
          {regions.map((r, i) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setSel(i)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-[0.75rem] border px-1.5 py-2",
                i === sel ? "border-[var(--color-accent)]/45 bg-[var(--color-accent-soft)]" : "border-[var(--color-line)]",
              )}
            >
              <CloudSun size={18} style={{ color: r.color }} />
              <span className="text-[0.6875rem] font-medium text-[var(--color-text-hi)]">{r.label}</span>
              <span className="text-[1rem] font-semibold tabular-nums text-[var(--color-text-hi)]">{r.temp}</span>
              <span className="font-mono text-[0.4375rem] uppercase" style={{ color: r.tone }}>
                {r.go}
              </span>
            </button>
          ))}
        </div>
        {(size === "L" || size === "XL") && (
          <div className="flex min-h-0 flex-1 flex-col justify-center rounded-[0.75rem] border border-[var(--color-line)] px-3 py-2">
            <div className="text-[0.875rem] font-semibold text-[var(--color-text-hi)]">
              {active.label} · {active.cond}
            </div>
            <div className="mt-1 font-mono text-[0.5625rem] uppercase text-[var(--color-text-lo)]">
              {active.temp} · precip 20% · wind 12 mph
            </div>
          </div>
        )}
      </div>
    </PatternFrame>
  );
}

type GlassPatternId = Extract<
  PatternId,
  | "focal-stat"
  | "focal-feature"
  | "metric-strip"
  | "stack-list"
  | "card-list"
  | "split-primary-secondary"
  | "metric-over-list"
  | "metric-over-bars"
  | "bars-fill"
  | "media-bleed"
  | "roster"
  | "ask"
  | "chrome-feed"
  | "timeline-spine"
  | "key-value-sheet"
  | "stage-rail"
  | "media-toolbar"
  | "trend-pulse"
  | "compare-twin"
  | "dual-trend"
  | "spark-metric-grid"
  | "donut-legend"
  | "activity-feed"
  | "checklist"
  | "status-roster"
  | "agenda-strip"
  | "weather-band"
  | "video-stage"
  | "video-playlist"
  | "video-theater"
  | "client-accordion"
  | "client-master-detail"
  | "client-drawer"
  | "aging-buckets"
  | "aging-funnel"
  | "aging-cohort"
  | "notes-pad"
  | "notes-checklist"
  | "investigator-scope"
  | "coverage-hybrid"
  | "weather-ops"
  | "weather-week"
  | "weather-alert"
  | "weather-board"
>;

export const GLASS_CATALOG: PatternDef[] = [
  {
    id: "focal-stat",
    label: "Focal Stat",
    blurb: "One big number + label. The atomic metric.",
    sizes: ["XS", "S", "M"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "metric-strip",
    label: "Metric Strip",
    blurb: "2–4 dense metric tiles in a short row.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "trend-pulse",
    label: "Trend Pulse",
    blurb: "Big number with a simple sparkline.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "stage-rail",
    label: "Stage Rail",
    blurb: "Horizontal pipeline steps with active stage.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "focal-feature",
    label: "Focal Feature",
    blurb: "Full-bleed featured headline with accent rail.",
    sizes: ["XS", "S"],
    theme: "glass",
    folder: "Intel",
  },
  {
    id: "chrome-feed",
    label: "Chrome Feed",
    blurb: "Tabs / search chrome + feed. L+ only.",
    sizes: ["L", "XL"],
    theme: "glass",
    folder: "Intel",
  },
  {
    id: "timeline-spine",
    label: "Timeline Spine",
    blurb: "Vertical timeline with dots and entries.",
    sizes: ["S", "M", "L", "XL"],
    theme: "glass",
    folder: "Intel",
  },
  {
    id: "ask",
    label: "Ask",
    blurb: "Search + suggestions (M) or answer body (L+).",
    sizes: ["S", "M", "L", "XL"],
    theme: "glass",
    folder: "Intel",
  },
  {
    id: "media-bleed",
    label: "Media Bleed",
    blurb: "Full-bleed media plane + optional corner chrome.",
    sizes: ["M", "L", "XL"],
    theme: "glass",
    folder: "Evidence",
  },
  {
    id: "media-toolbar",
    label: "Media Toolbar",
    blurb: "Media plane with integrated top tool strip.",
    sizes: ["M", "L", "XL"],
    theme: "glass",
    folder: "Evidence",
  },
  {
    id: "card-list",
    label: "Card List",
    blurb: "Rail cards with optional summary line on larger sizes.",
    sizes: ["S", "M", "L", "XL"],
    theme: "glass",
    folder: "Evidence",
  },
  {
    id: "key-value-sheet",
    label: "Key-Value Sheet",
    blurb: "Labeled field pairs in a compact sheet.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Evidence",
  },
  {
    id: "stack-list",
    label: "Stack List",
    blurb: "Slot-capped rows with title / meta. Expand for overflow.",
    sizes: ["S", "M", "L", "XL"],
    theme: "glass",
    folder: "Field",
  },
  {
    id: "roster",
    label: "Roster",
    blurb: "Entity rows with trailing meta.",
    sizes: ["S", "M", "L", "XL"],
    theme: "glass",
    folder: "Field",
  },
  {
    id: "split-primary-secondary",
    label: "Split Primary / Secondary",
    blurb: "Dense metrics + narrower secondary zone.",
    sizes: ["L", "XL"],
    theme: "glass",
    folder: "Patterns",
  },
  {
    id: "metric-over-list",
    label: "Metric over List",
    blurb: "Centered metrics band, then list — never overlapping.",
    sizes: ["M", "L", "XL"],
    theme: "glass",
    folder: "Patterns",
  },
  {
    id: "metric-over-bars",
    label: "Metric over Bars",
    blurb: "Centered metrics band, then proportional bars.",
    sizes: ["M", "L", "XL"],
    theme: "glass",
    folder: "Patterns",
  },
  {
    id: "bars-fill",
    label: "Bars Fill",
    blurb: "Bars alone, filling the body.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Patterns",
  },
  {
    id: "compare-twin",
    label: "Compare Twin",
    blurb: "Two equal columns for side-by-side comparison.",
    sizes: ["M", "L", "XL"],
    theme: "glass",
    folder: "Patterns",
  },
  {
    id: "dual-trend",
    label: "Dual Trend",
    blurb: "KPI header + dual-series area/line chart.",
    sizes: ["S", "M", "L", "XL"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "spark-metric-grid",
    label: "Spark Metric Grid",
    blurb: "2×2 metric tiles with mini sparklines + deltas.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "donut-legend",
    label: "Donut Legend",
    blurb: "Distribution donut with legend.",
    sizes: ["S", "M", "L", "XL"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "activity-feed",
    label: "Activity Feed",
    blurb: "Avatar + action line + type/time meta.",
    sizes: ["S", "M", "L", "XL"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "checklist",
    label: "Checklist",
    blurb: "Task list with remaining count.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "status-roster",
    label: "Status Roster",
    blurb: "People rows with status pills.",
    sizes: ["S", "M", "L", "XL"],
    theme: "glass",
    folder: "Field",
  },
  {
    id: "agenda-strip",
    label: "Agenda Strip",
    blurb: "Day schedule with times + events.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Field",
  },
  {
    id: "weather-band",
    label: "Weather Band",
    blurb: "Current condition + day forecast chips.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Field",
  },
  {
    id: "video-stage",
    label: "Video Stage",
    blurb: "Player plane + transport bar.",
    sizes: ["S", "M", "L", "XL"],
    theme: "glass",
    folder: "Evidence",
  },
  {
    id: "video-playlist",
    label: "Video Playlist",
    blurb: "Player beside clip list.",
    sizes: ["M", "L", "XL"],
    theme: "glass",
    folder: "Evidence",
  },
  {
    id: "video-theater",
    label: "Video Theater",
    blurb: "Meta chrome + large stage + scrub.",
    sizes: ["L", "XL"],
    theme: "glass",
    folder: "Evidence",
  },
  {
    id: "client-accordion",
    label: "Client Accordion",
    blurb: "Client rows that expand inline to show cases.",
    sizes: ["M", "L", "XL"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "client-master-detail",
    label: "Client Master Detail",
    blurb: "Client list + side pane of cases.",
    sizes: ["L", "XL"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "client-drawer",
    label: "Client Drawer",
    blurb: "Compact client list; click opens cases modal.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "aging-buckets",
    label: "Aging Buckets",
    blurb: "Avg turnaround + age band tiles.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "aging-funnel",
    label: "Aging Funnel",
    blurb: "KPIs over age-band bars.",
    sizes: ["M", "L", "XL"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "aging-cohort",
    label: "Aging Cohort",
    blurb: "Trend spark + avg days by service.",
    sizes: ["L", "XL"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "notes-pad",
    label: "Notes Pad",
    blurb: "Personal freeform notes.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "notes-checklist",
    label: "Notes + Checklist",
    blurb: "Scratch notes stacked with a checklist.",
    sizes: ["M", "L", "XL"],
    theme: "glass",
    folder: "Ops",
  },
  {
    id: "investigator-scope",
    label: "Investigator Scope",
    blurb: "Picker + metrics/bars scoped to one investigator.",
    sizes: ["M", "L", "XL"],
    theme: "glass",
    folder: "Evidence",
  },
  {
    id: "coverage-hybrid",
    label: "Coverage Hybrid",
    blurb: "Hero metrics when small; + status roster at L+.",
    sizes: ["S", "M", "L", "XL"],
    theme: "glass",
    folder: "Field",
  },
  {
    id: "weather-ops",
    label: "Weather Ops",
    blurb: "Worst-risk banner + region go/hold rows.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Field",
  },
  {
    id: "weather-week",
    label: "Weather Week",
    blurb: "Field-week go/hold strip.",
    sizes: ["S", "M", "L"],
    theme: "glass",
    folder: "Field",
  },
  {
    id: "weather-alert",
    label: "Weather Alert",
    blurb: "Compact worst-region alert tile.",
    sizes: ["XS", "S", "M"],
    theme: "glass",
    folder: "Field",
  },
  {
    id: "weather-board",
    label: "Weather Board",
    blurb: "All 3 regions as tiles; select one for detail.",
    sizes: ["M", "L", "XL"],
    theme: "glass",
    folder: "Field",
  },
];

const RENDERERS: Record<GlassPatternId, (size: PatternSize) => ReactNode> = {
  "focal-stat": (s) => <FocalStat size={s} />,
  "focal-feature": (s) => <FocalFeature size={s} />,
  "metric-strip": (s) => <MetricStrip size={s} />,
  "stack-list": (s) => <StackList size={s} />,
  "card-list": (s) => <CardList size={s} />,
  "split-primary-secondary": (s) => <SplitPrimarySecondary size={s} />,
  "metric-over-list": (s) => <MetricOverList size={s} />,
  "metric-over-bars": (s) => <MetricOverBars size={s} />,
  "bars-fill": (s) => <BarsFill size={s} />,
  "media-bleed": (s) => <MediaBleed size={s} />,
  roster: (s) => <Roster size={s} />,
  ask: (s) => <Ask size={s} />,
  "chrome-feed": (s) => <ChromeFeed size={s} />,
  "timeline-spine": (s) => <TimelineSpine size={s} />,
  "key-value-sheet": (s) => <KeyValueSheet size={s} />,
  "stage-rail": (s) => <StageRail size={s} />,
  "media-toolbar": (s) => <MediaToolbar size={s} />,
  "trend-pulse": (s) => <TrendPulse size={s} />,
  "compare-twin": (s) => <CompareTwin size={s} />,
  "dual-trend": (s) => <DualTrend size={s} />,
  "spark-metric-grid": (s) => <SparkMetricGrid size={s} />,
  "donut-legend": (s) => <DonutLegend size={s} />,
  "activity-feed": (s) => <ActivityFeed size={s} />,
  checklist: (s) => <Checklist size={s} />,
  "status-roster": (s) => <StatusRoster size={s} />,
  "agenda-strip": (s) => <AgendaStrip size={s} />,
  "weather-band": (s) => <WeatherBand size={s} />,
  "video-stage": (s) => <VideoStage size={s} />,
  "video-playlist": (s) => <VideoPlaylist size={s} />,
  "video-theater": (s) => <VideoTheater size={s} />,
  "client-accordion": (s) => <ClientAccordion size={s} />,
  "client-master-detail": (s) => <ClientMasterDetail size={s} />,
  "client-drawer": (s) => <ClientDrawer size={s} />,
  "aging-buckets": (s) => <AgingBuckets size={s} />,
  "aging-funnel": (s) => <AgingFunnel size={s} />,
  "aging-cohort": (s) => <AgingCohort size={s} />,
  "notes-pad": (s) => <NotesPad size={s} />,
  "notes-checklist": (s) => <NotesChecklist size={s} />,
  "investigator-scope": (s) => <InvestigatorScope size={s} />,
  "coverage-hybrid": (s) => <CoverageHybrid size={s} />,
  "weather-ops": (s) => <WeatherOps size={s} />,
  "weather-week": (s) => <WeatherWeek size={s} />,
  "weather-alert": (s) => <WeatherAlert size={s} />,
  "weather-board": (s) => <WeatherBoard size={s} />,
};

export function renderGlassPattern(id: PatternId, size: PatternSize): ReactNode {
  const render = RENDERERS[id as GlassPatternId];
  if (!render) return null;
  return render(size);
}

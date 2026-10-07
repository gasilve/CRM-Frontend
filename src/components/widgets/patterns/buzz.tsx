import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PatternDef, PatternId, PatternSize } from "@/lib/pattern-size";
import { slotsForSize } from "@/lib/pattern-size";
import {
  MockBar,
  MockMetric,
  MockPill,
  MoreFooter,
  PatternExpandModal,
  PatternFrame,
} from "./PatternChrome";

const FOLDER = "Buzz";

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

const SPARK = [18, 16, 19, 17, 22, 21, 26, 24, 29, 31, 30, 38];

function takeSlots(size: PatternSize, rowPx = 40, reserved = 52) {
  return slotsForSize(size, rowPx, reserved);
}

/** Unread / attention pip — Theme B cue without leaving the palette. */
function AttentionDot({ tone = "accent" }: { tone?: "accent" | "warn" | "neg" }) {
  const color =
    tone === "warn" ? "var(--color-warn)" : tone === "neg" ? "var(--color-neg)" : "var(--color-accent)";
  return (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" style={{ background: color }} />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

function CountBubble({
  n,
  tone = "neg",
}: {
  n: number;
  tone?: "neg" | "warn" | "accent";
}) {
  if (n <= 0) return null;
  const bg =
    tone === "warn" ? "var(--color-warn)" : tone === "accent" ? "var(--color-accent)" : "var(--color-neg)";
  return (
    <span
      className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full px-1 font-mono text-[0.5rem] font-bold leading-none text-white"
      style={{ background: bg }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

function BuzzRow({
  title,
  meta,
  unread,
  urgent,
  onClick,
}: {
  title: string;
  meta?: string;
  unread?: boolean;
  urgent?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative flex w-full min-w-0 items-center gap-2 rounded-[0.625rem] border px-2 py-1.5 text-left",
        unread
          ? "border-[var(--color-accent)]/35 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"
          : "border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_40%,transparent)]",
        onClick && "cursor-pointer hover:border-[var(--color-line-2)]",
      )}
    >
      <span
        className="absolute inset-y-1.5 left-0 w-[0.15rem] rounded-full"
        style={{ background: urgent ? "var(--color-neg)" : unread ? "var(--color-accent)" : "var(--color-line-2)" }}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 items-center gap-1.5 pl-1.5">
        {unread && <AttentionDot tone={urgent ? "neg" : "accent"} />}
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-[0.75rem] text-[var(--color-text-hi)]", unread && "font-semibold")}>{title}</div>
          {meta && (
            <div className="truncate font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">{meta}</div>
          )}
        </div>
      </div>
      {urgent && (
        <MockPill color="var(--color-neg)">Rush</MockPill>
      )}
    </Tag>
  );
}

function SparkBuzz({ className }: { className?: string }) {
  const w = 100;
  const h = 40;
  const max = Math.max(...SPARK);
  const min = Math.min(...SPARK);
  const range = max - min || 1;
  const points = SPARK.map((v, i) => {
    const x = (i / (SPARK.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  }).join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-full w-full text-[var(--color-accent)]", className)} aria-hidden>
      <polygon fill="currentColor" opacity="0.14" points={area} />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function ShoutStat({ size }: { size: PatternSize }) {
  if (size === "M") {
    return (
      <PatternFrame title="Shout Stat" size={size} theme="buzz" badge={8}>
        <div className="grid h-full min-h-0 grid-cols-[1.3fr_1fr] gap-2">
          <div className="relative flex flex-col justify-center overflow-hidden rounded-[0.625rem] border border-[var(--color-accent)]/30 bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5">
              <AttentionDot tone="neg" />
              <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-neg)]">8 overdue</span>
            </div>
            <div className="text-[2.5rem] font-semibold leading-none tabular-nums text-[var(--color-text-hi)]">47</div>
            <div className="mt-1 font-mono text-[0.5rem] uppercase tracking-[0.14em] text-[var(--color-text-lo)]">Open cases</div>
          </div>
          <div className="grid grid-rows-2 gap-2">
            <MockMetric value="12" label="Rush" tone="var(--color-warn)" dense />
            <MockMetric value="8" label="Overdue" tone="var(--color-neg)" dense />
          </div>
        </div>
      </PatternFrame>
    );
  }
  return (
    <PatternFrame title="Shout Stat" size={size} theme="buzz" badge={8}>
      <div className="flex h-full flex-col justify-center gap-2">
        <div className="flex items-center gap-1.5">
          <AttentionDot tone="warn" />
          <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-warn)]">Needs attention</span>
        </div>
        <div className={cn("font-semibold leading-none tabular-nums text-[var(--color-text-hi)]", size === "XS" ? "text-[1.75rem]" : "text-[2.75rem]")}>
          47
        </div>
        <div className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[var(--color-text-lo)]">Open cases</div>
        {size === "S" && <div className="text-[0.6875rem] text-[var(--color-text-mid)]">12 rush · 8 overdue</div>}
      </div>
    </PatternFrame>
  );
}

function HeatTile({ size }: { size: PatternSize }) {
  return (
    <PatternFrame title="Heat Tile" size={size} theme="buzz" badge={1} padded={false}>
      <button
        type="button"
        className="relative flex h-full w-full flex-col justify-end overflow-hidden bg-[linear-gradient(165deg,var(--color-ink-1)_0%,color-mix(in_srgb,var(--color-accent)_45%,var(--color-ink-2))_55%,var(--color-accent)_140%)] text-left"
      >
        <div className="absolute right-2.5 top-2.5 z-10">
          <CountBubble n={1} tone="neg" />
        </div>
        <div className="relative z-10 w-full border-t border-white/10 bg-[linear-gradient(to_top,rgba(8,12,22,0.92),rgba(8,12,22,0.5))] px-3 py-2.5 backdrop-blur-sm">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <MockPill>Intel</MockPill>
            <MockPill color="var(--color-neg)">Unread</MockPill>
            <span className="font-mono text-[0.5rem] text-white/60">2h ago</span>
          </div>
          <div className={cn("font-medium leading-snug text-white", size === "XS" ? "line-clamp-2 text-[0.75rem]" : "line-clamp-3 text-[0.875rem]")}>
            {HEADLINES[0]}
          </div>
        </div>
      </button>
    </PatternFrame>
  );
}

function ChipStrip({ size }: { size: PatternSize }) {
  const metrics = [
    { v: "47", l: "Open", t: undefined as string | undefined },
    { v: "8", l: "Overdue", t: "var(--color-neg)" },
    { v: "12", l: "Rush", t: "var(--color-warn)" },
    { v: "3", l: "Hold", t: undefined },
  ];
  if (size === "L") {
    return (
      <PatternFrame title="Chip Strip" size={size} theme="buzz" badge={20}>
        <div className="grid h-full grid-cols-2 grid-rows-2 gap-2">
          {metrics.map((m) => (
            <MockMetric key={m.l} value={m.v} label={m.l} tone={m.t} />
          ))}
        </div>
      </PatternFrame>
    );
  }
  return (
    <PatternFrame title="Chip Strip" size={size} theme="buzz" badge={20}>
      <div className={cn("grid h-full gap-2", size === "S" ? "grid-cols-2" : "grid-cols-4")}>
        {metrics.slice(0, size === "S" ? 2 : 4).map((m) => (
          <MockMetric key={m.l} value={m.v} label={m.l} tone={m.t} dense={size === "S"} />
        ))}
      </div>
    </PatternFrame>
  );
}

function ScrollStack({ size }: { size: PatternSize }) {
  const [open, setOpen] = useState(false);
  const n = takeSlots(size, 44, 48);
  const items = NAMES.map((name, i) => ({
    name,
    caseId: CASES[i],
    unread: i < 3,
    urgent: i === 0 || i === 2,
  }));
  const visible = items.slice(0, n);
  const unreadCount = items.filter((i) => i.unread).length;
  return (
    <PatternFrame title="Scroll Stack" size={size} theme="buzz" badge={unreadCount}>
      <div className="flex h-full min-h-0 flex-col gap-1.5">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <span className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-[var(--color-text-lo)]">Caseload</span>
          <span className="flex items-center gap-1 font-mono text-[0.5rem] uppercase text-[var(--color-accent-2)]">
            <AttentionDot /> {unreadCount} unread
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
          {visible.map((item) => (
            <BuzzRow
              key={item.name}
              title={item.name}
              meta={`${item.caseId} · Workers Comp`}
              unread={item.unread}
              urgent={item.urgent}
              onClick={() => setOpen(true)}
            />
          ))}
          <MoreFooter count={items.length - n} onClick={() => setOpen(true)} />
        </div>
      </div>
      <PatternExpandModal title="Scroll Stack" open={open} onClose={() => setOpen(false)}>
        {items.map((item) => (
          <BuzzRow key={item.name} title={item.name} meta={`${item.caseId} · Workers Comp`} unread={item.unread} urgent={item.urgent} />
        ))}
      </PatternExpandModal>
    </PatternFrame>
  );
}

function BuzzCards({ size }: { size: PatternSize }) {
  const [open, setOpen] = useState(false);
  const n = size === "S" ? 2 : size === "M" ? 2 : size === "L" ? 3 : 3;
  const cards = HEADLINES.map((h, i) => ({
    headline: h,
    pill: i % 2 ? "Case law" : "Regulation",
    color: i % 2 ? "var(--color-accent-2)" : "var(--color-warn)",
    ago: `${i + 1}h ago`,
    unread: i < 2,
  }));
  const visible = cards.slice(0, n);
  return (
    <PatternFrame title="Buzz Cards" size={size} theme="buzz" badge={2}>
      <div className="flex h-full min-h-0 flex-col gap-1.5">
        {visible.map((card) => (
          <button
            key={card.headline}
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "relative flex min-h-0 w-full flex-1 flex-col justify-center overflow-hidden rounded-[0.625rem] border px-2.5 py-1.5 text-left",
              card.unread
                ? "border-[var(--color-accent)]/35 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"
                : "border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_40%,transparent)]",
            )}
          >
            <span className="absolute inset-y-1.5 left-0 w-[0.18rem] rounded-full" style={{ background: card.color }} aria-hidden />
            <div className="flex shrink-0 items-center gap-1.5 pl-2">
              {card.unread && <AttentionDot />}
              <MockPill color={card.color}>{card.pill}</MockPill>
              <span className="ml-auto font-mono text-[0.5rem] text-[var(--color-text-lo)]">{card.ago}</span>
            </div>
            <div className={cn("mt-0.5 pl-2 text-[0.75rem] font-medium leading-snug text-[var(--color-text-hi)]", size === "S" ? "line-clamp-1" : "line-clamp-2")}>
              {card.headline}
            </div>
          </button>
        ))}
        <MoreFooter count={cards.length - n} onClick={() => setOpen(true)} />
      </div>
      <PatternExpandModal title="Buzz Cards" open={open} onClose={() => setOpen(false)}>
        {cards.map((card) => (
          <div key={card.headline} className="rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 p-3">
            <div className="mb-1 flex gap-1.5">
              <MockPill color={card.color}>{card.pill}</MockPill>
              {card.unread && <MockPill color="var(--color-accent)">Unread</MockPill>}
            </div>
            <div className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{card.headline}</div>
          </div>
        ))}
      </PatternExpandModal>
    </PatternFrame>
  );
}

function DuelSplit({ size }: { size: PatternSize }) {
  return (
    <PatternFrame title="Duel Split" size={size} theme="buzz" badge={8}>
      <div className="flex h-full min-h-0 flex-row gap-2">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-1.5 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            Primary <CountBubble n={8} />
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5">
            <MockMetric value="47" label="Open" align="center" />
            <MockMetric value="8" label="Overdue" tone="var(--color-neg)" align="center" />
            <MockMetric value="12" label="Rush" tone="var(--color-warn)" align="center" />
            <MockMetric value="3" label="Hold" dense align="center" />
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 border-l border-[var(--color-line)] pl-2">
          <div className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Secondary</div>
          <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1">
            <MockBar label="Surveil" value={18} max={18} />
            <MockBar label="WC" value={12} max={18} />
            <MockBar label="Social" value={7} max={18} />
            {(size === "L" || size === "XL") && <MockBar label="FMLA" value={4} max={18} />}
            {size === "XL" && <MockBar label="BG" value={5} max={18} />}
          </div>
        </div>
      </div>
    </PatternFrame>
  );
}

function HeatOverFeed({ size }: { size: PatternSize }) {
  const [open, setOpen] = useState(false);
  const n = size === "M" ? 2 : size === "L" ? 3 : 4;
  return (
    <PatternFrame title="Heat over Feed" size={size} theme="buzz" badge={3}>
      <div className="flex h-full min-h-0 flex-col gap-1.5">
        <div className="grid shrink-0 grid-cols-3 gap-1.5">
          <MockMetric value="1" label="Pending" tone="var(--color-warn)" align="center" dense />
          <MockMetric value="1" label="Accepted" tone="var(--color-pos)" align="center" dense />
          <MockMetric value="0" label="File errs" align="center" dense />
        </div>
        <div className="flex shrink-0 items-center justify-between">
          <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Inbox</span>
          <span className="flex items-center gap-1 font-mono text-[0.5rem] text-[var(--color-accent-2)]">
            <AttentionDot /> 3 new
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1 overflow-hidden">
          {NAMES.slice(0, n).map((name, i) => (
            <BuzzRow
              key={name}
              title={name}
              meta={`${COMPANIES[i]} · 2d ago`}
              unread={i < 2}
              urgent={i === 0}
              onClick={() => setOpen(true)}
            />
          ))}
          <MoreFooter count={NAMES.length - n} onClick={() => setOpen(true)} />
        </div>
      </div>
      <PatternExpandModal title="Heat over Feed" open={open} onClose={() => setOpen(false)}>
        {NAMES.map((name, i) => (
          <BuzzRow key={name} title={name} meta={`${COMPANIES[i]} · 2d ago`} unread={i < 2} urgent={i === 0} />
        ))}
      </PatternExpandModal>
    </PatternFrame>
  );
}

function HeatOverBars({ size }: { size: PatternSize }) {
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
    <PatternFrame title="Heat over Bars" size={size} theme="buzz" badge={4}>
      <div className="flex h-full min-h-0 flex-col gap-1.5">
        <div className="grid shrink-0 grid-cols-3 gap-1.5">
          <MockMetric value="64" label="Total" align="center" dense />
          <MockMetric value="4" label="24h" align="center" dense />
          <MockMetric value="4" label="Failed" tone="var(--color-neg)" align="center" dense />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="shrink-0 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Storage</div>
          <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1">
            {data.slice(0, bars).map(([l, v]) => (
              <MockBar key={l} label={l} value={v} max={42} />
            ))}
          </div>
        </div>
      </div>
    </PatternFrame>
  );
}

function FillMeters({ size }: { size: PatternSize }) {
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
    <PatternFrame title="Fill Meters" size={size} theme="buzz">
      <div className="flex h-full min-h-0 flex-col justify-evenly gap-1">
        {data.slice(0, n).map(([l, v]) => (
          <MockBar key={l} label={l} value={v} max={12} />
        ))}
      </div>
    </PatternFrame>
  );
}

function UrgencyFeed({ size }: { size: PatternSize }) {
  const [open, setOpen] = useState(false);
  const n = size === "S" ? 3 : size === "M" ? 4 : 5;
  return (
    <PatternFrame title="Urgency Feed" size={size} theme="buzz" badge={4}>
      <div className="flex h-full min-h-0 flex-col gap-1.5">
        <div className="flex shrink-0 items-center gap-2 rounded-[0.5rem] border border-[var(--color-neg)]/30 bg-[color-mix(in_srgb,var(--color-neg)_10%,transparent)] px-2 py-1">
          <AttentionDot tone="neg" />
          <span className="font-mono text-[0.5rem] font-semibold uppercase tracking-wider text-[var(--color-neg)]">
            4 unread intel items
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
          {HEADLINES.slice(0, n).map((h, i) => (
            <button
              key={h}
              type="button"
              onClick={() => setOpen(true)}
              className="flex min-w-0 items-start gap-2 border-b border-[var(--color-line)]/60 py-1.5 text-left last:border-0 hover:bg-[color-mix(in_srgb,var(--color-ink-3)_40%,transparent)]"
            >
              {i < 2 ? <AttentionDot /> : <span className="mt-1 h-2 w-2 shrink-0" />}
              <span className="mt-0.5 shrink-0 font-mono text-[0.5rem] text-[var(--color-text-lo)]">{i + 1}h</span>
              <span className={cn("line-clamp-2 text-[0.75rem] leading-snug text-[var(--color-text-hi)]", i < 2 && "font-semibold")}>
                {h}
              </span>
            </button>
          ))}
          <MoreFooter count={HEADLINES.length - n} onClick={() => setOpen(true)} />
        </div>
      </div>
      <PatternExpandModal title="Urgency Feed" open={open} onClose={() => setOpen(false)}>
        {HEADLINES.map((h, i) => (
          <div key={h} className="border-b border-[var(--color-line)] py-2 text-[0.8125rem] text-[var(--color-text-hi)] last:border-0">
            <span className="mr-2 font-mono text-[0.5rem] text-[var(--color-text-lo)]">{i + 1}h</span>
            {h}
          </div>
        ))}
      </PatternExpandModal>
    </PatternFrame>
  );
}

function CrowdRoster({ size }: { size: PatternSize }) {
  const n = takeSlots(size, 36, 40);
  return (
    <PatternFrame title="Crowd Roster" size={size} theme="buzz" badge={2}>
      <div className="flex h-full min-h-0 flex-col justify-evenly gap-0.5">
        {NAMES.slice(0, n).map((name, i) => (
          <div key={name} className="flex items-center justify-between gap-2 rounded-[0.5rem] px-1 py-1">
            <div className="flex min-w-0 items-center gap-2">
              {i < 2 && <AttentionDot tone="warn" />}
              <span className="truncate text-[0.75rem] text-[var(--color-text-hi)]">{name}</span>
            </div>
            <span className="shrink-0 font-mono text-[0.5rem] text-[var(--color-text-lo)]">{CASES[i]}</span>
          </div>
        ))}
      </div>
    </PatternFrame>
  );
}

function PromptBar({ size }: { size: PatternSize }) {
  const centerS = size === "S";
  return (
    <PatternFrame title="Prompt Bar" size={size} theme="buzz">
      <div className={cn("flex h-full flex-col gap-2", centerS && "justify-center")}>
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 px-2.5 py-2 text-[0.75rem] text-[var(--color-text-lo)]">
            <Search size={12} className="shrink-0 opacity-60" />
            <span className="truncate">e.g. CA surveillance privacy…</span>
          </div>
          <div className="relative shrink-0 rounded-[0.5rem] border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-3 py-2 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-hi)]">
            Ask
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--color-accent)]" aria-hidden />
          </div>
        </div>
        {size === "M" && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {["CA privacy", "SIU fraud", "FMLA abuse"].map((s) => (
              <span
                key={s}
                className="rounded-full border border-[var(--color-line)] px-2.5 py-1 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-mid)]"
              >
                {s}
              </span>
            ))}
          </div>
        )}
        {(size === "L" || size === "XL") && (
          <div className="min-h-0 flex-1 overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/30 p-2.5">
            <div className="mb-1 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Cached · answer</div>
            <p className="text-[0.75rem] leading-snug text-[var(--color-text-mid)]">
              Referral thresholds moved this week — review the overdue queue before assigning new field work.
            </p>
          </div>
        )}
      </div>
    </PatternFrame>
  );
}

function PulseLine({ size }: { size: PatternSize }) {
  const numClass = size === "L" ? "text-[2.5rem]" : size === "M" ? "text-[2rem]" : "text-[1.625rem]";
  const sparkH = size === "L" ? "h-[4.5rem]" : size === "M" ? "h-[3.25rem]" : "h-[2.25rem]";
  return (
    <PatternFrame title="Pulse Line" size={size} theme="buzz" badge={1}>
      <div className="flex h-full min-h-0 items-center gap-3">
        <div className="min-w-0 shrink-0">
          <div className="mb-1 flex items-center gap-1.5">
            <AttentionDot tone="warn" />
            <span className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--color-text-lo)]">SIU referrals</span>
          </div>
          <div className={cn("font-semibold leading-none tabular-nums text-[var(--color-text-hi)]", numClass)}>38</div>
          <div className="mt-1.5 font-mono text-[0.5625rem] text-[var(--color-pos)]">+12% vs prior week</div>
        </div>
        <div className={cn("min-w-0 flex-1", sparkH)}>
          <SparkBuzz />
        </div>
      </div>
    </PatternFrame>
  );
}

function VsColumns({ size }: { size: PatternSize }) {
  const rows = size === "M" ? 3 : size === "L" ? 4 : 5;
  return (
    <PatternFrame title="VS Columns" size={size} theme="buzz" badge={3}>
      <div className="grid h-full min-h-0 grid-cols-2 gap-2">
        {[
          { title: "Claimants", items: NAMES.slice(0, rows), unread: 2 },
          { title: "Cases", items: CASES.slice(0, rows), unread: 1 },
        ].map((col) => (
          <div
            key={col.title}
            className="flex min-h-0 flex-col overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_35%,transparent)] p-2.5"
          >
            <div className="mb-2 flex shrink-0 items-center justify-between border-b border-[var(--color-line)] pb-2">
              <div>
                <div className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">{col.title}</div>
                <div className="text-[1.25rem] font-semibold tabular-nums text-[var(--color-text-hi)]">{col.items.length}</div>
              </div>
              <CountBubble n={col.unread} tone="accent" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-between gap-1">
              {col.items.map((item, i) => (
                <div key={item} className="flex min-w-0 items-center gap-1.5">
                  {i < col.unread && <AttentionDot />}
                  <span className="truncate text-[0.75rem] text-[var(--color-text-hi)]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PatternFrame>
  );
}

function StreakRail({ size }: { size: PatternSize }) {
  const stages = ["Intake", "Triage", "Field", "SIU", "Legal", "Done"];
  const active = 2;
  const visible = size === "S" ? stages.slice(0, 4) : size === "M" ? stages.slice(0, 5) : stages;
  return (
    <PatternFrame title="Streak Rail" size={size} theme="buzz" badge={1}>
      <div className="flex h-full flex-col justify-center gap-2">
        <div className="flex items-center gap-1.5">
          <AttentionDot tone="accent" />
          <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Active stage · Field</span>
        </div>
        <div className="flex w-full min-w-0">
          {visible.map((s, i) => (
            <div key={s} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
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
                  "relative z-[1] grid h-5 w-5 place-items-center rounded-full border text-[0.5rem] font-semibold",
                  i < active && "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-ink-1)]",
                  i === active &&
                    "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] text-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30",
                  i > active && "border-[var(--color-line)] bg-[var(--color-ink-3)] text-[var(--color-text-lo)]",
                )}
              >
                {i + 1}
              </span>
              <span className="w-full truncate px-0.5 text-center font-mono text-[0.4375rem] uppercase tracking-wider text-[var(--color-text-lo)]" title={s}>
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PatternFrame>
  );
}

function KeyBlast({ size }: { size: PatternSize }) {
  const pairs = [
    ["Claimant", "Tomas Herrera"],
    ["Case", "C-5001"],
    ["Carrier", "Hartford"],
    ["Status", "Active review"],
    ["Referral", "Staged collision"],
    ["Analyst", "Riley Chen"],
  ];
  const n = size === "S" ? 4 : size === "M" ? 5 : 6;
  return (
    <PatternFrame title="Key Blast" size={size} theme="buzz" badge={1}>
      <div className="flex h-full min-h-0 flex-col justify-center px-0.5 py-1">
        {pairs.slice(0, n).map(([l, v], i) => (
          <div key={l} className="flex items-baseline justify-between gap-2 border-b border-[var(--color-line)]/60 py-2 last:border-0">
            <span className="flex items-center gap-1.5 font-mono text-[0.5rem] uppercase tracking-[0.1em] text-[var(--color-text-lo)]">
              {i === 3 && <AttentionDot tone="warn" />}
              {l}
            </span>
            <span className="min-w-0 truncate text-right text-[0.75rem] text-[var(--color-text-hi)]">{v}</span>
          </div>
        ))}
      </div>
    </PatternFrame>
  );
}

type BuzzPatternId = Extract<
  PatternId,
  | "shout-stat"
  | "heat-tile"
  | "chip-strip"
  | "scroll-stack"
  | "buzz-cards"
  | "duel-split"
  | "heat-over-feed"
  | "heat-over-bars"
  | "fill-meters"
  | "urgency-feed"
  | "crowd-roster"
  | "prompt-bar"
  | "pulse-line"
  | "vs-columns"
  | "streak-rail"
  | "key-blast"
>;

export const BUZZ_CATALOG: PatternDef[] = [
  { id: "shout-stat", label: "Shout Stat", blurb: "Hero metric with overdue attention badge.", sizes: ["XS", "S", "M"], theme: "buzz", folder: FOLDER },
  { id: "chip-strip", label: "Chip Strip", blurb: "Metric chips; badge for total alerts.", sizes: ["S", "M", "L"], theme: "buzz", folder: FOLDER },
  { id: "pulse-line", label: "Pulse Line", blurb: "Trend with unread pip + scaling sparkline.", sizes: ["S", "M", "L"], theme: "buzz", folder: FOLDER },
  { id: "streak-rail", label: "Streak Rail", blurb: "Pipeline with active-stage ring.", sizes: ["S", "M", "L"], theme: "buzz", folder: FOLDER },
  { id: "heat-tile", label: "Heat Tile", blurb: "Featured intel with unread bubble.", sizes: ["XS", "S", "M"], theme: "buzz", folder: FOLDER },
  { id: "urgency-feed", label: "Urgency Feed", blurb: "Intel list with unread dots + alert strip.", sizes: ["S", "M", "L"], theme: "buzz", folder: FOLDER },
  { id: "prompt-bar", label: "Prompt Bar", blurb: "Ask field with CTA attention pip.", sizes: ["S", "M", "L", "XL"], theme: "buzz", folder: FOLDER },
  { id: "scroll-stack", label: "Scroll Stack", blurb: "Caseload rows with unread / rush cues.", sizes: ["S", "M", "L", "XL"], theme: "buzz", folder: FOLDER },
  { id: "buzz-cards", label: "Buzz Cards", blurb: "Cards with unread highlight.", sizes: ["S", "M", "L", "XL"], theme: "buzz", folder: FOLDER },
  { id: "crowd-roster", label: "Crowd Roster", blurb: "Roster with attention pips on hot rows.", sizes: ["S", "M", "L", "XL"], theme: "buzz", folder: FOLDER },
  { id: "key-blast", label: "Key Blast", blurb: "Key-values with status attention.", sizes: ["S", "M", "L"], theme: "buzz", folder: FOLDER },
  { id: "duel-split", label: "Duel Split", blurb: "50/50 split with overdue bubble.", sizes: ["L", "XL"], theme: "buzz", folder: FOLDER },
  { id: "heat-over-feed", label: "Heat over Feed", blurb: "Metrics + inbox with new count.", sizes: ["M", "L", "XL"], theme: "buzz", folder: FOLDER },
  { id: "heat-over-bars", label: "Heat over Bars", blurb: "Compact metrics, bars take height.", sizes: ["M", "L", "XL"], theme: "buzz", folder: FOLDER },
  { id: "fill-meters", label: "Fill Meters", blurb: "Bars that scale with footprint.", sizes: ["S", "M", "XL"], theme: "buzz", folder: FOLDER },
  { id: "vs-columns", label: "VS Columns", blurb: "Compare columns with unread bubbles.", sizes: ["M", "L", "XL"], theme: "buzz", folder: FOLDER },
];

const RENDERERS: Record<BuzzPatternId, (s: PatternSize) => ReactNode> = {
  "shout-stat": (s) => <ShoutStat size={s} />,
  "heat-tile": (s) => <HeatTile size={s} />,
  "chip-strip": (s) => <ChipStrip size={s} />,
  "scroll-stack": (s) => <ScrollStack size={s} />,
  "buzz-cards": (s) => <BuzzCards size={s} />,
  "duel-split": (s) => <DuelSplit size={s} />,
  "heat-over-feed": (s) => <HeatOverFeed size={s} />,
  "heat-over-bars": (s) => <HeatOverBars size={s} />,
  "fill-meters": (s) => <FillMeters size={s} />,
  "urgency-feed": (s) => <UrgencyFeed size={s} />,
  "crowd-roster": (s) => <CrowdRoster size={s} />,
  "prompt-bar": (s) => <PromptBar size={s} />,
  "pulse-line": (s) => <PulseLine size={s} />,
  "vs-columns": (s) => <VsColumns size={s} />,
  "streak-rail": (s) => <StreakRail size={s} />,
  "key-blast": (s) => <KeyBlast size={s} />,
};

export function renderBuzzPattern(id: PatternId, size: PatternSize): ReactNode {
  const fn = RENDERERS[id as BuzzPatternId];
  return fn ? fn(size) : null;
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SteeringWheelIcon } from "@/components/case/SteeringWheelIcon";

/** Seats per row for each supported layout — front row is always driver + one. */
const ROW_COUNTS: Record<number, number[]> = {
  2: [2],
  4: [2, 2],
  5: [2, 3],
  6: [2, 2, 2],
  7: [2, 2, 3],
};

export function rowsForSeatCount(seatCount: number): number[] {
  return ROW_COUNTS[seatCount] ?? ROW_COUNTS[5];
}

const W = 250;
/** Nose (bumper + hood + windshield) above the cabin, tail (rear window + boot) below. */
const NOSE = 124;
const TAIL = 108;
const ROW_H = 104;

/**
 * Top-down chassis the seats sit on. Drawn as plain SVG rather than a picture
 * so every seat stays a real, hoverable target and the silhouette stretches to
 * however many rows the vehicle actually has.
 */
export function VehicleChassis({
  seatCount,
  driverSeat,
  passengerSeats,
  maxWidth = "17rem",
  fill = false,
  className,
}: {
  seatCount: number;
  driverSeat: ReactNode;
  passengerSeats: ReactNode[];
  /** Widens the whole diagram — the vehicle modal gives it a lot more room than the drawer. */
  maxWidth?: string;
  /** Grow to fill a height-constrained parent (the vehicle modal) instead of sizing off width alone. */
  fill?: boolean;
  className?: string;
}) {
  const rows = rowsForSeatCount(seatCount);
  const cabinH = rows.length * ROW_H;
  const H = NOSE + cabinH + TAIL;

  const frontPassenger = passengerSeats[0] ?? null;
  const rest = passengerSeats.slice(1);
  const rowSeats: ReactNode[][] = [[driverSeat, frontPassenger]];
  let cursor = 0;
  for (let r = 1; r < rows.length; r++) {
    rowSeats.push(rest.slice(cursor, cursor + rows[r]));
    cursor += rows[r];
  }

  const cabinTopPct = (NOSE / H) * 100;
  const cabinHeightPct = (cabinH / H) * 100;
  const bodyTop = 16;
  const bodyBottom = H - 16;
  // Dash wheel sits above the driver column — a touch down and left of center.
  const wheelTopPct = cabinTopPct + 1.25;

  const box = (
    <div
      className={cn("relative", className)}
      style={
        fill
          ? { aspectRatio: `${W} / ${H}`, width: "auto", height: `min(100cqh, calc(100cqw * ${(H / W).toFixed(4)}))` }
          : { aspectRatio: `${W} / ${H}`, width: "100%", maxWidth }
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" aria-hidden>
        {[
          { y: NOSE - 66 },
          { y: NOSE + cabinH + 6 },
        ].map((axle, i) => (
          <g key={i} fill="var(--color-ink-3)" stroke="var(--color-line-2)" strokeWidth="2">
            <rect x="2" y={axle.y} width="22" height="62" rx="10" />
            <rect x={W - 24} y={axle.y} width="22" height="62" rx="10" />
          </g>
        ))}

        <rect
          x="18"
          y={bodyTop}
          width={W - 36}
          height={bodyBottom - bodyTop}
          rx="46"
          fill="var(--color-ink-2)"
          stroke="var(--color-line-2)"
          strokeWidth="2.5"
        />

        <path
          d={`M 40 ${bodyTop + 26} Q ${W / 2} ${bodyTop + 4} ${W - 40} ${bodyTop + 26} L ${W - 44} ${bodyTop + 54} Q ${W / 2} ${bodyTop + 36} 44 ${bodyTop + 54} Z`}
          fill="var(--color-ink-3)"
          opacity="0.85"
        />
        <path
          d={`M 44 ${NOSE - 10} Q ${W / 2} ${NOSE - 46} ${W - 44} ${NOSE - 10} L ${W - 40} ${NOSE} L 40 ${NOSE} Z`}
          fill="var(--color-accent-soft)"
          stroke="var(--color-line-2)"
          strokeWidth="1.5"
        />

        <path
          d={`M 40 ${NOSE + cabinH} L ${W - 40} ${NOSE + cabinH} L ${W - 44} ${NOSE + cabinH + 36} Q ${W / 2} ${NOSE + cabinH + 66} 44 ${NOSE + cabinH + 36} Z`}
          fill="var(--color-accent-soft)"
          stroke="var(--color-line-2)"
          strokeWidth="1.5"
        />
        <path
          d={`M 44 ${bodyBottom - 52} Q ${W / 2} ${bodyBottom - 34} ${W - 44} ${bodyBottom - 52} L ${W - 40} ${bodyBottom - 24} Q ${W / 2} ${bodyBottom - 6} 40 ${bodyBottom - 24} Z`}
          fill="var(--color-ink-3)"
          opacity="0.85"
        />

        <rect x="6" y={NOSE + 4} width="14" height="20" rx="6" fill="var(--color-ink-3)" stroke="var(--color-line-2)" strokeWidth="1.5" />
        <rect x={W - 20} y={NOSE + 4} width="14" height="20" rx="6" fill="var(--color-ink-3)" stroke="var(--color-line-2)" strokeWidth="1.5" />

        {rows.slice(1).map((_, i) => (
          <line
            key={i}
            x1="34"
            x2={W - 34}
            y1={NOSE + (i + 1) * ROW_H}
            y2={NOSE + (i + 1) * ROW_H}
            stroke="var(--color-line)"
            strokeDasharray="5 6"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      <div
        className="absolute inset-x-0 flex flex-col"
        style={{ top: `${cabinTopPct}%`, height: `${cabinHeightPct}%` }}
      >
        {rowSeats.map((seats, ri) => (
          <div key={ri} className="flex flex-1 items-center justify-evenly px-[8%]">
            {seats.map((seat, si) => (
              <div key={si}>{seat}</div>
            ))}
          </div>
        ))}
      </div>

      {/* Dash steering wheel — between the last two horizontal placements */}
      <div
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[var(--color-text-mid)] opacity-80"
        style={{ left: "32.25%", top: `${wheelTopPct}%` }}
        title="Driver side"
      >
        <SteeringWheelIcon size={45} />
      </div>
    </div>
  );

  if (!fill) return <div className="flex w-full justify-center">{box}</div>;

  return (
    <div className="grid min-h-0 w-full flex-1 place-items-center" style={{ containerType: "size" }}>
      {box}
    </div>
  );
}

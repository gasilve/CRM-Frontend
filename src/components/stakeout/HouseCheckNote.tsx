import type { StakeoutPlan } from "@/lib/crm-api";

type HouseCheck = NonNullable<StakeoutPlan["plan"]["houseCheck"]>;

const TITLE: Record<HouseCheck["status"], string> = {
  verified: "✓ House confirmed",
  likely: "House not fully confirmed",
  unverified: "⚠ Can't tell which house to watch",
};

/** Whether the map is sure the outlined house is the subject's, and why. */
export function HouseCheckNote({ check, compact = false }: { check: HouseCheck; compact?: boolean }) {
  return (
    <div className={`stk-house-check ${check.status}${compact ? " compact" : ""}`} role={check.status === "unverified" ? "alert" : undefined}>
      <strong>{TITLE[check.status]}</strong>
      {(!compact || check.status === "unverified") && <span>{check.message}</span>}
    </div>
  );
}

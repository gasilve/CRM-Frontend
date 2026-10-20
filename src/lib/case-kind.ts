/** Claim type is the insurance matter. Work is what we were hired to do. A case can have several jobs. */

export const CLAIM_TYPES = ["WC", "LIA", "FMLA", "DIS"] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const CLAIM_LABELS: Record<ClaimType, string> = {
  WC: "Workers' comp",
  LIA: "Liability",
  FMLA: "FMLA",
  DIS: "Disability",
};

export const CASE_WORKS = ["SURV", "SOC", "BG", "MED", "DOM", "LOC", "PS"] as const;
export type CaseWork = (typeof CASE_WORKS)[number];

export const WORK_LABELS: Record<CaseWork, string> = {
  SURV: "Surveillance",
  SOC: "Social media",
  BG: "Background",
  MED: "Medical canvas",
  DOM: "Domestic",
  LOC: "Locate",
  PS: "Process serving",
};

export function claimLabel(claim: string | null | undefined): string {
  if (claim && claim in CLAIM_LABELS) return CLAIM_LABELS[claim as ClaimType];
  return "Claim type not set";
}

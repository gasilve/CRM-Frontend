export interface Certification {
  code: string;
  label: string;
  color: string;
}

// No certification data model exists yet — this is a visual placeholder catalog
// until real credential tracking lands.
export const CERTIFICATION_CATALOG: Certification[] = [
  { code: "SUR", label: "Surveillance", color: "#4a7fff" },
  { code: "SIU", label: "Special Investigations", color: "#f59e0b" },
  { code: "SKP", label: "Skip Trace", color: "#4ade80" },
  { code: "PRS", label: "Process Serving", color: "#a78bfa" },
  { code: "BGC", label: "Background Checks", color: "#22d3ee" },
  { code: "FIR", label: "Firearms Certified", color: "#f87171" },
  { code: "SOC", label: "Social Media Intel", color: "#fb923c" },
  { code: "MED", label: "Medical Records", color: "#34d399" },
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic placeholder certifications for a given investigator, derived from
 * a stable seed (e.g. user id) so the badges don't reshuffle between renders.
 */
export function getCertifications(seed: string): Certification[] {
  const hash = hashSeed(seed);
  const count = 2 + (hash % 3);
  const offset = hash % CERTIFICATION_CATALOG.length;
  const picked: Certification[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(CERTIFICATION_CATALOG[(offset + i * 3) % CERTIFICATION_CATALOG.length]);
  }
  return picked;
}

/** Does this investigator (by seed) hold the given certification code? */
export function hasCertification(seed: string, code: string): boolean {
  return getCertifications(seed).some((c) => c.code === code);
}

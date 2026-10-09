/**
 * Dev-only surface access. Pattern Lab never ships to production builds
 * (`import.meta.env.DEV` is false after Vite prod compile).
 */
const PATTERN_LAB_EMAILS = [
  "valentin@accenty.com",
  "valentin@accenty.ai",
  "valentindeveloper@", // prefix match fallback handled below
  "guillermo@accenty.com",
  "guillermo@accenty.ai",
];

export function canAccessPatternLab(email: string | undefined | null): boolean {
  if (!import.meta.env.DEV) return false;
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (PATTERN_LAB_EMAILS.some((x) => x.endsWith("@") ? e.startsWith(x) : e === x)) return true;
  // Local display-name style accounts: "Valentin Developer" often uses valentin* emails
  if (e.includes("valentin")) return true;
  return false;
}

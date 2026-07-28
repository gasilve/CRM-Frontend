/** Age in whole years from ISO `YYYY-MM-DD`. */
export function ageFromDob(iso: string, from: Date = new Date()): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return 0;
  let age = from.getFullYear() - y;
  const birthdayPassed =
    from.getMonth() > m - 1 ||
    (from.getMonth() === m - 1 && from.getDate() >= d);
  if (!birthdayPassed) age -= 1;
  return age;
}

/** Format ISO date `YYYY-MM-DD` for display, e.g. `Mar 14, 1981 (45)`. */
export function formatDob(iso: string, from: Date = new Date()): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  const dateStr = dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${dateStr} (${ageFromDob(iso, from)})`;
}

/**
 * Whole days from today until the next birthday (0 = today).
 * Uses local calendar dates; `dob` is `YYYY-MM-DD`.
 */
export function daysUntilBirthday(dob: string, from: Date = new Date()): number {
  const parts = dob.split("-").map(Number);
  const month = parts[1];
  const day = parts[2];
  if (!month || !day) return 0;

  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

export function birthdayCountdownLabel(dob: string, from?: Date): string {
  const days = daysUntilBirthday(dob, from);
  if (days === 0) return "Birthday today";
  if (days === 1) return "1 day to birthday";
  return `${days} days to birthday`;
}

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

const DAY_MS = 86_400_000;

/**
 * Due dates, birth dates, and injury dates are calendar days stored at UTC
 * midnight. Reading them with the local timezone shifts the day backward
 * anywhere west of UTC.
 */
export function calendarDateKey(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function localDateKey(from: Date = new Date()): string {
  const month = String(from.getMonth() + 1).padStart(2, "0");
  const day = String(from.getDate()).padStart(2, "0");
  return `${from.getFullYear()}-${month}-${day}`;
}

/** Whole calendar days from local today until `iso`. Negative means overdue. */
export function daysUntilDue(iso: string, from: Date = new Date()): number {
  const due = calendarDateKey(iso);
  if (!due) return 0;
  const dueMs = Date.parse(`${due}T00:00:00Z`);
  const todayMs = Date.parse(`${localDateKey(from)}T00:00:00Z`);
  if (Number.isNaN(dueMs) || Number.isNaN(todayMs)) return 0;
  return Math.round((dueMs - todayMs) / DAY_MS);
}

export function formatCalendarDate(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  if (!iso) return "—";
  const key = calendarDateKey(iso);
  if (!key) return "—";
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    ...options,
    timeZone: "UTC",
  });
}

export function formatDueShort(iso: string): string {
  return formatCalendarDate(iso, { month: "short", day: "numeric" });
}

export function dueReminderLabel(iso: string, status: string): string {
  if (status === "closed") return "closed";
  const left = daysUntilDue(iso);
  if (left < 0) return left === -1 ? "1 day overdue" : `${Math.abs(left)} days overdue`;
  if (left === 0) return "due today";
  if (left === 1) return "1 day left";
  return `${left} days left`;
}

/** Chip copy for a due date: the calendar day, plus overdue / soon coloring. */
export function dueDateTone(iso: string | null): { label: string; color: string } | null {
  if (!iso || !calendarDateKey(iso)) return null;
  const days = daysUntilDue(iso);
  const label = `Due ${formatDueShort(iso)} (${formatCalendarDate(iso, { weekday: "short" })})`;
  if (days < 0) return { label: `${label} · overdue`, color: "#f87171" };
  if (days <= 3) return { label, color: "#fb923c" };
  return { label, color: "var(--color-text-mid)" };
}

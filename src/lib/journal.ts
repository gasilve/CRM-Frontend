import { Briefcase, Car, Home, ScanFace, ShieldQuestion, StickyNote, User } from "lucide-react";
import type { CaseDayEntryType } from "@/lib/crm-api";

/**
 * One place for "what does this journal entry type look like" — shared by the
 * Case Work Mode journal, the My Day recent-notes feed, and anywhere else that
 * needs to render a `CaseDayEntry` consistently.
 */
export const ENTRY_META: Record<CaseDayEntryType, { icon: typeof StickyNote; label: string; color: string }> = {
  note: { icon: StickyNote, label: "Field note", color: "var(--color-text-mid)" },
  qa: { icon: ShieldQuestion, label: "Answer", color: "#60a5fa" },
  photo_person: { icon: User, label: "Person photo", color: "#f87171" },
  photo_vehicle: { icon: Car, label: "Vehicle photo", color: "#34d399" },
  photo_home: { icon: Home, label: "Residence photo", color: "#60a5fa" },
  face_match: { icon: ScanFace, label: "Comparison", color: "#22d3ee" },
  manager_note: { icon: Briefcase, label: "Office note", color: "#fbbf24" },
};

export const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

export const fmtDayLabel = (iso: string, today: string): string => {
  const key = iso.slice(0, 10);
  if (key === today) return "Today";
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

/** Short "Sep 16, 4:35 PM" stamp used inside photo libraries and comparison history. */
export const fmtWhen = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

/**
 * Every timestamp in the investigator UI renders through this class so dates
 * read as a first-class, theme-tinted element instead of disappearing into
 * low-contrast grey — they're one of the main things an investigator scans
 * a journal for.
 */
export const READABLE_DATE_CLASS = "font-mono font-medium text-[var(--color-accent-2)]";

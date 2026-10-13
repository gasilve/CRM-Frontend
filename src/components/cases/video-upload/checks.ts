import type { CaseService } from "@/lib/crm-api";
import type { CameraKind, Declared, LeftOutReason } from "@/components/cases/video-library";

export const ATTEST = [
  "I did not edit any video.",
  "This is all the video I took on this date.",
  "I certify this under penalty of perjury.",
] as const;

/** Investigators declare from notes; a minute either way still counts as a match. */
export const LENGTH_SLACK_SECONDS = 60;

export const LEFT_OUT_LABEL: Record<LeftOutReason, string> = {
  wrong_person: "Wrong person",
  too_dark: "Too dark",
  other: "Other",
};

export const CAMERA = {
  covert: { label: "Covert", note: "Its own time stamp stays" },
  camcorder: { label: "Camcorder", note: "We add the time stamp" },
} as const satisfies Record<CameraKind, { label: string; note: string }>;

export type Tone = "ok" | "warn" | "bad" | "wait";

export type Check = { id: string; tone: Tone; title: string; detail: string };

type Named = { name: string };

/**
 * Camera names end in a short running number (MAH00007, C0007, IMG_0007, 00007.MTS).
 * Longer runs are dates or times (20261009_154454), which say nothing about order.
 */
export function readNumber(name: string): { pattern: string; number: number } | null {
  const stem = name.replace(/\.[^.]+$/, "");
  const match = /^(.*?)(\d+)(\D*)$/.exec(stem);
  if (!match || match[2].length > 5) return null;
  return { pattern: `${match[1].toUpperCase()}#${match[3].toUpperCase()}`, number: Number(match[2]) };
}

export type Series =
  | { kind: "none" }
  | { kind: "mixed"; patterns: string[] }
  | { kind: "run"; first: number; last: number; missing: number[] };

export function readSeries(clips: Named[]): Series {
  if (clips.length === 0) return { kind: "none" };
  const read = clips.map((clip) => readNumber(clip.name));
  if (read.some((item) => item == null)) return { kind: "none" };
  const patterns = [...new Set(read.map((item) => item!.pattern))];
  if (patterns.length > 1) return { kind: "mixed", patterns: patterns.map((p) => p.replace("#", "…")) };
  const numbers = [...new Set(read.map((item) => item!.number))].sort((a, b) => a - b);
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  const have = new Set(numbers);
  const missing: number[] = [];
  for (let n = first; n <= last && missing.length <= 200; n += 1) if (!have.has(n)) missing.push(n);
  return { kind: "run", first, last, missing };
}

export function sortByCamera<T extends Named & { recordedAt: string | null }>(clips: T[]) {
  return [...clips].sort((a, b) => {
    const na = readNumber(a.name);
    const nb = readNumber(b.name);
    if (na && nb && na.pattern === nb.pattern) return na.number - nb.number;
    if (a.recordedAt && b.recordedAt) return a.recordedAt.localeCompare(b.recordedAt);
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

export function filesCheck(declared: Declared, count: number): Check {
  if (count === declared.files) return { id: "files", tone: "ok", title: `${count} of ${declared.files} files`, detail: "Matches your answer." };
  const fewer = count < declared.files;
  return {
    id: "files",
    tone: "bad",
    title: `${count} of ${declared.files} files`,
    detail: fewer
      ? `You said ${declared.files}. ${declared.files - count} ${plural(declared.files - count, "is", "are")} not here yet.`
      : `You said ${declared.files}. There ${plural(count - declared.files, "is", "are")} ${count - declared.files} extra.`,
  };
}

export function lengthCheck(declared: Declared, seconds: (number | null)[], unreadable: number): Check {
  const pending = seconds.filter((value) => value == null).length - unreadable;
  if (pending > 0) return { id: "length", tone: "wait", title: "Reading lengths", detail: `${pending} ${plural(pending, "clip", "clips")} still loading.` };
  const total = seconds.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  if (unreadable > 0) {
    return {
      id: "length",
      tone: "warn",
      title: `${clock(total)}+ of ${clock(declared.seconds)}`,
      detail: `This browser can't read ${unreadable} ${plural(unreadable, "file", "files")}. Their length is checked when they reach the server.`,
    };
  }
  const off = Math.abs(total - declared.seconds);
  if (off <= LENGTH_SLACK_SECONDS) return { id: "length", tone: "ok", title: `${clock(total)} of ${clock(declared.seconds)}`, detail: "Matches your answer." };
  return {
    id: "length",
    tone: "bad",
    title: `${clock(total)} of ${clock(declared.seconds)}`,
    detail: `You said ${clock(declared.seconds)}. The clips add up to ${clock(total)}.`,
  };
}

export function orderCheck(series: Series, explanation: string): Check {
  const explained = explanation.trim().length >= 8;
  if (series.kind === "none") return { id: "order", tone: "ok", title: "In recorded order", detail: "These file names have no clip numbers." };
  if (series.kind === "mixed") {
    return {
      id: "order",
      tone: explained ? "warn" : "bad",
      title: explained ? "Explained" : "Two cameras?",
      detail: explained
        ? "These names come from more than one camera. Your reason is signed with the video."
        : `These names come from more than one camera (${series.patterns.join(", ")}). Upload one camera at a time, or tell us why.`,
    };
  }
  const span = series.first === series.last ? `Clip ${series.first}` : `Clips ${series.first}–${series.last}`;
  if (series.missing.length === 0) return { id: "order", tone: "ok", title: `${span}, none missing`, detail: "Nothing is missing in the middle." };
  return {
    id: "order",
    tone: explained ? "warn" : "bad",
    title: explained ? `${span}, explained` : `${missingText(series.missing)} missing`,
    detail: explained
      ? `${missingSentence(series.missing)} Your reason is signed with the video.`
      : `${missingSentence(series.missing)} Add ${series.missing.length === 1 ? "it" : "them"}, or tell us why.`,
  };
}

export function repeatCheck(repeats: { name: string; day: string }[]): Check | null {
  if (repeats.length === 0) return null;
  const first = repeats[0];
  return {
    id: "repeat",
    tone: "bad",
    title: repeats.length === 1 ? "Already uploaded" : `${repeats.length} already uploaded`,
    detail:
      repeats.length === 1
        ? `${first.name} is already on this case from ${first.day}. Remove it.`
        : `${repeats.map((item) => item.name).join(", ")} are already on this case. Remove them.`,
  };
}

export function stampNote(camera: CameraKind) {
  return camera === "camcorder" ? "Time stamp will be added" : "Camera's own time stamp kept";
}

export function packageNote(service: CaseService | string, state: string | null) {
  if (service === "WC") return state ? `Title page and ${state} trailer will be added` : "Title page and trailer will be added";
  if (service === "LIA") return "No title page or trailer";
  return "Office will choose the title page";
}

export function caseTypeLabel(service: CaseService | string) {
  if (service === "WC") return "Workers' comp";
  if (service === "LIA") return "Liability";
  if (service === "SURV") return "Surveillance";
  return service;
}

export function clock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function dayKeyOf(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dayName(key: string, long = false) {
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-US", long ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" });
}

export function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function missingText(missing: number[]) {
  if (missing.length === 1) return `Clip ${missing[0]}`;
  if (missing.length <= 3) return `Clips ${missing.join(", ")}`;
  return `${missing.length} clips`;
}

function missingSentence(missing: number[]) {
  if (missing.length === 1) return `Clip ${missing[0]} is missing between ${missing[0] - 1} and ${missing[0] + 1}.`;
  if (missing.length <= 6) return `Clips ${missing.join(", ")} are missing.`;
  return `${missing.length} clips are missing in the middle, starting at ${missing[0]}.`;
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

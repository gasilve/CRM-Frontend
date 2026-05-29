export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, boolean | null | undefined>
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const push = (v: ClassValue) => {
    if (!v && v !== 0) return;
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v));
    } else if (Array.isArray(v)) {
      v.forEach(push);
    } else if (typeof v === "object") {
      for (const key in v) {
        if (v[key]) out.push(key);
      }
    }
  };
  inputs.forEach(push);
  return out.join(" ");
}

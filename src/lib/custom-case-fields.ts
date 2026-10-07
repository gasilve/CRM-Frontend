/**
 * Org-wide custom case field definitions (the case-bar "notebook").
 * Not per-case — once defined, keys are available in the widget field catalog.
 * Values resolve as placeholders until a real data mapping exists.
 *
 * Stored in localStorage for now (same browser / shared machine). Swap the
 * persistence layer for a house API later without changing the public shape.
 */

export type CustomCaseFieldDef = {
  id: string;
  /** Stable catalog key, e.g. `placeholder.subject_mother`. */
  key: string;
  label: string;
  description: string;
  /** Free-text note: where this info is usually found (e.g. intake form, DMV). */
  dataSource: string;
  /** Sample text shown on widgets until real case data is wired up. */
  placeholderValue: string;
  createdAt: string;
  updatedAt: string;
};

const LS_KEY = "accenty.crm.custom-case-fields.v1";
const KEY_PREFIX = "placeholder.";

const listeners = new Set<() => void>();
let cache: CustomCaseFieldDef[] | null = null;

function notify(): void {
  for (const cb of listeners) cb();
}

function readRaw(): CustomCaseFieldDef[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f): f is CustomCaseFieldDef => !!f && typeof f === "object" && typeof (f as CustomCaseFieldDef).id === "string")
      .map((f) => ({
        id: String(f.id),
        key: typeof f.key === "string" ? f.key : "",
        label: typeof f.label === "string" ? f.label.slice(0, 80) : "Field",
        description: typeof f.description === "string" ? f.description.slice(0, 2000) : "",
        dataSource: typeof f.dataSource === "string" ? f.dataSource.slice(0, 500) : "",
        placeholderValue:
          typeof (f as CustomCaseFieldDef).placeholderValue === "string"
            ? (f as CustomCaseFieldDef).placeholderValue.slice(0, 200)
            : "",
        createdAt: typeof f.createdAt === "string" ? f.createdAt : new Date().toISOString(),
        updatedAt: typeof f.updatedAt === "string" ? f.updatedAt : new Date().toISOString(),
      }))
      .filter((f) => f.key.startsWith(KEY_PREFIX));
  } catch {
    return [];
  }
}

function writeAll(fields: CustomCaseFieldDef[]): void {
  cache = fields;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(fields));
  } catch {
    /* ignore quota */
  }
  notify();
}

export function getCustomCaseFields(): CustomCaseFieldDef[] {
  if (!cache) cache = readRaw();
  return cache;
}

export function subscribeCustomCaseFields(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getCustomCaseFieldByKey(key: string): CustomCaseFieldDef | undefined {
  return getCustomCaseFields().find((f) => f.key === key);
}

/** Turn "Subject mother" into `subject_mother`. */
export function slugifyFieldLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 64);
}

export function customFieldKeyFromLabel(label: string): string {
  const slug = slugifyFieldLabel(label) || `field_${Date.now().toString(36)}`;
  return `${KEY_PREFIX}${slug}`;
}

function newId(): string {
  return `cf-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function upsertCustomCaseField(input: {
  id?: string;
  label: string;
  description: string;
  dataSource: string;
  placeholderValue?: string;
}): CustomCaseFieldDef {
  // Empty label allowed for the always-present blank slot (not shown in catalog).
  const label = input.label.trim().slice(0, 80);
  const now = new Date().toISOString();
  const current = getCustomCaseFields();
  const existing = input.id ? current.find((f) => f.id === input.id) : undefined;

  // Keep the key stable on rename so saved widgets still resolve.
  const key = existing?.key ?? (() => {
    let candidate = customFieldKeyFromLabel(label || "field");
    const used = new Set(current.map((f) => f.key));
    if (!used.has(candidate)) return candidate;
    let n = 2;
    while (used.has(`${candidate}_${n}`)) n += 1;
    return `${candidate}_${n}`;
  })();

  const next: CustomCaseFieldDef = {
    id: existing?.id ?? newId(),
    key,
    label,
    description: input.description.trim().slice(0, 2000),
    dataSource: input.dataSource.trim().slice(0, 500),
    placeholderValue: (input.placeholderValue ?? existing?.placeholderValue ?? "")
      .trim()
      .slice(0, 200),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  writeAll(existing ? current.map((f) => (f.id === existing.id ? next : f)) : [...current, next]);
  return next;
}

/** Always keep ≥1 field: create a blank slot if the list is empty. */
export function ensureAtLeastOneCustomCaseField(): CustomCaseFieldDef {
  const current = getCustomCaseFields();
  if (current[0]) return current[0];
  return upsertCustomCaseField({
    label: "",
    description: "",
    dataSource: "",
    placeholderValue: "",
  });
}

/** Clear field contents in place (used when trashing the last remaining row). */
export function clearCustomCaseField(id: string): CustomCaseFieldDef | undefined {
  const current = getCustomCaseFields();
  const existing = current.find((f) => f.id === id);
  if (!existing) return undefined;
  const next: CustomCaseFieldDef = {
    ...existing,
    label: "",
    description: "",
    dataSource: "",
    placeholderValue: "",
    updatedAt: new Date().toISOString(),
  };
  writeAll(current.map((f) => (f.id === id ? next : f)));
  return next;
}

/**
 * Remove a field, or clear it if it's the only one left (minimum of 1 row).
 */
export function deleteCustomCaseField(id: string): void {
  const current = getCustomCaseFields();
  if (current.length <= 1) {
    clearCustomCaseField(id);
    return;
  }
  writeAll(current.filter((f) => f.id !== id));
}

export function isCustomCaseFieldKey(key: string): boolean {
  return key.startsWith(KEY_PREFIX);
}

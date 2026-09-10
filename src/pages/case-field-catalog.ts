import { SERVICE_LABELS } from "@/lib/mock-data";
import type { CaseDetail } from "@/lib/crm-api";
import {
  getCustomCaseFieldByKey,
  getCustomCaseFields,
  type CustomCaseFieldDef,
} from "@/lib/custom-case-fields";

/**
 * Catalog of case data a SuperAdmin can pull into a custom widget. Each entry
 * maps a stable key (stored in the layout document) to a display resolver on
 * the loaded case, plus the RBAC field that governs its visibility (if any).
 *
 * Removing an entry never breaks saved widgets — unknown keys render nothing
 * and are dropped the next time the widget is edited.
 *
 * Notebook-defined fields (`placeholder.*`) are merged in at read time from
 * the custom-case-fields store.
 */

export type CaseFieldEntry = {
  key: string;
  /** Default label shown in the builder — the admin can rename per widget. */
  label: string;
  group: string;
  /** RBAC protected-field key; undefined means always visible. */
  rbacField?: string;
  resolve: (c: CaseDetail) => string;
};

const fmtDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

const dash = (v: string | number | null | undefined): string =>
  v === null || v === undefined || v === "" ? "—" : String(v);

export const CASE_FIELD_CATALOG: CaseFieldEntry[] = [
  // ── Subject ────────────────────────────────────────────────────────────────
  { key: "case.subjectName", label: "Subject name", group: "Subject", resolve: (c) => dash(c.subjectName) },
  {
    key: "case.subjectAliases", label: "Aliases", group: "Subject", rbacField: "case.subjectAliases",
    resolve: (c) => (c.subjectAliases.length ? c.subjectAliases.join(", ") : "—"),
  },
  {
    key: "case.subjectDob", label: "Date of birth", group: "Subject", rbacField: "case.subjectDob",
    resolve: (c) => fmtDate(c.subjectDob),
  },
  {
    key: "case.subjectSsn", label: "SSN", group: "Subject", rbacField: "case.subjectSsn",
    resolve: (c) => dash(c.subjectSsn),
  },
  {
    key: "case.subjectDriverLicense", label: "Driver license", group: "Subject",
    rbacField: "case.subjectDriverLicense", resolve: (c) => dash(c.subjectDriverLicense),
  },
  { key: "case.subjectLanguage", label: "Language", group: "Subject", resolve: (c) => dash(c.subjectLanguage) },
  {
    key: "case.subjectDescription", label: "Physical description", group: "Subject",
    rbacField: "case.subjectDescription", resolve: (c) => dash(c.subjectDescription),
  },
  {
    key: "case.subjectJobTitle", label: "Job title", group: "Subject", rbacField: "case.subjectEmployment",
    resolve: (c) => dash(c.subjectJobTitle),
  },
  {
    key: "case.subjectEmployer", label: "Employer", group: "Subject", rbacField: "case.subjectEmployment",
    resolve: (c) => dash(c.subjectEmployer),
  },
  {
    key: "case.subjectEmployerAddress", label: "Employer address", group: "Subject",
    rbacField: "case.subjectEmployment", resolve: (c) => dash(c.subjectEmployerAddress),
  },
  {
    key: "case.subjectWorkStatus", label: "Work status", group: "Subject", rbacField: "case.subjectEmployment",
    resolve: (c) => dash(c.subjectWorkStatus),
  },

  // ── Assignment ────────────────────────────────────────────────────────────
  {
    key: "case.claimNumber", label: "Claim #", group: "Assignment", rbacField: "case.claimNumber",
    resolve: (c) => dash(c.claimNumber),
  },
  {
    key: "case.policyNumber", label: "Policy #", group: "Assignment", rbacField: "case.policyNumber",
    resolve: (c) => dash(c.policyNumber),
  },
  { key: "case.service", label: "Service", group: "Assignment", resolve: (c) => SERVICE_LABELS[c.service] ?? c.service },
  {
    key: "case.status",
    label: "Status",
    group: "Assignment",
    resolve: (c) => {
      if (c.status === "open") return "Open";
      if (c.status === "suspended") return "Suspended";
      if (c.status === "closed") return "Closed";
      return c.status;
    },
  },
  { key: "case.priority", label: "Priority", group: "Assignment", resolve: (c) => c.priority },
  { key: "case.dueDate", label: "Due date", group: "Assignment", resolve: (c) => fmtDate(c.dueDate) },
  {
    key: "case.daysAllotted", label: "Days allotted", group: "Assignment",
    resolve: (c) => (c.daysAllotted != null ? String(c.daysAllotted) : "—"),
  },
  { key: "case.dateOpened", label: "Date opened", group: "Assignment", resolve: (c) => fmtDate(c.dateOpened) },
  {
    key: "case.dateOfInjury", label: "Date of injury", group: "Assignment", rbacField: "case.dateOfInjury",
    resolve: (c) => fmtDate(c.dateOfInjury),
  },
  { key: "case.startTime", label: "Start time", group: "Assignment", resolve: (c) => dash(c.startTime) },
  {
    key: "case.estimatedValue", label: "Estimated value", group: "Assignment", rbacField: "case.estimatedValue",
    resolve: (c) => (c.estimatedValue != null ? `$${c.estimatedValue.toLocaleString()}` : "—"),
  },
  {
    key: "case.description", label: "Case instructions", group: "Assignment", rbacField: "case.description",
    resolve: (c) => dash(c.description),
  },

  // ── Client & adjuster ─────────────────────────────────────────────────────
  {
    key: "case.client.company", label: "Client", group: "Client & adjuster", rbacField: "case.client",
    resolve: (c) => dash(c.client?.company),
  },
  {
    key: "case.adjusterName", label: "Adjuster", group: "Client & adjuster", rbacField: "case.adjuster",
    resolve: (c) => dash(c.adjusterName),
  },
  {
    key: "case.adjusterEmail", label: "Adjuster email", group: "Client & adjuster", rbacField: "case.adjuster",
    resolve: (c) => dash(c.adjusterEmail),
  },
  {
    key: "case.adjusterPhone", label: "Adjuster phone", group: "Client & adjuster", rbacField: "case.adjuster",
    resolve: (c) => dash(c.adjusterPhone),
  },

  // ── Addresses / tags / people ─────────────────────────────────────────────
  {
    key: "case.city",
    label: "City",
    group: "Location",
    rbacField: "case.subjectAddresses",
    resolve: (c) => {
      const a = c.addresses.find((x) => x.isPrimary) ?? c.addresses[0];
      const city = [a?.city, a?.state ?? c.state].filter(Boolean).join(", ");
      return city || "—";
    },
  },
  {
    key: "case.primaryAddress", label: "Primary address", group: "Location", rbacField: "case.subjectAddresses",
    resolve: (c) => {
      const a = c.addresses.find((x) => x.isPrimary) ?? c.addresses[0];
      return a ? [a.line1, a.city, a.state, a.zip].filter(Boolean).join(", ") : "—";
    },
  },
  {
    key: "case.addresses", label: "All addresses", group: "Location", rbacField: "case.subjectAddresses",
    resolve: (c) =>
      c.addresses.length
        ? c.addresses.map((a) => [a.line1, a.city, a.state].filter(Boolean).join(", ")).join(" · ")
        : "—",
  },
  { key: "case.state", label: "State", group: "Location", resolve: (c) => dash(c.state) },
  {
    key: "case.region", label: "Region", group: "Location",
    resolve: (c) => (c.region ? c.region.toUpperCase() : "—"),
  },
  { key: "case.tags", label: "Tags", group: "Case file", resolve: (c) => (c.tags.length ? c.tags.join(", ") : "—") },
  {
    key: "case.assignments", label: "Assigned investigators", group: "Case file",
    resolve: (c) => (c.assignments.length ? c.assignments.map((a) => a.user.name).join(", ") : "—"),
  },
  {
    key: "case.vehicles", label: "Vehicles", group: "Case file", rbacField: "case.vehicles",
    resolve: (c) =>
      c.vehicles.length
        ? c.vehicles
            .map((v) => [v.year, v.color, v.make, v.model].filter(Boolean).join(" ") || v.licensePlate || "Vehicle")
            .join(" · ")
        : "—",
  },
  {
    key: "case.people", label: "People on the case", group: "Case file", rbacField: "case.associates",
    resolve: (c) => (c.people?.length ? c.people.map((p) => p.name).join(", ") : "—"),
  },

  // ── Meta ──────────────────────────────────────────────────────────────────
  { key: "case.caseNumber", label: "Case #", group: "Meta", resolve: (c) => c.caseNumber },
  { key: "case.createdAt", label: "Created", group: "Meta", resolve: (c) => fmtDate(c.createdAt) },
  { key: "case.createdBy", label: "Created by", group: "Meta", resolve: (c) => dash(c.createdBy?.name) },
];

const BY_KEY = new Map(CASE_FIELD_CATALOG.map((f) => [f.key, f]));

const NOTEBOOK_GROUP = "Notebook";

function customDefToEntry(def: CustomCaseFieldDef): CaseFieldEntry {
  const sample = def.placeholderValue.trim();
  return {
    key: def.key,
    label: def.label,
    group: NOTEBOOK_GROUP,
    // Pending mapping — show the notebook sample (or em-dash) until real case data fills this key.
    resolve: () => (sample ? sample : "—"),
  };
}

export function caseFieldEntry(key: string): CaseFieldEntry | undefined {
  const builtIn = BY_KEY.get(key);
  if (builtIn) return builtIn;
  const custom = getCustomCaseFieldByKey(key);
  if (!custom || !custom.label.trim()) return undefined;
  return customDefToEntry(custom);
}

export function caseFieldGroups(): { group: string; fields: CaseFieldEntry[] }[] {
  const groups = new Map<string, CaseFieldEntry[]>();
  for (const f of CASE_FIELD_CATALOG) {
    const list = groups.get(f.group) ?? [];
    list.push(f);
    groups.set(f.group, list);
  }
  const notebook = getCustomCaseFields()
    .filter((f) => f.label.trim())
    .map(customDefToEntry);
  if (notebook.length > 0) groups.set(NOTEBOOK_GROUP, notebook);
  return [...groups.entries()].map(([group, fields]) => ({ group, fields }));
}

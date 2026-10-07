/**
 * prodigy-api.ts
 * Adapter layer: translates the Prodigy/FastAPI backend (localhost:8000)
 * responses into the CaseListItem / CaseDetail shape that CRM-Frontend expects.
 * Zero changes needed to Cases.tsx or crm-api.ts.
 */

import type {
  CaseListItem,
  CaseStatus,
  CasePriority,
  CaseService,
  Region,
} from "./crm-api";

const PRODIGY_API = "/api-proxy";

// ── Type mappings ────────────────────────────────────────────────────────────

const TYPE_TO_SERVICE: Record<string, CaseService> = {
  surveillance:    "SURV",
  background:      "BG",
  medical_canvass: "WC",
  field_assignment:"SURV",
};

const STATUS_MAP: Record<string, CaseStatus> = {
  open:      "open",
  closed:    "closed",
  suspended: "suspended",
  completed: "closed",
  cancelled: "closed",
};

const PRIORITY_MAP: Record<string, CasePriority> = {
  standard: "standard",
  rush:     "rush",
  urgent:   "rush",
};

// ── Raw API types ────────────────────────────────────────────────────────────

interface ProdigyInvestigation {
  id: number;
  subject_name: string | null;
  subject_aliases: string[] | null;
  subject_dob: string | null;
  subject_addresses: string[];
  subject_phones: string[] | null;
  investigator_name: string | null;
  investigator_id: number | null;
  status: string;
  priority: string;
  investigation_type: string;
  secondary_types: string[] | null;
  case_types: string[] | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  ai_summary: string | null;
  progress: number;
  photos_count: number;
  vehicles_count: number;
  confirmed_findings: number;
  extra_metadata: Record<string, unknown> | null;
  reference_photos: string[];
  subject_photo_url?: string | null;
}

interface ProdigyListResponse {
  items: ProdigyInvestigation[];
  total: number;
  page: number;
  page_size: number;
}

// ── Adapter functions ────────────────────────────────────────────────────────

function adaptInvestigation(inv: ProdigyInvestigation): CaseListItem {
  const meta = inv.extra_metadata ?? {};
  const claimNumber = (meta.claim_number as string) ?? null;
  const caseNumber  = claimNumber ?? `INV-${inv.id}`;
  const clientCompany = (meta.client_company as string) ?? null;
  const adjuster    = (meta.requester_name as string) ?? null;

  // Region from first address or locations
  let region: Region | null = null;
  const addr = inv.subject_addresses?.[0] ?? "";
  if (/\bCA\b|california/i.test(addr)) region = "ca";
  else if (/\bNY\b|new york/i.test(addr)) region = "tristate";
  else if (/\bTX\b|texas/i.test(addr)) region = "texas";

  const service: CaseService = TYPE_TO_SERVICE[inv.investigation_type] ?? "SURV";
  const status: CaseStatus   = STATUS_MAP[inv.status] ?? "open";
  const priority: CasePriority = PRIORITY_MAP[inv.priority] ?? "standard";

  const allTypes = Array.from(new Set([
    inv.investigation_type,
    ...(inv.case_types ?? []),
    ...(inv.secondary_types ?? []),
  ]));
  const _prodigyExtras = {
    _prodigy_meta: meta,
    _prodigy_phones: inv.subject_phones ?? [],
    _prodigy_type: inv.investigation_type,
    _prodigy_case_types: allTypes,
  };

  return {
    ...(_prodigyExtras as any),
    id: String(inv.id),
    caseNumber,
    claimNumber,
    policyNumber: null,
    clientId: null,
    client: clientCompany ? { id: "prodigy", company: clientCompany } : null,
    adjusterName: adjuster,
    adjusterEmail: (meta.email_from as string) ?? null,
    adjusterPhone: null,
    service,
    tags: inv.investigation_type ? [inv.investigation_type] : [],
    status,
    priority,
    reopened: false,
    region,
    state: null,
    earliestActiveAt: inv.started_at 
      ?? (inv.progress > 0 ? inv.created_at : null),
    situationSummary: inv.ai_summary,
    subjectWorkStatus: null,
    _count: {
      people: 0,
      vehicles: inv.vehicles_count,
      days: 0,
    },
    dateOpened: inv.created_at,
    dateClosed: inv.completed_at ?? null,
    dateOfInjury: null,
    dueDate: null,
    imeAt: null,
    daysAllotted: null,
    startTime: null,
    estimatedValue: null,
    description: inv.ai_summary,
    subjectName: (() => {
      if (inv.subject_name && inv.subject_name !== "Unknown Subject" && !inv.subject_name.startsWith("Unknown")) {
        return inv.subject_name;
      }
      // Try to extract name from email subject: "Re: Gil Surveillance" → "Gil"
      const subj = meta.email_subject as string | null;
      if (subj) {
        // Pattern: "Name - ClaimNum" or "Re: Name Surveillance"
        const cleaned = subj.replace(/^Re:\s*/i, "").replace(/^Fwd:\s*/i, "");
        const dashParts = cleaned.split(" - ");
        const firstPart = dashParts[0].trim();
        // If first part looks like a name (not a URL, not too long, has words)
        if (firstPart.length < 60 && /[A-Za-z]/.test(firstPart) && !firstPart.includes("http")) {
          return firstPart;
        }
      }
      return claimNumber ? `Claim ${claimNumber}` : `Investigation ${inv.id}`;
    })(),
    subjectAliases: inv.subject_aliases ?? [],
    subjectDob: inv.subject_dob ?? null,
    subjectPhotoUrl: (() => {
      const r = inv.reference_photos?.[0];
      if (!r) return null;
      // If it's already a full URL (http/https), use it directly
      if (r.startsWith('http')) return r;
      // Otherwise it's a minio_path — serve via forensic endpoint
      return `${PRODIGY_API}/api/forensic/image/${r}`;
    })(),
    subjectTransport: null,
    subjectSetting: null,
    addresses: ( inv.subject_addresses ?? [] ).map((line, i) => ({
      id: `addr-${inv.id}-${i}`,
      label: null,
      line1: line,
      city: null,
      state: null,
      zip: null,
      lat: null,
      lng: null,
      isPrimary: i === 0,
    })),
    assignments: inv.investigator_name
      ? [{
          id: `asgn-${inv.id}`,
          userId: String(inv.investigator_id ?? "unknown"),
          role: "investigator",
          assignedAt: inv.created_at,
          user: {
            id: String(inv.investigator_id ?? "unknown"),
            name: inv.investigator_name,
            email: "",
          },
        }]
      : [],
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface ProdigyCaseListParams {
  page?: number;
  pageSize?: number;
  status?: CaseStatus | "";
  service?: CaseService | "";
  search?: string;
}

export async function prodigyCases(params: ProdigyCaseListParams = {}): Promise<{
  cases: CaseListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(Math.min(params.pageSize ?? 20, 500)));

  // Status
  if (params.status) {
    const raw = Object.entries(STATUS_MAP).find(([, v]) => v === params.status)?.[0];
    if (raw) qs.set("status", raw);
  }

  // Service → investigation_type
  if (params.service) {
    const typeMap: Record<string, string> = {
      SURV: "surveillance",
      BG:   "background",
      WC:   "medical_canvass",
      LIA:  "field_assignment",
    };
    const t = typeMap[params.service];
    if (t) qs.set("investigation_type", t);
  }

  // Search
  if (params.search) qs.set("q", params.search);

  const res = await fetch(`${PRODIGY_API}/api/investigations?${qs.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Prodigy API error: ${res.status}`);

  const data: ProdigyListResponse = await res.json();

  return {
    cases: data.items.map(adaptInvestigation),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
  };
}

export async function prodigyCaseDetail(id: string) {
  const res = await fetch(`${PRODIGY_API}/api/investigations/${id}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Prodigy API error: ${res.status}`);
  const inv: ProdigyInvestigation = await res.json();
  return adaptInvestigation(inv);
}

// ── Full CaseDetail adapter ──────────────────────────────────────────────────

import type { CaseDetail, CasePersonRelationship } from "./crm-api";

export async function prodigyCaseDetailFull(id: string): Promise<{ case: CaseDetail }> {
  const res = await fetch(`${PRODIGY_API}/api/investigations/${id}`, {
    credentials: "include",
  });
  if (!res.ok) {
    const err = Object.assign(new Error("Not found"), { status: res.status });
    throw err;
  }
  const inv = await res.json() as ProdigyInvestigation & {
    subject_ssn_last4?: string | null;
    subject_employers?: string[] | null;
    captured_urls?: { id: number; url: string; captured_at: string; title?: string }[];
    vehicles?: { id?: number; make?: string; model?: string; year?: number; color?: string; plate?: string }[];
    people?: { id?: number; name: string; relationship?: string; phone?: string }[];
  };

  const base = adaptInvestigation(inv);
  const meta = inv.extra_metadata ?? {};

  const detail: CaseDetail = {
    ...base,
    subjectSsn: inv.subject_ssn_last4 ? `\u2022\u2022\u2022-\u2022\u2022-${inv.subject_ssn_last4}` : null,
    subjectDriverLicense: null,
    subjectJobTitle: null,
    subjectEmployer: inv.subject_employers?.[0] ?? null,
    subjectEmployerAddress: null,
    subjectWorkStatus: null,
    subjectLanguage: null,
    subjectDescription: null,
    vehicles: (inv.vehicles ?? []).map((v, i) => ({
      id: String(v.id ?? i),
      make: v.make ?? null,
      model: v.model ?? null,
      year: v.year ?? null,
      color: v.color ?? null,
      licensePlate: v.plate ?? null,
      state: null,
      vin: null,
      photoUrl: null,
      notes: null,
      registeredOwner: null,
      personLinks: [],
      seatCount: 5,
      kind: "unknown" as const,
    })),
    people: (inv.people ?? []).map((p, i) => ({
      id: String(p.id ?? i),
      name: p.name,
      relationship: (p.relationship as CasePersonRelationship) ?? "neighbor",
      photoUrl: null,
      phone: p.phone ?? null,
      address: null,
      notes: null,
      vehicleLinks: [],
      createdAt: inv.created_at,
      updatedAt: inv.created_at,
    })),
    presurveillance: null,
    days: [],
    scheduleBlocks: [],
    openDays: [],
    specialDates: [],
    patterns: [],
    files: (inv.captured_urls ?? []).map((u) => ({
      id: String(u.id),
      filename: u.title ?? u.url,
      contentType: "text/html",
      sizeBytes: null,
      sha256: null,
      extracted: null,
      storage: "external",
      storageKey: u.url,
      source: "ingest",
      error: null,
      createdAt: u.captured_at,
    })),
    todos: [],
    situationSummary: inv.ai_summary ?? null,
    createdBy: null,
    createdAt: inv.created_at,
    updatedAt: inv.completed_at ?? inv.created_at,
    earliestActiveAt: inv.started_at ?? null,
    imeAt: null,
    subjectTransport: null,
    subjectSetting: null,
  };

  // Geocode addresses via Nominatim (OpenStreetMap) — free, no key needed
  if (detail.addresses.length > 0) {
    const geocoded = await Promise.all(
      detail.addresses.map(async (addr) => {
        try {
          const q = encodeURIComponent(addr.line1 ?? "");
          if (!q) return addr;
          const r = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=1`,
            { headers: { "Accept-Language": "en", "User-Agent": "proti.ai/1.0" } }
          );
          const results = await r.json() as { lat: string; lon: string; address?: { city?: string; state?: string; postcode?: string } }[];
          if (results[0]) {
            const hit = results[0];
            return {
              ...addr,
              lat: parseFloat(hit.lat),
              lng: parseFloat(hit.lon),
              city: addr.city ?? hit.address?.city ?? null,
              state: addr.state ?? hit.address?.state ?? null,
              zip: addr.zip ?? hit.address?.postcode ?? null,
            };
          }
        } catch (_) { /* geocoding failed */ }
        return addr;
      })
    );
    detail.addresses = geocoded;
  }

  // Try to get a downloaded photo for the subject
  try {
    const pRes = await fetch(`${PRODIGY_API}/api/investigations/${id}/photos`, { credentials: "include" });
    if (pRes.ok) {
      const photos = await pRes.json() as Array<{ id: number; minio_path: string | null; profile_picture: boolean; is_downloaded: boolean; source_url: string }>;
      const best = photos.find((p) => p.profile_picture && p.is_downloaded && p.minio_path)
        ?? photos.find((p) => p.profile_picture && p.minio_path);
      if (best?.minio_path) {
        detail.subjectPhotoUrl = `${PRODIGY_API}/api/forensic/image/${best.minio_path}`;
      } else if (best?.source_url) {
        detail.subjectPhotoUrl = best.source_url;
      }
    }
  } catch (_) { /* photo fetch failed — not critical */ }

  return { case: detail };
}

// ── Pending Cases adapter ────────────────────────────────────────────────────

import type { PendingCaseListItem } from "./crm-api";

function adaptToPending(inv: ProdigyInvestigation): PendingCaseListItem {
  const meta = inv.extra_metadata ?? {};
  const claimNumber = (meta.claim_number as string) ?? null;
  const subjectName = (() => {
    if (inv.subject_name && !inv.subject_name.startsWith("Unknown")) return inv.subject_name;
    const subj = meta.email_subject as string | null;
    if (subj) {
      const cleaned = subj.replace(/^(Re|Fwd):\s*/i, "");
      const first = cleaned.split(" - ")[0].trim();
      if (first.length < 60 && /[A-Za-z]/.test(first)) return first;
    }
    return claimNumber ? `Claim ${claimNumber}` : null;
  })();

  return {
    id: String(inv.id),
    caseIngestorCode: (meta.email_classification as string) ?? null,
    claimNumber,
    status: "pending_review" as const,
    filesStatus: "none" as const,
    ingestorStatus: inv.status,
    ingestorCaseType: inv.investigation_type,
    subjectName,
    insurer: (meta.client_company as string) ?? null,
    dueDate: null,
    filesError: (meta.errors as string[] | null)?.[0] ?? null,
    acceptedCaseId: null,
    reviewedAt: null,
    receivedAt: (meta.email_received_at as string) ?? inv.created_at,
    proposal: {
      caseIngestorCode: (meta.email_classification as string) ?? null,
      claimNumber,
      caseType: inv.investigation_type,
      ingestorStatus: inv.status,
      ingestorCreatedAt: inv.created_at,
      pushedAt: null,
      subject: {
        name: inv.subject_name ?? null,
        dob: inv.subject_dob ?? null,
        ssnLast4: null,
        addresses: inv.subject_addresses ?? [],
        phones: (inv.subject_phones as string[] | null) ?? [],
        vehicle: null,
        physical: null,
        job: null,
        employer: null,
        employerContact: null,
        employerPhone: null,
      },
      assignment: {
        insurer: (meta.client_company as string) ?? null,
        adjusterName: (meta.requester_name as string) ?? null,
        adjusterPhone: null,
        adjusterEmail: (meta.adjuster_email as string) ?? (meta.email_from as string) ?? null,
        type: inv.investigation_type,
        surveillanceDays: null,
        reportDueDate: null,
        dateOfLoss: null,
        typeOfClaim: (meta.case_type as string) ?? inv.investigation_type,
        bodyParts: (meta.body_parts as string) ?? null,
        restrictions: null,
        injuryDescription: (meta.body_parts as string) ?? null,
        instructions: null,
        suspicion: null,
        isRepresented: null,
        defenseAttorney: (meta.defense_attorney as string) ?? null,
        defenseLawFirm: null,
        defensePhone: null,
      },
      emailSource: {
        messageId: null,
        subject: (meta.email_subject as string) ?? null,
        from: (meta.email_from as string) ?? null,
        receivedAt: (meta.email_received_at as string) ?? inv.created_at,
        classification: (meta.email_classification as string) ?? null,
      },
      vehicles: [],
      attachments: [],
    },
  };
}

export async function prodigyPendingCases(params: { page?: number; pageSize?: number; search?: string } = {}): Promise<{
  pendingCases: PendingCaseListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const qs = new URLSearchParams();
  const pageSize = params.pageSize ?? 50;
  qs.set("limit", String(pageSize * 3)); // fetch more, filter client-side
  qs.set("offset", "0");

  const res = await fetch(`${PRODIGY_API}/api/investigations?${qs.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Prodigy API error: ${res.status}`);
  const data: ProdigyListResponse = await res.json();

  // Pending = open + progress=0 (not yet started)
  let pending = data.items.filter(
    (i) => i.status === "open" && (i.progress === 0 || i.progress == null)
  );

  // Search filter
  if (params.search) {
    const q = params.search.toLowerCase();
    pending = pending.filter(
      (i) =>
        i.subject_name?.toLowerCase().includes(q) ||
        String(i.extra_metadata?.claim_number ?? "").toLowerCase().includes(q) ||
        String(i.extra_metadata?.email_subject ?? "").toLowerCase().includes(q)
    );
  }

  const page = params.page ?? 1;
  const start = (page - 1) * pageSize;
  const paged = pending.slice(start, start + pageSize);

  return {
    pendingCases: paged.map(adaptToPending),
    total: pending.length,
    page,
    pageSize,
  };
}

// ── Dashboard Stats adapter ──────────────────────────────────────────────────

export interface ProdigySurveillanceStats {
  period: string;
  active_cases: number;
  surv_days: number;
  prev_days: number;
  days_delta: number;
  total_hours: number;
  hd_pct: number;
  investigators: { name: string; surv_days: number; hours: number; video_days: number; avg_hours_per_day: number; hd_pct: number }[];
}

export async function prodigyStats(): Promise<ProdigySurveillanceStats> {
  const res = await fetch(`${PRODIGY_API}/api/stats/surveillance`, { credentials: "include" });
  if (!res.ok) throw new Error(`Stats error: ${res.status}`);
  return res.json();
}

export async function prodigyCaseSummary() {
  const [list, stats] = await Promise.all([
    fetch(`${PRODIGY_API}/api/investigations?limit=1`, { credentials: "include" }).then((r) => r.json()),
    prodigyStats().catch(() => null),
  ]);
  return {
    total: (list as ProdigyListResponse).total ?? 0,
    activeInvestigators: stats?.investigators?.length ?? 0,
    survDays: stats?.surv_days ?? 0,
    activeCases: stats?.active_cases ?? 0,
  };
}

// ── casesApi.summary() compatible for dashboard widgets ─────────────────────

import type { CaseSummary } from "./crm-api";

export async function prodigySummary(): Promise<CaseSummary> {
  const [listRes, statsRes] = await Promise.all([
    fetch(`${PRODIGY_API}/api/investigations?limit=200`, { credentials: "include" }),
    fetch(`${PRODIGY_API}/api/stats/surveillance`, { credentials: "include" }),
  ]);

  const list: ProdigyListResponse = listRes.ok ? await listRes.json() : { items: [], total: 0, page: 1, page_size: 50 };

  const all = list.items;
  const openItems = all.filter((i) => i.status === "open");
  const closedItems = all.filter((i) => i.status === "closed" || i.status === "completed");

  const serviceMap: Record<string, number> = {};
  for (const inv of openItems) {
    const svc = TYPE_TO_SERVICE[inv.investigation_type] ?? "SURV";
    serviceMap[svc] = (serviceMap[svc] ?? 0) + 1;
  }

  const byService = Object.entries(serviceMap).map(([service, count]) => ({
    service: service as CaseService,
    count,
  }));

  return {
    byService,
    byRegion: [],
    openCount: openItems.length,
    suspendedCount: 0,
    closedCount: closedItems.length,
    overdueCount: 0,
    rushCount: openItems.filter((i) => i.priority === "rush").length,
    estimatedValueOpen: 0,
  };
}

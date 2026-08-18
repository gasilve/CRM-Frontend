import type { Role } from "./auth-client";

const CRM_API_URL = import.meta.env.VITE_CRM_API_URL ?? "http://localhost:3000";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  payload?: T;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toQuery<T extends object>(params: T): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return "";
  const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
  return `?${qs.toString()}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CRM_API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    /* no body */
  }

  if (!res.ok || !json?.success) {
    throw new ApiError(json?.message || `Request failed (${res.status})`, res.status);
  }
  return json.payload as T;
}

export type Region = "ca" | "tristate" | "texas";

export const REGION_LABELS: Record<Region, string> = {
  ca: "California",
  tristate: "Tri-State",
  texas: "Texas",
};

export interface CrmUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
  region: Region | null;
  roles: Role[];
}

export interface InvestigatorProfileSummary {
  fullName: string | null;
  dob: string | null;
  phone: string | null;
  homeAddressLine1: string | null;
  homeCity: string | null;
  homeState: string | null;
  homeZip: string | null;
  timezone: string | null;
  region: Region | null;
  certifications: Certification[];
}

export interface InvestigatorListItem extends CrmUser {
  profile: InvestigatorProfileSummary | null;
}

export interface Invitation {
  id: string;
  email: string;
  roles: Role[];
  invitedBy: { name: string; email: string } | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  profile?: InvestigatorProfileSummary | null;
}

export interface InvitationPreview {
  email: string;
  roles: Role[];
  expiresAt: string;
}

export const usersApi = {
  me: () => request<{ user: CrmUser }>("/users/me"),
  list: () => request<{ users: CrmUser[] }>("/users"),
};

export const rolesApi = {
  assign: (userId: string, role: Role) =>
    request<{ user: CrmUser }>("/roles/assign", { method: "POST", body: JSON.stringify({ userId, role }) }),
  revoke: (userId: string, role: Role) =>
    request<{ user: CrmUser }>("/roles/revoke", { method: "POST", body: JSON.stringify({ userId, role }) }),
};

// ─── Profiles & certifications ──────────────────────────────────────────────

export interface Certification {
  id: string;
  label: string;
  kind: "certification" | "license";
  authority?: string | null;
  number?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  color?: string | null;
}

export interface InvestigatorProfile {
  id: string;
  userId: string | null;
  email: string;
  fullName: string | null;
  dob: string | null;
  phone: string | null;
  homeAddressLine1: string | null;
  homeCity: string | null;
  homeState: string | null;
  homeZip: string | null;
  timezone: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  region: Region | null;
  notes: string | null;
  certifications: Certification[];
  createdAt: string;
  updatedAt: string;
}

/** Profile details an admin preps before sending an invite. */
export interface InviteProfilePayload {
  fullName?: string | null;
  dob?: string | null;
  phone?: string | null;
  homeAddressLine1?: string | null;
  homeCity?: string | null;
  homeState?: string | null;
  homeZip?: string | null;
  timezone?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  region?: Region | null;
  notes?: string | null;
  certifications?: Certification[];
}

export const profileApi = {
  me: () => request<{ user: CrmUser; profile: InvestigatorProfile | null }>("/profile"),
  update: (body: InviteProfilePayload & { name?: string; certifications?: Certification[] }) =>
    request<{ user: CrmUser; profile: InvestigatorProfile | null }>("/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

export const invitationsApi = {
  create: (email: string, roles: Role[], profile?: InviteProfilePayload) =>
    request<InviteCreateResult>("/invitations", { method: "POST", body: JSON.stringify({ email, roles, profile }) }),
  list: () => request<{ invitations: Invitation[] }>("/invitations"),
  revoke: (id: string) => request<null>(`/invitations/${id}`, { method: "DELETE" }),
  resend: (id: string) => request<{ invitation: Invitation }>(`/invitations/${id}/resend`, { method: "POST" }),
  preview: (token: string) => request<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`),
};

export type InviteCreateResult =
  | { kind: "invitation"; invitation: Invitation }
  | { kind: "roles_assigned"; user: CrmUser };

export const investigatorsApi = {
  list: () => request<{ investigators: InvestigatorListItem[] }>("/investigators"),
  get: (id: string) =>
    request<{ user: CrmUser; profile: InvestigatorProfile | null }>(`/investigators/${encodeURIComponent(id)}`),
  setRegion: (id: string, region: Region | null) =>
    request<{ user: { id: string; name: string; region: Region | null } }>(`/investigators/${id}/region`, {
      method: "PATCH",
      body: JSON.stringify({ region }),
    }),
};

// ─── Cases (Phase 2) ────────────────────────────────────────────────────────

export type CaseStatus = "open" | "suspended" | "closed";
export type CasePriority = "rush" | "asap" | "standard";
export type CaseService = "SURV" | "WC" | "FMLA" | "BG" | "DOM" | "SOC" | "DIS" | "LOC" | "PS" | "LIA";
export type CaseDayEntryType = "note" | "qa" | "photo_person" | "photo_vehicle" | "face_match";

export interface CaseClient {
  id: string;
  company: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes?: string | null;
}

export interface CaseAddress {
  id: string;
  label: string | null;
  line1: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  isPrimary: boolean;
}

export interface CaseVehicle {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  licensePlate: string | null;
  state: string | null;
  vin: string | null;
  photoUrl: string | null;
  notes: string | null;
}

export interface CaseParticipant {
  id: string;
  name: string;
  email: string;
}

export interface CaseAssignment {
  id: string;
  userId: string;
  role: string;
  assignedAt: string;
  user: CaseParticipant;
  assignedBy?: CaseParticipant | null;
}

export interface CasePresurveillance {
  id: string;
  status: "pending" | "fetched" | "not_available";
  summary: string | null;
  fetchedAt: string | null;
}

export interface CaseDayEntry {
  id: string;
  type: CaseDayEntryType;
  question: string | null;
  body: string | null;
  photoUrl: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  author: CaseParticipant | null;
}

export interface CaseDay {
  id: string;
  date: string;
  entries: CaseDayEntry[];
}

export interface CaseListItem {
  id: string;
  caseNumber: string;
  claimNumber: string | null;
  policyNumber: string | null;
  clientId: string | null;
  client: { id: string; company: string } | null;
  adjusterName: string | null;
  adjusterEmail: string | null;
  adjusterPhone: string | null;
  service: CaseService;
  tags: string[];
  status: CaseStatus;
  priority: CasePriority;
  reopened: boolean;
  region: Region | null;
  state: string | null;
  dateOpened: string;
  dateClosed: string | null;
  dateOfInjury: string | null;
  dueDate: string | null;
  daysAllotted: number | null;
  startTime: string | null;
  estimatedValue: number | null;
  description: string | null;
  subjectName: string;
  subjectAliases: string[];
  subjectDob: string | null;
  subjectPhotoUrl: string | null;
  addresses: CaseAddress[];
  assignments: CaseAssignment[];
}

export interface CaseDetail extends CaseListItem {
  subjectSsn: string | null;
  subjectDriverLicense: string | null;
  subjectJobTitle: string | null;
  subjectEmployer: string | null;
  subjectEmployerAddress: string | null;
  subjectWorkStatus: string | null;
  subjectLanguage: string | null;
  subjectDescription: string | null;
  vehicles: CaseVehicle[];
  presurveillance: CasePresurveillance | null;
  days: CaseDay[];
  createdBy: CaseParticipant | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseSummary {
  byService: { service: CaseService; count: number }[];
  openCount: number;
  suspendedCount: number;
  closedCount: number;
  overdueCount: number;
  rushCount: number;
  estimatedValueOpen: number;
}

export interface CasesListParams {
  status?: CaseStatus;
  priority?: CasePriority;
  service?: CaseService;
  region?: Region;
  tag?: string;
  clientId?: string;
  assignedTo?: string;
  search?: string;
  dueFrom?: string;
  dueTo?: string;
  page?: number;
  pageSize?: number;
}

export interface CaseAddressInput {
  label?: string;
  line1: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number | null;
  lng?: number | null;
  isPrimary?: boolean;
}

export interface CaseVehicleInput {
  make?: string;
  model?: string;
  year?: number | null;
  color?: string;
  licensePlate?: string;
  state?: string;
  vin?: string;
  photoUrl?: string;
  notes?: string;
}

export interface CreateCasePayload {
  claimNumber?: string;
  policyNumber?: string;
  clientId?: string | null;
  adjusterName?: string;
  adjusterEmail?: string;
  adjusterPhone?: string;
  service: CaseService;
  tags?: string[];
  priority?: CasePriority;
  region?: Region | null;
  state?: string;
  dateOpened?: string;
  dateOfInjury?: string;
  dueDate?: string;
  daysAllotted?: number | null;
  startTime?: string;
  estimatedValue?: number | null;
  description?: string;
  subjectName: string;
  subjectAliases?: string[];
  subjectDob?: string;
  subjectSsn?: string;
  subjectDriverLicense?: string;
  subjectJobTitle?: string;
  subjectEmployer?: string;
  subjectEmployerAddress?: string;
  subjectWorkStatus?: string;
  subjectLanguage?: string;
  subjectDescription?: string;
  address?: CaseAddressInput;
}

export type UpdateCasePayload = Partial<CreateCasePayload> & {
  status?: CaseStatus;
  reopened?: boolean;
  dateClosed?: string | null;
  subjectPhotoUrl?: string | null;
};

export interface AddDayEntryPayload {
  date: string;
  type: CaseDayEntryType;
  question?: string;
  body?: string;
  photoUrl?: string;
  meta?: Record<string, unknown>;
}

export const casesApi = {
  list: (params: CasesListParams = {}) =>
    request<{ cases: CaseListItem[]; total: number; page: number; pageSize: number }>(`/cases${toQuery(params)}`),
  summary: () => request<CaseSummary>("/cases/summary"),
  get: (id: string) => request<{ case: CaseDetail }>(`/cases/${id}`),
  create: (body: CreateCasePayload) =>
    request<{ case: CaseDetail }>("/cases", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: UpdateCasePayload) =>
    request<{ case: CaseDetail }>(`/cases/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => request<null>(`/cases/${id}`, { method: "DELETE" }),

  addAddress: (id: string, body: CaseAddressInput) =>
    request<{ address: CaseAddress }>(`/cases/${id}/addresses`, { method: "POST", body: JSON.stringify(body) }),
  updateAddress: (id: string, addressId: string, body: CaseAddressInput) =>
    request<{ address: CaseAddress }>(`/cases/${id}/addresses/${addressId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteAddress: (id: string, addressId: string) =>
    request<null>(`/cases/${id}/addresses/${addressId}`, { method: "DELETE" }),

  addVehicle: (id: string, body: CaseVehicleInput) =>
    request<{ vehicle: CaseVehicle }>(`/cases/${id}/vehicles`, { method: "POST", body: JSON.stringify(body) }),
  updateVehicle: (id: string, vehicleId: string, body: CaseVehicleInput) =>
    request<{ vehicle: CaseVehicle }>(`/cases/${id}/vehicles/${vehicleId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteVehicle: (id: string, vehicleId: string) =>
    request<null>(`/cases/${id}/vehicles/${vehicleId}`, { method: "DELETE" }),

  assign: (id: string, userId: string, role = "investigator") =>
    request<{ assignment: CaseAssignment }>(`/cases/${id}/assignments`, {
      method: "POST",
      body: JSON.stringify({ userId, role }),
    }),
  unassign: (id: string, userId: string) =>
    request<null>(`/cases/${id}/assignments/${userId}`, { method: "DELETE" }),

  updatePresurveillance: (id: string, body: { status?: CasePresurveillance["status"]; summary?: string | null }) =>
    request<{ presurveillance: CasePresurveillance }>(`/cases/${id}/presurveillance`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  addDayEntry: (id: string, body: AddDayEntryPayload) =>
    request<{ days: CaseDay[] }>(`/cases/${id}/days/entries`, { method: "POST", body: JSON.stringify(body) }),
  deleteDayEntry: (id: string, dayId: string, entryId: string) =>
    request<null>(`/cases/${id}/days/${dayId}/entries/${entryId}`, { method: "DELETE" }),
};

export const clientsApi = {
  list: () => request<{ clients: CaseClient[] }>("/clients"),
  create: (body: { company: string; contactName?: string; contactEmail?: string; contactPhone?: string }) =>
    request<{ client: CaseClient }>("/clients", { method: "POST", body: JSON.stringify(body) }),
};

export interface WeatherReading {
  group: "ca" | "tristate" | "texas";
  label: string;
  city: string;
  tempF: number;
  code: number;
  isDay: boolean;
}

export interface WeatherDay {
  date: string;
  code: number;
  highF: number | null;
  lowF: number | null;
  precipChance: number | null;
  windMph: number | null;
}

export interface WeeklyWeather {
  group: "ca" | "tristate" | "texas";
  label: string;
  city: string;
  days: WeatherDay[];
}

export const weatherApi = {
  list: () => request<{ readings: WeatherReading[] }>("/weather"),
  weekly: (start: string) => request<{ start: string; groups: WeeklyWeather[] }>(`/weather/weekly?start=${start}`),
};

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export const geocodeApi = {
  lookup: (query: { line1: string; city?: string; state?: string; zip?: string }) =>
    request<{ result: GeocodeResult | null }>(`/geocode${toQuery(query)}`),
};

// ─── Scheduling ──────────────────────────────────────────────────────────────

export interface ScheduleBlock {
  id: string;
  caseId: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string | null;
  notes: string | null;
  createdAt: string;
  case: {
    id: string;
    caseNumber: string;
    claimNumber: string | null;
    subjectName: string;
    subjectDob: string | null;
    region: Region | null;
    status: CaseStatus;
    priority: CasePriority;
    dueDate: string | null;
  };
  user: { id: string; name: string; email: string; region: Region | null };
  createdBy: { id: string; name: string } | null;
}

export interface ScheduleListParams {
  from?: string;
  to?: string;
  region?: Region;
  caseId?: string;
  userId?: string;
}

export interface CreateScheduleBlockPayload {
  caseId: string;
  userId: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  notes?: string | null;
}

export const scheduleApi = {
  list: (params: ScheduleListParams = {}) =>
    request<{ blocks: ScheduleBlock[] }>(`/schedule${toQuery(params)}`),
  create: (body: CreateScheduleBlockPayload) =>
    request<{ block: ScheduleBlock }>("/schedule", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Omit<CreateScheduleBlockPayload, "caseId" | "userId">>) =>
    request<{ block: ScheduleBlock }>(`/schedule/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => request<null>(`/schedule/${id}`, { method: "DELETE" }),
};

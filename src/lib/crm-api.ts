import type { CaseScope, FieldAccessLevel, PeopleScope, RoleSummary, ScheduleScope } from "./auth-client";

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
    // Fetch cache mode — not a request header, so no CORS preflight issue.
    cache: "no-store",
    credentials: "include",
    headers: {
      // Only declare a content type when there is a body. A GET with no custom
      // headers is a "simple" CORS request, so the browser skips the OPTIONS
      // preflight — that alone halves the request count for reads.
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
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

/**
 * Fetches binary content (attachments) instead of the JSON envelope.
 *
 * Goes through `fetch` rather than pointing an <img>/<iframe> straight at the
 * URL so the session cookie is always attached, regardless of how the browser
 * treats credentials on subresource requests.
 */
async function requestBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(`${CRM_API_URL}${path}`, { cache: "no-store", credentials: "include", signal });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (json?.message) message = json.message;
    } catch {
      /* binary endpoints fail with a JSON envelope, but don't count on it */
    }
    throw new ApiError(message, res.status);
  }
  return res.blob();
}

/** Absolute URL for a file — used for "download" links, which need a real href. */
export const fileDownloadUrl = (path: string): string => `${CRM_API_URL}${path}?download=1`;

export const caseFilePath = (caseId: string, fileId: string): string => `/cases/${caseId}/files/${fileId}`;

export const pendingCaseFilePath = (pendingCaseId: string, fileId: string): string =>
  `/pending-cases/${pendingCaseId}/files/${fileId}`;

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
  roles: RoleSummary[];
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
  roles: RoleSummary[];
  invitedBy: { name: string; email: string } | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  profile?: InvestigatorProfileSummary | null;
}

export interface InvitationPreview {
  email: string;
  roles: RoleSummary[];
  expiresAt: string;
}

export const usersApi = {
  me: () => request<{ user: CrmUser }>("/users/me"),
  list: () => request<{ users: CrmUser[] }>("/users"),
};

// ─── Roles & permissions ────────────────────────────────────────────────────

/** A role with everything the Administration editor needs. */
export interface RoleDetail extends RoleSummary {
  caseScope: CaseScope;
  peopleScope: PeopleScope;
  scheduleScope: ScheduleScope;
  /** Holders can be assigned to cases and scheduled as field staff. */
  canWorkCases: boolean;
  sortOrder: number;
  permissions: string[];
  /** Restrictions only — a field absent from here is unrestricted. */
  fieldRules: Record<string, FieldAccessLevel>;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  requires?: string[];
}

export interface PermissionGroup {
  id: string;
  label: string;
  description: string;
  permissions: PermissionDefinition[];
}

export interface FieldDefinition {
  key: string;
  label: string;
  description: string;
  maskable: boolean;
}

export interface FieldGroup {
  id: string;
  label: string;
  description: string;
  fields: FieldDefinition[];
}

export interface ScopeOption {
  value: string;
  label: string;
  description: string;
}

export interface ScopeDefinition {
  label: string;
  description: string;
  options: ScopeOption[];
}

export interface AccessCatalog {
  permissionGroups: PermissionGroup[];
  fieldGroups: FieldGroup[];
  fieldAccessLevels: FieldAccessLevel[];
  scopes: {
    caseScope: ScopeDefinition;
    peopleScope: ScopeDefinition;
    scheduleScope: ScopeDefinition;
  };
}

export interface RolePayload {
  name: string;
  description?: string | null;
  color?: string | null;
  caseScope: CaseScope;
  peopleScope: PeopleScope;
  scheduleScope: ScheduleScope;
  canWorkCases: boolean;
  permissions: string[];
  fieldRules: Record<string, FieldAccessLevel>;
}

export const rolesApi = {
  catalog: () => request<AccessCatalog>("/roles/catalog"),
  list: () => request<{ roles: RoleDetail[] }>("/roles"),
  create: (body: RolePayload) => request<{ role: RoleDetail }>("/roles", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: RolePayload) =>
    request<{ role: RoleDetail }>(`/roles/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => request<null>(`/roles/${id}`, { method: "DELETE" }),
  reorder: (roleIds: string[]) =>
    request<{ roles: RoleDetail[] }>("/roles/reorder", { method: "POST", body: JSON.stringify({ roleIds }) }),
  setUserRoles: (userId: string, roleIds: string[]) =>
    request<{ user: CrmUser }>(`/roles/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: JSON.stringify({ roleIds }),
    }),
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
  create: (email: string, roleIds: string[], profile?: InviteProfilePayload) =>
    request<InviteCreateResult>("/invitations", { method: "POST", body: JSON.stringify({ email, roleIds, profile }) }),
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
export type CasePriority = "rush" | "standard";
export type SubjectTransport = "vehicle" | "foot" | "transit" | "other";
/** How built-up the area around the address is. `dense` is densely populated. */
export type SubjectSetting = "suburban" | "rural" | "dense";
export type SubjectAwareness = "unnoticed" | "suspicious" | "aware";
export type CaseService = "SURV" | "WC" | "FMLA" | "BG" | "DOM" | "SOC" | "DIS" | "LOC" | "PS" | "LIA";
export type CaseDayEntryType =
  | "note"
  | "qa"
  | "photo_person"
  | "photo_vehicle"
  | "photo_home"
  | "face_match"
  /** Written by the office rather than the field investigator. */
  | "manager_note";
export type QuestionSource = "standard" | "dynamic" | "free";

export interface CaseClient {
  id: string;
  company: string;
  location?: string | null;
  address?: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: { cases: number; contacts: number };
}

export type ClientContactRole =
  | "claims_adjuster"
  | "claims_investigator"
  | "lawyer"
  | "employer"
  | "risk_manager"
  | "inhouse_claims"
  | "other";

export const CLIENT_CONTACT_ROLE_LABELS: Record<ClientContactRole, string> = {
  claims_adjuster: "Claims adjuster",
  claims_investigator: "Claims investigator",
  lawyer: "Lawyer / attorney",
  employer: "Employer",
  risk_manager: "Risk manager",
  inhouse_claims: "In-house claims",
  other: "Other",
};

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  role: ClientContactRole;
  email: string | null;
  phone: string | null;
  location: string | null;
  address: string | null;
  lawFirmName: string | null;
  matterNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientCaseSummary {
  id: string;
  caseNumber: string;
  claimNumber: string | null;
  subjectName: string;
  status: CaseStatus;
  service: CaseService;
  updatedAt: string;
}

export interface ClientDetail extends CaseClient {
  contacts: ClientContact[];
  cases: ClientCaseSummary[];
}

export type ClientCreateBody = {
  company: string;
  location?: string;
  address?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactRole?: ClientContactRole;
  notes?: string;
};

export type ClientUpdateBody = {
  company?: string;
  location?: string | null;
  address?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
};

export type ClientContactBody = {
  name: string;
  role?: ClientContactRole;
  email?: string;
  phone?: string;
  location?: string;
  address?: string;
  lawFirmName?: string;
  matterNumber?: string;
  notes?: string;
};

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

export type CasePersonRelationship =
  | "cohabitant"
  | "neighbor"
  | "family"
  | "coworker"
  | "visitor"
  | "passer_by"
  | "other";

export const CASE_PERSON_RELATIONSHIP_LABELS: Record<CasePersonRelationship, string> = {
  cohabitant: "Cohabitant",
  neighbor: "Neighbor",
  family: "Family",
  coworker: "Coworker",
  visitor: "Visitor",
  passer_by: "Passer-by",
  other: "Other",
};

export type PersonVehicleRole = "owner" | "driver" | "passenger" | "observed_in";
export type VehicleKind = "subject" | "neighbor" | "unknown";
export const VEHICLE_SEAT_COUNTS = [2, 4, 5, 6, 7] as const;

/** A point-in-time seat-occupancy observation — powers the seat-hover history. */
export interface VehicleOccupancyEvent {
  id: string;
  role: PersonVehicleRole;
  at: string;
  note: string | null;
  person: { id: string; name: string; photoUrl: string | null; relationship?: CasePersonRelationship; isSubject?: boolean };
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
  registeredOwner: string | null;
  /** Seats in the chassis diagram — 1 driver + (seatCount - 1) passenger slots. Defaults to 5. */
  seatCount: number;
  /** Whose car this presumably is — badges it in the Vehicles list. */
  kind: VehicleKind;
  /** People linked to this vehicle (owner/driver/…). Present on case detail. */
  personLinks?: {
    id: string;
    role: PersonVehicleRole;
    person: { id: string; name: string; relationship: CasePersonRelationship; isSubject?: boolean };
  }[];
  /** Chronological log of who was tagged driver/passenger/etc. and when. Present on case detail. */
  occupancyEvents?: VehicleOccupancyEvent[];
}

export interface CasePersonVehicleLink {
  id: string;
  role: PersonVehicleRole;
  vehicle: {
    id: string;
    make: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
    licensePlate: string | null;
  };
}

/** An additional person on the case (not the subject — that stays on Case). */
export interface CasePerson {
  id: string;
  name: string;
  relationship: CasePersonRelationship;
  photoUrl: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  vehicleLinks: CasePersonVehicleLink[];
  createdAt: string;
  updatedAt: string;
  /** Server-managed mirror of the subject — lets the subject be assigned to a vehicle seat
   *  like anyone else. Always hide these from the cohabitant roster. */
  isSubject?: boolean;
}

export interface CaseParticipant {
  id: string;
  name: string;
  email: string;
}

export interface CaseRecentNote {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
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
  updatedAt?: string;
  author: CaseParticipant | null;
  /** Quick-capture tagging — which associate or vehicle this entry is about. */
  personId?: string | null;
  vehicleId?: string | null;
  questionSource?: QuestionSource | null;
  standardQuestionId?: string | null;
  ruleId?: string | null;
}

/** Prior wording of a field note, appended on each edit so nothing is lost. */
export interface NoteVersion {
  body: string;
  at: string;
  authorId?: string | null;
  authorName?: string | null;
}

export function noteVersionsOf(entry: CaseDayEntry): NoteVersion[] {
  const raw = entry.meta?.versions;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (v): v is NoteVersion =>
      !!v && typeof v === "object" && typeof (v as NoteVersion).body === "string" && typeof (v as NoteVersion).at === "string",
  );
}

export type CaseTodoKind = "system" | "manual";
export type CaseTodoStatus = "open" | "done";

export interface CaseTodo {
  id: string;
  caseId: string;
  title: string;
  kind: CaseTodoKind;
  sourceRef: string | null;
  status: CaseTodoStatus;
  dueBy: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CasePattern {
  id: string;
  caseId: string;
  title: string;
  place: string | null;
  whenLabel: string;
  detail: string | null;
  travel: string | null;
  source: "manual" | "generated";
  createdAt: string;
  updatedAt: string;
}

export interface CasePatternInput {
  title?: string;
  place?: string | null;
  whenLabel: string;
  detail?: string | null;
  travel?: string | null;
}

export interface CaseDay {
  id: string;
  date: string;
  /** End-of-day wrap-up, when written. */
  summary: string | null;
  /** How aware the subject was of the investigator. Null until answered. */
  awareness: SubjectAwareness | null;
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
  /** First investigator field note. Null until that note exists. */
  earliestActiveAt: string | null;
  situationSummary: string | null;
  subjectWorkStatus: string | null;
  _count?: { people: number; vehicles: number; days: number };
  dateOpened: string;
  dateClosed: string | null;
  dateOfInjury: string | null;
  dueDate: string | null;
  /** Independent medical exam. Null until someone schedules one. */
  imeAt: string | null;
  daysAllotted: number | null;
  startTime: string | null;
  estimatedValue: number | null;
  description: string | null;
  subjectName: string;
  subjectAliases: string[];
  subjectDob: string | null;
  subjectPhotoUrl: string | null;
  subjectTransport: SubjectTransport | null;
  subjectSetting: SubjectSetting | null;
  addresses: CaseAddress[];
  assignments: CaseAssignment[];
  /** Newest four field notes, for the glance-card hover. */
  recentNotes?: CaseRecentNote[];
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
  people: CasePerson[];
  presurveillance: CasePresurveillance | null;
  days: CaseDay[];
  /** Who was scheduled in the field on which date — the journal's day-crew credit. */
  scheduleBlocks: { id: string; date: string; notes: string | null; user: CaseParticipant }[];
  openDays: { id: string; caseId: string; date: string; createdAt: string }[];
  specialDates: { id: string; caseId: string; date: string; name: string; color: string; createdAt: string }[];
  patterns: CasePattern[];
  files: CaseFile[];
  todos: CaseTodo[];
  situationSummary: string | null;
  createdBy: CaseParticipant | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A document on a live case, carried over from the proposal on accept. A row
 * with no `storageKey` is known-but-unheld — the API answers its download with
 * a placeholder image rather than a 404.
 */
export interface CaseFile {
  id: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  extracted: Record<string, unknown> | null;
  storage: string;
  storageKey: string | null;
  source: string;
  error: string | null;
  createdAt: string;
}

export interface CaseSummary {
  byService: { service: CaseService; count: number }[];
  byRegion: { region: Region | null; count: number }[];
  openCount: number;
  suspendedCount: number;
  closedCount: number;
  overdueCount: number;
  rushCount: number;
  estimatedValueOpen: number;
}

/** Case columns the API can order the list by. */
export type CaseSortField =
  | "dueDate"
  | "subjectName"
  | "claimNumber"
  | "dateOpened"
  | "region"
  | "state"
  | "status"
  | "priority"
  | "service"
  | "earliestActiveAt";

export interface CasesListParams {
  status?: CaseStatus;
  priority?: CasePriority;
  service?: CaseService;
  region?: Region;
  state?: string;
  activity?: "started" | "not_started";
  tag?: string;
  clientId?: string;
  assignedTo?: string;
  search?: string;
  dueFrom?: string;
  dueTo?: string;
  sortBy?: CaseSortField;
  sortDir?: "asc" | "desc";
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
  photoUrl?: string | null;
  notes?: string;
  registeredOwner?: string | null;
  seatCount?: number;
  kind?: VehicleKind;
}

export interface CasePersonInput {
  name: string;
  relationship?: CasePersonRelationship;
  photoUrl?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
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
  imeAt?: string | null;
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
  /** Quick-capture tagging — which associate or vehicle this entry is about. */
  personId?: string | null;
  vehicleId?: string | null;
  /** Set on `type: "qa"` rows written from the question banks. */
  questionSource?: QuestionSource;
  standardQuestionId?: string | null;
  ruleId?: string | null;
}

// ─── My Day — this investigator's own assignments ──────────────────────────

export interface MyAssignment {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  case: {
    id: string;
    caseNumber: string;
    claimNumber: string | null;
    subjectName: string;
    subjectPhotoUrl: string | null;
    subjectTransport: SubjectTransport | null;
    service: CaseService;
    status: CaseStatus;
    priority: CasePriority;
    dueDate: string | null;
    dateOpened: string;
    region: Region | null;
    state: string | null;
    tags: string[];
    situationSummary: string | null;
    description: string | null;
    subjectWorkStatus: string | null;
    earliestActiveAt: string | null;
    client: { id: string; company: string } | null;
    addresses: { label: string | null; line1: string; city: string | null; state: string | null; zip: string | null; isPrimary: boolean }[];
    _count: { people: number; vehicles: number; days: number };
    assignments?: { user: { id: string; name: string } }[];
  };
}

export type MyCaseloadBucket = "today" | "current" | "past" | "closed";

export interface MyCaseloadItem {
  caseId: string;
  bucket: MyCaseloadBucket;
  assignedAt: string;
  lastScheduledDate: string | null;
  /** Next date this case is on your schedule, when it's still ahead of you. */
  nextScheduledDate: string | null;
  /** How many days you've already been in the field on this case. */
  daysWorked: number;
  todayNotes: string | null;
  recentNotes?: CaseRecentNote[];
  case: MyAssignment["case"];
}

export interface MyCaseloadResponse {
  todayCaseId: string | null;
  cases: MyCaseloadItem[];
}

export interface CaseTodoInput {
  title: string;
  dueBy?: string | null;
}

export interface CaseTodoUpdateInput {
  title?: string;
  status?: CaseTodoStatus;
  dueBy?: string | null;
}

export interface VehicleEventInput {
  personId: string;
  role: PersonVehicleRole;
  at?: string;
  note?: string | null;
}

// ─── Clarification questions ────────────────────────────────────────────────

export interface MatchedQuestionRule {
  ruleId: string;
  label: string;
  matchedOn: string;
  followUpQuestions: string[];
}

export interface UnansweredStandardQuestion {
  standardQuestionId: string;
  text: string;
}

export interface SuggestQuestionsResult {
  dayId: string;
  dynamicMatches: MatchedQuestionRule[];
  standardQuestions: UnansweredStandardQuestion[];
}

// ─── Visual comparison (CFR adapter) ────────────────────────────────────────

export interface VisualComparisonResult {
  /** 0–100 similarity score. */
  score: number;
  verdict: "MATCH" | "NO MATCH";
  threshold: number;
  /** Which implementation produced this — surfaced for transparency while CFR is pending integration. */
  source: "mock" | "cfr";
}

export interface VisualComparisonPayload {
  subjectPhotoUrl: string;
  probePhotoUrl: string;
  subjectLabel?: string;
  probeLabel?: string;
  date?: string;
}

export interface VisualComparisonResponse {
  result: VisualComparisonResult;
  entry: CaseDayEntry;
}

export const casesApi = {
  list: (params: CasesListParams = {}) =>
    request<{ cases: CaseListItem[]; total: number; page: number; pageSize: number }>(`/cases${toQuery(params)}`),
  summary: () => request<CaseSummary>("/cases/summary"),
  /** My Day — this investigator's own schedule blocks (+ the case each points at) between two dates, inclusive. */
  mine: (from: string, to: string) =>
    request<{ assignments: MyAssignment[] }>(`/cases/mine${toQuery({ from, to })}`),
  /** Investigator caseload for My Day — today / current / past / closed buckets. */
  myCaseload: () => request<MyCaseloadResponse>("/cases/mine/caseload"),
  get: (id: string) => request<{ case: CaseDetail }>(`/cases/${id}`),
  create: (body: CreateCasePayload) =>
    request<{ case: CaseDetail }>("/cases", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: UpdateCasePayload) =>
    request<{ case: CaseDetail }>(`/cases/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  setIme: (id: string, imeAt: string | null) =>
    request<{ id: string; imeAt: string | null }>(`/cases/${id}/ime`, {
      method: "PATCH",
      body: JSON.stringify({ imeAt }),
    }),
  addOpenDay: (id: string, date: string) =>
    request<{ openDay: { id: string; caseId: string; date: string; createdAt: string } }>(`/cases/${id}/open-days`, {
      method: "POST",
      body: JSON.stringify({ date }),
    }),
  removeOpenDay: (id: string, openDayId: string) =>
    request<null>(`/cases/${id}/open-days/${openDayId}`, { method: "DELETE" }),
  addSpecialDate: (id: string, body: { date: string; name: string; color: string }) =>
    request<{ specialDate: { id: string; caseId: string; date: string; name: string; color: string; createdAt: string } }>(
      `/cases/${id}/special-dates`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  removeSpecialDate: (id: string, specialDateId: string) =>
    request<null>(`/cases/${id}/special-dates/${specialDateId}`, { method: "DELETE" }),
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

  listFiles: (id: string) => request<{ files: CaseFile[] }>(`/cases/${id}/files`),
  fileBlob: (id: string, fileId: string, signal?: AbortSignal) => requestBlob(caseFilePath(id, fileId), signal),
  /** Upload a field-capture photo (multipart). Returns a CaseFile URL usable as day-entry photoUrl. */
  uploadCapturePhoto: async (id: string, file: File) => {
    const form = new FormData();
    form.append("photo", file);
    const res = await fetch(`${CRM_API_URL}/cases/${id}/capture-photo`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body: form,
    });
    type UploadPayload = { file: { fileId: string; url: string; contentType: string | null; sizeBytes: number | null } };
    let json: ApiEnvelope<UploadPayload> | null = null;
    try {
      json = (await res.json()) as ApiEnvelope<UploadPayload>;
    } catch {
      /* no body */
    }
    if (!res.ok || !json?.success || !json.payload) {
      throw new ApiError(json?.message || `Upload failed (${res.status})`, res.status);
    }
    return json.payload.file;
  },
  /** Wipes and re-fetches every attachment from the ingestor — for rows stuck on a wiped local disk. */
  resyncFiles: (id: string) => request<{ case: CaseDetail }>(`/cases/${id}/files/resync`, { method: "POST" }),

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
  updateDayEntry: (id: string, dayId: string, entryId: string, body: string) =>
    request<{ days: CaseDay[] }>(`/cases/${id}/days/${dayId}/entries/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    }),
  deleteDayEntry: (id: string, dayId: string, entryId: string) =>
    request<null>(`/cases/${id}/days/${dayId}/entries/${entryId}`, { method: "DELETE" }),

  addPerson: (id: string, body: CasePersonInput) =>
    request<{ person: CasePerson }>(`/cases/${id}/people`, { method: "POST", body: JSON.stringify(body) }),
  updatePerson: (id: string, personId: string, body: CasePersonInput) =>
    request<{ person: CasePerson }>(`/cases/${id}/people/${personId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deletePerson: (id: string, personId: string) => request<null>(`/cases/${id}/people/${personId}`, { method: "DELETE" }),
  linkPersonVehicle: (id: string, personId: string, vehicleId: string, role: PersonVehicleRole) =>
    request<{ person: CasePerson }>(`/cases/${id}/people/${personId}/vehicles`, {
      method: "POST",
      body: JSON.stringify({ vehicleId, role }),
    }),
  unlinkPersonVehicle: (id: string, personId: string, linkId: string) =>
    request<null>(`/cases/${id}/people/${personId}/vehicles/${linkId}`, { method: "DELETE" }),

  updateSituationSummary: (id: string, situationSummary: string | null) =>
    request<{ id: string; situationSummary: string | null }>(`/cases/${id}/summary`, {
      method: "PATCH",
      body: JSON.stringify({ situationSummary }),
    }),
  generateSituationSummary: (id: string) =>
    request<{ id: string; situationSummary: string | null }>(`/cases/${id}/summary/generate`, { method: "POST" }),
  setDaySummary: (id: string, date: string, summary: string | null) =>
    request<{ day: { id: string; date: string; summary: string | null } }>(`/cases/${id}/days/summary`, {
      method: "PUT",
      body: JSON.stringify({ date, summary }),
    }),
  setTransport: (id: string, transport: SubjectTransport | null) =>
    request<{ case: { id: string; subjectTransport: SubjectTransport | null } }>(`/cases/${id}/transport`, {
      method: "PATCH",
      body: JSON.stringify({ transport }),
    }),
  setSubjectSetting: (id: string, setting: SubjectSetting | null) =>
    request<{ case: { id: string; subjectSetting: SubjectSetting | null } }>(`/cases/${id}/setting`, {
      method: "PATCH",
      body: JSON.stringify({ setting }),
    }),
  setAwareness: (id: string, date: string, awareness: SubjectAwareness | null) =>
    request<{ day: { id: string; date: string; awareness: SubjectAwareness | null } }>(`/cases/${id}/days/awareness`, {
      method: "PUT",
      body: JSON.stringify({ date, awareness }),
    }),

  // ─── Todos ────────────────────────────────────────────────────────────────
  listTodos: (id: string) => request<{ todos: CaseTodo[] }>(`/cases/${id}/todos`),
  addTodo: (id: string, body: CaseTodoInput) =>
    request<{ todo: CaseTodo }>(`/cases/${id}/todos`, { method: "POST", body: JSON.stringify(body) }),
  updateTodo: (id: string, todoId: string, body: CaseTodoUpdateInput) =>
    request<{ todo: CaseTodo }>(`/cases/${id}/todos/${todoId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTodo: (id: string, todoId: string) => request<null>(`/cases/${id}/todos/${todoId}`, { method: "DELETE" }),

  listPatterns: (id: string) => request<{ patterns: CasePattern[] }>(`/cases/${id}/patterns`),
  addPattern: (id: string, body: CasePatternInput) =>
    request<{ pattern: CasePattern }>(`/cases/${id}/patterns`, { method: "POST", body: JSON.stringify(body) }),
  updatePattern: (id: string, patternId: string, body: Partial<CasePatternInput>) =>
    request<{ pattern: CasePattern }>(`/cases/${id}/patterns/${patternId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deletePattern: (id: string, patternId: string) =>
    request<null>(`/cases/${id}/patterns/${patternId}`, { method: "DELETE" }),
  generatePatterns: (id: string) =>
    request<{ patterns: CasePattern[]; scannedNotes: number }>(`/cases/${id}/patterns/generate`, { method: "POST" }),

  // ─── Vehicle seat-occupancy events ─────────────────────────────────────────
  addVehicleEvent: (id: string, vehicleId: string, body: VehicleEventInput) =>
    request<{ event: VehicleOccupancyEvent }>(`/cases/${id}/vehicles/${vehicleId}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteVehicleEvent: (id: string, vehicleId: string, eventId: string) =>
    request<null>(`/cases/${id}/vehicles/${vehicleId}/events/${eventId}`, { method: "DELETE" }),

  // ─── Clarification questions ────────────────────────────────────────────────
  suggestQuestions: (id: string, body: { date: string; text?: string }) =>
    request<SuggestQuestionsResult>(`/cases/${id}/days/suggest-questions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ─── Visual comparison (CFR adapter) ────────────────────────────────────────
  runVisualComparison: (id: string, body: VisualComparisonPayload) =>
    request<VisualComparisonResponse>(`/cases/${id}/visual-comparison`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ─── Dashboard aggregate widgets ─────────────────────────────────────────
  urgent: () => request<UrgentCasesSummary>("/cases/urgent"),
  aging: () => request<CaseAgingSummary>("/cases/aging"),
  journalRecent: () => request<{ entries: JournalEntry[] }>("/cases/journal/recent"),
  filesHealth: () => request<FilesHealthSummary>("/cases/files/health"),
  presurveillanceSummary: () => request<PresurveillanceSummary>("/cases/presurveillance/summary"),
};

// ─── Time entries — clock-in/out + foreground location pings ──────────────

export type TimeEntryStatus = "active" | "ended";

export interface TimeEntry {
  id: string;
  caseId: string;
  userId: string;
  status: TimeEntryStatus;
  clockInAt: string;
  clockOutAt: string | null;
  createdAt: string;
  case?: {
    id: string;
    caseNumber: string;
    claimNumber: string | null;
    subjectName: string;
    subjectPhotoUrl: string | null;
  };
}

export interface GeoPingInput {
  lat: number;
  lng: number;
  accuracy?: number | null;
  /** ISO timestamp. */
  capturedAt: string;
}

export interface ActiveWorkResponse {
  active: TimeEntry | null;
  /** Time already banked today from finished sessions — the clock counts up from here. */
  settledMsToday: number;
  /** When the running session started counting toward today (null when clocked out). */
  runningSince: string | null;
  /** Snapshot of settled + running at response time. */
  msToday: number;
  hoursToday: number;
}

export const timeEntriesApi = {
  /** "Start working the case" — clocks in, ending any other active entry first. */
  start: (caseId: string) => request<{ entry: TimeEntry }>("/time-entries", { method: "POST", body: JSON.stringify({ caseId }) }),
  stop: (id: string) => request<{ entry: TimeEntry }>(`/time-entries/${id}/stop`, { method: "POST" }),
  /** Batched foreground location breadcrumbs from the browser Geolocation API. Foreground-only — see the working-mode UI copy. */
  addPings: (id: string, pings: GeoPingInput[]) =>
    request<{ created: number }>(`/time-entries/${id}/pings`, { method: "POST", body: JSON.stringify({ pings }) }),
  /** The signed-in investigator's active clock-in (if any) + total hours worked today. */
  active: () => request<ActiveWorkResponse>("/time-entries/active"),
};

// ─── Question bank (admin) — standard questions + dynamic rules ───────────

export interface StandardQuestion {
  id: string;
  text: string;
  appliesToService: CaseService | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StandardQuestionInput {
  text: string;
  appliesToService?: CaseService | null;
  active?: boolean;
}

export interface QuestionRule {
  id: string;
  label: string;
  triggerExamples: string[];
  followUpQuestions: string[];
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionRuleInput {
  label: string;
  triggerExamples: string[];
  followUpQuestions: string[];
  active?: boolean;
}

export const questionBankApi = {
  listStandardQuestions: () => request<{ questions: StandardQuestion[] }>("/question-bank/standard-questions"),
  createStandardQuestion: (body: StandardQuestionInput) =>
    request<{ question: StandardQuestion }>("/question-bank/standard-questions", { method: "POST", body: JSON.stringify(body) }),
  updateStandardQuestion: (id: string, body: Partial<StandardQuestionInput>) =>
    request<{ question: StandardQuestion }>(`/question-bank/standard-questions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteStandardQuestion: (id: string) => request<null>(`/question-bank/standard-questions/${id}`, { method: "DELETE" }),

  listRules: () => request<{ rules: QuestionRule[] }>("/question-bank/rules"),
  createRule: (body: QuestionRuleInput) =>
    request<{ rule: QuestionRule }>("/question-bank/rules", { method: "POST", body: JSON.stringify(body) }),
  updateRule: (id: string, body: Partial<QuestionRuleInput>) =>
    request<{ rule: QuestionRule }>(`/question-bank/rules/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteRule: (id: string) => request<null>(`/question-bank/rules/${id}`, { method: "DELETE" }),
};

export interface UrgentCase {
  id: string;
  caseNumber: string;
  subjectName: string;
  service: CaseService;
  priority: CasePriority;
  dueDate: string | null;
  region: Region | null;
  client: { company: string } | null;
  daysOverdue: number | null;
}

export interface UrgentCasesSummary {
  cases: UrgentCase[];
  overdueCount: number;
}

export interface CaseAgingSummary {
  avgOpenDays: number;
  avgClosedDays: number;
  oldestOpenDays: number;
  /** Approx p95 days open among current open cases. */
  p95OpenDays?: number;
  openCount: number;
  closedRecentCount: number;
  buckets?: { d0_7: number; d8_14: number; d15_30: number; d30p: number };
  byService: { service: CaseService; avgOpenDays: number; count: number }[];
}

export interface JournalEntry {
  id: string;
  type: CaseDayEntryType;
  body: string | null;
  question: string | null;
  createdAt: string;
  author: CaseParticipant | null;
  case: { id: string; caseNumber: string; subjectName: string };
}

export interface FilesHealthSummary {
  total: number;
  last24h: number;
  byStorage: { storage: string; count: number }[];
  failedCount: number;
  failed: { id: string; filename: string; error: string | null; storage: string; case: { id: string; caseNumber: string } }[];
}

export interface PresurveillanceSummary {
  byStatus: { status: string; count: number }[];
  stuckCount: number;
  stuck: { id: string; caseNumber: string; subjectName: string; dateOpened: string; presurveillanceId: string }[];
}

// ─── Case ingest — pending proposals ────────────────────────────────────────
// Shapes mirror the ingestor's payload, normalised server-side. Snake_case
// fields from his DTO become camelCase here; anything unmapped stays in
// `rawPayload` on the detail response.

export type PendingCaseStatus = "pending_review" | "accepted" | "rejected";
export type PendingCaseFilesStatus = "none" | "pending" | "ready" | "failed";

export interface ProposalSubject {
  name: string | null;
  dob: string | null;
  ssnLast4: string | null;
  addresses: string[];
  phones: string[];
  vehicle: string | null;
  physical: string | null;
  job: string | null;
  employer: string | null;
  employerContact: string | null;
  employerPhone: string | null;
}

export interface ProposalAssignment {
  insurer: string | null;
  adjusterName: string | null;
  adjusterPhone: string | null;
  adjusterEmail: string | null;
  type: string | null;
  surveillanceDays: string | null;
  reportDueDate: string | null;
  dateOfLoss: string | null;
  typeOfClaim: string | null;
  bodyParts: string | null;
  restrictions: string | null;
  injuryDescription: string | null;
  instructions: string | null;
  suspicion: string | null;
  isRepresented: string | null;
  defenseAttorney: string | null;
  defenseLawFirm: string | null;
  defensePhone: string | null;
}

export interface ProposalEmailSource {
  messageId: string | null;
  subject: string | null;
  from: string | null;
  receivedAt: string | null;
  classification: string | null;
}

export interface ProposalVehicle {
  year: string | null;
  color: string | null;
  makeModel: string | null;
  plate: string | null;
  registeredOwner: string | null;
  source: string | null;
}

export interface ProposalAttachment {
  filename: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  extracted: Record<string, unknown> | null;
  hasInlineContent: boolean;
}

export interface CaseProposal {
  caseIngestorCode: string | null;
  claimNumber: string | null;
  caseType: string | null;
  ingestorStatus: string | null;
  subject: ProposalSubject;
  assignment: ProposalAssignment;
  emailSource: ProposalEmailSource;
  vehicles: ProposalVehicle[];
  attachments: ProposalAttachment[];
  ingestorCreatedAt: string | null;
  pushedAt: string | null;
}

export interface PendingCaseFile {
  id: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  extracted: Record<string, unknown> | null;
  storage: string;
  storageKey: string | null;
  error: string | null;
  createdAt: string;
}

export interface PendingCaseListItem {
  id: string;
  caseIngestorCode: string | null;
  claimNumber: string | null;
  status: PendingCaseStatus;
  filesStatus: PendingCaseFilesStatus;
  ingestorStatus: string | null;
  ingestorCaseType: string | null;
  subjectName: string | null;
  insurer: string | null;
  dueDate: string | null;
  filesError: string | null;
  acceptedCaseId: string | null;
  reviewedAt: string | null;
  receivedAt: string;
  proposal: CaseProposal;
}

export interface PendingCaseDetail extends PendingCaseListItem {
  rawPayload: unknown;
  filesFetchedAt: string | null;
  reviewNote: string | null;
  reviewedBy: CaseParticipant | null;
  deletedAt: string | null;
  updatedAt: string;
  files: PendingCaseFile[];
}

export interface PendingCaseSummary {
  pendingReview: number;
  accepted: number;
  rejected: number;
  filesFailed: number;
}

export interface PendingCasesListParams {
  status?: PendingCaseStatus;
  filesStatus?: PendingCaseFilesStatus;
  search?: string;
  includeRejected?: boolean;
  page?: number;
  pageSize?: number;
}

/** Only the normalised proposal is editable — the raw ingestor payload is not. */
export interface UpdatePendingCasePayload {
  claimNumber?: string | null;
  caseType?: string | null;
  ingestorStatus?: string | null;
  subject?: Partial<ProposalSubject>;
  assignment?: Partial<ProposalAssignment>;
  vehicles?: ProposalVehicle[];
}

export interface AcceptPendingCasePayload {
  /** Omit to let the server infer it from the payload. */
  service?: CaseService;
  priority?: CasePriority;
  region?: Region | null;
  clientId?: string | null;
  note?: string;
}

export interface AcceptedCase {
  id: string;
  caseNumber: string;
  claimNumber: string | null;
  subjectName: string;
  service: CaseService;
  status: CaseStatus;
}

export const pendingCasesApi = {
  list: (params: PendingCasesListParams = {}) =>
    request<{ pendingCases: PendingCaseListItem[]; total: number; page: number; pageSize: number }>(
      `/pending-cases${toQuery(params)}`,
    ),
  summary: () => request<PendingCaseSummary>("/pending-cases/summary"),
  get: (id: string) => request<{ pendingCase: PendingCaseDetail }>(`/pending-cases/${id}`),
  update: (id: string, body: UpdatePendingCasePayload) =>
    request<{ pendingCase: PendingCaseDetail }>(`/pending-cases/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  accept: (id: string, body: AcceptPendingCasePayload = {}) =>
    request<{ case: AcceptedCase; pendingCase: PendingCaseDetail }>(`/pending-cases/${id}/accept`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  reject: (id: string, note?: string) =>
    request<{ pendingCase: PendingCaseDetail }>(`/pending-cases/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  retryFiles: (id: string) =>
    request<{ pendingCase: PendingCaseDetail }>(`/pending-cases/${id}/retry-files`, { method: "POST" }),
  fileBlob: (id: string, fileId: string, signal?: AbortSignal) => requestBlob(pendingCaseFilePath(id, fileId), signal),
};

export const clientsApi = {
  list: () => request<{ clients: CaseClient[] }>("/clients"),
  get: (id: string) => request<{ client: ClientDetail }>(`/clients/${id}`),
  create: (body: ClientCreateBody) =>
    request<{ client: ClientDetail }>("/clients", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: ClientUpdateBody) =>
    request<{ client: ClientDetail }>(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  createContact: (id: string, body: ClientContactBody) =>
    request<{ contact: ClientContact }>(`/clients/${id}/contacts`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateContact: (id: string, contactId: string, body: Partial<ClientContactBody>) =>
    request<{ contact: ClientContact }>(`/clients/${id}/contacts/${contactId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteContact: (id: string, contactId: string) =>
    request<null>(`/clients/${id}/contacts/${contactId}`, { method: "DELETE" }),
  summary: () => request<ClientPortfolioSummary>("/clients/summary"),
};

export interface ClientPortfolioSummary {
  totalClients: number;
  activeClients: number;
  topByOpenCases: { id: string; company: string; location: string | null; openCases: number; contactCount: number }[];
  contactsByRole: { role: ClientContactRole; count: number }[];
}

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

export interface ScheduleBlockCaseAddress {
  id: string;
  label: string | null;
  line1: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  isPrimary: boolean;
}

export interface ScheduleBlock {
  id: string;
  caseId: string;
  userId: string;
  date: string;
  /** Null = all-day day-board assignment. */
  startTime: string | null;
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
    service: CaseService;
    startTime: string | null;
    earliestActiveAt: string | null;
    client: { id: string; company: string } | null;
    addresses: ScheduleBlockCaseAddress[];
  };
  user: { id: string; name: string; email: string; region: Region | null };
  createdBy: { id: string; name: string } | null;
}

export interface SchedulePriorWork {
  caseId: string;
  userId: string;
}

export interface ScheduleListParams {
  from?: string;
  to?: string;
  region?: Region;
  caseId?: string;
  userId?: string;
  /** When true, response includes priorWork pairs for cases in the result. */
  includePriorWork?: boolean;
  /** Comma-separated case UUIDs to include in prior-work lookup. */
  priorWorkCaseIds?: string;
}

export interface CreateScheduleBlockPayload {
  caseId: string;
  userId: string;
  date: string;
  /** Omit / null for day-level assignments. */
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
}

export const scheduleApi = {
  list: (params: ScheduleListParams = {}) =>
    request<{ blocks: ScheduleBlock[]; priorWork?: SchedulePriorWork[] }>(`/schedule${toQuery(params)}`),
  create: (body: CreateScheduleBlockPayload) =>
    request<{ block: ScheduleBlock }>("/schedule", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Omit<CreateScheduleBlockPayload, "caseId" | "userId">>) =>
    request<{ block: ScheduleBlock }>(`/schedule/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => request<null>(`/schedule/${id}`, { method: "DELETE" }),
};

/* ── Grid layouts ─────────────────────────────────────────────────────────── */

/**
 * Draggable grids with saved placement.
 * - `dashboard` — per user
 * - `case-detail` — shared house layout (SuperAdmin write), may include pages
 * - `cases-table` — shared cases-list column set (SuperAdmin write); item `x`
 *   is the column order and `label` an optional header rename
 */
export type GridSurface = "dashboard" | "case-detail" | "cases-table";

export interface GridLayoutItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Case-detail carousel page. Omitted on flat surfaces. */
  pageId?: string;
  /** Custom display label (cases-table column header rename). */
  label?: string;
}

export interface GridLayoutPage {
  id: string;
  name: string;
}

/** A SuperAdmin-built custom widget: a titled list of catalog fields. */
export interface GridLayoutWidget {
  id: string;
  type: "custom";
  title: string;
  fields: { key: string; label: string }[];
  /** Field layout — 1 list, 2 or 3 column grid. Defaults to list. */
  columns?: 1 | 2 | 3;
  /** True once explicitly kept for reuse — false/undefined means it's a draft. */
  persisted?: boolean;
}

export interface GridLayoutRecord {
  surface: GridSurface;
  /** `null` when no saved layout exists (client uses its built-in default). */
  items: GridLayoutItem[] | null;
  pages: GridLayoutPage[] | null;
  widgets: GridLayoutWidget[] | null;
  source: "user" | "house" | "default";
  updatedAt: string | null;
}

export interface ReportActivityDay {
  date: string;
  success: number;
  failed: number;
}

export interface ReportActivitySummary {
  todayCount: number;
  todaySuccess: number;
  todayFailed: number;
  successRate7d: number;
  daily: ReportActivityDay[];
  recent: {
    id: string;
    createdAt: string;
    status: string;
    claimNo: string | null;
    subjectName: string | null;
    aiModel: string | null;
    durationMs: number | null;
    errorMessage: string | null;
  }[];
}

export const reportActivityApi = {
  get: (days = 7) => request<ReportActivitySummary>(`/reports/activity?days=${days}`),
};

export type IntelCategory = "news" | "case_law" | "regulation" | "statute" | "fraud_trend";
export type IntelStatus = "pending_review" | "published" | "archived" | "rejected";

export interface IntelItem {
  id: string;
  category: IntelCategory;
  title: string;
  summary: string | null;
  url: string | null;
  jurisdiction: string | null;
  region: Region | null;
  tags: string[];
  publishedAt: string | null;
  relevanceScore: number | null;
  status: IntelStatus;
  pinned: boolean;
  curatedAt: string | null;
  createdAt: string;
  source: { id: string; name: string } | null;
}

export interface IntelResearchResult {
  cached: boolean;
  query: string;
  answer: string;
  citations: { title: string; url: string | null; category: string }[];
  costUsd: number;
  remainingToday: number;
}

export const intelApi = {
  list: (params?: {
    status?: IntelStatus;
    category?: IntelCategory;
    categories?: string;
    jurisdiction?: string;
    pinned?: boolean;
    q?: string;
    limit?: number;
  }) =>
    request<{ items: IntelItem[]; count: number }>(
      `/intel/items${toQuery({
        ...params,
        pinned: params?.pinned === undefined ? undefined : params.pinned ? "true" : "false",
      })}`,
    ),
  get: (id: string) => request<{ item: IntelItem }>(`/intel/items/${id}`),
  research: (query: string) =>
    request<IntelResearchResult>("/intel/research", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
};

export const gridLayoutsApi = {
  list: () => request<{ layouts: Record<GridSurface, GridLayoutRecord> }>("/grid-layouts"),
  get: (surface: GridSurface) => request<{ layout: GridLayoutRecord }>(`/grid-layouts/${surface}`),
  /**
   * `keepalive` lets a save started during page unload finish — layouts are
   * often dragged and then immediately navigated away from.
   */
  save: (
    surface: GridSurface,
    items: GridLayoutItem[],
    pages?: GridLayoutPage[] | null,
    widgets?: GridLayoutWidget[] | null,
  ) =>
    request<{ layout: GridLayoutRecord }>(`/grid-layouts/${surface}`, {
      method: "PUT",
      body: JSON.stringify({
        items,
        ...(pages && pages.length > 0 ? { pages } : {}),
        ...(widgets && widgets.length > 0 ? { widgets } : {}),
      }),
      keepalive: true,
    }),
  reset: (surface: GridSurface) =>
    request<{ layout: GridLayoutRecord }>(`/grid-layouts/${surface}`, { method: "DELETE" }),
};

export type VoiceIntakeStatus =
  | "preparing"
  | "active"
  | "processing"
  | "needs_review"
  | "approved"
  | "discarded"
  | "failed"
  | "abandoned";

export interface VoiceDraft {
  reportLocation: string | null;
  narrativeNote: string | null;
  injuryMobilityObservation: string | null;
  videoCaptured: "yes" | "no" | "unknown" | null;
  videoApproxDuration: string | null;
  videoActivities: string[];
  otherRelevantFacts: string[];
  discrepancies: string[];
}

export interface TranscriptTurn {
  speaker: "Alejandro" | "Investigator";
  text: string;
  secondsFromStart: number | null;
}

export interface VoiceIntakeSession {
  id: string;
  caseId: string;
  status: VoiceIntakeStatus;
  workDate: string;
  draft: VoiceDraft | null;
  transcript: TranscriptTurn[] | null;
  draftVersion: number;
  failureCode: string | null;
  noteEntryId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  approvedAt: string | null;
}

export interface VoiceIntakeJoin {
  callId: string;
  webCallUrl: string;
}

export const voiceIntakeApi = {
  list: (caseId: string) =>
    request<{ sessions: Array<VoiceIntakeSession & { join: VoiceIntakeJoin | null }> }>(`/cases/${caseId}/voice-intakes`),
  start: (caseId: string, workDate: string) =>
    request<{ session: VoiceIntakeSession; join: VoiceIntakeJoin | null }>(`/cases/${caseId}/voice-intakes`, {
      method: "POST",
      body: JSON.stringify({ workDate }),
    }),
  get: (caseId: string, sessionId: string) =>
    request<{ session: VoiceIntakeSession; join: VoiceIntakeJoin | null }>(`/cases/${caseId}/voice-intakes/${sessionId}`),
  saveDraft: (caseId: string, sessionId: string, draftVersion: number, narrativeNote: string) =>
    request<{ session: VoiceIntakeSession }>(`/cases/${caseId}/voice-intakes/${sessionId}/draft`, {
      method: "PATCH",
      body: JSON.stringify({ draftVersion, narrativeNote }),
    }),
  approve: (caseId: string, sessionId: string, draftVersion: number, narrativeNote: string) =>
    request<{ session: VoiceIntakeSession; days: CaseDay[] }>(`/cases/${caseId}/voice-intakes/${sessionId}/approve-note`, {
      method: "POST",
      body: JSON.stringify({ draftVersion, narrativeNote }),
    }),
  discard: (caseId: string, sessionId: string) =>
    request<{ session: VoiceIntakeSession }>(`/cases/${caseId}/voice-intakes/${sessionId}/discard`, { method: "POST" }),
  hangup: (caseId: string, sessionId: string) =>
    request<{ session: VoiceIntakeSession }>(`/cases/${caseId}/voice-intakes/${sessionId}/hangup`, { method: "POST" }),
};

// Mock data — replace with API later.
// All investigation-firm domain types. Legacy widget data kept at the bottom.

// ─── Domain types ────────────────────────────────────────────────────────────

export type CaseStatus = "open" | "suspended" | "closed";

export type ServiceType =
  | "SURV"   // Surveillance
  | "WC"     // Workers Compensation
  | "FMLA"   // FMLA leave
  | "BG"     // Background check
  | "DOM"    // Domestic
  | "SOC"    // Social Media
  | "DIS"    // Disability
  | "LOC"    // Locate
  | "PS"     // Process Serving
  | "LIA";   // Liability

export type InvTag =
  | "Work Comp"
  | "FMLA"
  | "Surveillance"
  | "Background"
  | "Social Media"
  | "Domestic"
  | "Disability"
  | "Locate"
  | "Process Serving"
  | "Rush"
  | "Liability";

/** Geographic scheduling calendars (Todd: one calendar per group). */
export type GeoGroup = "ca" | "tristate" | "texas";

export const GEO_GROUP_LABELS: Record<GeoGroup, string> = {
  ca: "California",
  tristate: "Tri-state",
  texas: "Texas",
};

export const GEO_GROUPS: GeoGroup[] = ["ca", "tristate", "texas"];

export interface Subject {
  name: string;
  dob?: string;
  /** Street address — shown under the subject name on the case header. */
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  description?: string;
  photoUrl?: string;
}

export interface InvCase {
  id: string;
  clientFileNum: string;
  client: string;
  subject: Subject;
  service: ServiceType;
  tags: InvTag[];
  status: CaseStatus;
  assignedTo: string[];   // investigator IDs
  dateOpened: string;
  dateClosed?: string;
  state: string;
  daysOpen: number;
  budget?: number;        // authorized hours
  hoursLogged?: number;
  notes?: string;
}

export type InvStatus = "clocked_in" | "off_duty" | "on_case";

export interface Investigator {
  id: string;
  name: string;
  initials: string;
  phone?: string;
  status: InvStatus;
  clockInTime?: string;
  hoursToday: number;
  currentCase?: string;
  location?: string;
  /** Home scheduling calendar for this investigator. */
  geoGroup: GeoGroup;
  totalCasesOpen: number;
}

export interface InvClient {
  id: string;
  company: string;
  contact: string;
  contactEmail: string;
  openCases: number;
  totalCases: number;
  lastActivity: string;
  status: "active" | "inactive";
}

export interface TimeEntry {
  id: string;
  caseId: string;
  investigatorId: string;
  investigatorName: string;
  date: string;
  hours: number;
  /** Optional 0–23 start for calendar placement; otherwise clock-in / 8 AM is used. */
  startHour?: number;
  location: string;
  notes: string;
  /** Which regional calendar this assignment sits on. */
  geoGroup: GeoGroup;
}

/** Timed field notes taken during surveillance (shown inside calendar hour blobs). */
export interface FieldNote {
  id: string;
  investigatorId: string;
  caseId: string;
  date: string;
  /** 24h "HH:MM" */
  time: string;
  text: string;
}

// ─── Investigators ────────────────────────────────────────────────────────────

export const investigators: Investigator[] = [
  {
    id: "INV-021", name: "Marcus Webb",     initials: "MW",
    status: "clocked_in", clockInTime: "08:14 AM", hoursToday: 6.5,
    currentCase: "C-4712", location: "Queens, NY", geoGroup: "tristate", totalCasesOpen: 4,
  },
  {
    id: "INV-034", name: "Priscilla Ortega", initials: "PO",
    status: "on_case", clockInTime: "07:55 AM", hoursToday: 7.1,
    currentCase: "C-4709", location: "Brooklyn, NY", geoGroup: "tristate", totalCasesOpen: 3,
  },
  {
    id: "INV-017", name: "James Holt",       initials: "JH",
    status: "clocked_in", clockInTime: "09:02 AM", hoursToday: 4.2,
    currentCase: "C-4715", location: "Newark, NJ", geoGroup: "tristate", totalCasesOpen: 5,
  },
  {
    id: "INV-043", name: "Diane Rossi",      initials: "DR",
    status: "off_duty", hoursToday: 0,
    location: "Los Angeles, CA", geoGroup: "ca", totalCasesOpen: 2,
  },
  {
    id: "INV-055", name: "Kevin Tran",       initials: "KT",
    status: "on_case", clockInTime: "08:30 AM", hoursToday: 5.8,
    currentCase: "C-4701", location: "Bronx, NY", geoGroup: "tristate", totalCasesOpen: 3,
  },
  {
    id: "INV-061", name: "Sandra Nwosu",     initials: "SN",
    status: "off_duty", hoursToday: 0,
    location: "Dallas, TX", geoGroup: "texas", totalCasesOpen: 1,
  },
  {
    id: "INV-072", name: "Elena Vasquez",    initials: "EV",
    status: "on_case", clockInTime: "07:40 AM", hoursToday: 6.0,
    currentCase: "C-4716", location: "Sacramento, CA", geoGroup: "ca", totalCasesOpen: 2,
  },
  {
    id: "INV-078", name: "Andre Bennett",    initials: "AB",
    status: "clocked_in", clockInTime: "08:05 AM", hoursToday: 5.5,
    currentCase: "C-4717", location: "Houston, TX", geoGroup: "texas", totalCasesOpen: 2,
  },
];

// ─── Clients ──────────────────────────────────────────────────────────────────

export const invClients: InvClient[] = [
  { id: "CL-01", company: "Applied Underwriters Inc",  contact: "Rachel Torres",   contactEmail: "r.torres@aui.com",      openCases: 6,  totalCases: 42, lastActivity: "Today",     status: "active" },
  { id: "CL-02", company: "PacSun",                    contact: "Derek Lim",       contactEmail: "d.lim@pacsun.com",      openCases: 2,  totalCases: 18, lastActivity: "Yesterday", status: "active" },
  { id: "CL-03", company: "Travelers Insurance",       contact: "Molly Crane",     contactEmail: "m.crane@travelers.com", openCases: 4,  totalCases: 31, lastActivity: "2d ago",    status: "active" },
  { id: "CL-04", company: "Zurich North America",      contact: "Ben Kapoor",      contactEmail: "b.kapoor@zurich.com",   openCases: 1,  totalCases: 12, lastActivity: "1w ago",    status: "active" },
  { id: "CL-05", company: "Hartford Financial",        contact: "Elaine Moss",     contactEmail: "e.moss@hartford.com",   openCases: 3,  totalCases: 27, lastActivity: "3d ago",    status: "active" },
  { id: "CL-06", company: "CNA Insurance",             contact: "Victor Reyes",    contactEmail: "v.reyes@cna.com",       openCases: 0,  totalCases: 9,  lastActivity: "3w ago",    status: "inactive" },
];

// ─── Cases ────────────────────────────────────────────────────────────────────

export const invCases: InvCase[] = [
  {
    id: "C-4701", clientFileNum: "AUI-2026-0881",
    client: "Applied Underwriters Inc",
    subject: { name: "Freddy Alvarado Peralta", address: "41-18 48th Ave", zip: "11104", dob: "1981-03-14", city: "Queens", state: "NY", description: "Male, 5'10\", heavy build, dark hair" },
    service: "WC", tags: ["Work Comp", "Rush"],
    status: "open", assignedTo: ["INV-055"],
    dateOpened: "2026-05-26", state: "NY", daysOpen: 0,
    budget: 40, hoursLogged: 3.2,
  },
  {
    id: "C-4702", clientFileNum: "TRV-2026-0441",
    client: "Travelers Insurance",
    subject: { name: "Lorena Vásquez", address: "218 Bergen St", zip: "07103", dob: "1978-09-22", city: "Newark", state: "NJ", description: "Female, 5'5\", medium build, dark hair, glasses" },
    service: "FMLA", tags: ["FMLA"],
    status: "open", assignedTo: ["INV-017"],
    dateOpened: "2026-05-20", state: "NJ", daysOpen: 6,
    budget: 32, hoursLogged: 14.5,
  },
  {
    id: "C-4703", clientFileNum: "AUI-2026-0744",
    client: "Applied Underwriters Inc",
    subject: { name: "Darnell Jeffries", address: "782 Jefferson Ave", zip: "11221", dob: "1990-06-05", city: "Brooklyn", state: "NY", description: "Male, 6'1\", athletic build, tattoo on left forearm" },
    service: "SURV", tags: ["Surveillance", "Work Comp"],
    status: "suspended", assignedTo: ["INV-034"],
    dateOpened: "2026-05-10", state: "NY", daysOpen: 16,
    budget: 60, hoursLogged: 28.0,
    notes: "Subject left state. Awaiting return confirmation.",
  },
  {
    id: "C-4704", clientFileNum: "PAC-2026-0112",
    client: "PacSun",
    subject: { name: "Miriam Osei", address: "1147 Crenshaw Blvd", zip: "90019", dob: "1985-12-30", city: "Los Angeles", state: "CA", description: "Female, 5'7\", slender build, natural hair" },
    service: "BG", tags: ["Background"],
    status: "closed", assignedTo: ["INV-043"],
    dateOpened: "2026-05-01", dateClosed: "2026-05-18", state: "CA", daysOpen: 17,
    budget: 20, hoursLogged: 18.0,
  },
  {
    id: "C-4705", clientFileNum: "TRV-2026-0509",
    client: "Travelers Insurance",
    subject: { name: "Raymond Kowalski", address: "88 Sip Ave", zip: "07306", dob: "1975-02-18", city: "Jersey City", state: "NJ", description: "Male, 5'9\", stocky build, grey beard" },
    service: "DIS", tags: ["Disability"],
    status: "open", assignedTo: ["INV-021"],
    dateOpened: "2026-05-14", state: "NJ", daysOpen: 12,
    budget: 48, hoursLogged: 21.5,
  },
  {
    id: "C-4706", clientFileNum: "HRT-2026-0233",
    client: "Hartford Financial",
    subject: { name: "Angela Brito", address: "412 Maple Ave", zip: "06114", dob: "1988-07-09", city: "Hartford", state: "CT", description: "Female, 5'4\", medium build, red highlights" },
    service: "SOC", tags: ["Social Media", "Surveillance"],
    status: "open", assignedTo: ["INV-061"],
    dateOpened: "2026-05-22", state: "CT", daysOpen: 4,
    budget: 24, hoursLogged: 6.0,
  },
  {
    id: "C-4707", clientFileNum: "PAC-2026-0098",
    client: "PacSun",
    subject: { name: "Tyler Nguyen", address: "1630 E 17th St", zip: "92705", dob: "1993-11-03", city: "Santa Ana", state: "CA", description: "Male, 5'8\", slim build, glasses, black hair" },
    service: "WC", tags: ["Work Comp"],
    status: "closed", assignedTo: ["INV-043"],
    dateOpened: "2026-04-15", dateClosed: "2026-05-05", state: "CA", daysOpen: 20,
    budget: 36, hoursLogged: 33.5,
  },
  {
    id: "C-4708", clientFileNum: "AUI-2026-0822",
    client: "Applied Underwriters Inc",
    subject: { name: "Crystal Munoz", address: "955 E 163rd St", zip: "10459", dob: "1982-04-27", city: "Bronx", state: "NY", description: "Female, 5'6\", curly hair, distinctive shoulder tattoo" },
    service: "SURV", tags: ["Surveillance", "Rush"],
    status: "open", assignedTo: ["INV-021", "INV-034"],
    dateOpened: "2026-05-24", state: "NY", daysOpen: 2,
    budget: 80, hoursLogged: 12.0,
  },
  {
    id: "C-4709", clientFileNum: "ZUR-2026-0167",
    client: "Zurich North America",
    subject: { name: "Patrick Oduya", address: "310 Flatbush Ave", zip: "11217", dob: "1970-08-15", city: "Brooklyn", state: "NY", description: "Male, 6'0\", medium build, short grey hair" },
    service: "LIA", tags: ["Liability"],
    status: "open", assignedTo: ["INV-034"],
    dateOpened: "2026-05-18", state: "NY", daysOpen: 8,
    budget: 40, hoursLogged: 18.5,
  },
  {
    id: "C-4710", clientFileNum: "HRT-2026-0198",
    client: "Hartford Financial",
    subject: { name: "Sandra Ferreira", address: "88 Main St", zip: "06604", dob: "1987-01-11", city: "Bridgeport", state: "CT", description: "Female, 5'3\", dark hair, usually wears scrubs" },
    service: "FMLA", tags: ["FMLA"],
    status: "suspended", assignedTo: ["INV-017"],
    dateOpened: "2026-05-05", state: "CT", daysOpen: 21,
    budget: 32, hoursLogged: 16.0,
    notes: "Surveillance on hold pending updated claim records from client.",
  },
  {
    id: "C-4711", clientFileNum: "TRV-2026-0488",
    client: "Travelers Insurance",
    subject: { name: "George Mbeki", address: "720 Springfield Ave", zip: "07111", dob: "1965-10-29", city: "Irvington", state: "NJ", description: "Male, 5'11\", tall, thin build, wears a brace on left knee" },
    service: "WC", tags: ["Work Comp"],
    status: "closed", assignedTo: ["INV-055"],
    dateOpened: "2026-04-28", dateClosed: "2026-05-20", state: "NJ", daysOpen: 22,
    budget: 56, hoursLogged: 51.5,
  },
  {
    id: "C-4712", clientFileNum: "AUI-2026-0855",
    client: "Applied Underwriters Inc",
    subject: { name: "Yolanda Herrera", address: "37-22 103rd St", zip: "11368", dob: "1980-05-16", city: "Queens", state: "NY", description: "Female, 5'5\", heavyset, short black hair, drives blue Honda CR-V" },
    service: "SURV", tags: ["Surveillance", "Work Comp"],
    status: "open", assignedTo: ["INV-021"],
    dateOpened: "2026-05-25", state: "NY", daysOpen: 1,
    budget: 48, hoursLogged: 6.5,
  },
  {
    id: "C-4713", clientFileNum: "HRT-2026-0211",
    client: "Hartford Financial",
    subject: { name: "Brian Castillo", address: "214 Crown St", zip: "06511", dob: "1994-03-08", city: "New Haven", state: "CT", description: "Male, 5'7\", slim build, beard, often seen with backpack" },
    service: "DOM", tags: ["Domestic"],
    status: "open", assignedTo: ["INV-061"],
    dateOpened: "2026-05-23", state: "CT", daysOpen: 3,
    budget: 20, hoursLogged: 4.0,
  },
  {
    id: "C-4714", clientFileNum: "AUI-2026-0791",
    client: "Applied Underwriters Inc",
    subject: { name: "Keisha Williams", address: "215 W 125th St", zip: "10027", dob: "1977-12-02", city: "Harlem", state: "NY", description: "Female, 5'8\", medium build, usually wears red coat" },
    service: "WC", tags: ["Work Comp", "Surveillance"],
    status: "closed", assignedTo: ["INV-043"],
    dateOpened: "2026-04-20", dateClosed: "2026-05-12", state: "NY", daysOpen: 22,
    budget: 44, hoursLogged: 40.5,
  },
  {
    id: "C-4715", clientFileNum: "TRV-2026-0522",
    client: "Travelers Insurance",
    subject: { name: "Ivan Sokolov", address: "540 Dr Martin Luther King Jr Blvd", zip: "07102", dob: "1983-06-19", city: "Newark", state: "NJ", description: "Male, 5'10\", medium build, light hair, drives white Hyundai Sonata" },
    service: "DIS", tags: ["Disability", "Rush"],
    status: "open", assignedTo: ["INV-017"],
    dateOpened: "2026-05-26", state: "NJ", daysOpen: 0,
    budget: 40, hoursLogged: 2.0,
  },
  {
    id: "C-4716", clientFileNum: "ZUR-2026-0194",
    client: "Zurich North America",
    subject: { name: "Nadia Okonkwo", address: "62 Warburton Ave", zip: "10701", dob: "1986-09-04", city: "Yonkers", state: "NY", description: "Female, 5'6\", medium build, braided hair, drives silver Toyota Camry" },
    service: "SURV", tags: ["Surveillance", "Work Comp"],
    status: "open", assignedTo: ["INV-072"],
    dateOpened: "2026-05-25", state: "NY", daysOpen: 1,
    budget: 36, hoursLogged: 6.0,
  },
  {
    id: "C-4717", clientFileNum: "AUI-2026-0902",
    client: "Applied Underwriters Inc",
    subject: { name: "Luis Romero", address: "318 Victory Blvd", zip: "10301", dob: "1979-11-21", city: "Staten Island", state: "NY", description: "Male, 5'11\", stocky build, goatee, often wears Mets cap" },
    service: "WC", tags: ["Work Comp"],
    status: "open", assignedTo: ["INV-078"],
    dateOpened: "2026-05-26", state: "NY", daysOpen: 0,
    budget: 40, hoursLogged: 5.5,
  },
];

// ─── Time entries ─────────────────────────────────────────────────────────────

export const timeEntries: TimeEntry[] = [
  { id: "TE-001", caseId: "C-4701", investigatorId: "INV-055", investigatorName: "Kevin Tran",       date: "2026-05-26", hours: 3.2, startHour: 8,  location: "Queens, NY",    notes: "Mobile surveillance, residence and surrounding streets.", geoGroup: "tristate" },
  { id: "TE-002", caseId: "C-4702", investigatorId: "INV-017", investigatorName: "James Holt",       date: "2026-05-26", hours: 4.5, startHour: 9,  location: "Newark, NJ",    notes: "Subject observed leaving residence, visited gym, grocery store.", geoGroup: "tristate" },
  { id: "TE-003", caseId: "C-4702", investigatorId: "INV-017", investigatorName: "James Holt",       date: "2026-05-25", hours: 5.0, startHour: 8,  location: "Newark, NJ",    notes: "Day 2 surveillance, no significant activity.", geoGroup: "tristate" },
  { id: "TE-004", caseId: "C-4703", investigatorId: "INV-034", investigatorName: "Priscilla Ortega", date: "2026-05-20", hours: 8.0, startHour: 7,  location: "Brooklyn, NY",  notes: "Subject not observed. Maintained coverage of residence.", geoGroup: "tristate" },
  { id: "TE-005", caseId: "C-4705", investigatorId: "INV-021", investigatorName: "Marcus Webb",      date: "2026-05-26", hours: 4.0, startHour: 8,  location: "Jersey City, NJ", notes: "Subject observed performing yard work for 2 hours without apparent restrictions.", geoGroup: "tristate" },
  { id: "TE-006", caseId: "C-4705", investigatorId: "INV-021", investigatorName: "Marcus Webb",      date: "2026-05-25", hours: 7.0, startHour: 8,  location: "Jersey City, NJ", notes: "Subject drove to Home Depot, carried lumber. Video obtained.", geoGroup: "tristate" },
  { id: "TE-007", caseId: "C-4708", investigatorId: "INV-021", investigatorName: "Marcus Webb",      date: "2026-05-24", hours: 6.0, startHour: 8,  location: "Bronx, NY",     notes: "Pre-deployment recon, identified vehicle and residence.", geoGroup: "tristate" },
  { id: "TE-008", caseId: "C-4708", investigatorId: "INV-034", investigatorName: "Priscilla Ortega", date: "2026-05-24", hours: 6.0, startHour: 8,  location: "Bronx, NY",     notes: "Two-car surveillance setup. Subject confirmed at residence.", geoGroup: "tristate" },
  { id: "TE-009", caseId: "C-4709", investigatorId: "INV-034", investigatorName: "Priscilla Ortega", date: "2026-05-26", hours: 7.1, startHour: 6,  location: "Brooklyn, NY",  notes: "Subject met with attorney at 10 AM. Departed at noon.", geoGroup: "tristate" },
  { id: "TE-010", caseId: "C-4712", investigatorId: "INV-021", investigatorName: "Marcus Webb",      date: "2026-05-25", hours: 6.5, startHour: 8,  location: "Queens, NY",    notes: "Subject observed walking dog, jogging approx. 1 mile without difficulty.", geoGroup: "tristate" },
  { id: "TE-011", caseId: "C-4712", investigatorId: "INV-021", investigatorName: "Marcus Webb",      date: "2026-05-26", hours: 2.5, startHour: 13, location: "Queens, NY",    notes: "Afternoon coverage after morning WC surveillance.", geoGroup: "tristate" },
  { id: "TE-012", caseId: "C-4715", investigatorId: "INV-017", investigatorName: "James Holt",       date: "2026-05-26", hours: 2.0, startHour: 14, location: "Newark, NJ",    notes: "Afternoon disability claim check-in.", geoGroup: "tristate" },
  { id: "TE-013", caseId: "C-4701", investigatorId: "INV-055", investigatorName: "Kevin Tran",       date: "2026-05-26", hours: 2.5, startHour: 12, location: "Bronx, NY",     notes: "Continued mobile after morning residence watch.", geoGroup: "tristate" },
  { id: "TE-014", caseId: "C-4708", investigatorId: "INV-061", investigatorName: "Sandra Nwosu",     date: "2026-05-26", hours: 5.0, startHour: 9,  location: "Dallas, TX",     notes: "Backup coverage — Texas roster half day then released.", geoGroup: "texas" },
  { id: "TE-015", caseId: "C-4716", investigatorId: "INV-072", investigatorName: "Elena Vasquez",    date: "2026-05-26", hours: 6.0, startHour: 7,  location: "Sacramento, CA", notes: "Residence and workplace surveillance; subject departed 08:10.", geoGroup: "ca" },
  { id: "TE-016", caseId: "C-4717", investigatorId: "INV-078", investigatorName: "Andre Bennett",    date: "2026-05-26", hours: 5.5, startHour: 8,  location: "Houston, TX",    notes: "WC claim check — subject observed loading truck bed.", geoGroup: "texas" },
];

export const fieldNotes: FieldNote[] = [
  { id: "FN-001", investigatorId: "INV-034", caseId: "C-4709", date: "2026-05-26", time: "06:15", text: "Subject left the house." },
  { id: "FN-002", investigatorId: "INV-034", caseId: "C-4709", date: "2026-05-26", time: "07:40", text: "Subject entered a black Uber, headed south on Atlantic." },
  { id: "FN-003", investigatorId: "INV-034", caseId: "C-4709", date: "2026-05-26", time: "10:05", text: "Subject met with attorney at office — video obtained of arrival." },
  { id: "FN-004", investigatorId: "INV-034", caseId: "C-4709", date: "2026-05-26", time: "12:10", text: "Subject departed attorney’s office, returned to residence." },
  { id: "FN-005", investigatorId: "INV-021", caseId: "C-4705", date: "2026-05-26", time: "08:45", text: "Subject in driveway stacking lumber — no visible restriction." },
  { id: "FN-006", investigatorId: "INV-021", caseId: "C-4705", date: "2026-05-26", time: "10:20", text: "Subject used leaf blower for ~25 minutes." },
  { id: "FN-007", investigatorId: "INV-021", caseId: "C-4712", date: "2026-05-26", time: "13:30", text: "Subject walking dog; gait appears normal." },
  { id: "FN-008", investigatorId: "INV-017", caseId: "C-4702", date: "2026-05-26", time: "09:25", text: "Subject left residence carrying gym bag." },
  { id: "FN-009", investigatorId: "INV-017", caseId: "C-4702", date: "2026-05-26", time: "11:10", text: "Subject at grocery store; lifted cases of water into cart." },
  { id: "FN-010", investigatorId: "INV-055", caseId: "C-4701", date: "2026-05-26", time: "08:50", text: "Subject vehicle departed — mobile surveillance initiated." },
  { id: "FN-011", investigatorId: "INV-055", caseId: "C-4701", date: "2026-05-26", time: "12:40", text: "Subject stopped at pharmacy, then resumed to Bronx." },
  { id: "FN-012", investigatorId: "INV-061", caseId: "C-4708", date: "2026-05-26", time: "09:30", text: "Set up perimeter; subject confirmed at residence." },
  { id: "FN-013", investigatorId: "INV-072", caseId: "C-4716", date: "2026-05-26", time: "08:10", text: "Subject departed residence in silver Camry." },
  { id: "FN-014", investigatorId: "INV-072", caseId: "C-4716", date: "2026-05-26", time: "11:45", text: "Subject at warehouse loading dock — on feet ~20 min." },
  { id: "FN-015", investigatorId: "INV-078", caseId: "C-4717", date: "2026-05-26", time: "08:35", text: "Subject loading tools into truck bed, no limp observed." },
  { id: "FN-016", investigatorId: "INV-078", caseId: "C-4717", date: "2026-05-26", time: "12:15", text: "Subject returned to residence; carried two bags of mulch." },
];

// ─── Case evidence video (demo clips — Mixkit stock standing in for field video) ─

const mixClip = (id: number) =>
  `https://assets.mixkit.co/videos/${id}/${id}-1080.mp4`;

export interface CaseVideo {
  id: string;
  caseId: string;
  /** Short label shown in the library rail */
  title: string;
  /** ISO date of recording */
  recordedAt: string;
  durationLabel: string;
  src: string;
  investigatorId?: string;
  kind: "surveillance" | "activity" | "recon";
}

export const caseVideos: CaseVideo[] = [
  {
    id: "CV-001", caseId: "C-4705", title: "Residence — morning",
    recordedAt: "2026-05-25", durationLabel: "0:42",
    src: mixClip(4450), investigatorId: "INV-021", kind: "surveillance",
  },
  {
    id: "CV-002", caseId: "C-4705", title: "Home Depot — lumber",
    recordedAt: "2026-05-25", durationLabel: "1:05",
    src: mixClip(3415), investigatorId: "INV-021", kind: "activity",
  },
  {
    id: "CV-003", caseId: "C-4705", title: "Yard work — Day 2",
    recordedAt: "2026-05-26", durationLabel: "0:58",
    src: mixClip(4332), investigatorId: "INV-021", kind: "activity",
  },
  {
    id: "CV-004", caseId: "C-4709", title: "Attorney office arrival",
    recordedAt: "2026-05-26", durationLabel: "0:36",
    src: mixClip(4308), investigatorId: "INV-034", kind: "surveillance",
  },
  {
    id: "CV-005", caseId: "C-4709", title: "Residence return",
    recordedAt: "2026-05-26", durationLabel: "0:41",
    src: mixClip(11), investigatorId: "INV-034", kind: "surveillance",
  },
  {
    id: "CV-006", caseId: "C-4708", title: "Pre-deploy recon",
    recordedAt: "2026-05-24", durationLabel: "0:50",
    src: mixClip(41161), investigatorId: "INV-021", kind: "recon",
  },
  {
    id: "CV-007", caseId: "C-4708", title: "Two-car setup",
    recordedAt: "2026-05-24", durationLabel: "0:47",
    src: mixClip(49845), investigatorId: "INV-034", kind: "surveillance",
  },
  {
    id: "CV-008", caseId: "C-4712", title: "Dog walk — gait",
    recordedAt: "2026-05-25", durationLabel: "0:39",
    src: mixClip(49878), investigatorId: "INV-021", kind: "activity",
  },
  {
    id: "CV-009", caseId: "C-4701", title: "Mobile — Queens",
    recordedAt: "2026-05-26", durationLabel: "0:55",
    src: mixClip(41541), investigatorId: "INV-055", kind: "surveillance",
  },
  {
    id: "CV-010", caseId: "C-4702", title: "Gym / grocery",
    recordedAt: "2026-05-26", durationLabel: "0:44",
    src: mixClip(42343), investigatorId: "INV-017", kind: "activity",
  },
  {
    id: "CV-011", caseId: "C-4716", title: "Warehouse dock",
    recordedAt: "2026-05-26", durationLabel: "0:52",
    src: mixClip(49875), investigatorId: "INV-072", kind: "activity",
  },
  {
    id: "CV-012", caseId: "C-4717", title: "Truck bed load",
    recordedAt: "2026-05-26", durationLabel: "0:33",
    src: mixClip(49806), investigatorId: "INV-078", kind: "activity",
  },
];

export function videosForCase(caseId: string): CaseVideo[] {
  return caseVideos.filter((v) => v.caseId === caseId);
}

export function casesWithVideo(): string[] {
  return [...new Set(caseVideos.map((v) => v.caseId))];
}

// ─── Subject / evidence stills (animal placeholders stand in for field photos) ─

export interface EvidencePhoto {
  id: string;
  caseId: string;
  url: string;
  label: string;
  kind: "primary" | "reference" | "surveillance";
  capturedAt: string;
}

/** Stable Unsplash animal stills — swap for real case assets later. */
export const ANIMAL_STILLS = [
  {
    url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&h=800&fit=crop",
    label: "Cat — front",
  },
  {
    url: "https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=800&h=800&fit=crop",
    label: "Hamster — close",
  },
  {
    url: "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&h=800&fit=crop",
    label: "Fox — alert",
  },
  {
    url: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&h=800&fit=crop",
    label: "Turtle — top",
  },
  {
    url: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=800&h=800&fit=crop",
    label: "Lion — face",
  },
  {
    url: "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=800&h=800&fit=crop",
    label: "Panda — sit",
  },
] as const;

export function hashCaseId(caseId: string): number {
  let h = 0;
  for (let i = 0; i < caseId.length; i++) h = (h * 31 + caseId.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic placeholder photo for a real case/subject id — swap for a real upload later. */
export function placeholderPhotoFor(seed: string, index = 0): string {
  const h = hashCaseId(seed);
  return ANIMAL_STILLS[(h + index * 3) % ANIMAL_STILLS.length].url;
}

/** 4–5 stills per case, deterministic from case id (placeholders). */
export function evidencePhotosForCase(caseId: string): EvidencePhoto[] {
  const seed = hashCaseId(caseId);
  const count = 4 + (seed % 2);
  const out: EvidencePhoto[] = [];
  for (let i = 0; i < count; i++) {
    const still = ANIMAL_STILLS[(seed + i * 3) % ANIMAL_STILLS.length];
    out.push({
      id: `${caseId}-EP-${i + 1}`,
      caseId,
      url: still.url,
      label: still.label,
      kind: i === 0 ? "primary" : i === 1 ? "reference" : "surveillance",
      capturedAt: `2026-05-${String(20 + ((seed + i) % 7)).padStart(2, "0")}`,
    });
  }
  return out;
}

// ─── Service type helpers ─────────────────────────────────────────────────────

export const SERVICE_LABELS: Record<ServiceType, string> = {
  SURV: "Surveillance",
  WC:   "Medical Canvass",
  FMLA: "FMLA",
  BG:   "Background",
  DOM:  "Domestic",
  SOC:  "Social Media",
  DIS:  "Disability",
  LOC:  "Locate",
  PS:   "Process Serving",
  LIA:  "Liability",
};

/** Tag pill colors — muted, editorial (bg / text) */
export const TAG_COLORS: Record<InvTag, { bg: string; text: string }> = {
  "Work Comp":       { bg: "rgba(74,127,255,0.18)",   text: "#7ba4ff" },
  "Surveillance":    { bg: "rgba(148,163,184,0.15)",  text: "#94a3b8" },
  "FMLA":            { bg: "rgba(245,158,11,0.18)",   text: "#f59e0b" },
  "Background":      { bg: "rgba(139,92,246,0.18)",   text: "#a78bfa" },
  "Social Media":    { bg: "rgba(6,182,212,0.18)",    text: "#22d3ee" },
  "Domestic":        { bg: "rgba(236,72,153,0.18)",   text: "#f472b6" },
  "Disability":      { bg: "rgba(74,222,128,0.18)",   text: "#4ade80" },
  "Locate":          { bg: "rgba(251,146,60,0.18)",   text: "#fb923c" },
  "Process Serving": { bg: "rgba(148,163,184,0.12)",  text: "#64748b" },
  "Rush":            { bg: "rgba(248,113,113,0.18)",  text: "#f87171" },
  "Liability":       { bg: "rgba(168,139,250,0.18)",  text: "#c4b5fd" },
};

export function daysOpenLabel(n: number): string {
  if (n === 0) return "Today";
  if (n === 1) return "1d";
  return `${n}d`;
}

// ─── Legacy widget data (kept for existing widgets) ───────────────────────────

export type ClientStatus = "active" | "prospect" | "dormant" | "churned";
export type ClientSegment = "Enterprise" | "Mid-market" | "SMB" | "Prospect";

export interface Client {
  id: string; name: string; email: string; company: string;
  segment: ClientSegment; arr: number; status: ClientStatus;
  owner: string; ownerInitials: string; lastTouch: string; joined: string;
}

export interface CaseRow {
  id: string; title: string; client: string;
  owner: string; ownerInitials: string; value: number;
  priority: "low" | "med" | "high";
  status: "new" | "qualifying" | "in_progress" | "blocked" | "won" | "lost";
  age: number;
}

export interface ScheduleItem { id: string; when: string; date: string; title: string; client: string; with: string; }
export interface ActivityItem { id: string; type: "call" | "email" | "meeting" | "deal" | "note"; text: string; who: string; whoInitials: string; at: string; }

export const clients: Client[] = [
  { id: "C-1042", name: "Helena Voss",    email: "helena@northstar.io",     company: "Northstar Capital",  segment: "Enterprise", arr: 184_500, status: "active",   owner: "T. Montgomery",  ownerInitials: "TM", lastTouch: "2h ago",    joined: "2023-04-11" },
  { id: "C-1043", name: "Idris Okafor",   email: "idris@cobaltlabs.co",     company: "Cobalt Labs",        segment: "Mid-market", arr:  72_000, status: "active",   owner: "S. Pine",  ownerInitials: "SP", lastTouch: "yesterday", joined: "2024-01-30" },
  { id: "C-1044", name: "Mei Lin",        email: "mei@lumen-grove.com",     company: "Lumen Grove",        segment: "Enterprise", arr: 246_000, status: "active",   owner: "T. Montgomery",  ownerInitials: "TM", lastTouch: "3d ago",    joined: "2022-11-02" },
  { id: "C-1045", name: "Quinn Thatcher", email: "quinn@parallaxworks.io",  company: "Parallax Works",     segment: "SMB",        arr:  18_400, status: "prospect", owner: "T. Owen",  ownerInitials: "TO", lastTouch: "5h ago",    joined: "2025-03-18" },
  { id: "C-1046", name: "Rafa Cordero",   email: "rafa@hiver-collective.co",company: "Hiver Collective",   segment: "Mid-market", arr:  48_900, status: "active",   owner: "S. Pine",  ownerInitials: "SP", lastTouch: "1w ago",    joined: "2024-07-22" },
];

export const cases: CaseRow[] = [
  { id: "K-3201", title: "Annual renewal — Northstar",  client: "Northstar Capital", owner: "T. Montgomery", ownerInitials: "TM", value: 184_500, priority: "high", status: "in_progress", age: 14 },
  { id: "K-3202", title: "Onboarding flow review",      client: "Cobalt Labs",       owner: "S. Pine", ownerInitials: "SP", value:  18_000, priority: "med",  status: "qualifying",  age: 3  },
  { id: "K-3203", title: "Pilot expansion proposal",    client: "Lumen Grove",       owner: "T. Montgomery", ownerInitials: "TM", value:  92_000, priority: "high", status: "in_progress", age: 9  },
  { id: "K-3204", title: "Inbound — discovery call",    client: "Parallax Works",    owner: "T. Owen", ownerInitials: "TO", value:  12_500, priority: "low",  status: "new",         age: 1  },
  { id: "K-3205", title: "Contract redlines — Hiver",   client: "Hiver Collective",  owner: "S. Pine", ownerInitials: "SP", value:  48_900, priority: "med",  status: "blocked",     age: 21 },
];

export const schedule: ScheduleItem[] = [
  { id: "S1", when: "09:20", date: "Wed, 28 May", title: "Case review — AUI batch",   client: "Applied Underwriters", with: "R. Torres" },
  { id: "S2", when: "10:35", date: "Wed, 28 May", title: "Deposition prep — C-4709",  client: "Zurich North America", with: "B. Kapoor" },
  { id: "S3", when: "13:00", date: "Thu, 29 May", title: "Investigator briefing",      client: "Internal",             with: "M. Webb + J. Holt" },
  { id: "S4", when: "15:30", date: "Fri, 30 May", title: "Invoice review — May",       client: "Travelers Insurance",  with: "M. Crane" },
];

export const activity: ActivityItem[] = [
  { id: "A1", type: "note",    text: "Video obtained — C-4705 (Kowalski)", who: "M. Webb",  whoInitials: "MW", at: "12m" },
  { id: "A2", type: "deal",    text: "C-4711 closed — Mbeki (TRV)",         who: "K. Tran",  whoInitials: "KT", at: "1h" },
  { id: "A3", type: "email",   text: "Surveillance report sent — AUI",      who: "Admin",    whoInitials: "AD", at: "2h" },
  { id: "A4", type: "meeting", text: "Case briefing — C-4708",              who: "P. Ortega",whoInitials: "PO", at: "3h" },
  { id: "A5", type: "call",    text: "Status update to Hartford",            who: "Admin",    whoInitials: "AD", at: "5h" },
];

export const revenueSeries = [
  { m: "Jul", revenue: 184, pipeline: 240 }, { m: "Aug", revenue: 196, pipeline: 262 },
  { m: "Sep", revenue: 210, pipeline: 248 }, { m: "Oct", revenue: 228, pipeline: 295 },
  { m: "Nov", revenue: 241, pipeline: 318 }, { m: "Dec", revenue: 256, pipeline: 305 },
  { m: "Jan", revenue: 268, pipeline: 330 }, { m: "Feb", revenue: 274, pipeline: 348 },
  { m: "Mar", revenue: 288, pipeline: 372 }, { m: "Apr", revenue: 301, pipeline: 395 },
  { m: "May", revenue: 318, pipeline: 410 }, { m: "Jun", revenue: 332, pipeline: 438 },
];

export const sourceMix = [
  { name: "Inbound",  value: 42, color: "#4a7fff" }, { name: "Referral", value: 27, color: "#7aa1ff" },
  { name: "Outbound", value: 19, color: "#34d399" }, { name: "Partner",  value: 12, color: "#f59e0b" },
];

export const tasks = [
  { id: "T1", text: "Send May invoice — Travelers",         done: false },
  { id: "T2", text: "Upload report for C-4703",             done: true  },
  { id: "T3", text: "Schedule coverage for C-4708",         done: false },
  { id: "T4", text: "Review expense sheet — Webb",          done: false },
  { id: "T5", text: "Confirm deposition date — C-4709",     done: false },
];

export function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(0);
}

export function statusLabel(s: ClientStatus): string {
  return { active: "Active", prospect: "Prospect", dormant: "Dormant", churned: "Churned" }[s];
}

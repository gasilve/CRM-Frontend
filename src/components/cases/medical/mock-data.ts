/** Sample Medical Canvass payload for the Skyview board (mirrors Prodigy canvass). */

/** All facility type chips (same set as Prodigy CanvassPanel). Search is manual. */
export const FACILITY_TYPE_OPTIONS: { id: string; label: string; defaultOn?: boolean }[] = [
  { id: "hospital", label: "Hospital", defaultOn: true },
  { id: "urgent_care", label: "Urgent care", defaultOn: true },
  { id: "pharmacy", label: "Pharmacy", defaultOn: true },
  { id: "imaging", label: "Diagnostic imaging" },
  { id: "orthopedic", label: "Orthopedic" },
  { id: "physical_therapy", label: "Physical therapy" },
  { id: "pain_management", label: "Pain management" },
  { id: "neurology", label: "Neurology" },
  { id: "surgery_center", label: "Surgery center" },
  { id: "lab", label: "Lab / Blood work" },
  { id: "psychiatric", label: "Psychiatric" },
  { id: "mental_health", label: "Mental health" },
  { id: "chiropractor", label: "Chiropractor" },
  { id: "primary_care", label: "Primary care" },
];

export type MedicalStepStatus = "done" | "running" | "pending" | "skipped";

export type MedicalPipelineStep = {
  id: string;
  label: string;
  status: MedicalStepStatus;
  detail: string;
  summary: string;
  hits: string[];
};

export type MedicalFacilityStatus =
  | "pending"
  | "with_record"
  | "chart_only"
  | "no_record"
  | "dismissed";

export type MedicalFacility = {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string;
  distance_mi: number;
  status: MedicalFacilityStatus;
  note?: string;
  lat: number;
  lng: number;
};

export type MedicalCanvassView = {
  investigation_id: number;
  subject: { name: string; dob: string; city: string; state: string };
  address: string;
  /** Center of radius search (subject / override). */
  center: { lat: number; lng: number };
  /** UI default in Prodigy is 30 mi; distance is road/driving-oriented in product copy. */
  radius_mi: number;
  types: string[];
  pipeline: MedicalPipelineStep[];
  facilities: MedicalFacility[];
  notes: string;
  counts: {
    total: number;
    pending: number;
    with_record: number;
    chart_only: number;
    no_record: number;
  };
};

/** Call-attempt quick notes (Prodigy NoteModal). */
export const NOTE_QUICK_OPTIONS = [
  "Voicemail / WTA — will try again",
  "Busy line — call back later",
  "Check phone number",
  "Transferred — try again",
  "Doesn't treat this condition",
  "Psychiatric / special facility — won't share",
  "Request denied",
  "Only billing / wrong dept",
  "Goes straight to voicemail",
  "No answer after multiple attempts",
];

/** Type-specific chart/account quick notes (Prodigy ChartOnlyModal). */
export const TYPE_QUICK_NOTES: Record<string, string[]> = {
  hospital: [
    "Has a chart.",
    "No additional information permitted.",
    "(member of Valley Health System)",
    "(member of Dignity Health)",
    "(member of Kaiser Permanente)",
    "Records retention: 7 years.",
    "Has a chart. No additional information permitted.",
  ],
  pharmacy: [
    "Has an account.",
    "No prescription filled for the past two years.  Records retention 2 years of records.",
    "Has an account.  No fills on record.",
    "Has an account.  Records retention 2 years.",
  ],
  urgent_care: [
    "Has a chart.",
    "No additional information permitted.",
    "Chart only — patient confirmed in system.",
    "No appointment yet.  No visits yet.",
    "Referral only — no treatment confirmed.",
  ],
  orthopedic: [
    "Has a chart.",
    "No additional information permitted.",
    "Chart only — patient confirmed in system.",
  ],
  physical_therapy: [
    "Has a chart.",
    "No appointment yet.  No visits yet.",
    "Referral only — no treatment confirmed.",
  ],
  psychiatric: [
    "Has a chart.",
    "No additional information permitted.",
    "Psychiatric / special facility — won't share",
  ],
  other: [
    "Has a chart.",
    "Has an account.",
    "No additional information permitted.",
    "No records available.",
    "Information not available by phone.",
  ],
};

export const MOCK_MEDICAL: MedicalCanvassView = {
  investigation_id: 185,
  subject: {
    name: "Karen Suley Cisneros",
    dob: "1990-02-15",
    city: "Long Beach",
    state: "CA",
  },
  address: "1247 E Ocean Blvd, Long Beach, CA 90802",
  center: { lat: 33.7666, lng: -118.1719 },
  radius_mi: 30,
  types: ["hospital", "urgent_care", "pharmacy", "orthopedic", "physical_therapy"],
  pipeline: [
    {
      id: "address",
      label: "Address & types",
      status: "done",
      detail: "30 mi · 5 types",
      summary: "Canvass center set from subject primary address; facility type chips selected.",
      hits: [
        "Center · 1247 E Ocean Blvd, Long Beach, CA 90802",
        "Radius · 30 miles (driving / road distance in product)",
        "Types on · Hospital, Urgent care, Pharmacy, Orthopedic, PT",
      ],
    },
    {
      id: "search",
      label: "Facility search",
      status: "done",
      detail: "18 facilities",
      summary: "Google Places Nearby → NPI phone enrich → Places Details for gaps → cache.",
      hits: [
        "Places Nearby · 18 unique facilities in radius",
        "NPI enrich · phones filled on 11",
        "Places Details · 4 remaining phones resolved",
        "Cached in osint.canvass_facility_cache",
      ],
    },
    {
      id: "canvass",
      label: "Canvass calls",
      status: "running",
      detail: "7 of 18 done",
      summary: "Investigator marks each facility: with record / chart only / no record / dismissed.",
      hits: [
        "with_record · 2 (Memorial Care, Long Beach Memorial)",
        "chart_only · 1 (CVS MinuteClinic)",
        "no_record · 4",
        "pending · 11 still to call",
      ],
    },
    {
      id: "report",
      label: "Report",
      status: "pending",
      detail: "Not generated",
      summary: "DOCX/PDF narrative of facilities + save to MEDICAL CANVASS share when ready.",
      hits: [
        "Waiting until canvass calls finish",
        "Will include with_record + chart_only narratives",
        "no_record counted but not listed in body",
      ],
    },
  ],
  facilities: [
    {
      id: "f1",
      name: "Long Beach Memorial Medical Center",
      type: "hospital",
      address: "2801 Atlantic Ave, Long Beach, CA",
      phone: "(562) 933-2000",
      distance_mi: 1.2,
      status: "with_record",
      note: "Records · ER 2019-03-12 · Ortho follow-up 2019-04 · confirmed by Medical Records · Name+DOB",
      lat: 33.8085,
      lng: -118.1677,
    },
    {
      id: "f2",
      name: "MemorialCare Medical Group — Orthopedics",
      type: "orthopedic",
      address: "2840 Long Beach Blvd, Long Beach, CA",
      phone: "(562) 933-0300",
      distance_mi: 1.8,
      status: "with_record",
      note: "2 visits · PT referral · confirmed by Reception · Name+DOB+Phone",
      lat: 33.8042,
      lng: -118.1889,
    },
    {
      id: "f3",
      name: "CVS MinuteClinic",
      type: "pharmacy",
      address: "6400 E Pacific Coast Hwy, Long Beach, CA",
      phone: "(562) 430-1100",
      distance_mi: 2.4,
      status: "chart_only",
      note: "Has an account. · No additional information permitted.",
      lat: 33.7601,
      lng: -118.1165,
    },
    {
      id: "f4",
      name: "Dignity Health — St. Mary Medical Center",
      type: "hospital",
      address: "1050 Linden Ave, Long Beach, CA",
      phone: "(562) 491-9000",
      distance_mi: 3.1,
      status: "no_record",
      lat: 33.7812,
      lng: -118.1921,
    },
    {
      id: "f5",
      name: "Concentra Urgent Care",
      type: "urgent_care",
      address: "100 W Broadway, Long Beach, CA",
      phone: "(562) 901-1400",
      distance_mi: 2.9,
      status: "no_record",
      note: "No answer after multiple attempts",
      lat: 33.7698,
      lng: -118.1955,
    },
    {
      id: "f6",
      name: "Select Physical Therapy",
      type: "physical_therapy",
      address: "3505 Long Beach Blvd, Long Beach, CA",
      phone: "(562) 426-2200",
      distance_mi: 2.1,
      status: "pending",
      lat: 33.7891,
      lng: -118.1894,
    },
    {
      id: "f7",
      name: "UCI Health — Orthopaedics",
      type: "orthopedic",
      address: "1640 Newport Blvd, Costa Mesa, CA",
      phone: "(949) 398-1440",
      distance_mi: 18.4,
      status: "pending",
      lat: 33.6594,
      lng: -117.9089,
    },
    {
      id: "f8",
      name: "Walgreens Pharmacy",
      type: "pharmacy",
      address: "5305 E Pacific Coast Hwy, Long Beach, CA",
      phone: "(562) 498-2200",
      distance_mi: 1.5,
      status: "pending",
      lat: 33.7618,
      lng: -118.1342,
    },
  ],
  notes:
    "Focus next on PT and remaining pharmacies. Memorial Care already confirms ER + ortho — strong for report.",
  counts: {
    total: 18,
    pending: 11,
    with_record: 2,
    chart_only: 1,
    no_record: 4,
  },
};

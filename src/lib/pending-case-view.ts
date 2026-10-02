/**
 * Adapts an intake proposal into the CaseDetail shape so pending cases render
 * through the exact same widget set as live cases. Fields the proposal cannot
 * know are filled with honest blanks — the widgets already handle missing data.
 */
import type {
  CaseDetail,
  CaseService,
  CaseVehicle,
  PendingCaseDetail,
  ProposalVehicle,
} from "@/lib/crm-api";

/** ISO-normalize when parseable; otherwise pass the raw string through for display. */
const isoDate = (value: string | null): string | null => {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? value : new Date(t).toISOString();
};

/** Best-effort service guess from the ingestor's free-text case type. */
const guessService = (caseType: string | null): CaseService => {
  const t = (caseType ?? "").toLowerCase();
  if (t.includes("comp") || /\bwc\b/.test(t)) return "WC";
  if (t.includes("fmla")) return "FMLA";
  if (t.includes("background")) return "BG";
  if (t.includes("domestic")) return "DOM";
  if (t.includes("social")) return "SOC";
  if (t.includes("disab")) return "DIS";
  if (t.includes("locate")) return "LOC";
  if (t.includes("liab")) return "LIA";
  return "SURV";
};

const toCaseVehicle = (v: ProposalVehicle, index: number): CaseVehicle => ({
  id: `proposal-vehicle-${index}`,
  make: v.makeModel,
  model: null,
  year: v.year && /^\d{4}$/.test(v.year.trim()) ? Number(v.year.trim()) : null,
  color: v.color,
  licensePlate: v.plate,
  state: null,
  vin: null,
  photoUrl: null,
  seatCount: 5,
  kind: "subject",
  notes: v.source ? `Source: ${v.source}` : null,
  registeredOwner: v.registeredOwner,
  personLinks: [],
});

const composeDescription = (p: PendingCaseDetail): string | null => {
  const a = p.proposal.assignment;
  const parts = [
    a.typeOfClaim && `Type of claim: ${a.typeOfClaim}`,
    a.injuryDescription && `Injury: ${a.injuryDescription}`,
    a.bodyParts && `Body parts: ${a.bodyParts}`,
    a.restrictions && `Restrictions: ${a.restrictions}`,
    a.suspicion && `Suspicion: ${a.suspicion}`,
    a.instructions && `Instructions: ${a.instructions}`,
    a.isRepresented && `Represented: ${a.isRepresented}`,
    a.defenseAttorney && `Defense attorney: ${a.defenseAttorney}${a.defenseLawFirm ? ` (${a.defenseLawFirm})` : ""}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("\n") : null;
};

export function proposalToCaseDetail(p: PendingCaseDetail): CaseDetail {
  const subject = p.proposal.subject;
  const assignment = p.proposal.assignment;
  const days = assignment.surveillanceDays ? Number.parseInt(assignment.surveillanceDays, 10) : NaN;

  return {
    id: p.id,
    caseNumber: p.caseIngestorCode ?? "PENDING",
    claimNumber: p.claimNumber,
    policyNumber: null,
    clientId: null,
    client: p.insurer ? { id: "pending-insurer", company: p.insurer } : null,
    adjusterName: assignment.adjusterName,
    adjusterEmail: assignment.adjusterEmail,
    adjusterPhone: assignment.adjusterPhone,
    service: guessService(p.ingestorCaseType ?? p.proposal.caseType),
    tags: [],
    status: "open",
    priority: "standard",
    subjectTransport: null,
    subjectSetting: null,
    reopened: false,
    region: null,
    state: null,
    earliestActiveAt: null,
    dateOpened: p.receivedAt,
    dateClosed: null,
    dateOfInjury: isoDate(assignment.dateOfLoss),
    dueDate: p.dueDate ?? isoDate(assignment.reportDueDate),
    daysAllotted: Number.isFinite(days) ? days : null,
    startTime: null,
    estimatedValue: null,
    description: composeDescription(p),
    subjectName: p.subjectName ?? subject.name ?? "Unnamed subject",
    subjectAliases: [],
    subjectDob: isoDate(subject.dob),
    subjectPhotoUrl: null,
    addresses: subject.addresses.map((line, i) => ({
      id: `proposal-address-${i}`,
      label: null,
      line1: line,
      city: null,
      state: null,
      zip: null,
      lat: null,
      lng: null,
      isPrimary: i === 0,
    })),
    assignments: [],
    subjectSsn: subject.ssnLast4 ? `•••-••-${subject.ssnLast4}` : null,
    subjectDriverLicense: null,
    subjectJobTitle: subject.job,
    subjectEmployer: subject.employer,
    subjectEmployerAddress: subject.employerContact
      ? [subject.employerContact, subject.employerPhone].filter(Boolean).join(" · ")
      : null,
    subjectWorkStatus: null,
    subjectLanguage: null,
    subjectDescription: subject.physical,
    vehicles: p.proposal.vehicles.map(toCaseVehicle),
    people: [],
    presurveillance: null,
    days: [],
    scheduleBlocks: [],
    files: p.files.map((f) => ({ ...f, source: "ingest" })),
    todos: [],
    situationSummary: null,
    createdBy: null,
    createdAt: p.receivedAt,
    updatedAt: p.updatedAt,
  };
}

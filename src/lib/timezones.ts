/** Curated IANA timezone ids for investigator profiles. */
export const TIMEZONE_OPTIONS = [
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/New_York", label: "Eastern (ET)" },
] as const;

export type ProfileTimezone = (typeof TIMEZONE_OPTIONS)[number]["value"];

export const TIMEZONE_LABELS: Record<ProfileTimezone, string> = Object.fromEntries(
  TIMEZONE_OPTIONS.map((tz) => [tz.value, tz.label]),
) as Record<ProfileTimezone, string>;

export const formatTimezone = (tz: string | null | undefined): string => {
  if (!tz) return "—";
  return TIMEZONE_LABELS[tz as ProfileTimezone] ?? tz.replace(/_/g, " ").replace("America/", "");
};

export interface HomeAddressFields {
  homeAddressLine1?: string | null;
  homeCity?: string | null;
  homeState?: string | null;
  homeZip?: string | null;
}

export const formatHomeAddress = (fields: HomeAddressFields): string => {
  const line = fields.homeAddressLine1?.trim();
  const cityStateZip = [fields.homeCity, fields.homeState, fields.homeZip].filter(Boolean).join(", ").trim();
  if (line && cityStateZip) return `${line}, ${cityStateZip}`;
  return line || cityStateZip || "—";
};

export const formatHomeAddressShort = (fields: HomeAddressFields): string => {
  const cityState = [fields.homeCity, fields.homeState].filter(Boolean).join(", ");
  if (cityState) return cityState;
  return fields.homeAddressLine1?.trim() || "—";
};

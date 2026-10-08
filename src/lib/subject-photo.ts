/**
 * Same rule as the API picker (crm-api/src/modules/intake/subject-photo.ts).
 * A stored image is the subject unless its name says it is a place, a vehicle,
 * or email signature art.
 */

type PhotoCandidate = {
  filename: string;
  contentType: string | null;
  extracted?: unknown;
  storageKey?: string | null;
};

const LOGO_NAME = /logo|promedix|signature|banner|\bicon\b|spacer|pixel|tracking/i;
const NOT_AN_IMAGE = /\.(pdf|docx?|xlsx?|csv|txt|eml|msg|zip)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
const IMAGE_TYPE = /^image\/(jpe?g|png|webp|gif|heic|heif)/i;
const NOT_THE_SUBJECT =
  /property|\bhouse\b|\bhome\b|residence|dwelling|building|exterior|aerial|satellite|street[\s_-]?view|\baddress\b|driveway|\byard\b|apartment|vehicle|\bcar\b|\btruck\b|licen[cs]e|\bplate\b|\bvin\b|floor[\s_-]?plan|\bmap\b/i;
/** Outlook's default name for a pasted image. A named file is a better portrait when both arrived. */
const GENERIC_PASTE = /^image\d*\.(png|jpe?g|gif|webp)$/i;

const extractedRole = (extracted: unknown): string | null => {
  if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) return null;
  const role = (extracted as { role?: unknown }).role;
  return typeof role === "string" ? role : null;
};

const isSubjectImage = (file: { filename: string; contentType?: string | null }): boolean => {
  const name = file.filename.trim();
  if (!name || LOGO_NAME.test(name) || NOT_AN_IMAGE.test(name)) return false;
  const image = IMAGE_EXT.test(name) || IMAGE_TYPE.test(file.contentType ?? "");
  if (!image) return false;
  if (NOT_THE_SUBJECT.test(name)) return false;
  return true;
};

export const chooseSubjectPhoto = <T extends PhotoCandidate>(files: T[]): T | null => {
  const held = files.filter((file) => Boolean(file.storageKey));
  const marked = held.find((file) => extractedRole(file.extracted) === "subject_photo" && isSubjectImage(file));
  if (marked) return marked;
  const candidates = held.filter((file) => {
    const role = extractedRole(file.extracted);
    if (role === "property" || role === "vehicle") return false;
    return isSubjectImage(file);
  });
  return candidates.find((file) => !GENERIC_PASTE.test(file.filename.trim())) ?? candidates[0] ?? null;
};

/**
 * Same rule as the API picker (crm-api/src/modules/intake/subject-photo.ts).
 * When the face service looked at an image, its answer decides; otherwise a
 * stored image is the subject unless its name says it is a place, a vehicle,
 * or email signature art. An enhanced copy that kept the person's identity is
 * shown instead of the photo it came from.
 */

type PhotoCandidate = {
  filename: string;
  contentType: string | null;
  extracted?: unknown;
  storageKey?: string | null;
  sha256?: string | null;
};

const SUBJECT_PHOTO = "subject_photo";
const SUBJECT_PHOTO_ENHANCED = "subject_photo_enhanced";

const LOGO_NAME = /logo|promedix|signature|banner|\bicon\b|spacer|pixel|tracking/i;
const NOT_AN_IMAGE = /\.(pdf|docx?|xlsx?|csv|txt|eml|msg|zip)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
const IMAGE_TYPE = /^image\/(jpe?g|png|webp|gif|heic|heif)/i;
const NOT_THE_SUBJECT =
  /property|\bhouse\b|\bhome\b|residence|dwelling|building|exterior|aerial|satellite|street[\s_-]?view|\baddress\b|driveway|\byard\b|apartment|vehicle|\bcar\b|\btruck\b|licen[cs]e|\bplate\b|\bvin\b|floor[\s_-]?plan|\bmap\b/i;
/** Outlook's default name for a pasted image. A named file is a better portrait when both arrived. */
const GENERIC_PASTE = /^image\d*\.(png|jpe?g|gif|webp)$/i;

const extractedObject = (extracted: unknown): Record<string, unknown> | null =>
  extracted && typeof extracted === "object" && !Array.isArray(extracted) ? (extracted as Record<string, unknown>) : null;

const extractedRole = (extracted: unknown): string | null => {
  const role = extractedObject(extracted)?.role;
  return typeof role === "string" ? role : null;
};

const faceUsable = (extracted: unknown): boolean | null => {
  const face = extractedObject(extractedObject(extracted)?.face);
  return face && typeof face.usable === "boolean" ? face.usable : null;
};

const isPhotoFile = (file: { filename: string; contentType?: string | null }): boolean => {
  const name = file.filename.trim();
  if (!name || LOGO_NAME.test(name) || NOT_AN_IMAGE.test(name)) return false;
  return IMAGE_EXT.test(name) || IMAGE_TYPE.test(file.contentType ?? "");
};

const couldBeSubject = (file: PhotoCandidate): boolean => {
  if (!isPhotoFile(file)) return false;
  const usable = faceUsable(file.extracted);
  if (usable !== null) return usable;
  const role = extractedRole(file.extracted);
  if (role === "property" || role === "vehicle") return false;
  return !NOT_THE_SUBJECT.test(file.filename.trim());
};

const chooseOriginal = <T extends PhotoCandidate>(held: T[]): T | null => {
  const originals = held.filter((file) => extractedRole(file.extracted) !== SUBJECT_PHOTO_ENHANCED);
  const marked = originals.find((file) => extractedRole(file.extracted) === SUBJECT_PHOTO && couldBeSubject(file));
  if (marked) return marked;
  const candidates = originals.filter(couldBeSubject);
  return candidates.find((file) => !GENERIC_PASTE.test(file.filename.trim())) ?? candidates[0] ?? null;
};

const enhancedCopyOf = <T extends PhotoCandidate>(files: T[], original: PhotoCandidate): T | null => {
  if (!original.sha256) return null;
  return (
    files.find((file) => {
      const data = extractedObject(file.extracted);
      if (data?.role !== SUBJECT_PHOTO_ENHANCED) return false;
      const from = extractedObject(data.enhancedFrom);
      const enhance = extractedObject(data.enhance);
      return from?.sha256 === original.sha256 && enhance?.status === "ok";
    }) ?? null
  );
};

export const chooseSubjectPhoto = <T extends PhotoCandidate>(files: T[]): T | null => {
  const held = files.filter((file) => Boolean(file.storageKey));
  const original = chooseOriginal(held);
  if (!original) return null;
  return enhancedCopyOf(held, original) ?? original;
};

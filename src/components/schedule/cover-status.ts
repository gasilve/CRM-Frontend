/** Placeholder cover status until a real investigator field exists.
 *  Visual palette (brand AgentMark): Safe = blue, Noticed = yellow, Burnt = red.
 */
export type CoverStatus = "safe" | "noticed" | "burnt";

/** Deterministic placeholder so the UI shows all three states without a schema. */
export function placeholderCoverStatus(userId: string): CoverStatus {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  const bucket = Math.abs(hash) % 10;
  if (bucket === 0) return "burnt";
  if (bucket <= 2) return "noticed";
  return "safe";
}

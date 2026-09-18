/**
 * Soft gate for TOTP MFA (enrollment + login challenge).
 * When false, Better Auth's twoFactor plugin is not loaded on the API, so
 * already-enrolled accounts can sign in with password alone. Routes/UI for
 * MFA stay in the app for when this is flipped back on.
 *
 * Temporarily defaults OFF — set VITE_MFA_REQUIRED=true to force MFA again.
 */
export function isMfaRequired(): boolean {
  const raw = String(import.meta.env.VITE_MFA_REQUIRED ?? "")
    .trim()
    .toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return false;
}

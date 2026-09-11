/**
 * Soft gate for mandatory TOTP enrollment.
 * MFA routes/UI/plugin stay; this only controls whether setup is forced.
 *
 * Temporarily defaults OFF — set VITE_MFA_REQUIRED=true to force enrollment again.
 */
export function isMfaRequired(): boolean {
  const raw = String(import.meta.env.VITE_MFA_REQUIRED ?? "")
    .trim()
    .toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return false;
}

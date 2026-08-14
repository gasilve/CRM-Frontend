import { useEffect, useState, type ReactNode } from "react";
import { Mail, Clock, X, RotateCw, Loader2, Check } from "lucide-react";
import { invitationsApi, ApiError, type Invitation } from "@/lib/crm-api";
import { RoleChip } from "./RoleChip";

type Props = {
  /** Bump this (e.g. a counter) to force a refetch — call after creating a new invite. */
  reloadToken?: number;
  /** Shown when there are no pending invitations. Pass `null` to render nothing in that case. */
  emptyState?: ReactNode | null;
};

const defaultEmptyState = (
  <p className="py-6 text-center text-[0.8125rem] text-[var(--color-text-lo)]">No pending invitations.</p>
);

export function PendingInvitations({ reloadToken = 0, emptyState = defaultEmptyState }: Props) {
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [justResent, setJustResent] = useState<string | null>(null);

  const load = () => {
    invitationsApi
      .list()
      .then((res) => setInvitations(res.invitations))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load invitations."));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [reloadToken]);

  const pending = invitations?.filter((i) => !i.acceptedAt) ?? [];

  const resend = async (invitation: Invitation) => {
    const key = `resend:${invitation.id}`;
    setBusyKey(key);
    setError(null);
    try {
      const { invitation: updated } = await invitationsApi.resend(invitation.id);
      setInvitations((prev) => prev?.map((i) => (i.id === updated.id ? updated : i)) ?? prev);
      setJustResent(invitation.id);
      setTimeout(() => setJustResent((cur) => (cur === invitation.id ? null : cur)), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend invitation.");
    } finally {
      setBusyKey(null);
    }
  };

  const revoke = async (invitation: Invitation) => {
    setBusyKey(`revoke:${invitation.id}`);
    setError(null);
    try {
      await invitationsApi.revoke(invitation.id);
      setInvitations((prev) => prev?.filter((i) => i.id !== invitation.id) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke invitation.");
    } finally {
      setBusyKey(null);
    }
  };

  if (!invitations && !error) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={18} className="animate-spin text-[var(--color-text-lo)]" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-[0.5rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-3.5 py-2.5 text-[0.78125rem] text-[var(--color-neg)]">
          {error}
        </div>
      )}

      {pending.length === 0 ? (
        emptyState
      ) : (
        <div className="flex flex-col divide-y divide-[var(--color-line)]">
          {pending.map((inv) => {
            const resending = busyKey === `resend:${inv.id}`;
            const revoking = busyKey === `revoke:${inv.id}`;
            return (
              <div key={inv.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Mail size={14} className="shrink-0 text-[var(--color-text-lo)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{inv.email}</div>
                  <div className="flex items-center gap-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                    <Clock size={10} />
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inv.roles.map((role) => (
                    <RoleChip key={role} role={role} />
                  ))}
                </div>
                <button
                  disabled={resending || revoking}
                  onClick={() => resend(inv)}
                  aria-label="Resend invitation"
                  title="Resend invitation email"
                  className="flex shrink-0 items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--color-text-mid)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] transition-colors disabled:opacity-50"
                >
                  {resending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : justResent === inv.id ? (
                    <Check size={12} className="text-[#4ade80]" />
                  ) : (
                    <RotateCw size={12} />
                  )}
                  {justResent === inv.id ? "Sent" : "Resend"}
                </button>
                <button
                  disabled={resending || revoking}
                  onClick={() => revoke(inv)}
                  aria-label="Revoke invitation"
                  title="Revoke invitation"
                  className="shrink-0 rounded-[0.5rem] p-1.5 text-[var(--color-text-lo)] hover:bg-white/[0.05] hover:text-[var(--color-neg)] transition-colors disabled:opacity-50"
                >
                  {revoking ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

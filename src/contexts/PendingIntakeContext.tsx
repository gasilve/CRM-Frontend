import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { pendingCasesApi } from "@/lib/crm-api";
import { useAuth } from "@/contexts/AuthContext";

interface PendingIntakeContextValue {
  pendingReview: number | null;
  setPendingReview: (count: number) => void;
  refresh: () => void;
}

const PendingIntakeContext = createContext<PendingIntakeContextValue | null>(null);

export function PendingIntakeProvider({ children }: { children: ReactNode }) {
  const { canAny } = useAuth();
  const canSeeIntake = canAny("intake.view");
  const [pendingReview, setPendingReview] = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (!canSeeIntake) return;
    pendingCasesApi
      .summary()
      .then((res) => setPendingReview(res.pendingReview))
      .catch(() => {});
  }, [canSeeIntake]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PendingIntakeContext.Provider value={{ pendingReview, setPendingReview, refresh }}>
      {children}
    </PendingIntakeContext.Provider>
  );
}

export function usePendingIntake(): PendingIntakeContextValue {
  const ctx = useContext(PendingIntakeContext);
  if (!ctx) {
    throw new Error("usePendingIntake must be used within PendingIntakeProvider");
  }
  return ctx;
}

import { useCallback, useEffect, useState } from "react";
import { fetchServiceHealth, type ServiceHealth } from "@/lib/health";

export function useServiceHealth(pollMs = 8_000) {
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      setHealth(await fetchServiceHealth());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (pollMs <= 0) return;
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, refresh]);

  return { health, checking, refresh };
}

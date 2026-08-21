const CRM_API_URL = import.meta.env.VITE_CRM_API_URL ?? "http://localhost:3000";

export type ServiceHealth = {
  ok: boolean;
  db: "connected" | "down" | "unknown";
  message?: string;
};

export const DB_UNAVAILABLE_HINT =
  "Database is unavailable. If you're running locally, start Postgres with: docker compose up -d auth-postgres";

export async function fetchServiceHealth(): Promise<ServiceHealth> {
  try {
    const res = await fetch(`${CRM_API_URL}/health`, { credentials: "omit" });
    const json = (await res.json()) as {
      success?: boolean;
      payload?: { db?: string; dbError?: string | null };
    };

    if (!res.ok || !json.success) {
      return { ok: false, db: "unknown", message: "Could not reach the API." };
    }

    const db = json.payload?.db === "connected" ? "connected" : "down";
    return {
      ok: db === "connected",
      db,
      message: db === "connected" ? undefined : DB_UNAVAILABLE_HINT,
    };
  } catch {
    return { ok: false, db: "unknown", message: "Could not reach the API. Is crm-api running?" };
  }
}

export const isDatabaseUnavailableMessage = (message: string | null | undefined): boolean => {
  if (!message) return false;
  return /database is unavailable|DATABASE_UNAVAILABLE|can't reach database|auth-postgres/i.test(message);
};

// Prodigy OSINT API client — Vite/fetch compatible (no axios)
const getBaseURL = (): string => {
  const envUrl = import.meta.env.VITE_PRODIGY_API_URL;
  if (envUrl) return envUrl;
  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;
    if (!["localhost", "127.0.0.1"].includes(hostname) || port === "4001") return "";
    return `http://${hostname}:8000`;
  }
  return "http://localhost:8000";
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getBaseURL();
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[Prodigy API] ${res.status} ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const prodigyApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
};

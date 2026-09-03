/**
 * Global investigation progress store.
 * Uses a simple event-based approach (no Zustand needed).
 */

export interface EngineStatus {
  engine: string;
  status: "running" | "done" | "error" | "pending";
  tier: number;
  result_count: number;
  error?: string | null;
  duration_ms?: number | null;
}

export interface InvestigationProgress {
  investigation_id: number;
  subject_name: string;
  status: string;
  progress: number;
  tier1_complete: boolean;
  engines: EngineStatus[];
  total_engines: number;
  done_engines: number;
  running_engines: number;
  photo_total: number;
  photo_processed: number;
}

type Listener = (progress: InvestigationProgress | null) => void;
const listeners = new Set<Listener>();
let current: InvestigationProgress | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;

export function subscribeProgress(fn: Listener): () => void {
  listeners.add(fn);
  fn(current); // emit current state immediately
  return () => listeners.delete(fn);
}

function emit(p: InvestigationProgress | null) {
  current = p;
  listeners.forEach(fn => fn(p));
}

export function startTracking(investigationId: number) {
  if (pollInterval) stopTracking();

  const poll = async () => {
    try {
      const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
      const port = typeof window !== "undefined" ? window.location.port : "3001";
      // Production or nginx: use relative URLs (Next.js rewrites /api/* to backend)
      const baseUrl = (!["localhost", "127.0.0.1"].includes(hostname) || port === "4001")
        ? "" : "http://localhost:8000";
      const r = await fetch(`${baseUrl}/api/investigations/${investigationId}/progress`);
      if (!r.ok) return;
      const data: InvestigationProgress = await r.json();
      emit(data);

      // Stop polling when done
      if (data.status === "completed" || data.status === "failed") {
        stopTracking();
      }
    } catch { /* ignore network errors */ }
  };

  poll();
  pollInterval = setInterval(poll, 2500); // poll every 2.5s
}

export function stopTracking() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

export function clearProgress() {
  emit(null);
  stopTracking();
}

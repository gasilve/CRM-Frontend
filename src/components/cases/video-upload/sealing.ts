import { useSyncExternalStore } from "react";

/**
 * Uploads in flight, outside React. Closing the modal mid-upload doesn't stop the
 * work, and reopening it shows where the upload got to.
 */
export type SealJob = { id: string; caseId: string; day: string; files: number; done: number; error: string | null };

let jobs: SealJob[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function startJob(job: Omit<SealJob, "done" | "error">) {
  jobs = [...jobs, { ...job, done: 0, error: null }];
  emit();
}

export function stepJob(id: string, done: number) {
  jobs = jobs.map((job) => (job.id === id ? { ...job, done } : job));
  emit();
}

export function endJob(id: string) {
  jobs = jobs.filter((job) => job.id !== id);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSealJobs(caseId: string) {
  const all = useSyncExternalStore(subscribe, () => jobs);
  return all.filter((job) => job.caseId === caseId);
}

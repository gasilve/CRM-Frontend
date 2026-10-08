const DB_NAME = "accenty-case-video";
const STORE = "batches";

export type SavedClip = {
  id: string;
  name: string;
  kind: string;
  seconds: number | null;
  recordedAt: string | null;
  blob: Blob;
};

export type SavedBatch = {
  id: string;
  caseId: string;
  signerName: string;
  certifiedAt: string;
  minutes: number;
  measured: number | null;
  /** Calendar day (YYYY-MM-DD) → when that day was marked for the client. */
  sentOn: Record<string, string>;
  /** Calendar day → cold once it has left staging for the immutable copy. */
  storeOn?: Record<string, "staging" | "cold">;
  clips: SavedClip[];
};

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("caseId", "caseId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the video library."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Video library request failed."));
  });
}

export async function listBatches(caseId: string) {
  const db = await openDb();
  try {
    const rows = await requestToPromise(
      db.transaction(STORE).objectStore(STORE).index("caseId").getAll(caseId),
    );
    return (rows as SavedBatch[]).sort((a, b) => b.certifiedAt.localeCompare(a.certifiedAt));
  } finally {
    db.close();
  }
}

export async function saveBatch(batch: SavedBatch) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(batch);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not save the video."));
    });
  } finally {
    db.close();
  }
}

export async function markDayCold(batchId: string, day: string) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const batch = (await requestToPromise(store.get(batchId))) as SavedBatch | undefined;
    if (!batch) return;
    store.put({ ...batch, storeOn: { ...(batch.storeOn ?? {}), [day]: "cold" } });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not move that day."));
    });
  } finally {
    db.close();
  }
}

export async function markDaySent(batchId: string, day: string, at: string) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const batch = (await requestToPromise(store.get(batchId))) as SavedBatch | undefined;
    if (!batch) return;
    store.put({ ...batch, sentOn: { ...batch.sentOn, [day]: at } });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not update that day."));
    });
  } finally {
    db.close();
  }
}

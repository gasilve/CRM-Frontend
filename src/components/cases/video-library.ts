const DB_NAME = "accenty-case-video";
const STORE = "batches";
const DRAFTS = "drafts";
/** Draft files live apart from the draft so typing an answer never re-copies gigabytes of video. */
const DRAFT_CLIPS = "draftClips";

export type CameraKind = "covert" | "camcorder";

export type LeftOutReason = "wrong_person" | "too_dark" | "other";

export type SavedClip = {
  id: string;
  name: string;
  kind: string;
  seconds: number | null;
  recordedAt: string | null;
  blob: Blob | null;
  sizeBytes?: number;
  /** Clip number read from the camera's file name. */
  number?: number | null;
  sha256?: string | null;
  /** False keeps the original but leaves it out of the published video. */
  inClientVideo?: boolean;
  leftOutReason?: LeftOutReason | null;
  /** Set when this file, on its own, has been moved to cold storage. */
  coldAt?: string | null;
};

export type Declared = { files: number; seconds: number };

export type SavedSeries = {
  first: number | null;
  last: number | null;
  missing: number[];
  explanation: string | null;
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
  /** The day the investigator says they recorded (YYYY-MM-DD). */
  workDate?: string;
  camera?: CameraKind;
  declared?: Declared;
  /** The first answer, kept when the investigator changes it after seeing the files. */
  declaredFirst?: Declared;
  measuredSeconds?: number | null;
  series?: SavedSeries;
  attest?: string[];
  /** PNG data URL of the drawn signature. */
  signature?: string;
  service?: string;
  state?: string | null;
  flag?: { at: string; note: string } | null;
  storage?: "staging" | "cold";
  coldAt?: string | null;
  sends?: VideoSend[];
};

export type VideoSend = { at: string; to: string[]; note: string; by: string; clipIds?: string[] };

export type DraftStep = "identify" | "certify";

/** An upload that hasn't been signed yet. Kept so closing the modal never loses work. */
export type VideoDraft = {
  key: string;
  caseId: string;
  signerName: string;
  updatedAt: string;
  step: DraftStep;
  workDate: string;
  camera: CameraKind | null;
  filesText: string;
  minText: string;
  secText: string;
  declaredFirst: Declared | null;
  explanation: string;
  attest: boolean[];
  /** Server batch, once the files have started uploading. */
  batchId?: string;
  /** Clip ids in the order they were added; the files themselves are in DRAFT_CLIPS. */
  clipIds: string[];
  clipMeta: Record<string, { seconds: number | null; recordedAt: string | null; unreadable: boolean; inClientVideo: boolean; leftOutReason: LeftOutReason | null }>;
};

export type DraftClip = { id: string; draftKey: string; name: string; sizeBytes: number; blob: Blob };

export function draftKey(caseId: string, signerName: string) {
  return `${caseId}:${signerName}`;
}

export async function getDraft(key: string) {
  const db = await openDb();
  try {
    const draft = (await requestToPromise(db.transaction(DRAFTS).objectStore(DRAFTS).get(key))) as VideoDraft | undefined;
    if (!draft) return null;
    const clips = (await requestToPromise(
      db.transaction(DRAFT_CLIPS).objectStore(DRAFT_CLIPS).index("draftKey").getAll(key),
    )) as DraftClip[];
    return { draft, clips };
  } finally {
    db.close();
  }
}

export async function saveDraft(draft: VideoDraft) {
  await write(DRAFTS, (store) => store.put(draft));
}

export async function putDraftClip(clip: DraftClip) {
  await write(DRAFT_CLIPS, (store) => store.put(clip));
}

export async function deleteDraftClip(id: string) {
  await write(DRAFT_CLIPS, (store) => store.delete(id));
}

export async function clearDraft(key: string) {
  const db = await openDb();
  try {
    const tx = db.transaction([DRAFTS, DRAFT_CLIPS], "readwrite");
    tx.objectStore(DRAFTS).delete(key);
    const clips = tx.objectStore(DRAFT_CLIPS);
    const ids = await requestToPromise(clips.index("draftKey").getAllKeys(key));
    for (const id of ids) clips.delete(id);
    await done(tx);
  } finally {
    db.close();
  }
}

async function write(storeName: string, act: (store: IDBObjectStore) => void) {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName, "readwrite");
    act(tx.objectStore(storeName));
    await done(tx);
  } finally {
    db.close();
  }
}

function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Video library write failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Video library write was aborted."));
  });
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("caseId", "caseId");
      }
      if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS, { keyPath: "key" });
      if (!db.objectStoreNames.contains(DRAFT_CLIPS)) {
        db.createObjectStore(DRAFT_CLIPS, { keyPath: "id" }).createIndex("draftKey", "draftKey");
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

export async function updateBatch(batchId: string, change: (batch: SavedBatch) => SavedBatch) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const batch = (await requestToPromise(store.get(batchId))) as SavedBatch | undefined;
    if (!batch) return;
    store.put(change(batch));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not update the video."));
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

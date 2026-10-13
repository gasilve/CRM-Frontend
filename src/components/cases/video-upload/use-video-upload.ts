import { useEffect, useMemo, useRef, useState } from "react";
import type { CaseService } from "@/lib/crm-api";
import { readRecordedAt } from "@/components/cases/video-recorded-at";
import {
  clearDraft,
  deleteDraftClip,
  draftKey,
  putDraftClip,
  saveBatch,
  saveDraft,
  type CameraKind,
  type Declared,
  type DraftClip,
  type DraftStep,
  type LeftOutReason,
  type SavedBatch,
  type VideoDraft,
} from "@/components/cases/video-library";
import {
  ATTEST,
  dayKeyOf,
  dayName,
  filesCheck,
  lengthCheck,
  orderCheck,
  readNumber,
  readSeries,
  repeatCheck,
  sortByCamera,
  type Check,
} from "@/components/cases/video-upload/checks";
import { batchDay } from "@/components/cases/video-upload/ledger";
import { endJob, startJob, stepJob } from "@/components/cases/video-upload/sealing";

export type UploadClip = {
  id: string;
  name: string;
  kind: string;
  sizeBytes: number;
  url: string;
  blob: Blob;
  number: number | null;
  seconds: number | null;
  recordedAt: string | null;
  unreadable: boolean;
  sha256: string | null;
  inClientVideo: boolean;
  leftOutReason: LeftOutReason | null;
};

export type Resume = { draft: VideoDraft; clips: DraftClip[] };

/** Browsers hash in memory; anything bigger is fingerprinted when it reaches the server. */
const HASH_LIMIT_BYTES = 768 * 1024 * 1024;

export function useVideoUpload({
  caseId,
  signerName,
  service,
  state,
  batches,
  resume,
  presetDay,
  onDraft,
  onSealed,
}: {
  caseId: string;
  signerName: string;
  service: CaseService;
  state: string | null;
  batches: SavedBatch[];
  resume: Resume | null;
  presetDay?: string;
  /** Called with the draft whenever it is saved, and null once it is gone. */
  onDraft: (resume: Resume | null) => void;
  onSealed: (day: string) => void;
}) {
  const key = draftKey(caseId, signerName);
  const start = resume?.draft;
  const fileRef = useRef<HTMLInputElement>(null);
  const clipsRef = useRef<UploadClip[]>([]);
  const stopped = useRef(false);
  const abortSeal = useRef(false);
  const latest = useRef<Resume | null>(null);
  const sealedRef = useRef(onSealed);
  sealedRef.current = onSealed;
  const draftRef = useRef(onDraft);
  draftRef.current = onDraft;

  const [step, setStep] = useState<DraftStep>(start?.step ?? "identify");
  const [workDate, setWorkDate] = useState(start?.workDate ?? presetDay ?? dayKeyOf(new Date()));
  const [camera, setCamera] = useState<CameraKind | null>(start?.camera ?? null);
  const [filesText, setFilesText] = useState(start?.filesText ?? "");
  const [minText, setMinText] = useState(start?.minText ?? "");
  const [secText, setSecText] = useState(start?.secText ?? "");
  const [declaredFirst, setDeclaredFirst] = useState<Declared | null>(start?.declaredFirst ?? null);
  const [clips, setClips] = useState<UploadClip[]>(() => (resume ? restore(resume) : []));
  const [editing, setEditing] = useState(clips.length === 0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState(start?.explanation ?? "");
  const [attest, setAttest] = useState(start?.attest ?? [false, false, false]);
  const [signature, setSignature] = useState<string | null>(null);
  const [signKey, setSignKey] = useState(0);
  const [sealing, setSealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [dragging, setDragging] = useState(false);
  clipsRef.current = clips;

  const files = whole(filesText);
  const seconds = whole(minText) * 60 + Math.min(59, whole(secText));
  const declared: Declared | null = files >= 1 && seconds >= 1 ? { files, seconds } : null;
  const ready = Boolean(camera && declared && workDate);
  const missingAnswer = !camera ? "Choose the camera" : files < 1 ? "Say how many files" : seconds < 1 ? "Say the total length" : null;
  const started = Boolean(camera || filesText || minText || secText || clips.length);

  const ordered = useMemo(() => sortByCamera(clips), [clips]);
  const focus = ordered.find((clip) => clip.id === focusId) ?? ordered[0] ?? null;
  const series = useMemo(() => readSeries(clips), [clips]);

  const repeats = useMemo(() => {
    const seen = new Map<string, string>();
    for (const batch of batches) {
      const day = dayName(batchDay(batch));
      for (const clip of batch.clips) seen.set(`${clip.name}:${clip.sizeBytes ?? clip.blob?.size ?? 0}`, day);
    }
    return clips.flatMap((clip) => {
      const day = seen.get(`${clip.name}:${clip.sizeBytes}`);
      return day ? [{ id: clip.id, name: clip.name, day }] : [];
    });
  }, [batches, clips]);

  const otherDays = useMemo(
    () => clips.filter((clip) => clip.recordedAt && dayKeyOf(new Date(clip.recordedAt)) !== workDate).length,
    [clips, workDate],
  );

  const checks: Check[] = useMemo(() => {
    if (!declared || clips.length === 0) return [];
    const list = [
      filesCheck(declared, clips.length),
      lengthCheck(
        declared,
        clips.map((clip) => clip.seconds),
        clips.filter((clip) => clip.unreadable).length,
      ),
      orderCheck(series, explanation),
    ];
    const repeat = repeatCheck(repeats);
    return repeat ? [...list, repeat] : list;
  }, [declared, clips, series, explanation, repeats]);

  const needsExplanation = series.kind === "mixed" || (series.kind === "run" && series.missing.length > 0);
  const canContinue = checks.length > 0 && checks.every((check) => check.tone === "ok" || check.tone === "warn");
  const canCertify = canContinue && attest.every(Boolean) && Boolean(signature);
  const measuredSeconds = clips.some((clip) => clip.seconds == null)
    ? null
    : clips.reduce((sum, clip) => sum + (clip.seconds ?? 0), 0);

  useEffect(() => () => {
    for (const clip of clipsRef.current) URL.revokeObjectURL(clip.url);
    const last = latest.current;
    if (last && !stopped.current) {
      void saveDraft(last.draft).catch(() => {});
      draftRef.current(last);
    }
  }, []);

  useEffect(() => {
    if (!started || stopped.current) {
      latest.current = null;
      return;
    }
    const draft: VideoDraft = {
        key,
        caseId,
        signerName,
        updatedAt: new Date().toISOString(),
        step,
        workDate,
        camera,
        filesText,
        minText,
        secText,
        declaredFirst,
        explanation,
        attest,
        clipIds: clips.map((clip) => clip.id),
        clipMeta: Object.fromEntries(
          clips.map((clip) => [
            clip.id,
            { seconds: clip.seconds, recordedAt: clip.recordedAt, unreadable: clip.unreadable, inClientVideo: clip.inClientVideo, leftOutReason: clip.leftOutReason },
          ]),
        ),
      };
    latest.current = {
      draft,
      clips: clips.map((clip) => ({ id: clip.id, draftKey: key, name: clip.name, sizeBytes: clip.sizeBytes, blob: clip.blob })),
    };
    const timer = window.setTimeout(() => {
      if (stopped.current || !latest.current) return;
      void saveDraft(draft).catch(() => setError("Your answers could not be kept for later."));
      draftRef.current(latest.current);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [started, key, caseId, signerName, step, workDate, camera, filesText, minText, secText, declaredFirst, explanation, attest, clips]);

  const addFiles = (list: FileList | null) => {
    const picked = list ? [...list] : [];
    if (fileRef.current) fileRef.current.value = "";
    if (!ready || step !== "identify" || picked.length === 0) return;
    const have = new Set(clipsRef.current.map((clip) => `${clip.name}:${clip.sizeBytes}`));
    const fresh = picked.filter((file) => {
      const id = `${file.name}:${file.size}`;
      if (have.has(id)) return false;
      have.add(id);
      return true;
    });
    setSkipped(picked.length - fresh.length);
    if (fresh.length === 0) return;
    if (!declaredFirst && declared) setDeclaredFirst(declared);
    setEditing(false);
    const next: UploadClip[] = fresh.map((file) => toClip(newId(), file.name, file.size, file));
    setClips((current) => [...current, ...next]);
    for (const clip of next) {
      void putDraftClip({ id: clip.id, draftKey: key, name: clip.name, sizeBytes: clip.sizeBytes, blob: clip.blob }).catch(() =>
        setError("A file could not be kept for later. It is still here for now."),
      );
      void readRecordedAt(clip.blob).then((at) => {
        if (at) patchClip(clip.id, (item) => (item.recordedAt ? item : { ...item, recordedAt: at.toISOString() }));
      });
    }
  };

  const patchClip = (id: string, change: (clip: UploadClip) => UploadClip) =>
    setClips((current) => current.map((clip) => (clip.id === id ? change(clip) : clip)));

  const noteDuration = (id: string, value: number) =>
    patchClip(id, (clip) => (clip.seconds == null && value > 0 ? { ...clip, seconds: value } : clip));

  const noteUnreadable = (id: string) => patchClip(id, (clip) => (clip.seconds == null ? { ...clip, unreadable: true } : clip));

  const removeClip = (id: string) => {
    if (step !== "identify") return;
    setClips((current) => {
      const clip = current.find((item) => item.id === id);
      if (clip) URL.revokeObjectURL(clip.url);
      return current.filter((item) => item.id !== id);
    });
    void deleteDraftClip(id).catch(() => {});
  };

  const setLeftOut = (id: string, reason: LeftOutReason | null) =>
    patchClip(id, (clip) => ({ ...clip, inClientVideo: reason == null, leftOutReason: reason }));

  const certify = async () => {
    if (!canCertify || !declared || !camera || sealing) return;
    stopped.current = true;
    setSealing(true);
    setError(null);
    const jobId = newId();
    const list = ordered;
    const now = new Date().toISOString();
    startJob({ id: jobId, caseId, day: workDate, files: list.length });
    try {
      const sealed: UploadClip[] = [];
      for (const clip of list) {
        if (abortSeal.current) return;
        sealed.push({ ...clip, sha256: await sha256(clip.blob) });
        stepJob(jobId, sealed.length);
      }
      if (abortSeal.current) return;
      const batch: SavedBatch = {
        id: newId(),
        caseId,
        signerName,
        certifiedAt: now,
        minutes: Math.max(1, Math.round(declared.seconds / 60)),
        measured: measuredSeconds == null ? null : Math.max(1, Math.round(measuredSeconds / 60)),
        sentOn: {},
        storeOn: {},
        workDate,
        camera,
        declared,
        declaredFirst: declaredFirst ?? declared,
        measuredSeconds,
        series: {
          first: series.kind === "run" ? series.first : null,
          last: series.kind === "run" ? series.last : null,
          missing: series.kind === "run" ? series.missing : [],
          explanation: needsExplanation ? explanation.trim() : null,
        },
        attest: [...ATTEST],
        signature: signature ?? "",
        service,
        state,
        flag: null,
        storage: "staging",
        coldAt: null,
        sends: [],
        clips: sealed.map((clip) => ({
          id: clip.id,
          name: clip.name,
          kind: clip.kind,
          sizeBytes: clip.sizeBytes,
          number: clip.number,
          seconds: clip.seconds,
          recordedAt: clip.recordedAt,
          sha256: clip.sha256,
          inClientVideo: clip.inClientVideo,
          leftOutReason: clip.leftOutReason,
          blob: clip.blob,
        })),
      };
      await saveBatch(batch);
      await clearDraft(key).catch(() => {});
      latest.current = null;
      draftRef.current(null);
      sealedRef.current(workDate);
    } catch {
      stopped.current = false;
      setError("Could not keep these clips on the case. Nothing was lost. Try again.");
    } finally {
      endJob(jobId);
      setSealing(false);
    }
  };

  const discard = async () => {
    abortSeal.current = true;
    stopped.current = true;
    latest.current = null;
    await clearDraft(key).catch(() => {});
    draftRef.current(null);
  };

  return {
    fileRef,
    step,
    setStep,
    workDate,
    setWorkDate,
    camera,
    setCamera,
    filesText,
    setFilesText,
    minText,
    setMinText,
    secText,
    setSecText,
    declared,
    declaredFirst,
    editing,
    setEditing,
    ready,
    missingAnswer,
    clips: ordered,
    focus,
    setFocusId,
    series,
    checks,
    needsExplanation,
    explanation,
    setExplanation,
    repeatIds: new Set(repeats.map((item) => item.id)),
    otherDays,
    skipped,
    canContinue,
    attest,
    toggleAttest: (index: number) => setAttest((current) => current.map((value, i) => (i === index ? !value : value))),
    signature,
    setSignature,
    signKey,
    resetSignature: () => {
      setSignature(null);
      setSignKey((value) => value + 1);
    },
    canCertify,
    measuredSeconds,
    sealing,
    error,
    dragging,
    setDragging,
    addFiles,
    noteDuration,
    noteUnreadable,
    removeClip,
    setLeftOut,
    certify,
    discard,
    /** True once any answer or file is in, or while the upload is being saved. */
    dirty: started || sealing,
    openPicker: () => ready && step === "identify" && fileRef.current?.click(),
  };
}

export type VideoUpload = ReturnType<typeof useVideoUpload>;

function restore({ draft, clips }: Resume): UploadClip[] {
  const byId = new Map(clips.map((clip) => [clip.id, clip]));
  return draft.clipIds.flatMap((id) => {
    const stored = byId.get(id);
    if (!stored) return [];
    const meta = draft.clipMeta[id];
    const clip = toClip(id, stored.name, stored.sizeBytes, stored.blob);
    return [meta ? { ...clip, ...meta } : clip];
  });
}

function toClip(id: string, name: string, sizeBytes: number, blob: Blob): UploadClip {
  return {
    id,
    name,
    kind: kindLabel(name),
    sizeBytes,
    url: URL.createObjectURL(blob),
    blob,
    number: readNumber(name)?.number ?? null,
    seconds: null,
    recordedAt: null,
    unreadable: false,
    sha256: null,
    inClientVideo: true,
    leftOutReason: null,
  };
}

async function sha256(blob: Blob) {
  if (blob.size > HASH_LIMIT_BYTES || typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

function whole(value: string) {
  return /^\d+$/.test(value) ? Number(value) : 0;
}

export function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function kindLabel(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ext && ext.length <= 4 && ext !== name.toLowerCase() ? ext.toUpperCase() : "VIDEO";
}

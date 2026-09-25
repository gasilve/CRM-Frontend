import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Vapi from "@vapi-ai/web";
import { Loader2, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import {
  ApiError,
  voiceIntakeApi,
  type CaseDay,
  type VoiceDraft,
  type VoiceIntakeSession,
} from "@/lib/crm-api";

type Phase = "loading" | "ready" | "mic-denied" | "connecting" | "active" | "processing" | "review" | "recovery";

const blanksFor = (draft: VoiceDraft | null): string[] => {
  if (!draft) return ["Location", "Main update", "Injury or mobility", "Video"];
  const blanks: string[] = [];
  if (!draft.reportLocation) blanks.push("Location");
  if (!draft.injuryMobilityObservation) blanks.push("Injury or mobility");
  if (!draft.videoCaptured) blanks.push("Video");
  if (draft.videoCaptured === "yes" && !draft.videoApproxDuration) blanks.push("Video duration");
  if (draft.videoCaptured === "yes" && draft.videoActivities.length === 0) blanks.push("Video activities");
  return blanks;
};

export function VoiceIntakePanel({
  caseId,
  caseNumber,
  subjectName,
  workDate,
  onClose,
  onApproved,
}: {
  caseId: string;
  caseNumber: string;
  subjectName: string;
  workDate: string;
  onClose: () => void;
  onApproved: (days: CaseDay[]) => void;
}) {
  const vapiRef = useRef<Vapi | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<VoiceIntakeSession | null>(null);
  const [narrative, setNarrative] = useState("");
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [waited, setWaited] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speaker, setSpeaker] = useState<"alejandro" | "you" | null>(null);
  const callStarted = useRef<number | null>(null);

  const applySession = (next: VoiceIntakeSession) => {
    sessionIdRef.current = next.id;
    setSession(next);
    if (next.status === "needs_review" || next.status === "approved") {
      setNarrative(next.draft?.narrativeNote ?? "");
      setPhase("review");
      return;
    }
    if (next.status === "processing") setPhase("processing");
    else if (next.status === "failed" || next.status === "abandoned") setPhase("recovery");
  };

  useEffect(() => {
    let cancelled = false;
    voiceIntakeApi
      .list(caseId)
      .then((res) => {
        if (cancelled) return;
        const open = res.sessions.find((row) => row.status === "needs_review" || row.status === "processing" || row.status === "active");
        if (!open) {
          setPhase("ready");
          return;
        }
        applySession(open);
        if (open.status === "active") setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  useEffect(() => {
    if (phase !== "processing" || !sessionIdRef.current) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      if (Date.now() - started > 20_000) setWaited(true);
      void voiceIntakeApi.get(caseId, sessionId).then((res) => applySession(res.session)).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [phase, caseId]);

  useEffect(() => {
    if (phase !== "active") return;
    callStarted.current = callStarted.current ?? Date.now();
    const timer = window.setInterval(() => {
      if (callStarted.current) setElapsed(Date.now() - callStarted.current);
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    return () => {
      vapiRef.current?.stop();
      vapiRef.current?.removeAllListeners();
      vapiRef.current = null;
    };
  }, []);

  const clock = `${Math.floor(elapsed / 1000 / 60)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")}`;

  const ensureClient = () => {
    if (!vapiRef.current) vapiRef.current = new Vapi("join-only");
    return vapiRef.current;
  };

  const beginCall = async () => {
    setBusy(true);
    setMessage(null);
    setPhase("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setPhase("mic-denied");
      setBusy(false);
      return;
    }

    try {
      const started = await voiceIntakeApi.start(caseId, workDate);
      if (!started.join) throw new ApiError("The voice call did not return a connection.", 502);
      applySession(started.session);
      const vapi = ensureClient();
      vapi.removeAllListeners();
      vapi.on("call-start", () => {
        setPhase("active");
        setBusy(false);
        setSpeaker("alejandro");
      });
      vapi.on("speech-start", () => setSpeaker("alejandro"));
      vapi.on("speech-end", () => setSpeaker("you"));
      vapi.on("call-end", () => {
        setPhase("processing");
        setBusy(false);
        const sessionId = sessionIdRef.current;
        if (sessionId) void voiceIntakeApi.hangup(caseId, sessionId).catch(() => undefined);
      });
      vapi.on("error", () => {
        setMessage("The call dropped. A partial draft is kept if anything was captured.");
        setPhase("recovery");
        setBusy(false);
        const sessionId = sessionIdRef.current;
        if (sessionId) void voiceIntakeApi.hangup(caseId, sessionId).catch(() => undefined);
      });
      await vapi.reconnect({ webCallUrl: started.join.webCallUrl, id: started.join.callId });
      setPhase("active");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not start the voice call.");
      setPhase("recovery");
    } finally {
      setBusy(false);
    }
  };

  const endCall = () => {
    setMuted(false);
    vapiRef.current?.stop();
  };

  const toggleMute = () => {
    const next = !muted;
    vapiRef.current?.setMuted(next);
    setMuted(next);
  };

  const approve = async () => {
    if (!session) return;
    const text = narrative.trim();
    if (!text) {
      setMessage("Write the note before approving it.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const saved = await voiceIntakeApi.approve(caseId, session.id, session.draftVersion, text);
      onApproved(saved.days);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const fresh = await voiceIntakeApi.get(caseId, session.id).catch(() => null);
        if (fresh?.session.status === "approved") {
          onClose();
          return;
        }
        if (fresh) applySession(fresh.session);
      }
      setMessage(err instanceof ApiError ? err.message : "Could not approve the note.");
    } finally {
      setBusy(false);
    }
  };

  const blanks = blanksFor(session?.draft ?? null);

  const statusLine =
    phase === "loading"
      ? "Opening…"
      : phase === "connecting"
        ? "Calling…"
        : phase === "active"
          ? muted
            ? "Muted"
            : speaker === "alejandro"
              ? "Alejandro is talking"
              : "Listening"
          : phase === "processing"
            ? "Writing the note…"
            : phase === "review"
              ? "Call ended"
              : phase === "mic-denied"
                ? "Microphone blocked"
                : phase === "recovery"
                  ? "Call dropped"
                  : "Intake line";

  const wide = phase === "review";

  return createPortal(
    <div className="fixed inset-0 z-100 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
      <div
        className={`flex max-h-[min(92vh,46rem)] flex-col overflow-hidden rounded-[2.75rem] border border-white/10 bg-[#0b0d12] text-white shadow-[0_30px_80px_rgba(0,0,0,0.55)] ${wide ? "w-[min(36rem,96vw)]" : "h-[min(40rem,92vh)] w-[min(23rem,92vw)]"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-intake-title"
      >
        <div className="mx-auto mt-3 h-1.5 w-24 rounded-full bg-white/15" />
        <div className="flex items-center justify-between px-6 pt-4">
          <span className="font-mono text-[0.6875rem] tracking-wide text-white/45">{phase === "active" ? clock : "Alejandro"}</span>
          <button
            type="button"
            onClick={() => {
              if (phase === "active") endCall();
              onClose();
            }}
            className="text-[0.75rem] text-white/50 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center px-6 pb-8 pt-6">
          <div
            className={`grid h-24 w-24 place-items-center rounded-full bg-[#1c2333] text-white ${phase === "active" && speaker === "alejandro" ? "ring-4 ring-[#4ade80]/40" : ""}`}
          >
            {phase === "connecting" || phase === "loading" || phase === "processing" ? (
              <Loader2 size={28} className="animate-spin text-white/70" />
            ) : (
              <Phone size={28} strokeWidth={1.7} />
            )}
          </div>
          <h2 id="voice-intake-title" className="mt-5 text-[1.35rem] font-semibold tracking-tight">
            Alejandro
          </h2>
          <p className="mt-1 max-w-[16rem] truncate text-center text-[0.875rem] text-white/55">
            {caseNumber} · {subjectName}
          </p>
          <p className={`mt-3 font-mono text-[0.8125rem] ${phase === "active" ? "text-[#4ade80]" : "text-white/45"}`}>{statusLine}</p>

          <div className="mt-auto flex w-full flex-col items-center gap-4">
            {(phase === "ready" || phase === "mic-denied" || phase === "recovery") && (
              <>
                <p className="text-center text-[0.8125rem] leading-relaxed text-white/45">
                  Transcribed for you to review. Nothing is saved until you approve the note.
                </p>
                {phase === "mic-denied" && (
                  <p className="text-center text-[0.8125rem] text-[#fb923c]">Allow the microphone, or type the update in the journal.</p>
                )}
                {phase === "recovery" && (
                  <p className="text-center text-[0.8125rem] text-[#fb923c]">{message ?? "The call dropped. Try again, or type the update."}</p>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void beginCall()}
                  aria-label="Start call"
                  className="grid h-16 w-16 place-items-center rounded-full bg-[#22c55e] text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 size={22} className="animate-spin" /> : <Phone size={24} />}
                </button>
              </>
            )}

            {phase === "active" && (
              <div className="flex items-center gap-8">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute" : "Mute"}
                  className={`grid h-14 w-14 place-items-center rounded-full ${muted ? "bg-white text-[#0b0d12]" : "bg-white/10 text-white"}`}
                >
                  {muted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button
                  type="button"
                  onClick={endCall}
                  aria-label="End call"
                  className="grid h-16 w-16 place-items-center rounded-full bg-[#ef4444] text-white"
                >
                  <PhoneOff size={24} />
                </button>
              </div>
            )}

            {phase === "processing" && waited && (
              <p className="text-center text-[0.8125rem] text-white/45">Still writing. The draft stays on the case when it is ready.</p>
            )}
          </div>
        </div>

        {phase === "review" && session && (
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/10 px-5 py-4">
            <p className="mb-3 text-[0.8125rem] text-white/55">
              Saved to the journal for {session.workDate}. Change it here or later in the journal, then close.
            </p>
            {blanks.length > 0 && <p className="mb-2 text-[0.75rem] text-white/40">Not captured: {blanks.join(", ")}.</p>}
            {session.draft?.discrepancies && session.draft.discrepancies.length > 0 && (
              <p className="mb-2 text-[0.75rem] text-[#fb923c]">{session.draft.discrepancies.join("; ")}</p>
            )}
            <textarea
              value={narrative}
              onChange={(event) => setNarrative(event.target.value)}
              rows={7}
              className="w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[0.875rem] text-white outline-none"
            />
            {session.transcript && session.transcript.length > 0 && (
              <ul className="mt-3 flex max-h-36 flex-col gap-2 overflow-y-auto">
                {session.transcript.map((turn, index) => (
                  <li key={index} className="text-[0.75rem] leading-snug text-white/50">
                    <span className="text-white/80">{turn.speaker}: </span>
                    {turn.text}
                  </li>
                ))}
              </ul>
            )}
            {message && <p className="mt-2 text-[0.75rem] text-[#fb923c]">{message}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-[0.8125rem] text-white/70">
                Close
              </button>
              <button
                type="button"
                disabled={busy || narrative.trim() === (session.draft?.narrativeNote ?? "").trim()}
                onClick={() => void approve()}
                className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[0.8125rem] font-medium text-[#0b0d12] disabled:opacity-40"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                Save changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

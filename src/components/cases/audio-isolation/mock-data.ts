/** Sample Audio Isolation payload (speaker sep + labels + transcript). */

export type AudioIsoStepStatus = "done" | "running" | "pending" | "skipped";

export type AudioIsoPipelineStep = {
  id: string;
  label: string;
  status: AudioIsoStepStatus;
  detail: string;
  summary: string;
  hits: string[];
};

export type AudioJobStatus = "queued" | "preview" | "running" | "done" | "failed";

export type AudioSpeaker = {
  id: string;
  label: string;
  color: string;
  duration_s: number;
  merged_into?: string | null;
};

export type TranscriptLine = {
  t: string;
  speaker_id: string;
  text: string;
};

export type AudioIsolationJob = {
  id: string;
  source: string;
  source_kind: "video clip" | "audio file";
  recorded_at: string;
  duration_s: number;
  status: AudioJobStatus;
  gpu: boolean;
  speakers: AudioSpeaker[];
  transcript: TranscriptLine[];
  detail: string;
};

export type AudioIsolationView = {
  investigation_id: number;
  subject: { name: string; claim: string; city: string; state: string };
  pipeline: AudioIsoPipelineStep[];
  jobs: AudioIsolationJob[];
  notes: string;
  gpu_busy: boolean;
};

export const MOCK_AUDIO_ISO: AudioIsolationView = {
  investigation_id: 185,
  subject: {
    name: "Karen Suley Cisneros",
    claim: "DEMO-OSINT-185",
    city: "Long Beach",
    state: "CA",
  },
  pipeline: [
    {
      id: "ingest",
      label: "Source",
      status: "done",
      detail: "2 jobs",
      summary: "Pulls a ready field clip, or a standalone audio file.",
      hits: ["Video clip · ready custody", "Standalone wav/m4a", "SHA stays on the source row"],
    },
    {
      id: "isolate",
      label: "Isolate",
      status: "running",
      detail: "GPU",
      summary: "POST /api/audio/isolate — speaker separation. Unloads Ollama while the GPU is busy.",
      hits: ["Preview pass (fast)", "Full process", "Stems per speaker"],
    },
    {
      id: "label",
      label: "Label",
      status: "pending",
      detail: "Speakers",
      summary: "Name speakers, merge duplicates, drop noise. Labels travel with the transcript.",
      hits: ["Rename", "Merge A→B", "Mark noise / skip"],
    },
    {
      id: "transcript",
      label: "Transcript",
      status: "pending",
      detail: "Per job",
      summary: "Timed lines per speaker. Export with the isolation package.",
      hits: ["Whisper / GPU", "Speaker-attributed lines", "Download txt / json"],
    },
    {
      id: "export",
      label: "Export",
      status: "pending",
      detail: "Stems",
      summary: "Download isolated stems + transcript. Video upload/custody stays on Video.",
      hits: ["WAV stems", "Transcript", "Job report hash"],
    },
  ],
  jobs: [
    {
      id: "a1",
      source: "2026-10-12_LB_front_yard.mp4",
      source_kind: "video clip",
      recorded_at: "2026-10-12T14:08:00Z",
      duration_s: 742,
      status: "done",
      gpu: false,
      speakers: [
        { id: "s1", label: "Subject", color: "#f472b6", duration_s: 418 },
        { id: "s2", label: "Neighbor", color: "#38bdf8", duration_s: 186 },
        { id: "s3", label: "Passerby", color: "#fbbf24", duration_s: 41 },
      ],
      transcript: [
        { t: "14:08:12", speaker_id: "s2", text: "You doing okay with the cans?" },
        { t: "14:08:16", speaker_id: "s1", text: "Yeah I got it. Just taking it slow." },
        { t: "14:08:22", speaker_id: "s2", text: "Trash day always kills my back." },
        { t: "14:08:41", speaker_id: "s3", text: "Morning." },
      ],
      detail: "3 speakers labeled · transcript ready",
    },
    {
      id: "a2",
      source: "2026-10-13_pharmacy_lot.mp4",
      source_kind: "video clip",
      recorded_at: "2026-10-13T16:41:00Z",
      duration_s: 318,
      status: "running",
      gpu: true,
      speakers: [],
      transcript: [],
      detail: "Full isolate · GPU 41%",
    },
    {
      id: "a3",
      source: "voicemail_2026-10-11.m4a",
      source_kind: "audio file",
      recorded_at: "2026-10-11T19:02:00Z",
      duration_s: 94,
      status: "queued",
      gpu: false,
      speakers: [],
      transcript: [],
      detail: "Waiting on GPU",
    },
  ],
  notes: "Yard clip is the WC mobility take. Pharmacy lot still isolating.",
  gpu_busy: true,
};

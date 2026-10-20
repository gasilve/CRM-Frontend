/** Sample Forensic Collection payload (mirrors Prodigy forensic capture + CoC). */

export type ForensicStepStatus = "done" | "running" | "pending" | "skipped";

export type ForensicPipelineStep = {
  id: string;
  label: string;
  status: ForensicStepStatus;
  detail: string;
  summary: string;
  hits: string[];
};

export type ForensicMediaType = "screenshot" | "recording";

export type ForensicCapture = {
  id: string;
  smc: string;
  media_type: ForensicMediaType;
  platform: string;
  url: string;
  page_title: string;
  captured_at: string;
  collector: string;
  url_hash: string;
  content_hash: string;
  is_relevant: boolean;
  images_extracted: number;
  has_wacz: boolean;
  has_html: boolean;
};

export type ForensicView = {
  investigation_id: number;
  subject: { name: string; claim: string; city: string; state: string };
  collector: { name: string; title: string };
  session_id: string;
  pipeline: ForensicPipelineStep[];
  captures: ForensicCapture[];
  notes: string;
  counts: {
    total: number;
    relevant: number;
    screenshots: number;
    recordings: number;
  };
  export: {
    zip_ready: boolean;
    pdf_ready: boolean;
    immutable: boolean;
    last_export: string | null;
  };
};

export const MOCK_FORENSIC: ForensicView = {
  investigation_id: 185,
  subject: {
    name: "Karen Suley Cisneros",
    claim: "DEMO-OSINT-185",
    city: "Long Beach",
    state: "CA",
  },
  collector: { name: "Sol Rivera", title: "Senior Investigator" },
  session_id: "fx-sess-20261019-a1",
  pipeline: [
    {
      id: "extension",
      label: "Extension",
      status: "done",
      detail: "Firefox linked",
      summary: "Prodigy Forensic extension authenticated; session token refreshed every 30s.",
      hits: [
        "Auth · X-Session-Token ok",
        "Platforms · FB · IG · TikTok · LinkedIn · X",
        "Session · fx-sess-20261019-a1",
      ],
    },
    {
      id: "capture",
      label: "Capture",
      status: "done",
      detail: "6 items",
      summary: "Screenshot (visible tab + HTML) or Record (scroll frames → stitched PNG + WACZ).",
      hits: [
        "Screenshots · 4",
        "Recordings · 2 (WACZ + resources)",
        "HTML ≤ 5MB on screenshot path",
      ],
    },
    {
      id: "hash",
      label: "Chain of custody",
      status: "done",
      detail: "SHA-256",
      summary: "url_hash + content_hash (PNG bytes). Export adds SHA256SUMS.txt for every file.",
      hits: [
        "url_hash · SHA-256 of URL string",
        "content_hash · SHA-256 of PNG bytes",
        "Timestamps stored UTC · shown Pacific",
      ],
    },
    {
      id: "relevant",
      label: "Mark relevant",
      status: "running",
      detail: "4 of 6",
      summary: "Only is_relevant=true captures enter export ZIP and PDF report.",
      hits: ["Relevant · 4", "Held back · 2", "Images extracted · 18"],
    },
    {
      id: "export",
      label: "Export / report",
      status: "pending",
      detail: "ZIP · PDF",
      summary: "export-case ZIP + signed forensic PDF (pyHanko · FreeTSA RFC 3161).",
      hits: [
        "ZIP · recordings/ + screenshots/ + metadata.json",
        "PDF · cover · evidence pages · CoC · signature",
        "Promote → immutable-social-media (7yr Object Lock)",
      ],
    },
  ],
  captures: [
    {
      id: "c1",
      smc: "SMC-001",
      media_type: "recording",
      platform: "Facebook",
      url: "https://www.facebook.com/karen.cisneros.profile",
      page_title: "Karen Cisneros — Profile",
      captured_at: "2026-10-14T18:22:11Z",
      collector: "Sol Rivera",
      url_hash: "a3f1c8e2…9b01",
      content_hash: "7d44e190…c2af",
      is_relevant: true,
      images_extracted: 6,
      has_wacz: true,
      has_html: true,
    },
    {
      id: "c2",
      smc: "SMC-002",
      media_type: "screenshot",
      platform: "Instagram",
      url: "https://www.instagram.com/karencisneros/",
      page_title: "karencisneros",
      captured_at: "2026-10-14T18:31:04Z",
      collector: "Sol Rivera",
      url_hash: "b81a02dd…44e0",
      content_hash: "1c90ff32…ab71",
      is_relevant: true,
      images_extracted: 9,
      has_wacz: false,
      has_html: true,
    },
    {
      id: "c3",
      smc: "SMC-003",
      media_type: "screenshot",
      platform: "TikTok",
      url: "https://www.tiktok.com/@karencisneros",
      page_title: "@karencisneros",
      captured_at: "2026-10-15T15:02:40Z",
      collector: "Sol Rivera",
      url_hash: "09ee5a11…77c3",
      content_hash: "f2b6c441…0912",
      is_relevant: true,
      images_extracted: 2,
      has_wacz: false,
      has_html: true,
    },
    {
      id: "c4",
      smc: "SMC-004",
      media_type: "recording",
      platform: "LinkedIn",
      url: "https://www.linkedin.com/in/karen-cisneros",
      page_title: "Karen Cisneros | LinkedIn",
      captured_at: "2026-10-15T16:18:22Z",
      collector: "Sol Rivera",
      url_hash: "55c0d8aa…e190",
      content_hash: "88a1b003…d4fe",
      is_relevant: true,
      images_extracted: 1,
      has_wacz: true,
      has_html: true,
    },
    {
      id: "c5",
      smc: "SMC-005",
      media_type: "screenshot",
      platform: "X",
      url: "https://x.com/karencisneros",
      page_title: "Karen (@karencisneros)",
      captured_at: "2026-10-16T12:05:01Z",
      collector: "Sol Rivera",
      url_hash: "c41190ef…2a18",
      content_hash: "0e77b2cd…91aa",
      is_relevant: false,
      images_extracted: 0,
      has_wacz: false,
      has_html: true,
    },
    {
      id: "c6",
      smc: "SMC-006",
      media_type: "screenshot",
      platform: "Facebook",
      url: "https://www.facebook.com/photo/?fbid=…",
      page_title: "Photo",
      captured_at: "2026-10-16T12:11:48Z",
      collector: "Sol Rivera",
      url_hash: "d9a2ff01…6c40",
      content_hash: "3b19e8a7…55d0",
      is_relevant: false,
      images_extracted: 0,
      has_wacz: false,
      has_html: true,
    },
  ],
  notes: "Focus on mobility / outdoor activity posts. Ignore duplicate album thumb.",
  counts: { total: 6, relevant: 4, screenshots: 4, recordings: 2 },
  export: {
    zip_ready: false,
    pdf_ready: false,
    immutable: false,
    last_export: null,
  },
};

/** Sample candidates-view payload (Karen Cisneros) for the Skyview OSINT mockup. */

export type OsintSignal = { earned: number; max: number; note: string };

export type OsintCandidate = {
  handle: string;
  platform: string;
  url: string;
  score: number;
  photo_minio: string | null;
  photo_gender: string | null;
  photo_age: number | null;
  has_photo: boolean;
  tf_bits: number;
  finding_id: number;
  signals: Record<string, OsintSignal>;
  sherlock?: Record<string, string>;
};

export type OsintEvidence = {
  username: string;
  platforms: string[];
  max_conf: number;
  validated: boolean;
  photo_minio: string | null;
  findings: {
    id: number;
    platform: string;
    url: string;
    content: string;
    confidence: number;
    status: string;
    type: string;
    signals: string[];
    tf_bits: number;
    photo_minio: string | null;
  }[];
};

export type OsintPeopleRecord = {
  engine: string;
  content: string;
  url: string;
  confidence: number;
};

export type OsintSubject = {
  name: string;
  dob: string;
  city: string;
  state: string;
};

export type OsintStepStatus = "done" | "running" | "pending" | "skipped";

export type OsintPipelineStep = {
  id: string;
  label: string;
  status: OsintStepStatus;
  detail: string;
  /** Short what-this-step-did blurb for the step modal. */
  summary: string;
  /** Concrete hits / actions shown as a list in the step modal. */
  hits: string[];
};

export type OsintPhoto = {
  id: string;
  platform: string;
  handle: string;
  photo_minio: string;
  source_url: string;
  face_score: number | null;
};

export type OsintWhatsapp = {
  status: "found" | "not_found" | "unchecked";
  phone: string | null;
  profile_url: string | null;
  note: string;
};

export type OsintFindingRow = {
  id: number;
  platform: string;
  handle: string;
  type: string;
  content: string;
  confidence: number;
  status: string;
  url: string;
};

export type OsintView = {
  investigation_id: number;
  subject: OsintSubject;
  candidates: OsintCandidate[];
  evidence: OsintEvidence[];
  mentions_count: number;
  people_records: OsintPeopleRecord[];
  pipeline: OsintPipelineStep[];
  photos: OsintPhoto[];
  whatsapp: OsintWhatsapp;
  notes: string;
  findings: OsintFindingRow[];
};

export const PHOTO_BASE = "https://osint.proti.ai/osint-photos";

export const MOCK_OSINT: OsintView = {
  investigation_id: 185,
  subject: {
    name: "Karen Suley Cisneros",
    dob: "1990-02-15",
    city: "Long Beach",
    state: "CA",
  },
  candidates: [
    {
      handle: "karencisneros",
      platform: "twitter",
      url: "https://twitter.com/karencisneros",
      score: 95,
      photo_minio: "investigation_185/candidate_1da2650f.jpg",
      photo_gender: "F",
      photo_age: 39,
      has_photo: true,
      tf_bits: 37.8,
      finding_id: 54887,
      signals: {
        gender_match: { earned: 20, max: 20, note: "photo=female subject=female → ✓" },
        age_match: { earned: 20, max: 20, note: "photo_age=39 subject_age≈36 diff=3yr" },
        city_match: { earned: 15, max: 15, note: "found: ['Long Beach', 'CA']" },
        dob_mention: { earned: 10, max: 10, note: "found: ['year 1990']" },
        name_score: { earned: 10, max: 10, note: "tf_bits=37.8" },
        language_ok: { earned: 10, max: 10, note: "lang=en → ✓" },
        activity_ok: { earned: 5, max: 5, note: "followers=645 posts=814" },
        face_cluster: { earned: 0, max: 10, note: "not yet computed" },
      },
      sherlock: {
        TikTok: "https://tiktok.com/@karencisneros",
        Instagram: "https://instagram.com/karencisneros",
      },
    },
    {
      handle: "karen.s.cisneros",
      platform: "instagram",
      url: "https://instagram.com/karen.s.cisneros",
      score: 62,
      photo_minio: "investigation_185/candidate_ig_a3.jpg",
      photo_gender: "F",
      photo_age: 34,
      has_photo: true,
      tf_bits: 18.2,
      finding_id: 54890,
      signals: {
        city_match: { earned: 15, max: 15, note: "bio: Long Beach" },
        name_score: { earned: 10, max: 10, note: "tf_bits=18.2" },
        language_ok: { earned: 10, max: 10, note: "lang=en" },
        activity_ok: { earned: 5, max: 5, note: "posts=42" },
        gender_match: { earned: 10, max: 20, note: "photo=female" },
        age_match: { earned: 10, max: 20, note: "photo_age≈34" },
        dob_mention: { earned: 0, max: 10, note: "none" },
        face_cluster: { earned: 0, max: 10, note: "not yet computed" },
      },
    },
    {
      handle: "kc1990lb",
      platform: "facebook",
      url: "https://facebook.com/kc1990lb",
      score: 48,
      photo_minio: null,
      photo_gender: null,
      photo_age: null,
      has_photo: false,
      tf_bits: 12.4,
      finding_id: 54891,
      signals: {
        dob_mention: { earned: 10, max: 10, note: "handle year 1990" },
        city_match: { earned: 15, max: 15, note: "lb in handle" },
        name_score: { earned: 3, max: 10, note: "weak initials" },
        language_ok: { earned: 10, max: 10, note: "lang=en" },
        gender_match: { earned: 0, max: 20, note: "no photo" },
        age_match: { earned: 0, max: 20, note: "no photo" },
        activity_ok: { earned: 0, max: 5, note: "inactive" },
        face_cluster: { earned: 0, max: 10, note: "not yet computed" },
      },
    },
  ],
  evidence: [
    {
      username: "karencisneros",
      platforms: ["Twitter", "Instagram", "Facebook", "TikTok"],
      max_conf: 0.95,
      validated: false,
      photo_minio: "investigation_185/candidate_1da2650f.jpg",
      findings: [
        {
          id: 54887,
          platform: "twitter",
          url: "https://twitter.com/karencisneros",
          content: "Karen Cisneros · Long Beach · 645 followers",
          confidence: 0.95,
          status: "pending",
          type: "profile",
          signals: ["email_local", "username", "name"],
          tf_bits: 37.8,
          photo_minio: "investigation_185/candidate_1da2650f.jpg",
        },
      ],
    },
  ],
  mentions_count: 664,
  people_records: [
    {
      engine: "spokeo",
      content: "Name: Karen Suley Cisneros | Age: 36 | Location: Long Beach, CA",
      url: "https://spokeo.com/Karen-Cisneros",
      confidence: 0.85,
    },
    {
      engine: "clustal",
      content: "Karen S. Cisneros · 36 · Long Beach, Los Angeles County, CA",
      url: "https://example.com/clustal/karen",
      confidence: 0.78,
    },
  ],
  pipeline: [
    {
      id: "discovery",
      label: "Discovery",
      status: "done",
      detail: "14 engines · Tier 1",
      summary: "Fast Tier-1 engines ran against name, DOB, city, and known emails/phones.",
      hits: [
        "maigret · 11 username hits queued",
        "holehe · kcisneros90@gmail.com on Twitter + Instagram",
        "searxng · 664 web mentions indexed",
        "phoneinfoga · +1 562-555-0148 carrier AT&T CA",
        "breach_search · 1 email in 2019 dump (no password shown)",
      ],
    },
    {
      id: "social",
      label: "Social profiles",
      status: "done",
      detail: "4 platforms",
      summary: "Validated and clustered social URLs into candidate handles.",
      hits: [
        "twitter.com/karencisneros · profile live · 645 followers",
        "instagram.com/karen.s.cisneros · bio Long Beach",
        "facebook.com/kc1990lb · low activity",
        "tiktok.com/@karencisneros · linked via Sherlock",
      ],
    },
    {
      id: "scoring",
      label: "Identity scoring",
      status: "done",
      detail: "3 candidates",
      summary: "Cross-correlation score: gender, age, city, DOB, name bits, activity.",
      hits: [
        "@karencisneros · 95 CONFIRMED (gender+age+city+DOB)",
        "@karen.s.cisneros · 62 POSSIBLE (city+name, weaker photo age)",
        "@kc1990lb · 48 POSSIBLE (handle year+LB only)",
        "face_cluster still pending on all three",
      ],
    },
    {
      id: "deep",
      label: "Deep search",
      status: "done",
      detail: "Tier 2 complete",
      summary: "People-search and secondary engines after social ranking.",
      hits: [
        "spokeo · Karen Suley Cisneros · 36 · Long Beach",
        "clustal · Karen S. Cisneros · LA County",
        "sherlock · TikTok + Instagram aliases for top handle",
        "court / dating · no high-confidence hits",
      ],
    },
    {
      id: "relatives",
      label: "Relatives pivot",
      status: "running",
      detail: "2 of 5 queued",
      summary: "Pivoting 1st-degree relatives from people records into fresh searches.",
      hits: [
        "queued · Cisneros, Maria (mother) — people_search",
        "queued · Cisneros, Luis (brother) — social username dorks",
        "waiting · 3 more names from Spokeo relatives block",
        "no confirmed relative social profiles yet",
      ],
    },
    {
      id: "photos",
      label: "Photo extract",
      status: "done",
      detail: "6 photos",
      summary: "Pulled profile/avatar images from social findings (conf ≥ 0.70).",
      hits: [
        "twitter · 2 photos · best face 91%",
        "instagram · 2 photos · best face 84%",
        "tiktok · 1 avatar · face 68%",
        "facebook · 1 thumb · face 41%",
        "WhatsApp scrape not run (service scaffold only)",
      ],
    },
  ],
  photos: [
    {
      id: "p1",
      platform: "twitter",
      handle: "karencisneros",
      photo_minio: "investigation_185/candidate_1da2650f.jpg",
      source_url: "https://twitter.com/karencisneros",
      face_score: 0.91,
    },
    {
      id: "p2",
      platform: "twitter",
      handle: "karencisneros",
      photo_minio: "investigation_185/tw_banner_2.jpg",
      source_url: "https://twitter.com/karencisneros/photo",
      face_score: 0.72,
    },
    {
      id: "p3",
      platform: "instagram",
      handle: "karen.s.cisneros",
      photo_minio: "investigation_185/candidate_ig_a3.jpg",
      source_url: "https://instagram.com/karen.s.cisneros",
      face_score: 0.84,
    },
    {
      id: "p4",
      platform: "instagram",
      handle: "karen.s.cisneros",
      photo_minio: "investigation_185/ig_story_4.jpg",
      source_url: "https://instagram.com/p/abc",
      face_score: null,
    },
    {
      id: "p5",
      platform: "tiktok",
      handle: "karencisneros",
      photo_minio: "investigation_185/tt_avatar.jpg",
      source_url: "https://tiktok.com/@karencisneros",
      face_score: 0.68,
    },
    {
      id: "p6",
      platform: "facebook",
      handle: "kc1990lb",
      photo_minio: "investigation_185/fb_thumb.jpg",
      source_url: "https://facebook.com/kc1990lb",
      face_score: 0.41,
    },
  ],
  whatsapp: {
    status: "found",
    phone: "+1 (562) 555-0148",
    profile_url: "https://wa.me/15625550148",
    note: "Ignorant hit on subject mobile · display name matches first+last",
  },
  notes:
    "Top Twitter handle aligns with Long Beach + 1990. IG karen.s.cisneros weaker name bits but same city. Relatives pivot still running — check sister \"Cisneros\" aliases before closing identity.",
  findings: [
    {
      id: 54887,
      platform: "twitter",
      handle: "karencisneros",
      type: "profile",
      content: "Karen Cisneros · Long Beach · 645 followers",
      confidence: 0.95,
      status: "pending",
      url: "https://twitter.com/karencisneros",
    },
    {
      id: 54890,
      platform: "instagram",
      handle: "karen.s.cisneros",
      type: "profile",
      content: "Long Beach in bio · 42 posts",
      confidence: 0.62,
      status: "pending",
      url: "https://instagram.com/karen.s.cisneros",
    },
    {
      id: 54892,
      platform: "spokeo",
      handle: "people",
      type: "people_record",
      content: "Karen Suley Cisneros · 36 · Long Beach, CA",
      confidence: 0.85,
      status: "validated",
      url: "https://spokeo.com/Karen-Cisneros",
    },
    {
      id: 54893,
      platform: "searxng",
      handle: "web",
      type: "mention",
      content: "Obituary mention · Cisneros family Long Beach 2018",
      confidence: 0.44,
      status: "pending",
      url: "https://example.com/obit",
    },
    {
      id: 54894,
      platform: "holehe",
      handle: "email",
      type: "email_hit",
      content: "kcisneros90@gmail.com registered on Twitter + Instagram",
      confidence: 0.78,
      status: "pending",
      url: "",
    },
  ],
};

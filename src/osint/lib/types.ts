// Types matching backend Pydantic schemas exactly

export interface Investigation {
  id: number;
  case_id: number | null;
  subject_id: number | null;
  investigator_id: number | null;
  subject_name: string;
  subject_aliases: string[] | null;
  subject_emails: string[] | null;
  subject_phones: string[] | null;
  subject_phones_meta: Record<string, string> | null;
  subject_usernames: string[] | null;
  subject_dob: string | null;
  subject_locations: string[] | null;
  subject_employers: string[] | null;
  subject_addresses: string[] | null;
  subject_license_plates: string[] | null;
  subject_ssn_last4: string | null;
  subject_country: string | null;
  subject_gender: string | null;
  subject_race: string | null;
  subject_relatives: { name: string; relationship?: string }[] | null;
  subject_notes: string | null;
  reference_photos: unknown[] | null;
  time_window_start: string | null;
  time_window_end: string | null;
  enabled_engines: string[] | null;
  priority: string;
  status: string;
  progress: number;
  ai_summary: string | null;
  ai_confidence: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  has_reference_photos?: boolean;
  extra_metadata?: Record<string, any> | null;
  investigation_type?: string | null;
  subject_height?: string | null;
  subject_weight?: string | null;
  subject_build?: string | null;
  subject_eyes?: string | null;
  subject_complexion?: string | null;
  subject_glasses?: string | null;
  subject_hair_color?: string | null;
  subject_hair_length?: string | null;
  subject_facial_hair?: string | null;
  subject_counties?: string[] | null;
}

export interface InvestigationList {
  items: Investigation[];
  total: number;
  page: number;
  page_size: number;
}

export interface Finding {
  id: number;
  investigation_id: number;
  engine: string;
  platform: string | null;
  finding_type: string;
  url: string | null;
  title: string | null;
  content: string | null;
  found_username: string | null;
  found_name: string | null;
  found_email: string | null;
  found_phone: string | null;
  search_criterion: string | null;
  found_date: string | null;
  confidence: number;
  include_in_report: boolean;
  validation_status: string;
  validated_by: string | null;
  validated_at: string | null;
  validation_notes: string | null;
  screenshot_path: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface Photo {
  id: number;
  investigation_id: number;
  finding_id: number | null;
  source_url: string | null;
  source_platform: string | null;
  face_match_score: number | null;
  validation_status: string;
  is_downloaded: boolean;
  created_at: string;
}

export interface SearchLogEntry {
  id: number;
  investigation_id: number;
  engine: string;
  query_type: string | null;
  query_term: string | null;
  filters: Record<string, unknown> | null;
  result_count: number;
  duration_ms: number | null;
  error_message: string | null;
  executed_at: string;
  executed_by: string | null;
}

export interface Engine {
  id: number;
  code: string;
  name: string;
  description: string | null;
  engine_type: string | null;
  is_active: boolean;
  requires_api_key: boolean;
  cost_per_query: number;
  rate_limit: number | null;
}

export interface SubjectResult {
  id: number;
  full_name: string;
  dob: string | null;
  address: string | null;
  phone_number: string | null;
  facebook_url: string | null;
  whatsapp_profile_url: string | null;
  current_employer: string | null;
  employer_phone: string | null;
  employer_website: string | null;
  employer_address: string | null;
}

export interface CaseResult {
  id: number;
  case_number: string | null;
  claim_number: string | null;
  subject_name: string | null;
  status: string | null;
}

export interface InvestigatorResult {
  id: number;
  full_name: string;
  email: string | null;
}

export interface RunResponse {
  task_id: string;
  investigation_id: number;
  status: string;
  engines: string[];
}

export interface InvestigationCreate {
  subject_name: string;
  subject_id?: number | null;
  case_id?: number | null;
  investigator_id?: number | null;
  subject_aliases?: string[];
  subject_emails?: string[];
  subject_phones?: string[];
  subject_phones_meta?: Record<string, string>;
  subject_usernames?: string[];
  subject_dob?: string;
  subject_locations?: string[];
  subject_employers?: string[];
  subject_addresses?: string[];
  subject_license_plates?: string[];
  subject_ssn_last4?: string;
  subject_country?: string;
  subject_gender?: string;
  subject_race?: string;
  subject_relatives?: { name: string; relationship?: string }[];
  subject_notes?: string;
  enabled_engines?: string[];
  priority?: string;
  created_by?: string;
}

export interface PhotoItem {
  id: number;
  investigation_id: number;
  finding_id: number | null;
  source_url: string | null;
  source_platform: string | null;
  minio_path: string | null;
  thumbnail_path: string | null;
  is_downloaded: boolean;
  qdrant_point_id: string | null;
  face_match_score: number | null;
  validation_status: string;
  validated_by: string | null;
  extraction_method: string | null;
  extraction_quality: string | null;
  profile_picture: boolean | null;
  marked_as_subject: boolean | null;
  face_count: number | null;
  best_face_match_score: number | null;
  search_criterion: string | null;
  created_at: string;
}

export interface PhotoAuditEntry {
  id: number;
  photo_id: number;
  match_score: number | null;
  decision: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  workflow_mode: string | null;
  created_at: string;
}

export interface VideoFrame {
  id: number;
  video_filename: string;
  video_folder: string | null;
  frame_number: number;
  timestamp_sec: number;
  timestamp_wall: string | null;
  face_match_score: number | null;
  face_bbox: { x: number; y: number; w: number; h: number } | null;
  activity_type: string | null;
  activity_confidence: number | null;
  minio_path: string | null;
  thumbnail_path: string | null;
  flagged_for_report: boolean;
  reviewer_note: string | null;
  reviewed_by: string | null;
  created_at: string;
}

export interface VideoScanJob {
  id?: number;
  status: "never_run" | "pending" | "running" | "done" | "error";
  triggered_by?: string;
  videos_found?: number;
  videos_processed?: number;
  frames_scanned?: number;
  frames_matched?: number;
  frames_activity?: number;
  best_match_score?: number | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface VideoSummary {
  id: number;
  video_filename: string;
  video_folder: string | null;
  duration_seconds: number | null;
  fps: number | null;
  resolution: string | null;
  file_size_mb: number | null;
  scan_mode: "face_match" | "general";
  total_frames_scanned: number;
  person_detected_pct: number | null;
  activity_frames: number;
  face_match_frames: number;
  best_face_score: number | null;
  timeline_events: TimelineEvent[];
  best_frame_thumb: string | null;
  best_frame_ts: number | null;
  created_at: string;
  best_face_crop?: string | null;
  best_face_quality?: number | null;
}

export interface TimelineEvent {
  ts_sec: number;
  ts_fmt: string;
  type: string;
  score: number | null;
  thumb: string | null;
  desc: string;
  person_count: number;
  face_crop?: string | null;
  face_quality?: number | null;
}


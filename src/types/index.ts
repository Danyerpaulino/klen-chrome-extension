/**
 * Type definitions for the Klen LinkedIn Extension
 */

// ============================================================================
// API Types
// ============================================================================

export interface AuthTokens {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_at?: number
}

export interface UserInfo {
  id: string
  email: string
  first_name?: string
  last_name?: string
  tenant_id: string
}

export interface Job {
  id: string
  title: string
  description?: string
  company_name?: string
  location?: string
  status: string
  created_at: string
}

export interface JobListResponse {
  // Backend returns `jobs`; older clients may use `items`.
  jobs?: Job[]
  items?: Job[]
  total: number
  page: number
  size?: number
  page_size?: number
  pages?: number
  stats?: Record<string, unknown>
}

export interface TenantInfo {
  feature_flags?: Record<string, unknown>
}

// ============================================================================
// LinkedIn Profile Types
// ============================================================================

export interface LinkedInExperienceEntry {
  title?: string
  company?: string
  start?: string
  end?: string
  description?: string
  location?: string
}

export interface LinkedInEducationEntry {
  school?: string
  degree?: string
  field?: string
  start?: string
  end?: string
}

export interface LinkedInCertificationEntry {
  name?: string
  issuer?: string
  date?: string
  expiry_date?: string
}

export interface LinkedInProfileSnapshot {
  name?: string
  first_name?: string
  last_name?: string
  headline?: string
  location?: string
  job_title?: string
  company_name?: string
  about?: string
  skills: string[]
  experience: LinkedInExperienceEntry[]
  education: LinkedInEducationEntry[]
  certifications: LinkedInCertificationEntry[]
  profile_image_url?: string
}

export interface LinkedInImportRequest {
  profile_url: string
  public_identifier?: string
  snapshot: LinkedInProfileSnapshot
  raw_text?: string
  consent?: {
    captured_at: string
    user_initiated: boolean
  }
  force_rescore?: boolean
}

export interface LinkedInImportResponse {
  success: boolean
  job_candidate_id?: string
  candidate_id?: string
  job_id?: string
  linkedin_url?: string
  score?: number
  stage?: string
  source: string
  message?: string
  is_duplicate: boolean
}

export interface LinkedInICPRequest {
  profile_url: string
  public_identifier?: string
  snapshot: LinkedInProfileSnapshot
  consent?: {
    captured_at: string
    user_initiated: boolean
  }
}

export interface LinkedInICPResponse {
  success: boolean
  icp_id?: string
  job_id?: string
  criteria_count?: number
  generated_from?: string
  updated?: boolean
  message?: string
}

export interface ResolveByLinkedInResponse {
  found: boolean
  candidate_id?: string
  job_candidate_id?: string
  job_id?: string
  linkedin_url?: string
  name?: string
  stage?: string
  score?: number
}

export type LinkedInInMailTone =
  | "professional"
  | "friendly"
  | "direct"
  | "warm"
  | "consultative"

export type LinkedInInMailLength = "short" | "medium" | "long"

export interface LinkedInInMailDraftRequest {
  candidate_id?: string
  job_candidate_id?: string
  linkedin_url?: string
  tone?: LinkedInInMailTone
  length?: LinkedInInMailLength
}

export interface LinkedInInMailDraftResponse {
  communication_id: string
  subject: string
  content: string
  candidate_id: string
  job_candidate_id?: string
  linkedin_url?: string
}

// ============================================================================
// Extension State Types
// ============================================================================

export interface ExtensionState {
  isAuthenticated: boolean
  user?: UserInfo
  selectedJobId?: string
  apiBaseUrl: string
}

export interface StorageData {
  auth?: AuthTokens
  user?: UserInfo
  selectedJobId?: string
  apiBaseUrl?: string
}

// ============================================================================
// Message Types (for communication between content script and background)
// ============================================================================

export type MessageType =
  | "LOGIN"
  | "LOGOUT"
  | "GET_AUTH_STATUS"
  | "OPEN_POPUP"
  | "GET_JOBS"
  | "SELECT_JOB"
  | "IMPORT_LINKEDIN_PROFILE"
  | "CREATE_ICP_FROM_PROFILE"
  | "RESOLVE_LINKEDIN_CANDIDATE"
  | "DRAFT_LINKEDIN_INMAIL"
  | "API_REQUEST"

export interface Message<T = unknown> {
  type: MessageType
  payload?: T
}

export interface MessageResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// Login message types
export interface LoginPayload {
  email: string
  password: string
  apiBaseUrl?: string
}

export interface LoginResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  user: UserInfo
}

// Import message types
export interface ImportLinkedInPayload {
  jobId: string
  profile: LinkedInProfileSnapshot
  profileUrl: string
  rawText?: string
  forceRescore?: boolean
}

export interface CreateLinkedInIcpPayload {
  jobId: string
  profile: LinkedInProfileSnapshot
  profileUrl: string
}

export interface DraftLinkedInInmailPayload {
  jobId: string
  request: LinkedInInMailDraftRequest
}

// API request message types
export interface ApiRequestPayload {
  method: "GET" | "POST" | "PUT" | "DELETE"
  endpoint: string
  body?: unknown
}

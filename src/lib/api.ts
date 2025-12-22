/**
 * API client for the Klen LinkedIn Extension
 * Handles all communication with the Klen backend
 */

import {
  getAuthTokens,
  setAuthTokens,
  clearAllStorageData,
  getApiBaseUrl
} from "./storage"
import type {
  AuthTokens,
  UserInfo,
  Job,
  JobListResponse,
  LinkedInImportRequest,
  LinkedInImportResponse,
  ResolveByLinkedInResponse,
  LoginResponse
} from "~/types"

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

function truncateBodyForError(body: string, maxLength = 300): string {
  const trimmed = body.trim()
  if (!trimmed) {
    return ""
  }
  if (trimmed.length <= maxLength) {
    return trimmed
  }
  return `${trimmed.slice(0, maxLength)}…`
}

/**
 * Make an authenticated API request
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = await getApiBaseUrl()
  const tokens = await getAuthTokens()

  const url = `${baseUrl}${endpoint}`
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  }

  if (options.headers instanceof Headers) {
    options.headers.forEach((value, key) => {
      headers[key] = value
    })
  } else if (Array.isArray(options.headers)) {
    for (const [key, value] of options.headers) {
      headers[key] = value
    }
  } else if (options.headers) {
    Object.assign(headers, options.headers)
  }

  // Add auth header if we have tokens
  if (tokens?.access_token) {
    headers.Authorization = `Bearer ${tokens.access_token}`
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    })

    // Handle 401 - try to refresh token
    if (response.status === 401 && tokens?.refresh_token) {
      const refreshed = await refreshAccessToken(tokens.refresh_token)
      if (refreshed) {
        // Retry the request with new token
        headers.Authorization = `Bearer ${refreshed.access_token}`
        const retryResponse = await fetch(url, {
          ...options,
          headers
        })
        return handleResponse<T>(retryResponse)
      } else {
        // Refresh failed, clear tokens and throw
        await clearAllStorageData()
        throw new ApiError("Session expired. Please log in again.", 401, "SESSION_EXPIRED")
      }
    }

    return handleResponse<T>(response)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    console.error("[Klen] API fetch error:", error)
    throw new ApiError(
      error instanceof Error ? error.message : "Network error",
      0,
      "NETWORK_ERROR"
    )
  }
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`
    let errorCode = "HTTP_ERROR"

    try {
      const errorData = await response.json()
      errorMessage = errorData.detail || errorData.message || errorMessage
      errorCode = errorData.code || errorCode
    } catch {
      // Ignore JSON parse errors
    }

    throw new ApiError(errorMessage, response.status, errorCode)
  }

  // Handle empty responses
  const contentType = response.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    return {} as T
  }

  try {
    return await response.json()
  } catch {
    return {} as T
  }
}

/**
 * Refresh the access token
 */
async function refreshAccessToken(refreshToken: string): Promise<AuthTokens | null> {
  try {
    const baseUrl = await getApiBaseUrl()
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    })

    if (!response.ok) {
      return null
    }

    const text = await response.text()
    let tokenResponse: {
      access_token?: string
      refresh_token?: string
      token_type?: string
      expires_in?: number
    }

    try {
      tokenResponse = JSON.parse(text) as {
        access_token?: string
        refresh_token?: string
        token_type?: string
        expires_in?: number
      }
    } catch (error) {
      console.error("[Klen] Token refresh returned invalid JSON:", {
        status: response.status,
        contentType: response.headers.get("content-type"),
        snippet: truncateBodyForError(text)
      })
      return null
    }

    if (!tokenResponse?.access_token) {
      console.error("[Klen] Token refresh returned unexpected payload:", {
        status: response.status,
        contentType: response.headers.get("content-type"),
        snippet: truncateBodyForError(text)
      })
      return null
    }

    const tokens: AuthTokens = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      token_type: tokenResponse.token_type || "bearer",
      expires_at: tokenResponse.expires_in
        ? Date.now() + Math.max(0, tokenResponse.expires_in - 30) * 1000
        : undefined
    }

    await setAuthTokens(tokens)
    return tokens
  } catch (error) {
    console.error("[Klen] Token refresh error:", error)
    return null
  }
}

// ============================================================================
// Authentication API
// ============================================================================

/**
 * Login with email and password
 */
export async function login(
  email: string,
  password: string,
  apiBaseUrl?: string
): Promise<LoginResponse> {
  const baseUrl = apiBaseUrl || (await getApiBaseUrl())

  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  })

  const text = await response.text()
  const contentType = response.headers.get("content-type") || "unknown"

  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = null
  }

  if (!response.ok) {
    let errorMessage = "Login failed"
    try {
      const errorData = parsed as { detail?: string; message?: string } | null
      errorMessage = errorData?.detail || errorData?.message || errorMessage
    } catch {
      // Ignore
    }

    if (!parsed && text) {
      errorMessage = `${errorMessage} (non-JSON response: ${contentType}). Body: ${truncateBodyForError(
        text
      )}`
    }
    throw new ApiError(errorMessage, response.status, "LOGIN_FAILED")
  }

  if (!parsed) {
    throw new ApiError(
      `Login failed: server returned non-JSON response (${contentType}). Body: ${truncateBodyForError(
        text
      )}`,
      response.status,
      "INVALID_RESPONSE"
    )
  }

  const data = parsed as LoginResponse
  if (!data?.access_token || typeof data.expires_in !== "number") {
    throw new ApiError(
      `Login failed: server returned unexpected payload (${contentType}). Body: ${truncateBodyForError(
        text
      )}`,
      response.status,
      "INVALID_RESPONSE"
    )
  }

  return data
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<UserInfo> {
  return apiFetch<UserInfo>("/api/v1/auth/me")
}

/**
 * Logout (clear tokens)
 */
export async function logout(): Promise<void> {
  await clearAllStorageData()
}

// ============================================================================
// Jobs API
// ============================================================================

/**
 * List jobs for the current user
 */
export async function listJobs(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<JobListResponse> {
  let endpoint = `/api/v1/jobs?page=${page}&page_size=${pageSize}`
  if (search) {
    endpoint += `&search=${encodeURIComponent(search)}`
  }
  return apiFetch<JobListResponse>(endpoint)
}

/**
 * Get a single job by ID
 */
export async function getJob(jobId: string): Promise<Job> {
  return apiFetch<Job>(`/api/v1/jobs/${jobId}`)
}

// ============================================================================
// LinkedIn Import API
// ============================================================================

/**
 * Import a candidate from LinkedIn profile
 */
export async function importLinkedInProfile(
  jobId: string,
  request: LinkedInImportRequest
): Promise<LinkedInImportResponse> {
  return apiFetch<LinkedInImportResponse>(
    `/api/v1/jobs/${jobId}/candidates/import/linkedin`,
    {
      method: "POST",
      body: JSON.stringify(request)
    }
  )
}

/**
 * Resolve a candidate by LinkedIn URL
 */
export async function resolveByLinkedIn(
  jobId: string,
  linkedinUrl: string
): Promise<ResolveByLinkedInResponse> {
  const encodedUrl = encodeURIComponent(linkedinUrl)
  return apiFetch<ResolveByLinkedInResponse>(
    `/api/v1/jobs/${jobId}/candidates/resolve-by-linkedin?linkedin_url=${encodedUrl}`
  )
}

// ============================================================================
// Communications API (for message logging)
// ============================================================================

export interface CreateCommunicationRequest {
  candidate_id: string
  job_candidate_id: string
  communication_type: "linkedin_message" | "linkedin_inmail"
  direction: "outbound" | "inbound"
  content: string
  status: "draft" | "sent" | "received"
  thread_id?: string
}

export interface Communication {
  id: string
  candidate_id: string
  job_candidate_id: string
  communication_type: string
  direction: string
  content: string
  status: string
  thread_id?: string
  sent_at?: string
  created_at: string
}

/**
 * Create a communication record (draft message)
 */
export async function createCommunication(
  jobId: string,
  request: CreateCommunicationRequest
): Promise<Communication> {
  return apiFetch<Communication>(`/api/v1/jobs/${jobId}/communications`, {
    method: "POST",
    body: JSON.stringify(request)
  })
}

/**
 * Mark a communication as sent
 */
export async function markCommunicationSent(
  jobId: string,
  communicationId: string
): Promise<Communication> {
  return apiFetch<Communication>(
    `/api/v1/jobs/${jobId}/communications/${communicationId}/send`,
    {
      method: "POST"
    }
  )
}

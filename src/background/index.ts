/**
 * Background Service Worker for Klen LinkedIn Extension
 *
 * Handles:
 * - Authentication state management
 * - API calls (isolated from content scripts for security)
 * - Token refresh
 * - Message routing between popup and content scripts
 */

import {
  getAuthTokens,
  setAuthTokens,
  getUserInfo,
  setUserInfo,
  clearAllStorageData,
  getSelectedJobId,
  setSelectedJobId,
  getApiBaseUrl,
  setApiBaseUrl,
  isAuthenticated
} from "~/lib/storage"

import {
  login as apiLogin,
  getCurrentUser,
  listJobs,
  importLinkedInProfile,
  resolveByLinkedIn,
  ApiError
} from "~/lib/api"

import type {
  Message,
  MessageResponse,
  LoginPayload,
  ImportLinkedInPayload,
  LinkedInImportRequest,
  Job
} from "~/types"

console.log("[Klen] Background service worker started")

function normalizeApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "")
}

function validateApiBaseUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "API URL must start with http:// or https://"
    }
  } catch {
    return "Invalid API URL"
  }

  return null
}

// ============================================================================
// Message Handler
// ============================================================================

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  // Handle the message asynchronously
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error("[Klen] Message handler error:", error)
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      })
    })

  // Return true to indicate we'll send response asynchronously
  return true
})

/**
 * Main message handler - routes messages to appropriate handlers
 */
async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  console.log("[Klen] Received message:", message.type)

  switch (message.type) {
    case "LOGIN":
      return handleLogin(message.payload as LoginPayload)

    case "LOGOUT":
      return handleLogout()

    case "GET_AUTH_STATUS":
      return handleGetAuthStatus()

    case "OPEN_POPUP":
      return handleOpenPopup()

    case "GET_JOBS":
      return handleGetJobs(message.payload as { search?: string })

    case "SELECT_JOB":
      return handleSelectJob(message.payload as { jobId: string })

    case "IMPORT_LINKEDIN_PROFILE":
      return handleImportLinkedInProfile(message.payload as ImportLinkedInPayload)

    case "RESOLVE_LINKEDIN_CANDIDATE":
      return handleResolveLinkedInCandidate(
        message.payload as { jobId: string; linkedinUrl: string }
      )

    default:
      return {
        success: false,
        error: `Unknown message type: ${message.type}`
      }
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

async function handleOpenPopup(): Promise<MessageResponse> {
  try {
    if (chrome.action?.openPopup) {
      await chrome.action.openPopup()
      return { success: true }
    }
  } catch (error) {
    console.warn("[Klen] openPopup failed:", error)
  }

  try {
    const url = chrome.runtime.getURL("popup.html")
    await chrome.tabs.create({ url })
    return { success: true }
  } catch (error) {
    console.warn("[Klen] tabs.create for popup failed:", error)
    return {
      success: false,
      error: "Please click the Klen extension icon to open the popup."
    }
  }
}

/**
 * Handle login request
 */
async function handleLogin(payload: LoginPayload): Promise<MessageResponse> {
  try {
    const { email, password, apiBaseUrl } = payload

    // Set API base URL if provided
    const normalizedApiBaseUrl = apiBaseUrl
      ? normalizeApiBaseUrl(apiBaseUrl)
      : undefined

    if (normalizedApiBaseUrl) {
      const validationError = validateApiBaseUrl(normalizedApiBaseUrl)
      if (validationError) {
        return { success: false, error: validationError }
      }

      await setApiBaseUrl(normalizedApiBaseUrl)
    }

    // Perform login
    const response = await apiLogin(email, password, normalizedApiBaseUrl)

    // Store tokens
    await setAuthTokens({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      token_type: response.token_type,
      expires_at: Date.now() + Math.max(0, response.expires_in - 30) * 1000
    })

    // Store user info
    await setUserInfo(response.user)

    console.log("[Klen] Login successful for:", email)

    return {
      success: true,
      data: {
        user: response.user
      }
    }
  } catch (error) {
    console.error("[Klen] Login error:", error)
    return {
      success: false,
      error:
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Login failed"
    }
  }
}

/**
 * Handle logout request
 */
async function handleLogout(): Promise<MessageResponse> {
  try {
    await clearAllStorageData()
    console.log("[Klen] Logout successful")
    return { success: true }
  } catch (error) {
    console.error("[Klen] Logout error:", error)
    return {
      success: false,
      error: "Logout failed"
    }
  }
}

/**
 * Handle get auth status request
 */
async function handleGetAuthStatus(): Promise<MessageResponse> {
  try {
    const authenticated = await isAuthenticated()
    const user = authenticated ? await getUserInfo() : null
    const selectedJobId = await getSelectedJobId()
    const apiBaseUrl = await getApiBaseUrl()

    return {
      success: true,
      data: {
        isAuthenticated: authenticated,
        user,
        selectedJobId,
        apiBaseUrl
      }
    }
  } catch (error) {
    console.error("[Klen] Get auth status error:", error)
    return {
      success: false,
      error: "Failed to get auth status"
    }
  }
}

/**
 * Handle get jobs request
 */
async function handleGetJobs(
  payload?: { search?: string }
): Promise<MessageResponse<{ jobs: Job[] }>> {
  try {
    const response = await listJobs(1, 50, payload?.search)
    const responseAny = response as unknown as { jobs?: Job[]; items?: Job[] }
    const jobs = Array.isArray(responseAny.jobs)
      ? responseAny.jobs
      : Array.isArray(responseAny.items)
        ? responseAny.items
        : []

    return {
      success: true,
      data: {
        jobs
      }
    }
  } catch (error) {
    console.error("[Klen] Get jobs error:", error)
    return {
      success: false,
      error: error instanceof ApiError ? error.message : "Failed to get jobs"
    }
  }
}

/**
 * Handle select job request
 */
async function handleSelectJob(
  payload: { jobId: string }
): Promise<MessageResponse> {
  try {
    await setSelectedJobId(payload.jobId)
    console.log("[Klen] Selected job:", payload.jobId)
    return { success: true }
  } catch (error) {
    console.error("[Klen] Select job error:", error)
    return {
      success: false,
      error: "Failed to select job"
    }
  }
}

/**
 * Handle import LinkedIn profile request
 */
async function handleImportLinkedInProfile(
  payload: ImportLinkedInPayload
): Promise<MessageResponse> {
  try {
    const { jobId, profile, profileUrl, rawText } = payload

    const request: LinkedInImportRequest = {
      profile_url: profileUrl,
      snapshot: profile,
      raw_text: rawText,
      consent: {
        captured_at: new Date().toISOString(),
        user_initiated: true
      }
    }

    const response = await importLinkedInProfile(jobId, request)

    console.log("[Klen] Import result:", response)

    return {
      success: true,
      data: response
    }
  } catch (error) {
    console.error("[Klen] Import LinkedIn profile error:", error)
    return {
      success: false,
      error: error instanceof ApiError ? error.message : "Failed to import profile"
    }
  }
}

/**
 * Handle resolve LinkedIn candidate request
 */
async function handleResolveLinkedInCandidate(
  payload: { jobId: string; linkedinUrl: string }
): Promise<MessageResponse> {
  try {
    const { jobId, linkedinUrl } = payload
    const response = await resolveByLinkedIn(jobId, linkedinUrl)

    return {
      success: true,
      data: response
    }
  } catch (error) {
    console.error("[Klen] Resolve LinkedIn candidate error:", error)
    return {
      success: false,
      error: error instanceof ApiError ? error.message : "Failed to resolve candidate"
    }
  }
}

// ============================================================================
// Extension Install/Update Handlers
// ============================================================================

chrome.runtime.onInstalled.addListener((details) => {
  console.log("[Klen] Extension installed/updated:", details.reason)

  if (details.reason === "install") {
    // First install - could open onboarding page
    console.log("[Klen] First install detected")
  } else if (details.reason === "update") {
    // Extension updated
    console.log("[Klen] Extension updated from:", details.previousVersion)
  }
})

// Keep service worker alive (optional, for development)
// In production, service workers should handle being suspended/resumed

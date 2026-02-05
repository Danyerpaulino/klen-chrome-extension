/**
 * Storage utilities for the Klen LinkedIn Extension
 * Uses chrome.storage.local for secure token storage
 */

import { Storage } from "@plasmohq/storage"
import type {
  AuthTokens,
  UserInfo,
  StorageData,
  LinkedInInMailOutreachMode
} from "~/types"

// API base URL from environment (set at build time)
// In development: http://localhost:8000
// In production: https://api.klen.ai
const API_BASE_URL = process.env.PLASMO_PUBLIC_API_BASE_URL || "https://api.klen.ai"

// Whether dev tools are enabled (allows API URL override in dev only)
const SHOW_DEV_TOOLS = process.env.PLASMO_PUBLIC_SHOW_DEV_TOOLS === "true"

// Storage keys
const STORAGE_KEYS = {
  AUTH: "klen_auth",
  USER: "klen_user",
  SELECTED_JOB: "klen_selected_job",
  API_BASE_URL: "klen_api_base_url",
  OUTREACH_MODE: "klen_outreach_mode"
} as const

// Create storage instance
const storage = new Storage({ area: "local" })

/**
 * Get authentication tokens from storage
 */
export async function getAuthTokens(): Promise<AuthTokens | null> {
  try {
    const auth = await storage.get<AuthTokens>(STORAGE_KEYS.AUTH)
    return auth || null
  } catch (error) {
    console.error("[Klen] Error getting auth tokens:", error)
    return null
  }
}

/**
 * Save authentication tokens to storage
 */
export async function setAuthTokens(tokens: AuthTokens): Promise<void> {
  try {
    await storage.set(STORAGE_KEYS.AUTH, tokens)
  } catch (error) {
    console.error("[Klen] Error saving auth tokens:", error)
    throw error
  }
}

/**
 * Clear authentication tokens from storage
 */
export async function clearAuthTokens(): Promise<void> {
  try {
    await storage.remove(STORAGE_KEYS.AUTH)
  } catch (error) {
    console.error("[Klen] Error clearing auth tokens:", error)
  }
}

/**
 * Get user info from storage
 */
export async function getUserInfo(): Promise<UserInfo | null> {
  try {
    const user = await storage.get<UserInfo>(STORAGE_KEYS.USER)
    return user || null
  } catch (error) {
    console.error("[Klen] Error getting user info:", error)
    return null
  }
}

/**
 * Save user info to storage
 */
export async function setUserInfo(user: UserInfo): Promise<void> {
  try {
    await storage.set(STORAGE_KEYS.USER, user)
  } catch (error) {
    console.error("[Klen] Error saving user info:", error)
    throw error
  }
}

/**
 * Clear user info from storage
 */
export async function clearUserInfo(): Promise<void> {
  try {
    await storage.remove(STORAGE_KEYS.USER)
  } catch (error) {
    console.error("[Klen] Error clearing user info:", error)
  }
}

/**
 * Get selected job ID from storage
 */
export async function getSelectedJobId(): Promise<string | null> {
  try {
    const jobId = await storage.get<string>(STORAGE_KEYS.SELECTED_JOB)
    return jobId || null
  } catch (error) {
    console.error("[Klen] Error getting selected job:", error)
    return null
  }
}

/**
 * Get outreach mode preference
 */
export async function getOutreachMode(): Promise<LinkedInInMailOutreachMode> {
  try {
    const mode = await storage.get<LinkedInInMailOutreachMode>(
      STORAGE_KEYS.OUTREACH_MODE
    )
    return mode === "candidate_centric" ? "candidate_centric" : "employer_centric"
  } catch (error) {
    console.error("[Klen] Error getting outreach mode:", error)
    return "employer_centric"
  }
}

/**
 * Save outreach mode preference
 */
export async function setOutreachMode(
  mode: LinkedInInMailOutreachMode
): Promise<void> {
  try {
    await storage.set(STORAGE_KEYS.OUTREACH_MODE, mode)
  } catch (error) {
    console.error("[Klen] Error saving outreach mode:", error)
    throw error
  }
}

/**
 * Save selected job ID to storage
 */
export async function setSelectedJobId(jobId: string): Promise<void> {
  try {
    await storage.set(STORAGE_KEYS.SELECTED_JOB, jobId)
  } catch (error) {
    console.error("[Klen] Error saving selected job:", error)
    throw error
  }
}

/**
 * Clear selected job ID from storage
 */
export async function clearSelectedJobId(): Promise<void> {
  try {
    await storage.remove(STORAGE_KEYS.SELECTED_JOB)
  } catch (error) {
    console.error("[Klen] Error clearing selected job:", error)
  }
}

/**
 * Get API base URL
 * In production: always uses the build-time environment variable
 * In development: can be overridden via storage for testing
 */
export async function getApiBaseUrl(): Promise<string> {
  // In dev mode, allow storage override for testing different backends
  if (SHOW_DEV_TOOLS) {
    try {
      const url = await storage.get<string>(STORAGE_KEYS.API_BASE_URL)
      if (url) return url
    } catch (error) {
      console.error("[Klen] Error getting API base URL:", error)
    }
  }
  return API_BASE_URL
}

/**
 * Check if dev tools are enabled (for conditional UI)
 */
export function isDevMode(): boolean {
  return SHOW_DEV_TOOLS
}

/**
 * Save API base URL to storage
 */
export async function setApiBaseUrl(url: string): Promise<void> {
  try {
    await storage.set(STORAGE_KEYS.API_BASE_URL, url)
  } catch (error) {
    console.error("[Klen] Error saving API base URL:", error)
    throw error
  }
}

/**
 * Get all storage data
 */
export async function getAllStorageData(): Promise<StorageData> {
  const [auth, user, selectedJobId, apiBaseUrl, outreachMode] = await Promise.all([
    getAuthTokens(),
    getUserInfo(),
    getSelectedJobId(),
    getApiBaseUrl(),
    getOutreachMode()
  ])

  return {
    auth: auth || undefined,
    user: user || undefined,
    selectedJobId: selectedJobId || undefined,
    apiBaseUrl,
    outreachMode
  }
}

/**
 * Clear all storage data (logout)
 */
export async function clearAllStorageData(): Promise<void> {
  await Promise.all([
    clearAuthTokens(),
    clearUserInfo(),
    clearSelectedJobId()
  ])
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const tokens = await getAuthTokens()
  if (!tokens?.access_token) {
    return false
  }

  // Check if token is expired
  if (tokens.expires_at && Date.now() >= tokens.expires_at) {
    return false
  }

  return true
}

export { storage }

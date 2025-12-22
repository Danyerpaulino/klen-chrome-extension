/**
 * Storage utilities for the Klen LinkedIn Extension
 * Uses chrome.storage.local for secure token storage
 */

import { Storage } from "@plasmohq/storage"
import type { AuthTokens, UserInfo, StorageData } from "~/types"

// Default API base URL - can be overridden in settings
const DEFAULT_API_BASE_URL = "https://api.klen.ai"

// Storage keys
const STORAGE_KEYS = {
  AUTH: "klen_auth",
  USER: "klen_user",
  SELECTED_JOB: "klen_selected_job",
  API_BASE_URL: "klen_api_base_url"
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
 * Get API base URL from storage
 */
export async function getApiBaseUrl(): Promise<string> {
  try {
    const url = await storage.get<string>(STORAGE_KEYS.API_BASE_URL)
    return url || DEFAULT_API_BASE_URL
  } catch (error) {
    console.error("[Klen] Error getting API base URL:", error)
    return DEFAULT_API_BASE_URL
  }
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
  const [auth, user, selectedJobId, apiBaseUrl] = await Promise.all([
    getAuthTokens(),
    getUserInfo(),
    getSelectedJobId(),
    getApiBaseUrl()
  ])

  return {
    auth: auth || undefined,
    user: user || undefined,
    selectedJobId: selectedJobId || undefined,
    apiBaseUrl
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

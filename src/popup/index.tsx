/**
 * Popup UI for Klen LinkedIn Extension
 *
 * Provides:
 * - Login form
 * - User info display
 * - Job selection
 * - Settings
 */

import { useEffect, useState, useCallback } from "react"
import type { Job, UserInfo, MessageResponse } from "~/types"
import "./popup.css"

// Send message to background script
async function sendMessage<T>(
  type: string,
  payload?: unknown
): Promise<MessageResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message })
        return
      }

      resolve(response || { success: false, error: "No response" })
    })
  })
}

function formatErrorMessage(message: string): string {
  const trimmed = message.trim()
  if (trimmed.length <= 600) {
    return trimmed
  }
  return `${trimmed.slice(0, 600)}… (truncated)`
}

function Popup() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<UserInfo | null>(null)

  // Login form state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [apiUrl, setApiUrl] = useState("https://api.klen.ai")
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string>("")
  const [jobSearch, setJobSearch] = useState("")

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<"main" | "settings">("main")

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await sendMessage<{
        isAuthenticated: boolean
        user?: UserInfo
        selectedJobId?: string
        apiBaseUrl?: string
      }>("GET_AUTH_STATUS")

      if (response.success && response.data) {
        setIsAuthenticated(response.data.isAuthenticated)
        setUser(response.data.user || null)
        if (response.data.selectedJobId) {
          setSelectedJobId(response.data.selectedJobId)
        }
        if (response.data.apiBaseUrl) {
          setApiUrl(response.data.apiBaseUrl)
        }

        // Load jobs if authenticated
        if (response.data.isAuthenticated) {
          await loadJobs()
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadJobs = async (search?: string) => {
    const response = await sendMessage<{ jobs?: Job[] }>("GET_JOBS", { search })
    if (response.success && response.data) {
      setJobs(Array.isArray(response.data.jobs) ? response.data.jobs : [])
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await sendMessage<{ user: UserInfo }>("LOGIN", {
        email,
        password,
        apiBaseUrl: apiUrl
      })

      if (response.success && response.data) {
        setIsAuthenticated(true)
        setUser(response.data.user)
        setPassword("") // Clear password
        await loadJobs()
      } else {
        setError(
          formatErrorMessage(response.error || "Login failed")
        )
      }
    } catch (err) {
      setError(
        formatErrorMessage(err instanceof Error ? err.message : "Login failed")
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await sendMessage("LOGOUT")
      setIsAuthenticated(false)
      setUser(null)
      setJobs([])
      setSelectedJobId("")
    } finally {
      setIsLoading(false)
    }
  }

  const handleJobSelect = async (jobId: string) => {
    setSelectedJobId(jobId)
    await sendMessage("SELECT_JOB", { jobId })
  }

  const handleJobSearch = async (search: string) => {
    setJobSearch(search)
    await loadJobs(search)
  }

  // Render login form
  const renderLoginForm = () => (
    <div className="login-container">
      <div className="logo">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="8" fill="url(#gradient)" />
          <path
            d="M12 28V12h4v16h-4zm6-8v8h4v-8h-4zm6-4v12h4V16h-4z"
            fill="white"
          />
          <defs>
            <linearGradient
              id="gradient"
              x1="0"
              y1="0"
              x2="40"
              y2="40"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6366f1" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <h1>Klen</h1>
      </div>

      <p className="subtitle">Sign in to add LinkedIn candidates</p>

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>

        {showAdvanced && (
          <div className="form-group">
            <label htmlFor="apiUrl">API URL</label>
            <input
              id="apiUrl"
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.klen.ai"
            />
          </div>
        )}

        <button
          type="button"
          className="link-button"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? "Hide" : "Show"} advanced options
        </button>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  )

  // Render main view (logged in)
  const renderMainView = () => (
    <div className="main-container">
      {/* Header */}
      <div className="header">
        <div className="user-info">
          <div className="user-avatar">
            {user?.first_name?.[0] || user?.email?.[0] || "U"}
          </div>
          <div className="user-details">
            <span className="user-name">
              {user?.first_name
                ? `${user.first_name} ${user.last_name || ""}`
                : user?.email}
            </span>
            <span className="user-email">{user?.email}</span>
          </div>
        </div>
        <button
          className="icon-button"
          onClick={() => setView("settings")}
          title="Settings"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Job Selector */}
      <div className="section">
        <h2>Select Job</h2>
        <div className="search-input-wrapper">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search jobs..."
            value={jobSearch}
            onChange={(e) => handleJobSearch(e.target.value)}
          />
        </div>

        <div className="job-list">
          {jobs.length === 0 ? (
            <div className="empty-state">
              {jobSearch ? "No jobs found" : "No active jobs"}
            </div>
          ) : (
            jobs.slice(0, 10).map((job) => (
              <div
                key={job.id}
                className={`job-item ${selectedJobId === job.id ? "selected" : ""}`}
                onClick={() => handleJobSelect(job.id)}
              >
                <div className="job-item-content">
                  <span className="job-title">{job.title}</span>
                  {job.location && (
                    <span className="job-location">{job.location}</span>
                  )}
                </div>
                {selectedJobId === job.id && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="instructions">
        <p>
          On LinkedIn profiles, click the purple Klen button in the bottom-right
          to open the panel, then “Add as Candidate”.
        </p>
      </div>
    </div>
  )

  // Render settings view
  const renderSettingsView = () => (
    <div className="settings-container">
      <div className="settings-header">
        <button
          className="icon-button"
          onClick={() => setView("main")}
          title="Back"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h2>Settings</h2>
      </div>

      <div className="settings-section">
        <h3>Account</h3>
        <div className="settings-item">
          <span>Signed in as</span>
          <span className="settings-value">{user?.email}</span>
        </div>
        <button
          className="btn btn-secondary btn-full"
          onClick={handleLogout}
          disabled={isLoading}
        >
          Sign Out
        </button>
      </div>

      <div className="settings-section">
        <h3>About</h3>
        <div className="settings-item">
          <span>Version</span>
          <span className="settings-value">1.0.0</span>
        </div>
      </div>
    </div>
  )

  // Loading state
  if (isLoading && !isAuthenticated && !error) {
    return (
      <div className="popup-container">
        <div className="loading">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="popup-container">
      {!isAuthenticated && renderLoginForm()}
      {isAuthenticated && view === "main" && renderMainView()}
      {isAuthenticated && view === "settings" && renderSettingsView()}
    </div>
  )
}

export default Popup

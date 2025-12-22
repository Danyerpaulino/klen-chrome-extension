/**
 * LinkedIn Profile Content Script
 *
 * Runs on LinkedIn profile pages (linkedin.com/in/*)
 * Injects a floating panel with "Add to Klen" functionality
 */

import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useState, useCallback, useRef } from "react"
import {
  extractLinkedInProfile,
  isLinkedInProfilePage,
  extractProfileUrl
} from "~/lib/linkedin-extractor"
import type {
  Job,
  LinkedInImportResponse,
  MessageResponse
} from "~/types"

// Content script configuration
export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/in/*", "https://linkedin.com/in/*"],
  all_frames: false
}

// Custom styles for the injected panel
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    .klen-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      max-height: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      z-index: 2147483647;
      overflow: hidden;
    }

    .klen-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
    }

    .klen-panel-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }

    .klen-panel-close {
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .klen-panel-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .klen-panel-body {
      padding: 16px;
    }

    .klen-profile-preview {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f9fafb;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .klen-profile-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #e5e7eb;
      overflow: hidden;
    }

    .klen-profile-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .klen-profile-info {
      flex: 1;
      min-width: 0;
    }

    .klen-profile-name {
      font-weight: 600;
      font-size: 14px;
      color: #111827;
      margin: 0 0 2px 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .klen-profile-title {
      font-size: 12px;
      color: #6b7280;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .klen-job-select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 12px;
      background: white;
      cursor: pointer;
    }

    .klen-job-select:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .klen-btn {
      width: 100%;
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .klen-btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
    }

    .klen-btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }

    .klen-btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .klen-btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }

    .klen-btn-secondary:hover {
      background: #e5e7eb;
    }

    .klen-status {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 13px;
    }

    .klen-status-success {
      background: #d1fae5;
      color: #065f46;
    }

    .klen-status-error {
      background: #fee2e2;
      color: #991b1b;
    }

    .klen-status-info {
      background: #dbeafe;
      color: #1e40af;
    }

    .klen-login-prompt {
      text-align: center;
      padding: 20px;
    }

    .klen-login-prompt p {
      margin: 0 0 12px 0;
      color: #6b7280;
      font-size: 13px;
    }

    .klen-toggle-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      transition: transform 0.2s;
    }

    .klen-toggle-btn:hover {
      transform: scale(1.05);
    }

    .klen-score-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .klen-score-high {
      background: #d1fae5;
      color: #065f46;
    }

    .klen-score-medium {
      background: #fef3c7;
      color: #92400e;
    }

    .klen-score-low {
      background: #fee2e2;
      color: #991b1b;
    }
  `
  return style
}

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

// Main content component
function LinkedInProfilePanel() {
  const [isOpen, setIsOpen] = useState(false)
  const hasAutoOpenedRef = useRef(false)
  const profileExtractAttemptsRef = useRef(0)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{
    type: "success" | "error" | "info"
    message: string
  } | null>(null)
  const [importResult, setImportResult] = useState<LinkedInImportResponse | null>(null)

  // Profile data from extraction
  const [profileData, setProfileData] = useState<{
    name: string
    title: string
    imageUrl?: string
  } | null>(null)

  const loadJobs = useCallback(async () => {
    const response = await sendMessage<{ jobs: Job[] }>("GET_JOBS")
    if (response.success && response.data) {
      setJobs(Array.isArray(response.data.jobs) ? response.data.jobs : [])
    }
  }, [])

  const checkAuthStatus = useCallback(async () => {
    const response = await sendMessage<{
      isAuthenticated: boolean
      selectedJobId?: string
    }>("GET_AUTH_STATUS")

    if (response.success && response.data) {
      setIsAuthenticated(response.data.isAuthenticated)
      if (response.data.selectedJobId) {
        setSelectedJobId(response.data.selectedJobId)

        if (!hasAutoOpenedRef.current) {
          setIsOpen(true)
          hasAutoOpenedRef.current = true
        }
      }

      // Load jobs if authenticated
      if (response.data.isAuthenticated) {
        await loadJobs()
      }
    }
  }, [loadJobs])

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  // Re-check auth status when opening (covers: logged in via popup after page load)
  useEffect(() => {
    if (isOpen) {
      checkAuthStatus()
    }
  }, [isOpen, checkAuthStatus])

  // Extract profile when panel opens
  useEffect(() => {
    if (!isOpen || !isLinkedInProfilePage()) {
      return
    }

    let isCancelled = false
    profileExtractAttemptsRef.current = 0

    const extractAndUpdate = () => {
      const { profile } = extractLinkedInProfile()
      if (isCancelled) return

      setProfileData({
        name: profile.name || "Unknown",
        title: profile.headline || profile.job_title || "",
        imageUrl: profile.profile_image_url
      })

      profileExtractAttemptsRef.current += 1
      if (
        profileExtractAttemptsRef.current < 3 &&
        (!profile.name || profile.name === "Unknown")
      ) {
        window.setTimeout(extractAndUpdate, 1000)
      }
    }

    extractAndUpdate()

    return () => {
      isCancelled = true
    }
  }, [isOpen])

  const handleJobChange = async (jobId: string) => {
    setSelectedJobId(jobId)
    await sendMessage("SELECT_JOB", { jobId })
  }

  const handleAddCandidate = async () => {
    if (!selectedJobId) {
      setStatus({ type: "error", message: "Please select a job first" })
      return
    }

    if (!isLinkedInProfilePage()) {
      setStatus({ type: "error", message: "Not a LinkedIn profile page" })
      return
    }

    setIsLoading(true)
    setStatus(null)
    setImportResult(null)

    try {
      // Extract profile data
      const { profile, profileUrl, rawText } = extractLinkedInProfile()

      // Send to background for import
      const response = await sendMessage<LinkedInImportResponse>(
        "IMPORT_LINKEDIN_PROFILE",
        {
          jobId: selectedJobId,
          profile,
          profileUrl,
          rawText
        }
      )

      if (response.success && response.data) {
        setImportResult(response.data)
        if (response.data.is_duplicate) {
          setStatus({
            type: "info",
            message: "Candidate already exists in this job"
          })
        } else {
          setStatus({
            type: "success",
            message: "Candidate added successfully!"
          })
        }
      } else {
        setStatus({
          type: "error",
          message: response.error || "Failed to add candidate"
        })
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const openPopup = () => {
    // This will open the extension popup
    chrome.runtime.sendMessage({ type: "OPEN_POPUP" })
  }

  // Get score badge color
  const getScoreBadgeClass = (score?: number) => {
    if (!score) return ""
    if (score >= 70) return "klen-score-high"
    if (score >= 50) return "klen-score-medium"
    return "klen-score-low"
  }

  // Render toggle button when panel is closed
  if (!isOpen) {
    return (
      <button
        className="klen-toggle-btn"
        onClick={() => setIsOpen(true)}
        title="Open Klen Panel"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      </button>
    )
  }

  // Render full panel
  return (
    <div className="klen-panel">
      <div className="klen-panel-header">
        <h3>Klen Recruiting</h3>
        <button
          className="klen-panel-close"
          onClick={() => setIsOpen(false)}
          title="Close"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="klen-panel-body">
        {!isAuthenticated ? (
          <div className="klen-login-prompt">
            <p>Please log in to Klen to add candidates</p>
            <button className="klen-btn klen-btn-primary" onClick={openPopup}>
              Open Klen
            </button>
          </div>
        ) : (
          <>
            {/* Profile Preview */}
            {profileData && (
              <div className="klen-profile-preview">
                <div className="klen-profile-avatar">
                  {profileData.imageUrl ? (
                    <img src={profileData.imageUrl} alt="" />
                  ) : (
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="#9ca3af"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  )}
                </div>
                <div className="klen-profile-info">
                  <p className="klen-profile-name">{profileData.name}</p>
                  <p className="klen-profile-title">{profileData.title}</p>
                </div>
              </div>
            )}

            {/* Job Selector */}
            <select
              className="klen-job-select"
              value={selectedJobId}
              onChange={(e) => handleJobChange(e.target.value)}
            >
              <option value="">Select a job...</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>

            {/* Add Candidate Button */}
            <button
              className="klen-btn klen-btn-primary"
              onClick={handleAddCandidate}
              disabled={isLoading || !selectedJobId}
            >
              {isLoading ? "Adding..." : "Add as Candidate"}
            </button>

            {/* Status Message */}
            {status && (
              <div className={`klen-status klen-status-${status.type}`}>
                {status.message}
                {importResult?.score !== undefined && (
                  <span
                    className={`klen-score-badge ${getScoreBadgeClass(importResult.score)}`}
                    style={{ marginLeft: 8 }}
                  >
                    Score: {importResult.score}%
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default LinkedInProfilePanel

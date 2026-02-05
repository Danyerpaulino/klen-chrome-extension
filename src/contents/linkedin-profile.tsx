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
  isLinkedInProfilePage
} from "~/lib/linkedin-extractor"
import type {
  Job,
  ClusterOutreachContext,
  LinkedInICPResponse,
  LinkedInImportResponse,
  LinkedInInMailDraftResponse,
  LinkedInInMailLength,
  LinkedInInMailOutreachMode,
  LinkedInInMailTone,
  MessageResponse,
  ResolveByLinkedInResponse
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
      max-height: 80vh;
      height: min(80vh, 620px);
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      z-index: 2147483647;
      overflow: hidden;
      display: flex;
      flex-direction: column;
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
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      flex: 1 1 auto;
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

    .klen-status-action {
      width: auto;
      padding: 4px 8px;
      font-size: 12px;
      border-radius: 999px;
      margin-left: 8px;
    }

    .klen-status-action:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .klen-action-stack {
      display: grid;
      gap: 8px;
    }

    .klen-field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
    }

    .klen-field-group {
      display: grid;
      gap: 6px;
    }

    .klen-field-label {
      font-size: 12px;
      font-weight: 600;
      color: #374151;
    }

    .klen-textarea {
      width: 100%;
      min-height: 64px;
      padding: 8px 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 12px;
      font-family: inherit;
      background: white;
      resize: vertical;
    }

    .klen-textarea:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .klen-field-hint {
      font-size: 11px;
      color: #6b7280;
      text-align: right;
    }

    .klen-select {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 13px;
      background: white;
    }

    .klen-select:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .klen-outreach-card {
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #f9fafb;
      display: grid;
      gap: 8px;
    }

    .klen-outreach-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .klen-outreach-header .klen-inmail-copy {
      margin-left: auto;
    }

    .klen-mode-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
    }

    .klen-mode-candidate {
      background: #e0f2fe;
      color: #0369a1;
    }

    .klen-mode-employer {
      background: #f3f4f6;
      color: #6b7280;
    }

    .klen-outreach-preview {
      display: grid;
      gap: 8px;
    }

    .klen-outreach-list {
      display: grid;
      gap: 4px;
    }

    .klen-outreach-item {
      font-size: 11px;
      color: #374151;
    }

    .klen-outreach-stats {
      display: grid;
      gap: 6px;
      border-top: 1px dashed #e5e7eb;
      padding-top: 8px;
    }

    .klen-outreach-stat {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      color: #4b5563;
    }

    .klen-outreach-stat-label {
      font-weight: 600;
      color: #6b7280;
    }

    .klen-outreach-stat-value {
      color: #111827;
      text-align: right;
    }

    .klen-outreach-snapshot {
      font-size: 11px;
      color: #4b5563;
      background: #ffffff;
      border: 1px dashed #e5e7eb;
      padding: 6px 8px;
      border-radius: 8px;
    }

    .klen-outreach-hint {
      font-size: 11px;
      color: #6b7280;
    }

    .klen-inmail-preview {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      display: grid;
      gap: 8px;
    }

    .klen-inmail-label {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .klen-inmail-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .klen-inmail-copy {
      border: 1px solid #e5e7eb;
      background: white;
      color: #374151;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 999px;
      cursor: pointer;
    }

    .klen-inmail-copy:hover {
      background: #f3f4f6;
    }

    .klen-inmail-subject {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
    }

    .klen-inmail-body {
      font-size: 12px;
      color: #374151;
      white-space: pre-wrap;
      line-height: 1.45;
    }

    .klen-copy-btn {
      width: fit-content;
      padding: 6px 10px;
      font-size: 12px;
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

    .klen-privacy-note {
      margin-top: 12px;
      padding: 8px 10px;
      background: #ecfdf5;
      border-radius: 6px;
      color: #065f46;
      font-size: 11px;
      text-align: center;
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

function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatScore(value: unknown): number | null {
  const parsed = coerceFiniteNumber(value)
  if (parsed === null) return null
  return Math.round(parsed)
}

function formatCurrencyValue(value: unknown, currency?: string): string | null {
  const amount = coerceFiniteNumber(value)
  if (amount === null) return null

  const safeCurrency =
    typeof currency === "string" && currency.trim() ? currency.trim() : "USD"

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 0
    }).format(amount)
  } catch {
    return `$${Math.round(amount)}`
  }
}

function formatCurrencyRange(
  minValue: unknown,
  maxValue: unknown,
  currency?: string
): string | null {
  const minFormatted = formatCurrencyValue(minValue, currency)
  const maxFormatted = formatCurrencyValue(maxValue, currency)

  if (minFormatted && maxFormatted) {
    return `${minFormatted} - ${maxFormatted}`
  }
  return minFormatted || maxFormatted
}

function buildMarketSnapshot(context: ClusterOutreachContext | null): string | null {
  if (!context) return null

  const parts: string[] = []
  if (context.market_demand_count > 0) {
    parts.push(`${context.market_demand_count} companies actively hiring`)
  }

  const salaryRange = formatCurrencyRange(
    context.salary_range_min,
    context.salary_range_max,
    context.salary_currency
  )
  if (salaryRange) {
    parts.push(`Salary range ${salaryRange}`)
  }

  if (Array.isArray(context.top_skills) && context.top_skills.length > 0) {
    parts.push(`Top skills: ${context.top_skills.slice(0, 6).join(", ")}`)
  }

  if (parts.length === 0) return null
  return `Market snapshot: ${parts.join(" | ")}`
}

const INMAIL_CONTEXT_MAX = 500
const OUTREACH_VALUE_PROPS = [
  "Free salary benchmark for their role and market",
  "AI resume analysis with improvement tips",
  "Professional 60-second highlight reel they can use anywhere",
  "Representation to active employers with no commitment",
  "We only get paid when they get hired"
]

// Main content component
function LinkedInProfilePanel() {
  const [isOpen, setIsOpen] = useState(false)
  const hasAutoOpenedRef = useRef(false)
  const profileExtractAttemptsRef = useRef(0)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRescoreLoading, setIsRescoreLoading] = useState(false)
  const [status, setStatus] = useState<{
    type: "success" | "error" | "info"
    message: string
  } | null>(null)
  const [importResult, setImportResult] = useState<LinkedInImportResponse | null>(null)
  const [inmailStatus, setInmailStatus] = useState<{
    type: "success" | "error" | "info"
    message: string
  } | null>(null)
  const [inmailDraft, setInmailDraft] = useState<LinkedInInMailDraftResponse | null>(null)
  const [isInmailLoading, setIsInmailLoading] = useState(false)
  const [inmailTone, setInmailTone] = useState<LinkedInInMailTone>("professional")
  const [inmailLength, setInmailLength] = useState<LinkedInInMailLength>("short")
  const [inmailContext, setInmailContext] = useState("")
  const [outreachMode, setOutreachMode] =
    useState<LinkedInInMailOutreachMode>("employer_centric")
  const [icpStatus, setIcpStatus] = useState<{
    type: "success" | "error" | "info"
    message: string
  } | null>(null)
  const [icpResult, setIcpResult] = useState<LinkedInICPResponse | null>(null)
  const [isIcpLoading, setIsIcpLoading] = useState(false)
  const [clusterContext, setClusterContext] = useState<ClusterOutreachContext | null>(
    null
  )
  const [clusterStatus, setClusterStatus] = useState<{
    type: "success" | "error" | "info"
    message: string
  } | null>(null)
  const [isClusterLoading, setIsClusterLoading] = useState(false)
  const importAttemptRef = useRef(0)

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
      outreachMode?: LinkedInInMailOutreachMode
    }>("GET_AUTH_STATUS")

    if (response.success && response.data) {
      setIsAuthenticated(response.data.isAuthenticated)
      setOutreachMode(response.data.outreachMode || "employer_centric")

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

  const loadClusterContext = useCallback(async (jobId: string) => {
    if (!jobId) return

    setIsClusterLoading(true)
    setClusterStatus(null)
    try {
      const response = await sendMessage<ClusterOutreachContext>(
        "GET_CLUSTER_CONTEXT",
        { jobId }
      )
      if (response.success && response.data) {
        setClusterContext(response.data)
      } else {
        setClusterContext(null)
        setClusterStatus({
          type: "info",
          message: response.error || "Cluster context unavailable for this job."
        })
      }
    } catch (error) {
      setClusterContext(null)
      setClusterStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load cluster context"
      })
    } finally {
      setIsClusterLoading(false)
    }
  }, [])

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

  useEffect(() => {
    if (!isOpen || !isAuthenticated) return

    if (!selectedJobId || outreachMode !== "candidate_centric") {
      setClusterContext(null)
      setClusterStatus(null)
      return
    }

    void loadClusterContext(selectedJobId)
  }, [isOpen, isAuthenticated, selectedJobId, outreachMode, loadClusterContext])

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
    setInmailStatus(null)
    setInmailDraft(null)
    setClusterContext(null)
    setClusterStatus(null)
    await sendMessage("SELECT_JOB", { jobId })
  }

  const handleAddCandidate = async (options?: { forceRescore?: boolean }) => {
    const attemptId = ++importAttemptRef.current
    const isRescore = Boolean(options?.forceRescore)

    if (!selectedJobId) {
      setStatus({ type: "error", message: "Please select a job first" })
      return
    }

    const jobId = selectedJobId

    if (!isLinkedInProfilePage()) {
      setStatus({ type: "error", message: "Not a LinkedIn profile page" })
      return
    }

    if (isRescore) {
      setIsRescoreLoading(true)
    } else {
      setIsLoading(true)
      setStatus(null)
      setImportResult(null)
      setInmailStatus(null)
      setInmailDraft(null)
    }

    try {
      // Extract profile data
      const { profile, profileUrl, rawText } = extractLinkedInProfile()

      // Send to background for import
      const response = await sendMessage<LinkedInImportResponse>(
        "IMPORT_LINKEDIN_PROFILE",
        {
          jobId,
          profile,
          profileUrl,
          rawText,
          forceRescore: isRescore
        }
      )

      if (response.success && response.data) {
        setImportResult(response.data)
        const hasScore = typeof response.data.score === "number"
        const message =
          response.data.message ||
          (response.data.is_duplicate
            ? "Candidate already exists in this job"
            : hasScore
              ? "Candidate added successfully!"
              : "Candidate added successfully! Scoring in progress...")

        setStatus({
          type: response.data.is_duplicate ? "info" : hasScore ? "success" : "info",
          message
        })

        // If scoring is async, poll the resolve endpoint until we get a score.
        if (!hasScore) {
          const linkedinUrl = response.data.linkedin_url || profileUrl
          const startedAt = Date.now()
          const maxDurationMs = 5 * 60 * 1000
          const baseDelayMs = 1200
          const maxDelayMs = 15_000

          let attempt = 0
          let delayMs = baseDelayMs

          while (Date.now() - startedAt < maxDurationMs) {
            await new Promise((resolve) => window.setTimeout(resolve, delayMs))

            // Abort if a new import attempt has started
            if (importAttemptRef.current !== attemptId) return

            const resolveResponse = await sendMessage<ResolveByLinkedInResponse>(
              "RESOLVE_LINKEDIN_CANDIDATE",
              { jobId, linkedinUrl }
            )

            const resolvedData = resolveResponse.data
            const resolvedScore = coerceFiniteNumber(resolvedData?.score)

            if (
              resolveResponse.success &&
              resolvedData?.found &&
              resolvedScore !== null
            ) {
              setImportResult((prev) =>
                prev ? { ...prev, score: resolvedScore } : prev
              )
              setStatus({
                type: "success",
                message: response.data.is_duplicate
                  ? "Candidate updated successfully!"
                  : "Candidate added successfully!"
              })
              return
            }

            attempt += 1
            delayMs = Math.min(maxDelayMs, baseDelayMs * Math.pow(1.5, attempt))
          }

          setStatus({
            type: "info",
            message:
              "Candidate saved successfully, but scoring is taking longer than expected — it will update in Klen once complete."
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
      if (isRescore) {
        setIsRescoreLoading(false)
      } else {
        setIsLoading(false)
      }
    }
  }

  const handleRescoreCandidate = async () => {
    await handleAddCandidate({ forceRescore: true })
  }

  const openPopup = () => {
    // This will open the extension popup
    chrome.runtime.sendMessage({ type: "OPEN_POPUP" })
  }

  // Get score badge color
  const getScoreBadgeClass = (score?: number) => {
    if (typeof score !== "number") return ""
    if (score >= 70) return "klen-score-high"
    if (score >= 50) return "klen-score-medium"
    return "klen-score-low"
  }

  const handleCreateIcp = async () => {
    if (!selectedJobId) {
      setIcpStatus({ type: "error", message: "Please select a job first" })
      return
    }

    if (!isLinkedInProfilePage()) {
      setIcpStatus({ type: "error", message: "Not a LinkedIn profile page" })
      return
    }

    setIsIcpLoading(true)
    setIcpStatus(null)
    setIcpResult(null)

    try {
      const { profile, profileUrl } = extractLinkedInProfile()

      const response = await sendMessage<LinkedInICPResponse>(
        "CREATE_ICP_FROM_PROFILE",
        {
          jobId: selectedJobId,
          profile,
          profileUrl
        }
      )

      if (response.success && response.data) {
        setIcpResult(response.data)
        setIcpStatus({
          type: "success",
          message:
            response.data.message ||
            (response.data.updated
              ? "Ideal Candidate Profile updated!"
              : "Ideal Candidate Profile created!")
        })
      } else {
        setIcpStatus({
          type: "error",
          message: response.error || "Failed to create Ideal Candidate Profile"
        })
      }
    } catch (error) {
      setIcpStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error"
      })
    } finally {
      setIsIcpLoading(false)
    }
  }

  const handleDraftInmail = async () => {
    if (!selectedJobId) {
      setInmailStatus({ type: "error", message: "Please select a job first" })
      return
    }

    if (!isLinkedInProfilePage()) {
      setInmailStatus({ type: "error", message: "Not a LinkedIn profile page" })
      return
    }

    setIsInmailLoading(true)
    setInmailStatus(null)
    setInmailDraft(null)

    try {
      const trimmedContext = inmailContext.trim()
      const marketSnapshot =
        outreachMode === "candidate_centric"
          ? buildMarketSnapshot(clusterContext)
          : null
      const contextParts = [trimmedContext, marketSnapshot].filter(Boolean) as string[]
      const mergedContext = contextParts.join("\n")
      const context =
        mergedContext.length > 0
          ? mergedContext.slice(0, INMAIL_CONTEXT_MAX)
          : undefined
      const { profileUrl } = extractLinkedInProfile()
      if (!profileUrl) {
        setInmailStatus({ type: "error", message: "LinkedIn profile URL not found" })
        return
      }

      const importMatchesJob = importResult?.job_id === selectedJobId
      const importMatchesProfile =
        importResult?.linkedin_url && importResult.linkedin_url === profileUrl
      const canUseImport = importMatchesJob && importMatchesProfile

      let candidateId = canUseImport ? importResult?.candidate_id : undefined
      let jobCandidateId = canUseImport ? importResult?.job_candidate_id : undefined

      if (!candidateId && !jobCandidateId) {
        const resolveResponse = await sendMessage<ResolveByLinkedInResponse>(
          "RESOLVE_LINKEDIN_CANDIDATE",
          { jobId: selectedJobId, linkedinUrl: profileUrl }
        )

        if (!resolveResponse.success || !resolveResponse.data?.found) {
          setInmailStatus({
            type: "error",
            message: "Add this profile as a candidate before drafting an InMail."
          })
          return
        }

        candidateId = resolveResponse.data.candidate_id
        jobCandidateId = resolveResponse.data.job_candidate_id
      }

      if (!candidateId && !jobCandidateId) {
        setInmailStatus({
          type: "error",
          message: "Candidate could not be resolved for this job."
        })
        return
      }

      const response = await sendMessage<LinkedInInMailDraftResponse>(
        "DRAFT_LINKEDIN_INMAIL",
        {
          jobId: selectedJobId,
          request: {
            candidate_id: candidateId,
            job_candidate_id: jobCandidateId,
            linkedin_url: profileUrl,
            tone: inmailTone,
            length: inmailLength,
            context,
            outreach_mode: outreachMode
          }
        }
      )

      if (response.success && response.data) {
        setInmailDraft(response.data)
        setInmailStatus({
          type: "success",
          message: "Draft ready. Review and copy when ready."
        })
      } else {
        setInmailStatus({
          type: "error",
          message: response.error || "Failed to draft InMail"
        })
      }
    } catch (error) {
      setInmailStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error"
      })
    } finally {
      setIsInmailLoading(false)
    }
  }

  const copyInmailText = async (text: string, successMessage: string) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access unavailable")
      }

      await navigator.clipboard.writeText(text)
      setInmailStatus({ type: "success", message: successMessage })
    } catch (error) {
      setInmailStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to copy to clipboard"
      })
    }
  }

  const handleCopyInmail = async () => {
    if (!inmailDraft) return

    const text = `Subject: ${inmailDraft.subject}\n\n${inmailDraft.content}`
    await copyInmailText(text, "InMail copied to clipboard.")
  }

  const handleCopyInmailSubject = async () => {
    if (!inmailDraft) return
    await copyInmailText(inmailDraft.subject, "Subject copied to clipboard.")
  }

  const handleCopyInmailBody = async () => {
    if (!inmailDraft) return
    await copyInmailText(inmailDraft.content, "InMail body copied to clipboard.")
  }

  const getScoreEmoji = (score?: number) => {
    if (typeof score !== "number") return ""
    if (score >= 85) return "🔥"
    if (score >= 70) return "✨"
    if (score >= 50) return "👍"
    return "🧊"
  }

  const displayScore = formatScore(importResult?.score)
  const scoreBadgeClass = getScoreBadgeClass(displayScore ?? undefined)
  const scoreEmoji = getScoreEmoji(displayScore ?? undefined)
  const canRescore = Boolean(
    importResult?.is_duplicate &&
      displayScore !== null &&
      importResult?.job_id === selectedJobId
  )
  const marketSnapshot =
    outreachMode === "candidate_centric" ? buildMarketSnapshot(clusterContext) : null
  const demandCount = clusterContext?.market_demand_count || 0
  const demandDisplay =
    demandCount > 0 ? new Intl.NumberFormat("en-US").format(demandCount) : "n/a"
  const salaryRange = clusterContext
    ? formatCurrencyRange(
        clusterContext.salary_range_min,
        clusterContext.salary_range_max,
        clusterContext.salary_currency
      )
    : null
  const topSkills = Array.isArray(clusterContext?.top_skills)
    ? clusterContext?.top_skills.slice(0, 6)
    : []

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

            <div className="klen-action-stack">
              <button
                className="klen-btn klen-btn-primary"
                onClick={handleAddCandidate}
                disabled={isLoading || !selectedJobId}
              >
                {isLoading ? "Adding..." : "Add as Candidate"}
              </button>
              <label className="klen-field-group">
                <span className="klen-field-label">Draft context (optional)</span>
                <textarea
                  className="klen-textarea"
                  value={inmailContext}
                  onChange={(e) => setInmailContext(e.target.value)}
                  placeholder="Share a short note to personalize this InMail."
                  maxLength={INMAIL_CONTEXT_MAX}
                />
                <span className="klen-field-hint">
                  {inmailContext.length}/{INMAIL_CONTEXT_MAX}
                </span>
              </label>
              <div className="klen-field-row">
                <label className="klen-field-group">
                  <span className="klen-field-label">Tone</span>
                  <select
                    className="klen-select"
                    value={inmailTone}
                    onChange={(e) =>
                      setInmailTone(e.target.value as LinkedInInMailTone)
                    }
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="direct">Direct</option>
                    <option value="warm">Warm</option>
                    <option value="consultative">Consultative</option>
                  </select>
                </label>
                <label className="klen-field-group">
                  <span className="klen-field-label">Length</span>
                  <select
                    className="klen-select"
                    value={inmailLength}
                    onChange={(e) =>
                      setInmailLength(e.target.value as LinkedInInMailLength)
                    }
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </label>
              </div>
              <div className="klen-outreach-card">
                <div className="klen-outreach-header">
                  <span className="klen-field-label">Outreach mode</span>
                  <span
                    className={`klen-mode-badge ${
                      outreachMode === "candidate_centric"
                        ? "klen-mode-candidate"
                        : "klen-mode-employer"
                    }`}
                  >
                    {outreachMode === "candidate_centric"
                      ? "Candidate-centric"
                      : "Employer-centric"}
                  </span>
                  <button
                    className="klen-inmail-copy"
                    onClick={openPopup}
                    type="button"
                  >
                    Settings
                  </button>
                </div>
                {outreachMode === "candidate_centric" ? (
                  <div className="klen-outreach-preview">
                    <div className="klen-inmail-label">Value prop preview</div>
                    <div className="klen-outreach-list">
                      {OUTREACH_VALUE_PROPS.map((item) => (
                        <div key={item} className="klen-outreach-item">
                          {item}
                        </div>
                      ))}
                    </div>
                    <div className="klen-outreach-stats">
                      <div className="klen-outreach-stat">
                        <span className="klen-outreach-stat-label">Market demand</span>
                        <span className="klen-outreach-stat-value">
                          {demandDisplay} companies
                        </span>
                      </div>
                      <div className="klen-outreach-stat">
                        <span className="klen-outreach-stat-label">Salary range</span>
                        <span className="klen-outreach-stat-value">
                          {salaryRange || "n/a"}
                        </span>
                      </div>
                      {topSkills.length > 0 && (
                        <div className="klen-outreach-stat">
                          <span className="klen-outreach-stat-label">Top skills</span>
                          <span className="klen-outreach-stat-value">
                            {topSkills.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                    {marketSnapshot && (
                      <div className="klen-outreach-snapshot">
                        {marketSnapshot}
                      </div>
                    )}
                    {isClusterLoading && (
                      <div className="klen-outreach-hint">Loading market stats...</div>
                    )}
                    {clusterStatus && (
                      <div className="klen-outreach-hint">{clusterStatus.message}</div>
                    )}
                  </div>
                ) : (
                  <div className="klen-outreach-hint">
                    Enable candidate outreach to unlock value-prop messaging.
                  </div>
                )}
              </div>
              <button
                className="klen-btn klen-btn-secondary"
                onClick={handleDraftInmail}
                disabled={isInmailLoading || !selectedJobId}
              >
                {isInmailLoading ? "Drafting..." : "Draft InMail"}
              </button>
              <button
                className="klen-btn klen-btn-secondary"
                onClick={handleCreateIcp}
                disabled={isIcpLoading || !selectedJobId}
              >
                {isIcpLoading ? "Building ICP..." : "Use as Ideal Profile"}
              </button>
            </div>

            {/* Status Message */}
            {status && (
              <div className={`klen-status klen-status-${status.type}`}>
                <span>{status.message}</span>
                {canRescore && (
                  <button
                    className="klen-btn klen-btn-secondary klen-status-action"
                    onClick={handleRescoreCandidate}
                    disabled={isRescoreLoading}
                  >
                    {isRescoreLoading ? "Rescoring..." : "Rescore"}
                  </button>
                )}
                {displayScore !== null && (
                  <span
                    className={`klen-score-badge ${scoreBadgeClass}`}
                    style={{ marginLeft: 8 }}
                  >
                    {scoreEmoji} Score: {displayScore}%
                  </span>
                )}
              </div>
            )}

            {inmailStatus && (
              <div className={`klen-status klen-status-${inmailStatus.type}`}>
                {inmailStatus.message}
              </div>
            )}

            {inmailDraft && (
              <div className="klen-inmail-preview">
                <div>
                  <div className="klen-inmail-row">
                    <div className="klen-inmail-label">Subject</div>
                    <button className="klen-inmail-copy" onClick={handleCopyInmailSubject}>
                      Copy
                    </button>
                  </div>
                  <div className="klen-inmail-subject">{inmailDraft.subject}</div>
                </div>
                <div>
                  <div className="klen-inmail-row">
                    <div className="klen-inmail-label">Body</div>
                    <button className="klen-inmail-copy" onClick={handleCopyInmailBody}>
                      Copy
                    </button>
                  </div>
                  <div className="klen-inmail-body">{inmailDraft.content}</div>
                </div>
                <button
                  className="klen-btn klen-btn-secondary klen-copy-btn"
                  onClick={handleCopyInmail}
                >
                  Copy InMail
                </button>
              </div>
            )}

            {icpStatus && (
              <div className={`klen-status klen-status-${icpStatus.type}`}>
                {icpStatus.message}
                {typeof icpResult?.criteria_count === "number" && (
                  <span className="klen-score-badge klen-score-high" style={{ marginLeft: 8 }}>
                    Criteria: {icpResult.criteria_count}
                  </span>
                )}
              </div>
            )}

            {/* Privacy note */}
            <div className="klen-privacy-note">
              Nothing happens automatically. Data is only collected when you click "Add as Candidate".
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default LinkedInProfilePanel

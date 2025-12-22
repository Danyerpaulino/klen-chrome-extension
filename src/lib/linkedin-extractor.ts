/**
 * LinkedIn Profile Data Extractor
 *
 * Extracts visible profile data from LinkedIn profile pages.
 * Uses multiple selector strategies for robustness against DOM changes.
 */

import type {
  LinkedInProfileSnapshot,
  LinkedInExperienceEntry,
  LinkedInEducationEntry
} from "~/types"

// Selector variants for different LinkedIn UI versions
const SELECTORS = {
  // Profile header selectors
  name: [
    "h1.text-heading-xlarge",
    ".pv-text-details__left-panel h1",
    ".pv-top-card--list li:first-child",
    'h1[data-anonymize="person-name"]',
    ".top-card-layout__title"
  ],

  // Headline selectors
  headline: [
    ".text-body-medium.break-words",
    ".pv-text-details__left-panel .text-body-medium",
    ".pv-top-card--list-bullet li",
    'div[data-anonymize="headline"]',
    ".top-card-layout__headline"
  ],

  // Location selectors
  location: [
    ".pv-text-details__left-panel .text-body-small:last-child",
    ".pv-top-card--list-bullet li:last-child",
    'span[data-anonymize="location"]',
    ".top-card-layout__first-subline"
  ],

  // About section selectors
  about: [
    "#about ~ .display-flex .pv-shared-text-with-see-more span.visually-hidden",
    "#about ~ .display-flex .inline-show-more-text",
    ".pv-about__summary-text",
    'section[data-section="summary"] .pv-shared-text-with-see-more',
    "#about + div span[aria-hidden='true']"
  ],

  // Experience section selectors
  experienceSection: [
    "#experience ~ .pvs-list__outer-container",
    "#experience + div + div",
    'section[data-section="experience"]',
    ".experience-section"
  ],

  experienceItem: [
    ".pvs-entity",
    ".pv-entity__position-group",
    ".experience-item"
  ],

  // Education section selectors
  educationSection: [
    "#education ~ .pvs-list__outer-container",
    "#education + div + div",
    'section[data-section="education"]',
    ".education-section"
  ],

  educationItem: [
    ".pvs-entity",
    ".pv-education-entity",
    ".education-item"
  ],

  // Skills section selectors
  skillsSection: [
    "#skills ~ .pvs-list__outer-container",
    'section[data-section="skills"]',
    ".pv-skill-categories-section"
  ],

  skillItem: [
    ".pvs-entity .mr1 span[aria-hidden='true']",
    ".pv-skill-category-entity__name",
    ".skill-item"
  ],

  // Profile image
  profileImage: [
    ".pv-top-card-profile-picture__image",
    ".pv-top-card__photo",
    ".profile-photo-edit__preview",
    "img.pv-top-card-profile-picture__image--show"
  ]
}

/**
 * Try multiple selectors and return the first match
 */
function querySelector(selectors: string[]): Element | null {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector)
      if (element) return element
    } catch (e) {
      // Invalid selector, skip
    }
  }
  return null
}

/**
 * Try multiple selectors and return all matches from the first successful selector
 */
function querySelectorAll(selectors: string[]): Element[] {
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector)
      if (elements.length > 0) return Array.from(elements)
    } catch (e) {
      // Invalid selector, skip
    }
  }
  return []
}

/**
 * Get text content from an element, cleaned up
 */
function getTextContent(element: Element | null): string {
  if (!element) return ""
  return (element.textContent || "").trim().replace(/\s+/g, " ")
}

/**
 * Extract the canonical LinkedIn URL from the page
 */
export function extractProfileUrl(): string {
  // Try canonical link first
  const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
  if (canonical?.href) {
    return canonical.href.split("?")[0].replace(/\/$/, "")
  }

  // Fall back to current URL
  return window.location.href.split("?")[0].replace(/\/$/, "")
}

/**
 * Extract public identifier from URL
 */
export function extractPublicIdentifier(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  return match ? match[1].toLowerCase() : null
}

/**
 * Extract name from the profile
 */
function extractName(): { fullName: string; firstName?: string; lastName?: string } {
  const nameElement = querySelector(SELECTORS.name)
  const fullName = getTextContent(nameElement) || "Unknown"

  // Try to split into first/last name
  const parts = fullName.split(" ")
  if (parts.length >= 2) {
    return {
      fullName,
      firstName: parts[0],
      lastName: parts.slice(1).join(" ")
    }
  }

  return { fullName }
}

/**
 * Extract headline from the profile
 */
function extractHeadline(): string {
  const element = querySelector(SELECTORS.headline)
  return getTextContent(element)
}

/**
 * Extract location from the profile
 */
function extractLocation(): string {
  const element = querySelector(SELECTORS.location)
  return getTextContent(element)
}

/**
 * Extract about/summary section
 */
function extractAbout(): string {
  const element = querySelector(SELECTORS.about)
  return getTextContent(element)
}

/**
 * Parse headline for current job title and company
 */
function parseHeadlineForJob(headline: string): { title?: string; company?: string } {
  if (!headline) return {}

  // Common patterns: "Title at Company" or "Title | Company"
  const atMatch = headline.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|·]|$)/i)
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim() }
  }

  const pipeMatch = headline.match(/^(.+?)\s*[|·]\s*(.+?)(?:\s*[|·]|$)/)
  if (pipeMatch) {
    return { title: pipeMatch[1].trim(), company: pipeMatch[2].trim() }
  }

  return { title: headline }
}

/**
 * Extract experience entries
 */
function extractExperience(): LinkedInExperienceEntry[] {
  const experiences: LinkedInExperienceEntry[] = []

  // Find experience section
  const section = querySelector(SELECTORS.experienceSection)
  if (!section) return experiences

  // Find experience items
  const items = section.querySelectorAll(".pvs-entity, li.artdeco-list__item")

  items.forEach((item) => {
    try {
      // Extract title
      const titleEl = item.querySelector(
        ".mr1.hoverable-link-text span[aria-hidden='true'], " +
        ".pv-entity__summary-info h3, " +
        ".t-bold span[aria-hidden='true']"
      )
      const title = getTextContent(titleEl)

      // Extract company
      const companyEl = item.querySelector(
        ".t-14.t-normal span[aria-hidden='true'], " +
        ".pv-entity__secondary-title, " +
        ".t-normal span[aria-hidden='true']"
      )
      const company = getTextContent(companyEl).split("·")[0].trim()

      // Extract dates
      const dateEl = item.querySelector(
        ".pvs-entity__caption-wrapper span[aria-hidden='true'], " +
        ".pv-entity__date-range span:nth-child(2), " +
        ".t-black--light span[aria-hidden='true']"
      )
      const dateText = getTextContent(dateEl)
      const { start, end } = parseDateRange(dateText)

      // Extract description
      const descEl = item.querySelector(
        ".pv-shared-text-with-see-more span[aria-hidden='true'], " +
        ".pv-entity__description, " +
        ".inline-show-more-text"
      )
      const description = getTextContent(descEl)

      // Extract location
      const locEl = item.querySelector(
        ".t-14.t-normal.t-black--light span[aria-hidden='true']"
      )
      const location = getTextContent(locEl)

      if (title || company) {
        experiences.push({
          title: title || undefined,
          company: company || undefined,
          start,
          end,
          description: description || undefined,
          location: location || undefined
        })
      }
    } catch (e) {
      console.error("[Klen] Error extracting experience item:", e)
    }
  })

  return experiences.slice(0, 10) // Limit to 10 entries
}

/**
 * Parse date range string into start/end
 */
function parseDateRange(dateText: string): { start?: string; end?: string } {
  if (!dateText) return {}

  // Common patterns: "Jan 2020 - Present", "2018 - 2022", "Jan 2020 - Dec 2022"
  const match = dateText.match(/(\w+\s*\d{4}|\d{4})\s*[-–]\s*(\w+\s*\d{4}|\d{4}|Present)/i)
  if (match) {
    return {
      start: match[1].trim(),
      end: match[2].trim()
    }
  }

  return {}
}

/**
 * Extract education entries
 */
function extractEducation(): LinkedInEducationEntry[] {
  const education: LinkedInEducationEntry[] = []

  // Find education section
  const section = querySelector(SELECTORS.educationSection)
  if (!section) return education

  // Find education items
  const items = section.querySelectorAll(".pvs-entity, li.artdeco-list__item")

  items.forEach((item) => {
    try {
      // Extract school
      const schoolEl = item.querySelector(
        ".mr1.hoverable-link-text span[aria-hidden='true'], " +
        ".pv-entity__school-name, " +
        ".t-bold span[aria-hidden='true']"
      )
      const school = getTextContent(schoolEl)

      // Extract degree and field
      const degreeEl = item.querySelector(
        ".t-14.t-normal span[aria-hidden='true'], " +
        ".pv-entity__degree-name, " +
        ".t-normal span[aria-hidden='true']"
      )
      const degreeText = getTextContent(degreeEl)
      const { degree, field } = parseDegree(degreeText)

      // Extract dates
      const dateEl = item.querySelector(
        ".pvs-entity__caption-wrapper span[aria-hidden='true'], " +
        ".pv-entity__dates span:nth-child(2)"
      )
      const dateText = getTextContent(dateEl)
      const { start, end } = parseDateRange(dateText)

      if (school) {
        education.push({
          school,
          degree,
          field,
          start,
          end
        })
      }
    } catch (e) {
      console.error("[Klen] Error extracting education item:", e)
    }
  })

  return education.slice(0, 5) // Limit to 5 entries
}

/**
 * Parse degree string into degree type and field
 */
function parseDegree(text: string): { degree?: string; field?: string } {
  if (!text) return {}

  // Common patterns: "Bachelor of Science, Computer Science" or "BS in CS"
  const commaMatch = text.match(/^(.+?),\s*(.+?)$/)
  if (commaMatch) {
    return { degree: commaMatch[1].trim(), field: commaMatch[2].trim() }
  }

  const inMatch = text.match(/^(.+?)\s+in\s+(.+?)$/i)
  if (inMatch) {
    return { degree: inMatch[1].trim(), field: inMatch[2].trim() }
  }

  return { degree: text }
}

/**
 * Extract skills
 */
function extractSkills(): string[] {
  const skills: string[] = []
  const seen = new Set<string>()

  // Find skills section
  const section = querySelector(SELECTORS.skillsSection)
  if (!section) return skills

  // Find skill items
  const items = section.querySelectorAll(
    ".pvs-entity .mr1 span[aria-hidden='true'], " +
    ".pv-skill-category-entity__name-text"
  )

  items.forEach((item) => {
    const skill = getTextContent(item)
    if (skill && !seen.has(skill.toLowerCase())) {
      seen.add(skill.toLowerCase())
      skills.push(skill)
    }
  })

  return skills.slice(0, 20) // Limit to 20 skills
}

/**
 * Extract profile image URL
 */
function extractProfileImage(): string | undefined {
  const img = querySelector(SELECTORS.profileImage) as HTMLImageElement
  if (img?.src && !img.src.includes("ghost")) {
    return img.src
  }
  return undefined
}

/**
 * Generate raw text from profile sections for scoring
 */
function generateRawText(profile: LinkedInProfileSnapshot): string {
  const sections: string[] = []

  if (profile.name) sections.push(profile.name)
  if (profile.headline) sections.push(profile.headline)
  if (profile.location) sections.push(profile.location)
  if (profile.about) sections.push(`About: ${profile.about}`)

  if (profile.skills?.length) {
    sections.push(`Skills: ${profile.skills.join(", ")}`)
  }

  profile.experience?.forEach((exp) => {
    let text = ""
    if (exp.title) text += exp.title
    if (exp.company) text += ` at ${exp.company}`
    if (exp.start) text += ` (${exp.start}`
    if (exp.end) text += ` - ${exp.end})`
    if (exp.description) text += `: ${exp.description}`
    if (text) sections.push(text)
  })

  profile.education?.forEach((edu) => {
    let text = ""
    if (edu.degree) text += edu.degree
    if (edu.field) text += ` in ${edu.field}`
    if (edu.school) text += ` from ${edu.school}`
    if (text) sections.push(text)
  })

  return sections.join("\n")
}

/**
 * Main function to extract all profile data
 */
export function extractLinkedInProfile(): {
  profile: LinkedInProfileSnapshot
  profileUrl: string
  rawText: string
} {
  console.log("[Klen] Starting profile extraction...")

  // Extract basic info
  const { fullName, firstName, lastName } = extractName()
  const headline = extractHeadline()
  const location = extractLocation()
  const about = extractAbout()

  // Parse headline for current job
  const { title: jobTitle, company: companyName } = parseHeadlineForJob(headline)

  // Extract sections
  const experience = extractExperience()
  const education = extractEducation()
  const skills = extractSkills()
  const profileImageUrl = extractProfileImage()

  // Get URL
  const profileUrl = extractProfileUrl()

  // Build profile snapshot
  const profile: LinkedInProfileSnapshot = {
    name: fullName,
    first_name: firstName,
    last_name: lastName,
    headline,
    location,
    job_title: jobTitle || experience[0]?.title,
    company_name: companyName || experience[0]?.company,
    about,
    skills,
    experience,
    education,
    profile_image_url: profileImageUrl
  }

  // Generate raw text for scoring
  const rawText = generateRawText(profile)

  console.log("[Klen] Profile extraction complete:", {
    name: fullName,
    headline,
    skillsCount: skills.length,
    experienceCount: experience.length,
    educationCount: education.length
  })

  return { profile, profileUrl, rawText }
}

/**
 * Check if current page is a LinkedIn profile page
 */
export function isLinkedInProfilePage(): boolean {
  const url = window.location.href
  return /linkedin\.com\/in\/[^/]+/i.test(url)
}

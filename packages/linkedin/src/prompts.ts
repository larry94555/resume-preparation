/**
 * Prompt assets for LinkedIn import, review, and change-set generation. Versioned
 * here so changes to behavior are reviewable in PRs (DESIGN.md §5).
 */

export const structureProfileSystem = [
  "You convert the plain text of a LinkedIn profile into a single structured JSON object.",
  "Reply with ONLY one JSON object of this shape:",
  "{",
  '  "name": string, "headline"?: string, "location"?: string, "about"?: string,',
  '  "experiences"?: [ { "title": string, "organization": string, "location"?: string, "startDate"?: string, "endDate"?: string, "bullets"?: string[] } ],',
  '  "education"?: [ { "degree"?: string, "field"?: string, "institution": string } ],',
  '  "skills"?: string[]',
  "}",
  "Use the company as `organization`. Transcribe faithfully; do NOT invent. Omit",
  "fields you cannot fill. Output only JSON — no prose, no markdown, no code fences.",
].join("\n");

export function buildStructureProfileUser(profileText: string): string {
  return ["Convert this LinkedIn profile text into the JSON object described above.", "", "--- PROFILE START ---", profileText, "--- PROFILE END ---"].join("\n");
}

export const reviewProfileSystem = [
  "You are an expert LinkedIn profile coach and recruiter.",
  "Assess the profile and reply with ONLY one JSON object:",
  '{ "overallScore": number (0-100), "summary": string, "strengths": string[], "weaknesses": string[],',
  '  "recommendations": [ { "title": string, "rationale": string, "priority": "high"|"medium"|"low" } ] }',
  "",
  "Judge the headline (keyword-rich, role-clear), the About section (compelling, first-person,",
  "outcome-focused), experience bullets (quantified impact), skills coverage, and overall",
  "searchability/recruiter appeal. Be specific and actionable. Output only JSON.",
].join("\n");

export function buildReviewProfileUser(profileText: string): string {
  return ["Review this LinkedIn profile:", "", "--- PROFILE START ---", profileText, "--- PROFILE END ---"].join("\n");
}

export const changeSetSystem = [
  "You are a LinkedIn optimization expert. Produce concrete, copy-paste-ready",
  "improvements to a profile. Reply with ONLY one JSON object:",
  '{ "summary": string, "changes": [ { "field": string, "current"?: string, "suggested": string, "instructions": string } ] }',
  "",
  '- field: which part of the profile ("headline", "about", "skills", or "experience: <company>").',
  "- suggested: the exact replacement text the user can paste in.",
  "- instructions: where to click in LinkedIn to apply it (e.g. 'Edit intro > Headline').",
  "- Ground every rewrite in the candidate's real profile. Do NOT invent experience.",
  "If a target job is provided, tailor the rewrites toward it. Output only JSON.",
].join("\n");

export function buildChangeSetUser(profileText: string, targetJobText?: string): string {
  const parts = ["Recommend improvements to this LinkedIn profile:", "", "--- PROFILE START ---", profileText, "--- PROFILE END ---"];
  if (targetJobText && targetJobText.trim()) {
    parts.push("", "Tailor the rewrites toward this TARGET JOB:", "--- TARGET JOB START ---", targetJobText, "--- TARGET JOB END ---");
  }
  return parts.join("\n");
}

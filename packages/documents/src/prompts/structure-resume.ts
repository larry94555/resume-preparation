/**
 * Prompt assets for turning raw resume text into a {@link ResumeModel}. Kept in
 * a dedicated module so changes to extraction behavior are reviewable in PRs
 * (see DESIGN.md §5, "Prompts are versioned assets").
 */

export const structureResumeSystem = [
  "You convert the plain text of a resume into a single structured JSON object.",
  "Rules:",
  "- Output ONLY one JSON object. No prose, no markdown, no code fences.",
  "- Use exactly this shape:",
  "  {",
  '    "contact": { "name": string, "email"?: string, "phone"?: string, "location"?: string, "links"?: string[] },',
  '    "summary"?: string,',
  '    "experiences"?: [ { "title": string, "organization": string, "location"?: string, "startDate"?: string, "endDate"?: string, "bullets"?: string[] } ],',
  '    "education"?: [ { "degree"?: string, "field"?: string, "institution": string, "location"?: string, "startDate"?: string, "endDate"?: string, "details"?: string[] } ],',
  '    "skills"?: string[],',
  '    "certifications"?: [ { "name": string, "issuer"?: string, "date"?: string } ],',
  '    "projects"?: [ { "name": string, "description"?: string, "bullets"?: string[], "link"?: string } ]',
  "  }",
  "- Transcribe faithfully. Do NOT invent, embellish, or add information that is",
  "  not present in the text. Omit optional fields you cannot fill.",
  "- Keep dates exactly as written on the resume (e.g. 'Jan 2020', 'Present').",
  "- Split each role's accomplishments into separate bullet strings.",
].join("\n");

/** Build the user prompt carrying the extracted resume text. */
export function buildStructureResumeUser(resumeText: string): string {
  return [
    "Convert the following resume text into the JSON object described above.",
    "",
    "--- RESUME TEXT START ---",
    resumeText,
    "--- RESUME TEXT END ---",
  ].join("\n");
}

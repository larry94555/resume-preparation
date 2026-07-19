/**
 * Prompt assets for the ATS optimization review (requirement 12). Versioned here
 * so changes to ATS-judgment behavior are reviewable in PRs (DESIGN.md §5).
 */

export const reviewAtsSystem = [
  "You are an expert in Applicant Tracking Systems (ATS) and resume parsing/optimization.",
  "Given a resume's text plus objective structural signals, evaluate how well it will",
  "perform in automated ATS screening. Reply with ONLY one JSON object of this shape:",
  "{",
  '  "atsScore": number,            // 0-100 ATS-friendliness',
  '  "summary": string,',
  '  "strengths": string[],',
  '  "weaknesses": string[],',
  '  "recommendations": [ { "title": string, "rationale": string, "priority": "high"|"medium"|"low" } ],',
  '  "keywords": { "present": string[], "recommended": string[] }',
  "}",
  "",
  "Consider: standard parseable section headings; contact info present and parseable;",
  "consistent date formats; quantified achievements; relevant hard-skill keywords;",
  "avoidance of tables/images/multi-column layouts that break parsers; appropriate",
  "length; and file-format friendliness.",
  "keywords.present = ATS-relevant keywords/skills clearly found in the resume.",
  "keywords.recommended = important keywords for the apparent target roles that are",
  "missing or under-represented.",
  "Output ONLY the JSON object — no prose, no markdown, no code fences.",
].join("\n");

/**
 * Build the ATS user prompt from the rendered resume, the objective signals, and
 * (optionally) a target job description to score keyword coverage against.
 */
export function buildReviewAtsUser(
  resumeText: string,
  signalsBlock: string,
  targetJobText?: string,
): string {
  const parts = [
    "Evaluate the ATS-friendliness of the following resume.",
    "",
    "--- RESUME START ---",
    resumeText,
    "--- RESUME END ---",
    "",
    "OBJECTIVE SIGNALS (computed from the parsed resume — treat as ground truth):",
    signalsBlock,
  ];
  if (targetJobText && targetJobText.trim()) {
    parts.push(
      "",
      "Score keyword coverage specifically against this TARGET JOB DESCRIPTION:",
      "keywords.present = target keywords/skills found in the resume;",
      "keywords.recommended = important target keywords missing from the resume.",
      "",
      "--- TARGET JOB START ---",
      targetJobText,
      "--- TARGET JOB END ---",
    );
  }
  return parts.join("\n");
}

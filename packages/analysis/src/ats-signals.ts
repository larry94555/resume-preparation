import type { ResumeModel } from "@resume-prep/schema";

/**
 * Objective, deterministic ATS signals computed directly from a
 * {@link ResumeModel} — no LLM involved. These are the parseability/quality
 * facts an ATS reviewer should not have to guess at (is there an email? are
 * roles dated? are bullets quantified?). They are fed into the ATS review prompt
 * as ground truth and are fully unit-testable.
 */
export interface AtsSignals {
  hasEmail: boolean;
  hasPhone: boolean;
  hasLocation: boolean;
  hasSummary: boolean;
  experienceCount: number;
  educationCount: number;
  skillCount: number;
  bulletCount: number;
  /** Bullets containing a number — a proxy for quantified achievements. */
  quantifiedBulletCount: number;
  /** Experiences that carry a start date (ATS parsers expect dated roles). */
  datedExperienceCount: number;
  /** Standard sections that are empty/missing. */
  emptySections: string[];
}

const HAS_NUMBER = /\d/;

export function computeAtsSignals(resume: ResumeModel): AtsSignals {
  const bullets = resume.experiences.flatMap((e) => e.bullets);

  const emptySections: string[] = [];
  if (!resume.summary) emptySections.push("summary");
  if (resume.experiences.length === 0) emptySections.push("experience");
  if (resume.education.length === 0) emptySections.push("education");
  if (resume.skills.length === 0) emptySections.push("skills");

  return {
    hasEmail: Boolean(resume.contact.email),
    hasPhone: Boolean(resume.contact.phone),
    hasLocation: Boolean(resume.contact.location),
    hasSummary: Boolean(resume.summary),
    experienceCount: resume.experiences.length,
    educationCount: resume.education.length,
    skillCount: resume.skills.length,
    bulletCount: bullets.length,
    quantifiedBulletCount: bullets.filter((b) => HAS_NUMBER.test(b)).length,
    datedExperienceCount: resume.experiences.filter((e) => Boolean(e.startDate)).length,
    emptySections,
  };
}

/** Render signals as a compact block for embedding in the ATS review prompt. */
export function renderAtsSignals(s: AtsSignals): string {
  return [
    `Contact present — email: ${s.hasEmail}, phone: ${s.hasPhone}, location: ${s.hasLocation}`,
    `Summary present: ${s.hasSummary}`,
    `Section counts — experience: ${s.experienceCount}, education: ${s.educationCount}, skills: ${s.skillCount}`,
    `Bullets — total: ${s.bulletCount}, quantified (contain numbers): ${s.quantifiedBulletCount}`,
    `Dated roles: ${s.datedExperienceCount}/${s.experienceCount}`,
    s.emptySections.length
      ? `Empty/missing sections: ${s.emptySections.join(", ")}`
      : "Empty/missing sections: none",
  ].join("\n");
}

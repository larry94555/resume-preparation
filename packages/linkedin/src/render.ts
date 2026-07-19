import type { LinkedInProfile } from "@resume-prep/schema";

/**
 * Deterministically render a {@link LinkedInProfile} as labeled plain text for
 * review/change-set prompts — mirrors the resume renderer so small local models
 * always see a consistent, section-marked document. Unit-testable.
 */
function dateRange(start?: string, end?: string): string {
  if (start && end) return `${start} – ${end}`;
  if (start) return `${start} – Present`;
  if (end) return end;
  return "";
}

export function renderLinkedInText(profile: LinkedInProfile): string {
  const lines: string[] = [profile.name];
  if (profile.headline) lines.push(profile.headline);
  if (profile.location) lines.push(profile.location);

  if (profile.about) lines.push("", "ABOUT", profile.about);

  if (profile.experiences.length) {
    lines.push("", "EXPERIENCE");
    for (const e of profile.experiences) {
      const head = [e.title, e.organization].filter(Boolean).join(" — ");
      const range = dateRange(e.startDate, e.endDate);
      lines.push(range ? `${head} (${range})` : head);
      for (const b of e.bullets) lines.push(`- ${b}`);
    }
  }

  if (profile.education.length) {
    lines.push("", "EDUCATION");
    for (const ed of profile.education) {
      lines.push([ed.degree, ed.field, ed.institution].filter(Boolean).join(" — "));
    }
  }

  if (profile.skills.length) lines.push("", "SKILLS", profile.skills.join(", "));

  return lines.join("\n").trim();
}

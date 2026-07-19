import type { ResumeModel } from "@resume-prep/schema";

/**
 * Deterministically render a {@link ResumeModel} as clean plain text for use in
 * review prompts. Keeping this out of the LLM path means the model always sees a
 * consistent, section-labeled document (which improves the reliability of small
 * local models) and lets us unit-test exactly what gets sent.
 */

function dateRange(start?: string, end?: string): string {
  if (start && end) return `${start} – ${end}`;
  if (start) return `${start} – Present`;
  if (end) return end;
  return "";
}

function joinNonEmpty(parts: (string | undefined)[], sep: string): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}

export function renderResumeText(resume: ResumeModel): string {
  const lines: string[] = [];
  const c = resume.contact;

  lines.push(c.name);
  const contact = joinNonEmpty([c.email, c.phone, c.location], " | ");
  if (contact) lines.push(contact);
  if (c.links.length) lines.push(`Links: ${c.links.join(", ")}`);

  if (resume.summary) lines.push("", "SUMMARY", resume.summary);

  if (resume.experiences.length) {
    lines.push("", "EXPERIENCE");
    for (const e of resume.experiences) {
      const head = joinNonEmpty([e.title, e.organization], " — ");
      const range = dateRange(e.startDate, e.endDate);
      lines.push(range ? `${head} (${range})` : head);
      if (e.location) lines.push(e.location);
      for (const b of e.bullets) lines.push(`- ${b}`);
    }
  }

  if (resume.education.length) {
    lines.push("", "EDUCATION");
    for (const ed of resume.education) {
      const deg = joinNonEmpty([ed.degree, ed.field], ", ");
      const head = joinNonEmpty([deg, ed.institution], " — ");
      const range = dateRange(ed.startDate, ed.endDate);
      lines.push(range ? `${head} (${range})` : head);
      for (const d of ed.details) lines.push(`- ${d}`);
    }
  }

  if (resume.skills.length) lines.push("", "SKILLS", resume.skills.join(", "));

  if (resume.certifications.length) {
    lines.push("", "CERTIFICATIONS");
    for (const cert of resume.certifications) {
      lines.push(joinNonEmpty([cert.name, cert.issuer, cert.date], " — "));
    }
  }

  if (resume.projects.length) {
    lines.push("", "PROJECTS");
    for (const p of resume.projects) {
      lines.push(p.description ? `${p.name} — ${p.description}` : p.name);
      for (const b of p.bullets) lines.push(`- ${b}`);
      if (p.link) lines.push(p.link);
    }
  }

  return lines.join("\n").trim();
}

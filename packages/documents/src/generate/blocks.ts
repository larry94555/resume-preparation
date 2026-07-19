import type { CoverLetter, ResumeModel } from "@resume-prep/schema";

/**
 * A format-neutral document model. Both the DOCX and PDF renderers consume
 * `Block[]`, so layout decisions live in one deterministic, unit-testable place
 * and the two output formats can never drift apart in content.
 */
export type Block =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "bullet"; text: string };

function dateRange(start?: string, end?: string): string {
  if (start && end) return `${start} – ${end}`;
  if (start) return `${start} – Present`;
  if (end) return end;
  return "";
}

function joinNonEmpty(parts: (string | undefined)[], sep: string): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}

/**
 * Render a resume into ATS-friendly blocks: a single column, standard section
 * headings, plain bullets — no tables, images, or multi-column layout that break
 * parsers.
 */
export function resumeToBlocks(resume: ResumeModel): Block[] {
  const blocks: Block[] = [];
  const c = resume.contact;
  blocks.push({ type: "title", text: c.name });

  const contact = joinNonEmpty([c.email, c.phone, c.location, ...c.links], " | ");
  if (contact) blocks.push({ type: "subtitle", text: contact });

  if (resume.summary) {
    blocks.push({ type: "heading", text: "Summary" });
    blocks.push({ type: "text", text: resume.summary });
  }

  if (resume.experiences.length) {
    blocks.push({ type: "heading", text: "Experience" });
    for (const e of resume.experiences) {
      const head = joinNonEmpty([e.title, e.organization], " — ");
      const range = dateRange(e.startDate, e.endDate);
      blocks.push({ type: "text", text: range ? `${head} (${range})` : head });
      for (const b of e.bullets) blocks.push({ type: "bullet", text: b });
    }
  }

  if (resume.education.length) {
    blocks.push({ type: "heading", text: "Education" });
    for (const ed of resume.education) {
      const deg = joinNonEmpty([ed.degree, ed.field], ", ");
      const head = joinNonEmpty([deg, ed.institution], " — ");
      const range = dateRange(ed.startDate, ed.endDate);
      blocks.push({ type: "text", text: range ? `${head} (${range})` : head });
      for (const d of ed.details) blocks.push({ type: "bullet", text: d });
    }
  }

  if (resume.skills.length) {
    blocks.push({ type: "heading", text: "Skills" });
    blocks.push({ type: "text", text: resume.skills.join(", ") });
  }

  if (resume.certifications.length) {
    blocks.push({ type: "heading", text: "Certifications" });
    for (const cert of resume.certifications) {
      blocks.push({ type: "bullet", text: joinNonEmpty([cert.name, cert.issuer, cert.date], " — ") });
    }
  }

  if (resume.projects.length) {
    blocks.push({ type: "heading", text: "Projects" });
    for (const p of resume.projects) {
      blocks.push({ type: "text", text: joinNonEmpty([p.name, p.description], " — ") });
      for (const b of p.bullets) blocks.push({ type: "bullet", text: b });
      if (p.link) blocks.push({ type: "text", text: p.link });
    }
  }

  return blocks;
}

/** Flatten blocks to plain text (headings upper-cased, bullets prefixed). */
export function blocksToPlainText(blocks: Block[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === "title") lines.push(b.text);
    else if (b.type === "subtitle") lines.push(b.text);
    else if (b.type === "heading") lines.push("", b.text.toUpperCase());
    else if (b.type === "bullet") lines.push(`- ${b.text}`);
    else lines.push(b.text);
  }
  return lines.join("\n").trim();
}

/** Render a simple titled document (paragraphs) into blocks. */
export function textToBlocks(title: string, paragraphs: string[]): Block[] {
  const blocks: Block[] = [{ type: "title", text: title }];
  for (const p of paragraphs) blocks.push({ type: "text", text: p });
  return blocks;
}

/** Render a cover letter into blocks. */
export function coverLetterToBlocks(letter: CoverLetter, title = "Cover Letter"): Block[] {
  const blocks: Block[] = [{ type: "title", text: title }];
  if (letter.greeting) blocks.push({ type: "text", text: letter.greeting });
  for (const p of letter.paragraphs) blocks.push({ type: "text", text: p });
  if (letter.closing) blocks.push({ type: "text", text: letter.closing });
  return blocks;
}

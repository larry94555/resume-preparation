import { z } from "zod";

/**
 * The canonical structured form of a resume. Ingestion parses a PDF/DOCX/text
 * resume into this shape (via an LLM structuring pass); later phases score it,
 * tailor it, and regenerate documents from it. Array fields default to `[]` so
 * a sparse LLM response still validates into a complete, safe object.
 */

export const ContactInfo = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  /** LinkedIn, portfolio, GitHub, etc. — kept as written. */
  links: z.array(z.string()).default([]),
});
export type ContactInfo = z.infer<typeof ContactInfo>;

export const ExperienceEntry = z.object({
  title: z.string().min(1),
  organization: z.string().min(1),
  location: z.string().optional(),
  /** Dates are kept as written on the resume; normalization happens later. */
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  bullets: z.array(z.string()).default([]),
});
export type ExperienceEntry = z.infer<typeof ExperienceEntry>;

export const EducationEntry = z.object({
  degree: z.string().optional(),
  field: z.string().optional(),
  institution: z.string().min(1),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  details: z.array(z.string()).default([]),
});
export type EducationEntry = z.infer<typeof EducationEntry>;

export const ProjectEntry = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  link: z.string().optional(),
});
export type ProjectEntry = z.infer<typeof ProjectEntry>;

export const CertificationEntry = z.object({
  name: z.string().min(1),
  issuer: z.string().optional(),
  date: z.string().optional(),
});
export type CertificationEntry = z.infer<typeof CertificationEntry>;

export const ResumeModel = z.object({
  contact: ContactInfo,
  summary: z.string().optional(),
  experiences: z.array(ExperienceEntry).default([]),
  education: z.array(EducationEntry).default([]),
  /** Flat skill labels; scored individually against a job in later phases. */
  skills: z.array(z.string()).default([]),
  certifications: z.array(CertificationEntry).default([]),
  projects: z.array(ProjectEntry).default([]),
});
export type ResumeModel = z.infer<typeof ResumeModel>;

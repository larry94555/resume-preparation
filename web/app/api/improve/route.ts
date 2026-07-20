import {
  planImprovement,
  renderResumeText,
  scoreRequirement,
  type RequirementInput,
} from "@resume-prep/analysis";
import { ingestResume } from "@resume-prep/documents";
import type { JobRequirementKind } from "@resume-prep/schema";
import type { Importance } from "@resume-prep/scoring";
import { getClient, requireModel } from "../../../lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Get an improvement plan for a requirement (req. 9). */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    resumeText?: string;
    label?: string;
    kind?: JobRequirementKind;
    importance?: Importance;
  };
  if (!body.resumeText?.trim() || !body.label?.trim()) {
    return Response.json({ error: "Provide resume text and a requirement label." }, { status: 400 });
  }

  const client = getClient();
  const gate = await requireModel(client);
  if (gate) return gate;

  const requirement: RequirementInput = {
    label: body.label,
    kind: body.kind ?? "skill",
    importance: body.importance ?? "required",
  };

  const resume = await ingestResume({ format: "text", text: body.resumeText }, client);
  const match = await scoreRequirement(requirement, renderResumeText(resume), client);
  const plan = await planImprovement(match, client);

  return Response.json({ match, plan });
}

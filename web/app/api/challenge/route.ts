import {
  askChallengeQuestions,
  challengeReducer,
  renderResumeText,
  scoreRequirement,
  startChallengeSession,
  submitChallengeEvidence,
  type RequirementInput,
} from "@resume-prep/analysis";
import { ingestResume } from "@resume-prep/documents";
import type { JobRequirementKind } from "@resume-prep/schema";
import type { Importance } from "@resume-prep/scoring";
import { getClient, requireModel } from "../../../lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Challenge a requirement's score (req. 8). Scores the requirement, asks
 * clarifying questions, and — if the user supplied evidence — evaluates it and
 * re-scores.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    resumeText?: string;
    label?: string;
    kind?: JobRequirementKind;
    importance?: Importance;
    evidence?: string;
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
  const resumeText = renderResumeText(resume);

  const match = await scoreRequirement(requirement, resumeText, client);
  const questions = await askChallengeQuestions(requirement, match.score, resumeText, client);
  let session = challengeReducer(startChallengeSession(match), { type: "questions", questions });

  if (body.evidence?.trim()) {
    session = await submitChallengeEvidence(session, body.evidence, resumeText, client);
  }

  return Response.json({ match, questions, session });
}

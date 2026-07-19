import type { ChatClient } from "@resume-prep/llm";
import { runStructured } from "@resume-prep/llm";
import { ImprovementPlan } from "@resume-prep/schema";
import type { RequirementMatch } from "./matching.js";
import { buildImproveUser, improveSystem } from "./prompts/improve.js";

/**
 * Produce an {@link ImprovementPlan} — concrete actions to strengthen a skill or
 * gain an experience so a future application scores higher (requirement 9).
 * Takes the current {@link RequirementMatch} so the advice is tailored to what
 * the resume already evidences.
 */
export function planImprovement(
  match: RequirementMatch,
  client: ChatClient,
): Promise<ImprovementPlan> {
  return runStructured(client, {
    system: improveSystem,
    user: buildImproveUser(match),
    schema: ImprovementPlan,
  });
}

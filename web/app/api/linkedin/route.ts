import { buildLinkedInChangeSet, reviewLinkedIn, structureLinkedInProfile } from "@resume-prep/linkedin";
import { getChat, getClient, requireModel } from "../../../lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Review a LinkedIn profile (req. 1) or build a copy-paste change set (req. 2)
 * from pasted profile text, optionally tailored to a target job.
 */
export async function POST(req: Request) {
  const { profileText, jobText, mode } = (await req.json()) as {
    profileText?: string;
    jobText?: string;
    mode?: "review" | "changeset";
  };
  if (!profileText?.trim()) {
    return Response.json({ error: "Paste your LinkedIn profile text." }, { status: 400 });
  }

  const client = getClient();
  const gate = await requireModel(client);
  if (gate) return gate;
  const chat = getChat(client);

  const profile = await structureLinkedInProfile(profileText, chat);

  if (mode === "changeset") {
    const changeSet = await buildLinkedInChangeSet(
      profile,
      chat,
      jobText?.trim() ? { targetJobText: jobText } : {},
    );
    return Response.json({ profile, changeSet });
  }

  const review = await reviewLinkedIn(profile, chat);
  return Response.json({ profile, review });
}

import Anthropic from "@anthropic-ai/sdk";

// Server-only: reads a resume PDF with Claude and returns the search-profile fields it can fill.
// Scoring stays deterministic (src/lib/ai/index.ts); Claude only drafts the profile the user reviews and saves.

export const resumeImportConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;

const SENIORITIES = ["intern", "junior", "mid", "senior", "lead", "manager", "director"] as const;

export type ResumeProfile = {
  roles: string[];
  skills: string[];
  keywords: string[];
  industries: string[];
  locations: string[];
  years_experience: number;
  current_role: string;
  education: string;
  seniority: (typeof SENIORITIES)[number];
};

const list = { type: "array", items: { type: "string" } };
const SCHEMA = {
  type: "object",
  properties: {
    roles: list,
    skills: list,
    keywords: list,
    industries: list,
    locations: list,
    years_experience: { type: "number" },
    current_role: { type: "string" },
    education: { type: "string" },
    seniority: { type: "string", enum: SENIORITIES },
  },
  required: ["roles", "skills", "keywords", "industries", "locations", "years_experience", "current_role", "education", "seniority"],
  additionalProperties: false,
};

const INSTRUCTIONS = `This is a candidate's resume. Fill in their job-search profile from it, using only what the resume states — leave a field empty rather than guess.

- roles: 2–5 job titles they are a strong fit for next: their current title plus close variants at the same level.
- skills: up to 25 technical and domain skills the resume shows them using, with conventional names (e.g. "Python", "AWS", "React").
- keywords: up to 8 specialisms or themes that recur in their work (e.g. "GenAI", "payments"), not already listed as skills.
- industries: industries they have worked in.
- locations: where they are based, as "City, Country" (e.g. "Bengaluru, India"). Empty if not stated.
- years_experience: total years of full-time professional work, excluding internships and study, to the nearest 0.5.
- current_role: "Title at Company" for their present job, or "" if none.
- education: highest qualification, short form (e.g. "B.Tech Computer Science").
- seniority: the level that best fits their experience and title.`;

/** A real PDF starts with "%PDF-"; don't trust the browser-reported MIME type alone. */
export const looksLikePdf = (bytes: Uint8Array) => Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-";

export async function extractProfileFromResume(pdf: Buffer): Promise<ResumeProfile> {
  // An org-level key (one not scoped to a workspace) must name the workspace to bill.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {});
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // re-run on Anthropic's recommended fallback model if a safety classifier declines
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
            { type: "text", text: INSTRUCTIONS },
          ],
        },
      ],
    });
  } catch (e) {
    console.error("[resume] Claude request failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    throw new Error(e instanceof Anthropic.RateLimitError ? "Resume import is busy right now. Try again in a minute." : "Couldn't read that resume. Try again, or fill in the form yourself.");
  }
  if (response.stop_reason === "refusal") throw new Error("Couldn't read that resume. Fill in the form yourself instead.");
  if (response.stop_reason === "max_tokens") throw new Error("That resume was too long to read in one go. Fill in the form yourself instead.");
  console.log(`[resume] read by ${response.model}: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out tokens`);
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
  if (!text) throw new Error("Couldn't read that resume. Try again, or fill in the form yourself.");
  return JSON.parse(text) as ResumeProfile;
}

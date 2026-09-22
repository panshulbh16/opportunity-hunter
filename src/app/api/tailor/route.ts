import type { NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { track } from "@/lib/analytics";
import { createTailorStream, parseTailorText, TAILOR_MAX_CHARS, tailorConfigured } from "@/lib/tailor";

// Free résumé tailoring for signed-in users. Streams the result so the score and gaps show fast.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return new Response("Please sign in.", { status: 401 });
  if (!tailorConfigured) return new Response("Résumé tailoring isn't available yet.", { status: 503 });

  const bodyIn = (await req.json().catch(() => ({}))) as { resume?: string; jd?: string };
  const resume = String(bodyIn.resume ?? "").slice(0, TAILOR_MAX_CHARS);
  const jd = String(bodyIn.jd ?? "").slice(0, TAILOR_MAX_CHARS);
  if (resume.trim().length < 80) return new Response("Paste your full résumé — at least a few lines.", { status: 400 });
  if (jd.trim().length < 80) return new Response("Paste the full job description.", { status: 400 });

  // No paid gate — this is free. A per-user rate limit just keeps abuse in check.
  try { await rateLimit(`tailor:${user.id}`, 15, 3600); } catch { return new Response("You've tailored a lot in the last hour — try again shortly.", { status: 429 }); }

  const stream = createTailorStream(resume, jd);
  const encoder = new TextEncoder();
  let full = "";

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            full += ev.delta.text;
            controller.enqueue(encoder.encode(ev.delta.text));
          }
        }
        track("tailor_created", user.id, { fit: parseTailorText(full).fit_score });
      } catch (e) {
        console.error("[tailor] stream failed", e);
        controller.enqueue(encoder.encode("\n\n[error] Couldn't finish tailoring — please try again."));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

import { headers } from "next/headers";

// ponytail: in-memory sliding window; move to Redis if running more than one instance
const hits = new Map<string, number[]>();

export async function rateLimit(action: string, limit: number, windowSec = 60) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const key = `${action}:${ip}`;
  const cutoff = Date.now() - windowSec * 1000;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
  recent.push(Date.now());
  hits.set(key, recent);
  if (recent.length > limit) throw new Error("Too many attempts. Please wait a minute and try again.");
}

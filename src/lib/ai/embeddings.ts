import { db } from "../db.ts";
import { bestSimilarity, getVec, normText, setVec, similarity } from "./embeddings-store.ts";
import { profileSummaryText, type NormalizedOpportunity, type Profile } from "./index.ts";

// Server-only half of the semantic layer: the persistent SQLite cache and the Voyage calls that fill
// the in-memory store (embeddings-store.ts). Embeddings are expensive network calls and the scorer is
// synchronous, so we never embed inside it: warmEmbeddings/warmForScoring embed new strings once, up
// front and async, into SQLite + the store; the scorer then reads vectors synchronously from the store.
// No VOYAGE_API_KEY → warm is a no-op, the store stays empty, and every similarity() returns null so
// matching falls back to exact text unchanged.

const MODEL = process.env.VOYAGE_MODEL ?? "voyage-3.5-lite";
const KEY = process.env.VOYAGE_API_KEY;
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

export const embeddingsEnabled = !!KEY;
export { similarity, bestSimilarity };

// Persisted vectors are loaded into the store once per process. ponytail: the whole cache lives in
// memory (a few MB for this app's skill/role/description vocabulary); add an ANN index only past ~1e5 rows.
let loaded = false;
function loadOnce() {
  if (loaded) return;
  loaded = true;
  const rows = db.prepare("SELECT text, vec FROM embeddings WHERE model = ?").all(MODEL) as { text: string; vec: Buffer }[];
  for (const r of rows) setVec(r.text, new Float32Array(r.vec.buffer, r.vec.byteOffset, r.vec.byteLength / 4));
}

/** Persist + store a vector, unit-normalized so similarity is a plain dot product. */
function put(text: string, raw: number[]) {
  let len = 0;
  for (const x of raw) len += x * x;
  len = Math.sqrt(len) || 1;
  const v = Float32Array.from(raw, (x) => x / len);
  db.prepare("INSERT OR REPLACE INTO embeddings (text, model, vec) VALUES (?, ?, ?)").run(text, MODEL, Buffer.from(v.buffer));
  setVec(text, v);
}

async function embed(texts: string[]): Promise<number[][]> {
  // Hard timeout: a hanging embedding call must never block a page render or a healthcheck —
  // on timeout we throw, the caller swallows it, and scoring falls back to exact match.
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: "document" }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`voyage ${res.status}: ${await res.text().catch(() => "")}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

/** Embed any of `texts` not already cached. Safe to call with duplicates/empties. No-op without a key. */
export async function warmEmbeddings(texts: string[]): Promise<void> {
  if (!KEY) return;
  loadOnce();
  const missing = [...new Set(texts.map(normText).filter((t) => t && !getVec(t)))];
  if (!missing.length) return;
  // Smaller batches keep each request well under the timeout even when embedding many long
  // descriptions, and a failed batch skips ahead instead of aborting the rest — so a cold cache
  // fills incrementally rather than returning nothing.
  for (let i = 0; i < missing.length; i += 48) {
    const batch = missing.slice(i, i + 48);
    try {
      const vecs = await embed(batch);
      batch.forEach((t, j) => put(t, vecs[j]));
    } catch {
      // A failed batch just leaves those strings uncached; callers fall back to exact match for them.
      continue;
    }
  }
}

/**
 * Embed every string the scorer might compare for this profile + these listings, once, before scoring.
 * calculateMatchScore stays synchronous and reads the warmed store; without a key this is a no-op.
 */
export async function warmForScoring(p: Profile, opps: NormalizedOpportunity[]): Promise<void> {
  await warmEmbeddings([
    ...p.skills, ...p.roles, profileSummaryText(p),
    ...opps.flatMap((o) => [...o.skills, ...o.nice_to_have, o.title, o.description]),
  ]);
}

// Two same-company titles this close are the same role posted twice (reworded across boards),
// so we drop the later one. Deliberately high: a missed duplicate is minor, but merging two
// genuinely different roles hides a real job — favor precision, raise it further if false merges appear.
const DUP_SIM = 0.93;

/**
 * Second de-dupe pass after the exact key match: collapse near-identical titles *within the same
 * company* by embedding similarity, keeping the earliest posting. Reused embeddings; no-op without a key.
 */
export async function semanticDedupe<T extends { company: string; title: string; posted_date: string }>(list: T[]): Promise<T[]> {
  if (!KEY || list.length < 2) return list;
  await warmEmbeddings(list.map((o) => o.title));
  const sorted = [...list].sort((a, b) => a.posted_date.localeCompare(b.posted_date));
  const kept: T[] = [];
  for (const o of sorted) {
    const co = normText(o.company);
    const dup = kept.some((k) => normText(k.company) === co && (similarity(k.title, o.title) ?? 0) >= DUP_SIM);
    if (!dup) kept.push(o);
  }
  return kept;
}

// A listing is "about" the query above this cosine. Descriptions are long and queries short, so a
// meaning match sits lower than a skill-to-skill one — 0.34 keeps the on-topic ones and drops the rest.
const SEARCH_SIM = 0.34;
// Title + the head of the description: enough signal to rank relevance, small enough to embed fast.
const docText = (o: { title: string; description: string }) => `${o.title}. ${o.description.slice(0, 400)}`;

/**
 * Precompute the search vectors for a set of listings, once, so semantic search hits a warm cache
 * instead of embedding the whole pool during a page render. Called at ingest; no-op without a key.
 */
export async function warmListings(opps: { title: string; description: string }[]): Promise<void> {
  await warmEmbeddings(opps.map(docText));
}

/**
 * Rank listings by how well their meaning matches a free-text query (semantic search), best first,
 * dropping the clearly-unrelated. Returns the input order unchanged when embeddings aren't available,
 * so the caller can fall back to keyword filtering — it never hides everything on a cold cache.
 */
export async function semanticRank<T extends { opp: { title: string; description: string } }>(
  query: string, items: T[], limit = 60,
): Promise<T[]> {
  if (!KEY || !items.length) return items;
  await warmEmbeddings([query, ...items.map((i) => docText(i.opp))]);
  const scored = items
    .map((i) => ({ i, s: similarity(query, docText(i.opp)) }))
    .filter((x): x is { i: T; s: number } => x.s != null);
  if (!scored.length) return items; // query or docs didn't embed — leave the list as-is
  return scored.filter((x) => x.s >= SEARCH_SIM).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.i);
}

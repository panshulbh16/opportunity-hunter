import { db } from "../db.ts";

// Semantic layer for matching. Embeddings are expensive network calls, but the scorer
// (calculateMatchScore) is synchronous and runs in a hot loop over every candidate, so we
// never embed inside it. Instead: warmEmbeddings() embeds any new strings once, up front and
// async, into a persistent SQLite cache; the scorer then reads vectors synchronously from an
// in-memory map. No VOYAGE_API_KEY → warm is a no-op, vectors are absent, and every semantic
// helper returns null so callers fall back to the exact-match logic unchanged.

const MODEL = process.env.VOYAGE_MODEL ?? "voyage-3.5-lite";
const KEY = process.env.VOYAGE_API_KEY;
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

export const embeddingsEnabled = !!KEY;

// text -> unit-normalized vector. ponytail: whole cache lives in memory (a few MB for this app's
// skill/role/description vocabulary); shard or an ANN index only if the table grows past ~1e5 rows.
let mem: Map<string, Float32Array> | null = null;

function load(): Map<string, Float32Array> {
  if (mem) return mem;
  mem = new Map();
  const rows = db.prepare("SELECT text, vec FROM embeddings WHERE model = ?").all(MODEL) as { text: string; vec: Buffer }[];
  for (const r of rows) mem.set(r.text, new Float32Array(r.vec.buffer, r.vec.byteOffset, r.vec.byteLength / 4));
  return mem;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Store a vector, unit-normalized so similarity is a plain dot product. */
function put(text: string, raw: number[]) {
  let len = 0;
  for (const x of raw) len += x * x;
  len = Math.sqrt(len) || 1;
  const v = Float32Array.from(raw, (x) => x / len);
  db.prepare("INSERT OR REPLACE INTO embeddings (text, model, vec) VALUES (?, ?, ?)")
    .run(text, MODEL, Buffer.from(v.buffer));
  load().set(text, v);
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
  const cache = load();
  const missing = [...new Set(texts.map(norm).filter((t) => t && !cache.has(t)))];
  if (!missing.length) return;
  // Voyage accepts up to 128 inputs per request.
  for (let i = 0; i < missing.length; i += 128) {
    const batch = missing.slice(i, i + 128);
    try {
      const vecs = await embed(batch);
      batch.forEach((t, j) => put(t, vecs[j]));
    } catch {
      // A failed batch just leaves those strings uncached; the scorer falls back to exact match for them.
      return;
    }
  }
}

const vecOf = (text: string) => (KEY ? load().get(norm(text)) ?? null : null);

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Cosine similarity of two cached strings in [-1,1], or null if either is not cached. */
export function similarity(a: string, b: string): number | null {
  const va = vecOf(a), vb = vecOf(b);
  return va && vb ? dot(va, vb) : null;
}

/** Best cosine of `target` against any of `candidates`; null if nothing is cached to compare. */
export function bestSimilarity(candidates: string[], target: string): number | null {
  const vt = vecOf(target);
  if (!vt) return null;
  let best: number | null = null;
  for (const c of candidates) {
    const vc = vecOf(c);
    if (vc) { const s = dot(vc, vt); if (best === null || s > best) best = s; }
  }
  return best;
}

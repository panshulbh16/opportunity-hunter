// Client-safe half of the semantic layer: an in-memory vector store plus the sync cosine reads the
// scorer needs. No DB, no fetch, no server-only imports — so this can sit in the module graph of a
// client component (ProfileForm imports the scorer's pure helpers) without pulling better-sqlite3 in.
// The server half (embeddings.ts) fills this store from SQLite + Voyage before scoring runs.

const mem = new Map<string, Float32Array>();
export const normText = (s: string) => s.trim().toLowerCase();

/** Store a unit-normalized vector under its text key. */
export function setVec(text: string, v: Float32Array) {
  mem.set(normText(text), v);
}
export const getVec = (text: string) => mem.get(normText(text)) ?? null;

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Cosine similarity of two stored strings in [-1,1], or null if either is not stored. */
export function similarity(a: string, b: string): number | null {
  const va = getVec(a), vb = getVec(b);
  return va && vb ? dot(va, vb) : null;
}

/** Best cosine of `target` against any of `candidates`; null if nothing is stored to compare. */
export function bestSimilarity(candidates: string[], target: string): number | null {
  const vt = getVec(target);
  if (!vt) return null;
  let best: number | null = null;
  for (const c of candidates) {
    const vc = getVec(c);
    if (vc) { const s = dot(vc, vt); if (best === null || s > best) best = s; }
  }
  return best;
}

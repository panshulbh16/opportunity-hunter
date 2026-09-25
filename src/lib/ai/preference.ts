import { db } from "../db.ts";
import { docVec } from "./embeddings.ts";

// Preference learning: turn a user's own save / apply / reject history into a "taste" vector, and
// score any listing against it. This is implicit-feedback learning-to-rank on top of the embeddings
// the matcher already builds — the taste vector is the centroid of liked listings minus the centroid
// of passed-on ones, so listings pointing the way the user leans get boosted, whatever their profile.
//
// It only re-ranks display order; the base match score stays the deterministic, explainable number.

// Need at least this many *embedded* liked listings before personalising — below that it's noise.
const MIN_LIKED = 3;

type Row = { title: string; description: string };
const vecsOf = (rows: Row[]) => rows.map(docVec).filter((v): v is Float32Array => v != null);

function centroid(vecs: Float32Array[]): Float32Array {
  const dim = vecs[0].length;
  const c = new Float32Array(dim);
  for (const v of vecs) for (let i = 0; i < dim; i++) c[i] += v[i];
  for (let i = 0; i < dim; i++) c[i] /= vecs.length;
  return c;
}

export type Taste = { vec: Float32Array; liked: number; passed: number };

/** Build the user's taste vector, or null when there isn't enough embedded signal yet. */
export function tasteVector(userId: number): Taste | null {
  const liked = db.prepare(
    `SELECT o.title, o.description FROM opportunities o WHERE o.id IN (
       SELECT opportunity_id FROM saved_opportunities WHERE user_id = ?
       UNION
       SELECT opportunity_id FROM applications WHERE user_id = ? AND status <> 'saved')`,
  ).all(userId, userId) as Row[];
  const passed = db.prepare(
    `SELECT o.title, o.description FROM opportunities o
       JOIN matches m ON m.opportunity_id = o.id
      WHERE m.user_id = ? AND m.status IN ('rejected', 'hidden')`,
  ).all(userId) as Row[];

  const pos = vecsOf(liked), neg = vecsOf(passed);
  if (pos.length < MIN_LIKED) return null;

  const p = centroid(pos);
  const vec = new Float32Array(p.length);
  if (neg.length) { const n = centroid(neg); for (let i = 0; i < p.length; i++) vec[i] = p[i] - n[i]; }
  else vec.set(p);

  let len = 0;
  for (let i = 0; i < vec.length; i++) len += vec[i] * vec[i];
  len = Math.sqrt(len) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] /= len;
  return { vec, liked: pos.length, passed: neg.length };
}

/** Cosine of the taste vector against a listing (−1..1), or null if the listing isn't embedded. */
export function tasteScore(taste: Taste, opp: { title: string; description: string }): number | null {
  const v = docVec(opp);
  if (!v) return null;
  let s = 0;
  for (let i = 0; i < taste.vec.length; i++) s += taste.vec[i] * v[i];
  return s;
}

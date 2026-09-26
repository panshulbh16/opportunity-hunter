const [base, expected, edge] = process.argv.slice(2);
if (!base || !/^[a-f0-9]{40}$/.test(expected ?? '')) throw Error('Usage: verify-release URL SHA [edge]');
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const r = await fetch(new URL('/api/version', base), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const data = await r.json();
    if (r.ok && data.commit === expected && /no-store/.test(r.headers.get('cache-control') ?? '') && (!edge || r.headers.get('x-edge-commit') === expected) && r.headers.get('cf-cache-status') !== 'HIT') {
      for (const path of ['/', '/pricing', '/login']) {
        const page = await fetch(new URL(path, base), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!page.ok || (edge && (!/no-store/.test(page.headers.get('cache-control') ?? '') || page.headers.get('x-edge-commit') !== expected))) throw Error(`Smoke check failed: ${path}`);
      }
      console.log(`Verified ${expected} live at ${base}`); process.exit(0);
    }
  } catch { /* bounded readiness retry */ }
  await new Promise(resolve => setTimeout(resolve, 5000));
}
throw Error('Release not verified: wrong commit, stale cache, or unhealthy pages');

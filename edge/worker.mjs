export default {
  async fetch(request, env) {
    // A route forwards to the existing Railway origin without changing host, cookies or webhook bytes.
    const upstream = await fetch(request, { cache: 'no-store', redirect: 'manual' });
    const response = new Response(upstream.body, upstream);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('CDN-Cache-Control', 'no-store');
    response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    response.headers.set('X-Edge-Commit', env.RELEASE_SHA);
    return response;
  },
};

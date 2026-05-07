// Cloudflare Worker — reverse proxy to Supabase.
// Bypasses ISP blocks of *.supabase.co by routing traffic through
// db.hero-academy.ru → CF Worker → gjezmurskhjngbostltn.supabase.co
//
// Forwards REST, Auth, Storage, Functions and Realtime WebSocket as-is.
// Strips alt-svc (HTTP/3 also disabled at the zone) and rewrites
// `Access-Control-Allow-Origin: *` to mirror the actual Origin so that
// credentialed requests from supabase-js pass the browser's CORS check.

const TARGET_HOST = 'gjezmurskhjngbostltn.supabase.co';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = TARGET_HOST;
    url.protocol = 'https:';
    url.port = '';

    const upstream = new Request(url.toString(), request);
    upstream.headers.set('Host', TARGET_HOST);

    const resp = await fetch(upstream);
    const headers = new Headers(resp.headers);
    headers.delete('alt-svc');

    const origin = request.headers.get('Origin');
    if (origin && headers.get('access-control-allow-origin') === '*') {
      headers.set('access-control-allow-origin', origin);
      headers.set('access-control-allow-credentials', 'true');
      const vary = headers.get('vary');
      headers.set('vary', vary ? `${vary}, Origin` : 'Origin');
    }

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  },
};

// Cloudflare Worker — reverse proxy to Supabase.
// Bypasses ISP blocks of *.supabase.co by routing traffic through
// db.hero-academy.ru → CF Worker → gjezmurskhjngbostltn.supabase.co
//
// Forwards REST, Auth, Storage, Functions and Realtime WebSocket as-is.
// alt-svc is stripped only as a safety net (HTTP/3 is also disabled at
// the zone level via API). Set-Cookie is preserved so that Cloudflare's
// own bot-protection cookies survive into POST requests.

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

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  },
};

// Cloudflare Worker — reverse proxy to Supabase.
// Bypasses ISP blocks of *.supabase.co by routing traffic through
// db.hero-academy.ru → CF Worker → gjezmurskhjngbostltn.supabase.co
//
// Forwards REST, Auth, Storage, Functions and Realtime WebSocket as-is.
// Strips alt-svc (forces browser onto HTTP/2 — some mobile carriers
// drop QUIC/UDP) and removes upstream Set-Cookie that targets
// supabase.co (browser rejects them on db.hero-academy.ru anyway).

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
    headers.delete('set-cookie');

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  },
};

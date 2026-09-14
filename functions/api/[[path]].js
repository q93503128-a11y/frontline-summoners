function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function normalizeOrigin(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function proxyByOrigin(request, origin) {
  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, `${origin}/`);
  const headers = new Headers(request.headers);
  headers.delete('host');
  const forwarded = new Request(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });
  return fetch(forwarded);
}

/**
 * Cloudflare Pages -> API Worker bridge.
 *
 * Preferred deployment: bind the Worker service as FRONTLINE_API. If a service binding is not
 * available, configure FRONTLINE_API_ORIGIN with the deployed Worker origin. Keeping the browser
 * on same-origin /api/* removes the current pages.dev -> HTML fallback failure and also keeps
 * Google/local account, social, PvP and co-op HTTP endpoints on one deployment contract.
 */
export async function onRequest(context) {
  const service = context.env?.FRONTLINE_API;
  if (service && typeof service.fetch === 'function') {
    return service.fetch(context.request);
  }

  const origin = normalizeOrigin(context.env?.FRONTLINE_API_ORIGIN);
  if (origin) return proxyByOrigin(context.request, origin);

  return json({
    error: 'api_proxy_not_configured',
    message: 'Configure Pages service binding FRONTLINE_API or FRONTLINE_API_ORIGIN.',
  }, 503);
}

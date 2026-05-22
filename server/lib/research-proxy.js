/**
 * Same-origin research proxy — lets the hidden sublayer iframe read DOM + simulate clicks.
 */

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

function isPrivateIp(host) {
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

export function validateResearchUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('INVALID_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('PROTOCOL_BLOCKED');
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || isPrivateIp(host)) throw new Error('HOST_BLOCKED');
  return url.toString();
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function rewriteUrl(href, baseUrl, proxyBase) {
  if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('data:')) {
    return href;
  }
  try {
    const abs = new URL(href, baseUrl).toString();
    validateResearchUrl(abs);
    return `${proxyBase}?url=${encodeURIComponent(abs)}`;
  } catch {
    return href;
  }
}

export function rewriteHtmlForProxy(html, pageUrl, proxyBase) {
  let out = String(html || '');
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/<meta[^>]+http-equiv\s*=\s*["']refresh["'][^>]*>/gi, '');

  if (!/<base[\s>]/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1><base href="${escapeAttr(pageUrl)}">`);
  }

  out = out.replace(/\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi, (match, _q, d1, d2, d3) => {
    const href = d1 || d2 || d3 || '';
    const rewritten = rewriteUrl(href, pageUrl, proxyBase);
    return ` href="${escapeAttr(rewritten)}"`;
  });

  out = out.replace(/\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi, (match, _q, d1, d2, d3) => {
    const src = d1 || d2 || d3 || '';
    if (!src || src.startsWith('data:')) return match;
    try {
      const abs = new URL(src, pageUrl).toString();
      validateResearchUrl(abs);
      return ` src="${escapeAttr(abs)}"`;
    } catch {
      return ' src=""';
    }
  });

  const banner = `<div id="sbcc-proxy-banner" style="position:fixed;top:0;left:0;right:0;z-index:999999;background:#01696f;color:#fff;font:11px sans-serif;padding:4px 8px;pointer-events:none">SBCC research layer (AI only — not visible to you)</div>`;
  out = out.replace(/<body([^>]*)>/i, `<body$1>${banner}`);

  return out;
}

export async function fetchProxiedPage(targetUrl, proxyBase) {
  const url = validateResearchUrl(targetUrl);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SBCC-ResearchLayer/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(25000),
    redirect: 'follow',
  });

  if (!res.ok) throw new Error(`FETCH_${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error('NOT_HTML');
  }

  const html = await res.text();
  const finalUrl = res.url || url;
  return {
    html: rewriteHtmlForProxy(html, finalUrl, proxyBase),
    finalUrl,
  };
}

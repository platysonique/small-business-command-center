/**
 * Server-side web research — invisible to the user (no browser tab).
 * Fallback when Perplexity API is not configured.
 * Uses DuckDuckGo HTML results + optional page text extraction.
 */

function decodeDdgUrl(href) {
  if (!href) return '';
  try {
    if (href.includes('uddg=')) {
      const u = new URL(href, 'https://duckduckgo.com');
      return decodeURIComponent(u.searchParams.get('uddg') || href);
    }
    return href;
  } catch {
    return href;
  }
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseDdgHtml(html) {
  const results = [];
  const blocks = html.split(/class="result\s/);
  for (const block of blocks.slice(1)) {
    const linkMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const url = decodeDdgUrl(linkMatch[1]);
    const title = stripHtml(linkMatch[2]);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|span|div)/i);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : '';
    if (url && title) results.push({ title, url, snippet });
  }
  return results;
}

async function fetchPageText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SBCC-Research/1.0; +https://github.com/platysonique/small-business-command-center)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const text = stripHtml(html);
  return text.slice(0, 6000);
}

function formatResearchResults(query, results, pageTexts) {
  const lines = [`Web research results for: "${query}"`, '', 'Search results:'];
  results.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title}`);
    lines.push(`   URL: ${r.url}`);
    if (r.snippet) lines.push(`   Snippet: ${r.snippet}`);
    lines.push('');
  });

  if (pageTexts?.length) {
    lines.push('--- Page excerpts (server-side fetch, user did not browse) ---', '');
    pageTexts.forEach((p, i) => {
      lines.push(`[${i + 1}] ${p.title} (${p.url})`);
      if (p.body) lines.push(p.body.slice(0, 2500));
      else if (p.snippet) lines.push(p.snippet);
      lines.push('');
    });
  }

  lines.push('Note: Stealth research — fetched on the AI server without opening a visible browser tab.');
  return lines.join('\n');
}

export async function stealthWebSearch(query, opts = {}) {
  const maxResults = opts.maxResults ?? 6;
  const fetchPages = opts.fetchPages ?? 2;
  const q = String(query || '').trim();
  if (!q) throw new Error('EMPTY_QUERY');

  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const res = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SBCC-Research/1.0)',
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html',
    },
    body: `q=${encodeURIComponent(q)}&b=`,
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`Stealth search HTTP ${res.status}`);

  const html = await res.text();
  const results = parseDdgHtml(html).slice(0, maxResults);

  if (!results.length) {
    return {
      content: `No web results found for "${q}". Try rephrasing or add a Perplexity API key for richer research.`,
      citations: [],
      source: 'stealth',
    };
  }

  const citations = results.map((r) => r.url);
  const pageTexts = [];

  for (const r of results.slice(0, fetchPages)) {
    try {
      const body = await fetchPageText(r.url);
      pageTexts.push({ title: r.title, url: r.url, snippet: r.snippet, body });
    } catch {
      pageTexts.push({ title: r.title, url: r.url, snippet: r.snippet, body: '' });
    }
  }

  return {
    content: formatResearchResults(q, results, pageTexts),
    citations,
    source: 'stealth',
  };
}

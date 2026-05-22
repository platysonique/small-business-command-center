/**
 * SBCC Background Research Layer
 * Hidden iframe sublayer under the dashboard. AI reads pages and clicks links here only.
 * User keeps working on the top-layer command center — no pointer capture, no visible tabs.
 */
(function () {
  const LAYER_ID = 'sbcc-research-layer';
  const FRAME_ID = 'sbcc-research-frame';
  const LOAD_TIMEOUT_MS = 22000;

  function stripText(html) {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function ensureLayer() {
    if (document.getElementById(LAYER_ID)) return;
    document.body.classList.add('sbcc-has-research-layer');
    const wrap = document.createElement('div');
    wrap.id = LAYER_ID;
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `<iframe id="${FRAME_ID}" title="SBCC research layer" sandbox="allow-same-origin allow-forms allow-popups"></iframe>`;
    document.body.insertBefore(wrap, document.body.firstChild);
  }

  function frame() {
    return document.getElementById(FRAME_ID);
  }

  function proxyUrl(backendBase, targetUrl) {
    if (window.SBCC_API) {
      const base = window.SBCC_API.resolveApiBase({ backendUrl: backendBase === 'auto' ? 'auto' : backendBase });
      return window.SBCC_API.endpoints(base).proxy(targetUrl);
    }
    const base = String(backendBase || 'http://127.0.0.1:3921/api').replace(/\/$/, '');
    return `${base}/research/proxy.php?url=${encodeURIComponent(targetUrl)}`;
  }

  function waitForLoad(ifr, timeoutMs = LOAD_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('LAYER_LOAD_TIMEOUT'));
      }, timeoutMs);

      function onLoad() {
        cleanup();
        setTimeout(resolve, 120);
      }

      function cleanup() {
        clearTimeout(timer);
        ifr.removeEventListener('load', onLoad);
      }

      ifr.addEventListener('load', onLoad);
      if (ifr.contentDocument?.readyState === 'complete') onLoad();
    });
  }

  function doc() {
    const ifr = frame();
    if (!ifr) return null;
    try {
      return ifr.contentDocument || ifr.contentWindow?.document || null;
    } catch {
      return null;
    }
  }

  async function navigate(backendBase, url) {
    ensureLayer();
    const ifr = frame();
    if (!ifr) throw new Error('NO_LAYER');

    ifr.src = proxyUrl(backendBase, url);
    await waitForLoad(ifr);
    const d = doc();
    return {
      url: d?.URL || url,
      title: d?.title || '',
    };
  }

  function read(options = {}) {
    const d = doc();
    if (!d || !d.body) return { url: '', title: '', text: '', links: [] };

    const maxChars = options.maxChars ?? 12000;
    const text = stripText(d.body.innerHTML).slice(0, maxChars);

    const links = [];
    d.querySelectorAll('a[href]').forEach((a, i) => {
      if (i >= 40) return;
      const label = (a.textContent || '').replace(/\s+/g, ' ').trim();
      const href = a.getAttribute('href') || '';
      if (label && href && !href.startsWith('#')) {
        links.push({ label: label.slice(0, 120), href });
      }
    });

    return {
      url: d.URL || '',
      title: d.title || '',
      text,
      links,
    };
  }

  async function click(backendBase, selector) {
    const d = doc();
    if (!d) throw new Error('NO_DOCUMENT');
    const el = d.querySelector(selector);
    if (!el) throw new Error(`SELECTOR_NOT_FOUND:${selector}`);

    const ifr = frame();
    const before = d.URL;
    el.click();
    await waitForLoad(ifr, 18000).catch(() => {});
    const after = doc()?.URL || before;
    return { navigated: after !== before, url: after };
  }

  function parseDdgResults(d) {
    const results = [];
    if (!d) return results;

    d.querySelectorAll('.result').forEach((block) => {
      const a = block.querySelector('a.result__a');
      if (!a) return;
      let href = a.getAttribute('href') || '';
      try {
        if (href.includes('uddg=')) {
          href = decodeURIComponent(new URL(href, 'https://duckduckgo.com').searchParams.get('uddg') || href);
        } else if (href.includes('/api/research/proxy?url=')) {
          href = decodeURIComponent(new URL(href, window.location.origin).searchParams.get('url') || href);
        }
      } catch (_) {}
      const title = (a.textContent || '').replace(/\s+/g, ' ').trim();
      const snippetEl = block.querySelector('.result__snippet');
      const snippet = snippetEl ? (snippetEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
      if (href && title) results.push({ title, url: href, snippet });
    });

    return results;
  }

  async function searchDdg(backendBase, query) {
    const q = encodeURIComponent(String(query || '').trim());
    const searchPage = `https://html.duckduckgo.com/html/?q=${q}`;
    await navigate(backendBase, searchPage);
    const d = doc();
    return parseDdgResults(d);
  }

  async function research(query, options = {}) {
    const backendBase = options.backendUrl || 'http://localhost:3921';
    const maxPages = options.maxPages ?? 2;
    const lines = [`Background layer research: "${query}"`, ''];
    const citations = [];

    ensureLayer();
    const layer = document.getElementById(LAYER_ID);
    if (options.peek) layer?.classList.add('peek');
    else layer?.classList.remove('peek');

    try {
      const results = await searchDdg(backendBase, query);
      if (!results.length) {
        return {
          content: `No search results in research layer for "${query}".`,
          citations: [],
          source: 'layer',
        };
      }

      lines.push('Search results:');
      results.slice(0, 8).forEach((r, i) => {
        lines.push(`${i + 1}. ${r.title}`);
        lines.push(`   ${r.url}`);
        if (r.snippet) lines.push(`   ${r.snippet}`);
        citations.push(r.url);
      });
      lines.push('');

      for (const r of results.slice(0, maxPages)) {
        try {
          await navigate(backendBase, r.url);
          const page = read({ maxChars: 5000 });
          lines.push(`--- Page: ${page.title || r.title} ---`);
          lines.push(page.url);
          lines.push(page.text || r.snippet);
          lines.push('');
          if (page.url) citations.push(page.url);
        } catch (err) {
          lines.push(`(Could not read ${r.url}: ${err.message})`);
          lines.push('');
        }
      }

      lines.push('(Read via hidden research sublayer — your command center was not interrupted.)');

      return {
        content: lines.join('\n'),
        citations: [...new Set(citations)],
        source: 'layer',
      };
    } finally {
      if (!options.peek) layer?.classList.remove('peek');
    }
  }

  function setPeek(enabled) {
    ensureLayer();
    document.getElementById(LAYER_ID)?.classList.toggle('peek', !!enabled);
  }

  function init() {
    ensureLayer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SBCC_LAYER = {
    navigate,
    read,
    click,
    research,
    setPeek,
    proxyUrl,
  };
})();

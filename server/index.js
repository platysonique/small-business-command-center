import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runAgent } from './lib/agent.js';
import { fetchProxiedPage, validateResearchUrl } from './lib/research-proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3921);
const BUNDLE = path.join(__dirname, '../hosting-bundle');
const CORS = process.env.SBCC_CORS_ORIGIN || '*';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': CORS,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders() });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json',
  };
  return map[ext] || 'application/octet-stream';
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.join(BUNDLE, rel.replace(/^\//, ''));
  if (!filePath.startsWith(BUNDLE)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return true;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }
  res.writeHead(200, { 'Content-Type': contentType(filePath), ...corsHeaders() });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/api/health' || url.pathname === '/api/health.php')) {
    sendJson(res, 200, {
      ok: true,
      service: 'sbcc-ai-api',
      version: '2.0.0',
      integrated: true,
      agentProviders: ['openai', 'anthropic'],
      researchAssistant: ['perplexity', 'background-layer'],
    });
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/api/research/proxy' || url.pathname === '/api/research/proxy.php')) {
    try {
      const target = url.searchParams.get('url');
      if (!target) {
        sendJson(res, 400, { error: 'url required' });
        return;
      }
      validateResearchUrl(target);
      const proxyBase = `${url.origin}/api/research/proxy.php`;
      const page = await fetchProxiedPage(target, proxyBase);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-SBCC-Research-Layer': '1',
        ...corsHeaders(),
      });
      res.end(page.html);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'text/plain', ...corsHeaders() });
      res.end(`Research proxy error: ${err.message}`);
    }
    return;
  }

  if (req.method === 'POST' && (url.pathname === '/api/chat' || url.pathname === '/api/chat.php')) {
    try {
      const body = await readBody(req);
      const { message, history, context, settings, prefetchedResearch } = body;
      if (!message || !String(message).trim()) {
        sendJson(res, 400, { error: 'message required' });
        return;
      }
      const result = await runAgent({
        message: String(message).trim(),
        history: Array.isArray(history) ? history : [],
        context: context || {},
        settings: settings || {},
        prefetchedResearch: prefetchedResearch || null,
      });
      sendJson(res, 200, result);
    } catch (err) {
      console.error('[sbcc-ai]', err);
      sendJson(res, 500, {
        error: err.message || 'Agent error',
        reply: `Something went wrong: ${err.message}`,
        actions: [],
        citations: [],
      });
    }
    return;
  }

  if (req.method === 'GET' && serveStatic(req, res, url)) return;

  sendJson(res, 404, { error: 'Not found' });
});

if (!fs.existsSync(BUNDLE)) {
  console.warn(`Warning: ${BUNDLE} missing — run: python3 scripts/build-hosting-bundle.py`);
}

server.listen(PORT, () => {
  console.log(`SMCC integrated server: http://127.0.0.1:${PORT}/command-center.html`);
  console.log(`  API: /api/health.php  /api/chat.php  /api/research/proxy.php`);
});

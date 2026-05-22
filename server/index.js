import http from 'http';
import { runAgent } from './lib/agent.js';
import { fetchProxiedPage, validateResearchUrl } from './lib/research-proxy.js';

const PORT = Number(process.env.PORT || 3921);
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

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'sbcc-ai-server',
      version: '1.1.0',
      agentProviders: ['openai', 'anthropic'],
      researchAssistant: ['perplexity', 'background-layer'],
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/research/proxy') {
    try {
      const target = url.searchParams.get('url');
      if (!target) {
        sendJson(res, 400, { error: 'url query param required' });
        return;
      }
      validateResearchUrl(target);
      const proxyBase = `${url.origin}/api/research/proxy`;
      const page = await fetchProxiedPage(target, proxyBase);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-SBCC-Research-Layer': '1',
        ...corsHeaders(),
      });
      res.end(page.html);
    } catch (err) {
      console.error('[sbcc-research-proxy]', err.message);
      res.writeHead(502, { 'Content-Type': 'text/plain', ...corsHeaders() });
      res.end(`Research proxy error: ${err.message}`);
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/chat') {
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

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`SBCC AI server listening on http://localhost:${PORT}`);
  console.log(`  Health: GET /api/health`);
  console.log(`  Chat:   POST /api/chat`);
});

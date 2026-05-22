import { classifyIntent } from './classify.js';
import { redactContext, stripSensitiveFromActions } from './redact.js';
import {
  AGENT_TOOLS,
  RESEARCH_TOOL,
  buildSystemPrompt,
  toolCallToAction,
} from './tools.js';
import { resolveProviderKeys, chatWithProvider } from './providers.js';
import { runWebResearch } from './research.js';

const AGENT_PROVIDERS = ['openai', 'anthropic'];

function normalizeAgentProvider(settings) {
  const p = settings.activeProvider || 'openai';
  if (AGENT_PROVIDERS.includes(p)) return p;
  return 'openai';
}

function parseToolArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function extractToolCalls(message) {
  if (!message?.tool_calls?.length) return [];
  return message.tool_calls.map((tc) => ({
    id: tc.id,
    name: tc.function?.name,
    args: parseToolArgs(tc.function?.arguments),
  }));
}

async function executeToolCall(name, args, keys, settings) {
  if (name === 'web_research' || name === 'perplexity_search') {
    const query = args.query || args.q || '';
    const result = await runWebResearch(query, keys, settings);
    return {
      type: 'search_result',
      content: result.content,
      citations: result.citations || [],
      source: result.source,
    };
  }
  const action = toolCallToAction(name, args);
  if (action) return { type: 'client_action', action };
  return { type: 'unknown', name, args };
}

async function synthesizeSearchAnswer(message, research, keys, agentProvider, safeContext, history) {
  const agentKey = keys[agentProvider];
  if (!agentKey) {
    return {
      reply: research.content,
      mode: research.source === 'stealth' ? 'stealth-research' : 'perplexity',
      citations: research.citations || [],
    };
  }

  const system = buildSystemPrompt({
    intent: 'search',
    fullAccess: false,
    hasResearchAssistant: true,
    researchSource: research.source,
  });

  const response = await chatWithProvider(agentProvider, {
    apiKey: agentKey,
    model: keys.models[agentProvider],
    messages: [
      {
        role: 'system',
        content: `${system}\n\nCommand center context (JSON):\n${JSON.stringify(safeContext, null, 2).slice(0, 8000)}`,
      },
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      {
        role: 'user',
        content: `${message}\n\n--- Web research (${research.source}) ---\n${research.content}`,
      },
    ],
  });

  const reply = response.choices?.[0]?.message?.content || research.content;
  return {
    reply,
    mode: agentProvider,
    citations: research.citations || [],
    researchSource: research.source,
  };
}

export async function runAgent({ message, history = [], context = {}, settings = {} }) {
  const fullAccess = !!settings.fullAccess;
  const keys = resolveProviderKeys(settings);
  const intent = classifyIntent(message);
  const safeContext = redactContext(context, fullAccess, settings.sensitiveKeys || []);
  const agentProvider = normalizeAgentProvider(settings);
  const agentKey = keys[agentProvider];
  const hasResearchAssistant = !!keys.perplexity || settings.researchAssistant?.fallbackStealth !== false;

  // ─── Search intent: research assistant first, agent synthesizes ───
  if (intent === 'search') {
    if (!hasResearchAssistant) {
      return {
        reply: 'Web research is unavailable. Add a Perplexity API key under Research Assistant, or enable stealth fallback in AI Settings.',
        mode: 'search_blocked',
        intent,
        actions: [],
        citations: [],
      };
    }

    try {
      const research = await runWebResearch(message, keys, settings);
      const synthesized = await synthesizeSearchAnswer(
        message,
        research,
        keys,
        agentProvider,
        safeContext,
        history,
      );
      return {
        reply: synthesized.reply,
        mode: synthesized.mode,
        intent,
        actions: [],
        citations: synthesized.citations,
        researchSource: synthesized.researchSource || research.source,
      };
    } catch (err) {
      return {
        reply: `Research failed: ${err.message}. Check your Perplexity key or try again.`,
        mode: 'search_error',
        intent,
        actions: [],
        citations: [],
      };
    }
  }

  // ─── Agent path (local + form_fill): one provider only ───
  if (!agentKey) {
    return {
      reply: `No agent provider configured. Open AI Settings, pick OpenAI or Anthropic under Agent Provider, and add its API key.`,
      mode: 'no_provider',
      intent,
      actions: [],
      citations: [],
    };
  }

  const system = buildSystemPrompt({
    intent,
    fullAccess,
    hasResearchAssistant,
    researchSource: keys.perplexity ? 'perplexity' : 'stealth',
  });
  const ctxBlock = JSON.stringify(safeContext, null, 2).slice(0, 14000);
  const messages = [
    { role: 'system', content: `${system}\n\nCommand center context (JSON):\n${ctxBlock}` },
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const actions = [];
  const citations = [];
  let loops = 0;
  let lastContent = '';
  let lastResearchSource = null;

  const formTools = AGENT_TOOLS.filter((t) => t.function.name !== 'web_research');
  const allTools = [...formTools, RESEARCH_TOOL];

  while (loops < 5) {
    loops += 1;

    const response = await chatWithProvider(agentProvider, {
      apiKey: agentKey,
      model: keys.models[agentProvider],
      messages,
      system,
      tools: allTools,
    });

    const assistantMsg = response.choices?.[0]?.message;
    if (!assistantMsg) break;

    lastContent = assistantMsg.content || '';
    const toolCalls = extractToolCalls(assistantMsg);

    if (!toolCalls.length) {
      return {
        reply: lastContent,
        mode: agentProvider,
        intent,
        actions: stripSensitiveFromActions(actions, fullAccess),
        citations,
        researchSource: lastResearchSource,
      };
    }

    messages.push(assistantMsg);

    for (const tc of toolCalls) {
      if ((tc.name === 'web_research' || tc.name === 'perplexity_search') && !hasResearchAssistant) {
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: 'ERROR: No research assistant available. Enable Perplexity or stealth fallback in AI Settings.',
        });
        continue;
      }

      try {
        const result = await executeToolCall(tc.name, tc.args, keys, settings);

        if (result.type === 'search_result') {
          lastResearchSource = result.source;
          if (result.citations?.length) citations.push(...result.citations);
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result.content,
          });
        } else if (result.type === 'client_action') {
          actions.push(result.action);
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: true, queued: result.action }),
          });
        } else {
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
      } catch (err) {
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: `ERROR: ${err.message}`,
        });
      }
    }
  }

  return {
    reply: lastContent || 'Done.',
    mode: agentProvider,
    intent,
    actions: stripSensitiveFromActions(actions, fullAccess),
    citations,
    researchSource: lastResearchSource,
  };
}

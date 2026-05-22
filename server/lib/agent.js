import { classifyIntent } from './classify.js';
import { redactContext, stripSensitiveFromActions } from './redact.js';
import {
  AGENT_TOOLS,
  buildSystemPrompt,
  toolCallToAction,
} from './tools.js';
import {
  resolveProviderKeys,
  perplexityChat,
  chatWithProvider,
} from './providers.js';

async function runPerplexitySearch(query, keys) {
  const result = await perplexityChat({
    apiKey: keys.perplexity,
    model: keys.models.perplexity,
    messages: [
      {
        role: 'system',
        content: 'You are a research assistant. Provide factual, cited answers. Include source URLs when available.',
      },
      { role: 'user', content: query },
    ],
  });
  return result;
}

async function executeToolCall(name, args, keys) {
  if (name === 'perplexity_search') {
    const result = await runPerplexitySearch(args.query, keys);
    return {
      type: 'search_result',
      content: result.content,
      citations: result.citations || [],
    };
  }
  const action = toolCallToAction(name, args);
  if (action) return { type: 'client_action', action };
  return { type: 'unknown', name, args };
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

export async function runAgent({ message, history = [], context = {}, settings = {} }) {
  const fullAccess = !!settings.fullAccess;
  const keys = resolveProviderKeys(settings);
  const intent = classifyIntent(message);
  const safeContext = redactContext(context, fullAccess, settings.sensitiveKeys || []);
  const hasPerplexity = !!keys.perplexity;

  // Hard rule: search intent requires Perplexity
  if (intent === 'search' && !hasPerplexity) {
    const localFallback = intent === 'search' && safeContext
      ? '\n\n(I can only use your command center data without Perplexity. Add your Perplexity API key in AI Settings → Providers for web research.)'
      : '';
    return {
      reply: `Perplexity API is required for search and external research, but no key is configured.${localFallback}`,
      mode: 'search_blocked',
      intent,
      actions: [],
      citations: [],
    };
  }

  // Direct Perplexity path for pure search
  if (intent === 'search' && hasPerplexity && !['openai', 'anthropic'].includes(settings.activeProvider)) {
    const ctxBlock = JSON.stringify(safeContext, null, 2).slice(0, 12000);
    const result = await perplexityChat({
      apiKey: keys.perplexity,
      model: keys.models.perplexity,
      messages: [
        {
          role: 'system',
          content: `${buildSystemPrompt({ intent, fullAccess, hasPerplexity })}\n\nCommand center context:\n${ctxBlock}`,
        },
        ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        {
          role: 'user',
          content: message,
        },
      ],
    });
    return {
      reply: result.content,
      mode: 'perplexity',
      intent,
      actions: [],
      citations: result.citations || [],
    };
  }

  const provider = settings.activeProvider || 'openai';
  const providerKey = keys[provider];
  if (!providerKey && intent !== 'search') {
    return {
      reply: 'No AI provider configured. Open AI Settings and add an OpenAI or Anthropic API key (or set Perplexity as active provider for search).',
      mode: 'no_provider',
      intent,
      actions: [],
      citations: [],
    };
  }

  const system = buildSystemPrompt({ intent, fullAccess, hasPerplexity });
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

  while (loops < 5) {
    loops += 1;
    const useTools = intent !== 'search' || loops > 1 ? AGENT_TOOLS : [
      ...AGENT_TOOLS.filter((t) => t.function.name === 'perplexity_search'),
    ];

    let response;
    if (provider === 'openai' || !providerKey) {
      if (!keys.openai && provider !== 'openai') break;
      response = await chatWithProvider('openai', {
        apiKey: keys.openai || providerKey,
        messages,
        model: keys.models.openai,
        tools: useTools,
      });
    } else {
      response = await chatWithProvider('anthropic', {
        apiKey: keys.anthropic,
        messages,
        model: keys.models.anthropic,
        system,
        tools: useTools,
      });
    }

    const assistantMsg = response.choices?.[0]?.message;
    if (!assistantMsg) break;

    lastContent = assistantMsg.content || '';
    const toolCalls = extractToolCalls(assistantMsg);

    if (!toolCalls.length) {
      return {
        reply: lastContent,
        mode: provider,
        intent,
        actions: stripSensitiveFromActions(actions, fullAccess),
        citations,
      };
    }

    messages.push(assistantMsg);

    for (const tc of toolCalls) {
      if (tc.name === 'perplexity_search' && !hasPerplexity) {
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: 'ERROR: Perplexity API key not configured.',
        });
        continue;
      }

      const result = await executeToolCall(tc.name, tc.args, keys);

      if (result.type === 'search_result') {
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
    }
  }

  return {
    reply: lastContent || 'Done.',
    mode: provider,
    intent,
    actions: stripSensitiveFromActions(actions, fullAccess),
    citations,
  };
}

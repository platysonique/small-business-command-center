/**
 * SBCC AI Agent — runs entirely in the browser. No server. Paste API keys, chat.
 */
(function () {
  const SENSITIVE = new Set(['phone', 'ein', 'address', 'city', 'state', 'zip', 'owner_name', 'birth_date', 'birth_place', 'owner_ethnicity']);

  function classifyIntent(message) {
    const text = String(message || '').trim();
    if (!text) return 'local';
    if (/\b(fill|update|set|add|write|draft|complete|populate)\b.*\b(field|form|profile|narrative|answer|task|grant)\b/i.test(text)) return 'form_fill';
    if (/\b(search|find|look up|lookup|research|latest|current|deadline|grant program|funding|eligible|requirements|what grants|how to apply)\b/i.test(text)) return 'search';
    if (/\?$/.test(text)) return 'search';
    if (/\b(grant|funding|loan|sba)\b/i.test(text) && text.length > 40) return 'search';
    if (/\b(my (profile|tasks|grants|checklist|calendar|milestones|dashboard))\b/i.test(text)) return 'local';
    return 'local';
  }

  function redactContext(context, fullAccess, extra = []) {
    if (!context || fullAccess) return context;
    const sens = new Set([...SENSITIVE, ...extra]);
    const out = JSON.parse(JSON.stringify(context));
    if (out.profile) {
      Object.keys(out.profile).forEach((k) => {
        if (sens.has(k)) out.profile[k] = '[REDACTED — enable Full Access in AI Settings]';
      });
    }
    return out;
  }

  function stripSensitiveActions(actions, fullAccess) {
    if (fullAccess || !Array.isArray(actions)) return actions || [];
    return actions.filter((a) => !(a.tool === 'fill_profile' && SENSITIVE.has(a.key)));
  }

  function resolveKeys(settings) {
    const p = settings.providers || {};
    return {
      perplexity: p.perplexity?.apiKey || '',
      openai: p.openai?.apiKey || '',
      anthropic: p.anthropic?.apiKey || '',
      models: {
        perplexity: p.perplexity?.model || 'sonar-pro',
        openai: p.openai?.model || 'gpt-4o-mini',
        anthropic: p.anthropic?.model || 'claude-sonnet-4-20250514',
      },
    };
  }

  const RESEARCH_TOOL = {
    type: 'function',
    function: {
      name: 'web_research',
      description: 'Research assistant — web search via Perplexity. Required for external facts.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  };

  const AGENT_TOOLS = [
    {
      type: 'function',
      function: {
        name: 'fill_profile_field',
        description: 'Set Application Profile field',
        parameters: {
          type: 'object',
          properties: { key: { type: 'string' }, value: { type: 'string' } },
          required: ['key', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'add_task',
        description: 'Add checklist task',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string' }, label: { type: 'string' },
            color: { type: 'string' }, group: { type: 'string' },
            deadline: { type: 'string' }, url: { type: 'string' },
          },
          required: ['text', 'label', 'group', 'deadline'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'add_grant_card',
        description: 'Add grant card',
        parameters: {
          type: 'object',
          properties: {
            section: { type: 'string' }, name: { type: 'string' }, amt: { type: 'string' },
            desc: { type: 'string' }, why: { type: 'string' }, url: { type: 'string' }, amtColor: { type: 'string' },
          },
          required: ['section', 'name', 'amt', 'desc', 'why', 'url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'add_narrative',
        description: 'Add grant narrative',
        parameters: {
          type: 'object',
          properties: { sectionHeading: { type: 'string' }, cardTitle: { type: 'string' }, body: { type: 'string' } },
          required: ['sectionHeading', 'cardTitle', 'body'],
        },
      },
    },
    RESEARCH_TOOL,
  ];

  function toolToAction(name, args) {
    switch (name) {
      case 'fill_profile_field': return { tool: 'fill_profile', key: args.key, value: args.value };
      case 'add_task': return { tool: 'add_task', ...args };
      case 'add_grant_card': return { tool: 'add_grant', ...args };
      case 'add_narrative': return { tool: 'add_narrative', ...args };
      default: return null;
    }
  }

  function systemPrompt(fullAccess, hasPplx) {
    const sens = fullAccess
      ? 'FULL ACCESS on — sensitive fields may be read/filled.'
      : 'Sensitive fields REDACTED. Never fill sensitive keys.';
    const research = hasPplx
      ? 'For external facts call web_research (Perplexity). Never guess grant deadlines or URLs.'
      : 'No Perplexity key — only answer from command center data. Tell user to add Perplexity key for web research.';
    return `SBCC AI Assistant. One agent provider (OpenAI or Anthropic). ${sens} ${research} Be concise.`;
  }

  async function apiFetch(url, options, label) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`${label} ${res.status}: ${err.slice(0, 300)}`);
      }
      return res.json();
    } catch (e) {
      if (e.message?.includes('Failed to fetch') || e.name === 'TypeError') {
        throw new Error(`${label}: network blocked (offline or provider CORS). Dashboard still works offline; AI needs internet + valid API key.`);
      }
      throw e;
    }
  }

  async function perplexityChat(apiKey, model, messages) {
    const data = await apiFetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 4096,
        web_search_options: { search_context_size: 'high' },
      }),
    }, 'Perplexity');
    return {
      content: data.choices?.[0]?.message?.content || '',
      citations: data.citations || [],
    };
  }

  async function openaiChat(apiKey, model, messages, tools) {
    const body = { model, messages, temperature: 0.3, max_tokens: 4096 };
    if (tools?.length) { body.tools = tools; body.tool_choice = 'auto'; }
    return apiFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 'OpenAI');
  }

  async function anthropicChat(apiKey, model, messages, system, tools) {
    const body = {
      model,
      max_tokens: 4096,
      system: system || '',
      messages: messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    };
    if (tools?.length) {
      body.tools = tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }
    const data = await apiFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    }, 'Anthropic');
    const text = data.content?.find((b) => b.type === 'text');
    const toolsOut = data.content?.filter((b) => b.type === 'tool_use') || [];
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: text?.text || '',
          tool_calls: toolsOut.map((tb) => ({
            id: tb.id,
            type: 'function',
            function: { name: tb.name, arguments: JSON.stringify(tb.input) },
          })),
        },
      }],
    };
  }

  function parseArgs(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return {}; }
  }

  async function runWebResearch(query, keys) {
    if (!keys.perplexity) throw new Error('Add Perplexity API key in AI Settings for web research.');
    return { ...(await perplexityChat(keys.perplexity, keys.models.perplexity, [
      { role: 'system', content: 'Factual research with citations.' },
      { role: 'user', content: query },
    ])), source: 'perplexity' };
  }

  async function synthesizeSearch(message, research, keys, agent, ctx, history) {
    const agentKey = keys[agent];
    if (!agentKey) {
      return { reply: research.content, mode: 'perplexity', citations: research.citations || [] };
    }
    const sys = systemPrompt(false, true);
    const msgs = [
      { role: 'system', content: `${sys}\n\nContext:\n${JSON.stringify(ctx).slice(0, 8000)}` },
      ...history.slice(-6),
      { role: 'user', content: `${message}\n\n--- Research ---\n${research.content}` },
    ];
    let resp;
    if (agent === 'anthropic') {
      resp = await anthropicChat(agentKey, keys.models.anthropic, msgs, sys);
    } else {
      resp = await openaiChat(agentKey, keys.models.openai, msgs);
    }
    return {
      reply: resp.choices?.[0]?.message?.content || research.content,
      mode: agent,
      citations: research.citations || [],
    };
  }

  async function runAgent({ message, history = [], context = {}, settings = {} }) {
    const fullAccess = !!settings.fullAccess;
    const keys = resolveKeys(settings);
    const intent = classifyIntent(message);
    const safeCtx = redactContext(context, fullAccess, settings.sensitiveKeys || []);
    const agent = ['openai', 'anthropic'].includes(settings.activeProvider) ? settings.activeProvider : 'openai';
    const agentKey = keys[agent];
    const hasPplx = !!keys.perplexity;

    if (intent === 'search') {
      if (!hasPplx && !agentKey) {
        return {
          reply: 'Add a Perplexity API key (research) and/or OpenAI/Anthropic key (agent) in AI Settings.',
          mode: 'no_keys', intent, actions: [], citations: [],
        };
      }
      try {
        const research = hasPplx
          ? await runWebResearch(message, keys)
          : { content: 'No Perplexity key.', citations: [], source: 'none' };
        const syn = await synthesizeSearch(message, research, keys, agent, safeCtx, history);
        return { reply: syn.reply, mode: syn.mode, intent, actions: [], citations: syn.citations, researchSource: research.source };
      } catch (e) {
        return { reply: e.message, mode: 'error', intent, actions: [], citations: [] };
      }
    }

    if (!agentKey) {
      return {
        reply: 'Add your OpenAI or Anthropic API key in AI Settings → Agent provider.',
        mode: 'no_provider', intent, actions: [], citations: [],
      };
    }

    const sys = systemPrompt(fullAccess, hasPplx);
    const ctxBlock = JSON.stringify(safeCtx).slice(0, 14000);
    const messages = [
      { role: 'system', content: `${sys}\n\nContext JSON:\n${ctxBlock}` },
      ...history.slice(-10),
      { role: 'user', content: message },
    ];

    const actions = [];
    const citations = [];
    let lastContent = '';

    for (let loop = 0; loop < 5; loop++) {
      const resp = agent === 'anthropic'
        ? await anthropicChat(agentKey, keys.models.anthropic, messages, sys, AGENT_TOOLS)
        : await openaiChat(agentKey, keys.models.openai, messages, AGENT_TOOLS);

      const assistant = resp.choices?.[0]?.message;
      if (!assistant) break;
      lastContent = assistant.content || '';
      const toolCalls = (assistant.tool_calls || []).map((tc) => ({
        id: tc.id,
        name: tc.function?.name,
        args: parseArgs(tc.function?.arguments),
      }));

      if (!toolCalls.length) {
        return {
          reply: lastContent,
          mode: agent,
          intent,
          actions: stripSensitiveActions(actions, fullAccess),
          citations,
        };
      }

      messages.push(assistant);

      for (const tc of toolCalls) {
        if (tc.name === 'web_research' || tc.name === 'perplexity_search') {
          try {
            const r = await runWebResearch(tc.args.query || message, keys);
            if (r.citations?.length) citations.push(...r.citations);
            messages.push({ role: 'tool', tool_call_id: tc.id, content: r.content });
          } catch (e) {
            messages.push({ role: 'tool', tool_call_id: tc.id, content: `ERROR: ${e.message}` });
          }
        } else {
          const action = toolToAction(tc.name, tc.args);
          if (action) actions.push(action);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ ok: true }) });
        }
      }
    }

    return {
      reply: lastContent || 'Done.',
      mode: agent,
      intent,
      actions: stripSensitiveActions(actions, fullAccess),
      citations,
    };
  }

  window.SBCC_AGENT = { run: runAgent, classifyIntent };
})();

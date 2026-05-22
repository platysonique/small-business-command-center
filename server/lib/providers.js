const PPLX_URL = 'https://api.perplexity.ai/chat/completions';

export async function perplexityChat({ apiKey, messages, model = 'sonar-pro', searchContextSize = 'high' }) {
  if (!apiKey) throw new Error('PERPLEXITY_KEY_REQUIRED');

  const res = await fetch(PPLX_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 4096,
      web_search_options: { search_context_size: searchContextSize },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity API ${res.status}: ${err.slice(0, 400)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message;
  return {
    content: choice?.content || '',
    citations: data.citations || [],
    usage: data.usage,
  };
}

export async function openaiChat({ apiKey, messages, model = 'gpt-4o-mini', tools, toolChoice }) {
  if (!apiKey) throw new Error('OPENAI_KEY_REQUIRED');

  const body = {
    model,
    messages,
    temperature: 0.3,
    max_tokens: 4096,
  };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = toolChoice || 'auto';
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${err.slice(0, 400)}`);
  }

  return res.json();
}

export async function anthropicChat({ apiKey, messages, model = 'claude-sonnet-4-20250514', system, tools }) {
  if (!apiKey) throw new Error('ANTHROPIC_KEY_REQUIRED');

  const userMessages = messages.filter((m) => m.role !== 'system');
  const body = {
    model,
    max_tokens: 4096,
    system: system || messages.find((m) => m.role === 'system')?.content || '',
    messages: userMessages.map((m) => ({
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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 400)}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b) => b.type === 'text');
  const toolBlocks = data.content?.filter((b) => b.type === 'tool_use') || [];

  return {
    choices: [{
      message: {
        role: 'assistant',
        content: textBlock?.text || '',
        tool_calls: toolBlocks.map((tb) => ({
          id: tb.id,
          type: 'function',
          function: { name: tb.name, arguments: JSON.stringify(tb.input) },
        })),
      },
    }],
  };
}

export function resolveProviderKeys(clientSettings = {}, env = process.env) {
  const p = clientSettings.providers || {};
  return {
    perplexity: p.perplexity?.apiKey || env.PERPLEXITY_API_KEY || '',
    openai: p.openai?.apiKey || env.OPENAI_API_KEY || '',
    anthropic: p.anthropic?.apiKey || env.ANTHROPIC_API_KEY || '',
    google: p.google?.apiKey || env.GOOGLE_API_KEY || '',
    models: {
      perplexity: p.perplexity?.model || 'sonar-pro',
      openai: p.openai?.model || 'gpt-4o-mini',
      anthropic: p.anthropic?.model || 'claude-sonnet-4-20250514',
    },
    activeProvider: clientSettings.activeProvider || 'openai',
  };
}

export async function chatWithProvider(provider, opts) {
  if (provider === 'anthropic') return anthropicChat(opts);
  if (provider === 'openai') return openaiChat(opts);
  throw new Error(`Unsupported synthesis provider: ${provider}`);
}

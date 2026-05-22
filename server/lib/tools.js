export const RESEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_research',
    description:
      'Research assistant — MANDATORY for external facts, grant programs, deadlines, and web search. Uses Perplexity when configured; otherwise server-side stealth web fetch (invisible to user). Returns grounded text and URLs.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
};

export const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'fill_profile_field',
      description: 'Set a field on the user Application Profile (grant sign-up form).',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Profile field key e.g. ein, industry, dba' },
          value: { type: 'string', description: 'Value to set' },
        },
        required: ['key', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: 'Add a checklist task to the command center.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          label: { type: 'string' },
          color: { type: 'string', enum: ['red', 'orange', 'gold', 'green', 'blue', 'purple', 'primary'] },
          group: { type: 'string', enum: ['urgent', 'monitor', 'hold', 'closed', 'month', 'june', 'later'] },
          deadline: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['text', 'label', 'group', 'deadline'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_grant_card',
      description: 'Add a grant card to a grants section.',
      parameters: {
        type: 'object',
        properties: {
          section: { type: 'string', enum: ['platforms', 'urgent', 'monitor', 'hold', 'closed', 'june', 'federal', 'tech', 'equipment'] },
          name: { type: 'string' },
          amt: { type: 'string' },
          desc: { type: 'string' },
          why: { type: 'string' },
          url: { type: 'string' },
          amtColor: { type: 'string' },
        },
        required: ['section', 'name', 'amt', 'desc', 'why', 'url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_narrative',
      description: 'Add grant copy narrative (single paragraph answer).',
      parameters: {
        type: 'object',
        properties: {
          sectionHeading: { type: 'string' },
          cardTitle: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['sectionHeading', 'cardTitle', 'body'],
      },
    },
  },
  RESEARCH_TOOL,
];

/** @deprecated alias — agent accepts legacy tool name */
export const LEGACY_RESEARCH_TOOL_NAMES = ['web_research', 'perplexity_search'];

export function toolCallToAction(name, args) {
  switch (name) {
    case 'fill_profile_field':
      return { tool: 'fill_profile', key: args.key, value: args.value };
    case 'add_task':
      return { tool: 'add_task', ...args };
    case 'add_grant_card':
      return { tool: 'add_grant', ...args };
    case 'add_narrative':
      return { tool: 'add_narrative', ...args };
    default:
      return null;
  }
}

export function buildSystemPrompt({ intent, fullAccess, hasResearchAssistant, researchSource }) {
  const sensitiveNote = fullAccess
    ? 'User enabled FULL ACCESS — sensitive profile fields may be read and filled.'
    : 'Sensitive fields (EIN, phone, address, DOB, owner name, etc.) are REDACTED. Never guess or invent them. Do not emit fill_profile actions for sensitive keys.';

  const researchRule = hasResearchAssistant
    ? researchSource === 'perplexity'
      ? 'For external facts you MUST call web_research (Perplexity research assistant). Do NOT answer from internal knowledge alone.'
      : 'For external facts you MUST call web_research (server stealth fetch — no visible browser tab). Do NOT answer from internal knowledge alone.'
    : 'Research assistant is NOT available. For external research, tell the user to add a Perplexity API key or enable stealth fallback in AI Settings. You may only synthesize from command center data provided.';

  return `You are the SBCC AI Assistant for a small business grant & operations command center.

You run on ONE agent provider (OpenAI or Anthropic). Web research is handled by a separate research assistant tool — not by switching providers.

${sensitiveNote}

${researchRule}

Intents:
- local: summarize or explain data already in the command center context JSON.
- search: research assistant gathers web results; you synthesize a helpful answer with citations when available.
- form_fill: use form tools (profile, tasks, grants, narratives). Call web_research first when grant-related facts are needed.

Return concise, actionable replies. When you use tools, explain what you changed.`;
}

export function contextSummary(context) {
  if (!context) return '{}';
  const parts = [];
  if (context.profile) parts.push(`Profile keys: ${Object.keys(context.profile).join(', ')}`);
  if (context.tasks?.length) parts.push(`Tasks: ${context.tasks.length}`);
  if (context.grants) {
    const total = Object.values(context.grants).flat().length;
    parts.push(`Grant cards: ${total}`);
  }
  if (context.narratives) parts.push(`Narrative snippets: ${Object.keys(context.narratives).length}`);
  if (context.currentView) parts.push(`Current view: ${context.currentView}`);
  return parts.join(' | ');
}

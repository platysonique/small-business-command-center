import { perplexityChat } from './providers.js';
import { stealthWebSearch } from './stealth-research.js';

export async function runWebResearch(query, keys, settings = {}) {
  const q = String(query || '').trim();
  if (!q) throw new Error('EMPTY_QUERY');

  const useStealthFallback = settings.researchAssistant?.fallbackStealth !== false;

  if (keys.perplexity) {
    const result = await perplexityChat({
      apiKey: keys.perplexity,
      model: keys.models.perplexity,
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant. Provide factual, cited answers. Include source URLs when available.',
        },
        { role: 'user', content: q },
      ],
    });
    return {
      content: result.content,
      citations: result.citations || [],
      source: 'perplexity',
    };
  }

  if (useStealthFallback) {
    return stealthWebSearch(q);
  }

  throw new Error('NO_RESEARCH_ASSISTANT');
}

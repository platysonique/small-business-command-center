import { perplexityChat } from './providers.js';
import { stealthWebSearch } from './stealth-research.js';

export async function runWebResearch(query, keys, settings = {}, prefetchedLayer = null) {
  const q = String(query || '').trim();
  if (!q) throw new Error('EMPTY_QUERY');

  if (prefetchedLayer?.content) {
    return {
      content: prefetchedLayer.content,
      citations: prefetchedLayer.citations || [],
      source: prefetchedLayer.source || 'layer',
    };
  }

  const useLayerFallback = settings.researchAssistant?.fallbackLayer !== false;
  const useServerStealth = settings.researchAssistant?.serverStealth === true;

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

  // Layer research runs in the browser sublayer (client prefetches). Server stealth is legacy fallback.
  if (useServerStealth) {
    return stealthWebSearch(q);
  }

  if (useLayerFallback) {
    throw new Error('LAYER_RESEARCH_REQUIRED');
  }

  throw new Error('NO_RESEARCH_ASSISTANT');
}

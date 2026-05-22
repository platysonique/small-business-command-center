const SEARCH_PATTERNS = [
  /\b(search|find|look up|lookup|google|research|latest|current|today|recent|news|grant program|funding opportunity|deadline|eligible|requirements)\b/i,
  /\b(what grants|which grants|how to apply|application process|competitors|market|industry trend)\b/i,
  /\b(perplexity|web|online|internet|source|citation)\b/i,
  /\?$/, // questions often need grounding
];

const LOCAL_PATTERNS = [
  /\b(my (profile|tasks|grants|checklist|calendar|milestones|revenue|dashboard))\b/i,
  /\b(command center|what do i have|summarize my|fill in my|update my profile|add a task)\b/i,
  /\b(copy|narrative|grant copy|application profile)\b/i,
];

const FORM_FILL_PATTERNS = [
  /\b(fill|update|set|add|write|draft|complete|populate)\b.*\b(field|form|profile|narrative|answer|task|grant)\b/i,
  /\b(help me (fill|write|draft|complete))\b/i,
];

export function classifyIntent(message) {
  const text = String(message || '').trim();
  if (!text) return 'local';

  if (FORM_FILL_PATTERNS.some((p) => p.test(text))) return 'form_fill';
  if (SEARCH_PATTERNS.some((p) => p.test(text))) return 'search';
  if (LOCAL_PATTERNS.some((p) => p.test(text))) return 'local';

  // Default: if it looks like external knowledge, treat as search
  if (/\b(grant|funding|loan|sba|irs|ein rules|texas|federal)\b/i.test(text) && text.length > 40) {
    return 'search';
  }
  return 'local';
}

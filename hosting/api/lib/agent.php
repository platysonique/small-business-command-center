<?php
declare(strict_types=1);

function sbcc_classify_intent(string $message): string {
    $text = trim($message);
    if ($text === '') return 'local';

    $form = '/\b(fill|update|set|add|write|draft|complete|populate)\b.*\b(field|form|profile|narrative|answer|task|grant)\b/i';
    if (preg_match($form, $text)) return 'form_fill';

    $search = [
        '/\b(search|find|look up|lookup|google|research|latest|current|today|recent|news|grant program|funding opportunity|deadline|eligible|requirements)\b/i',
        '/\b(what grants|which grants|how to apply|application process)\b/i',
    ];
    foreach ($search as $p) {
        if (preg_match($p, $text)) return 'search';
    }
    if (str_ends_with($text, '?')) return 'search';
    if (preg_match('/\b(grant|funding|loan|sba)\b/i', $text) && strlen($text) > 40) return 'search';

    $local = '/\b(my (profile|tasks|grants|checklist|calendar|milestones|dashboard))\b/i';
    if (preg_match($local, $text)) return 'local';

    return 'local';
}

function sbcc_redact_context(array $context, bool $fullAccess, array $extraSensitive = []): array {
    if ($fullAccess) return $context;
    $sensitive = array_flip(array_merge(
        ['phone', 'ein', 'address', 'city', 'state', 'zip', 'owner_name', 'birth_date', 'birth_place', 'owner_ethnicity'],
        $extraSensitive
    ));
    $out = $context;
    if (!empty($out['profile']) && is_array($out['profile'])) {
        foreach ($out['profile'] as $k => $v) {
            if (isset($sensitive[$k])) {
                $out['profile'][$k] = '[REDACTED — enable Full Access in AI Settings]';
            }
        }
    }
    return $out;
}

function sbcc_strip_sensitive_actions(array $actions, bool $fullAccess): array {
    if ($fullAccess) return $actions;
    $sensitive = ['phone', 'ein', 'address', 'city', 'state', 'zip', 'owner_name', 'birth_date', 'birth_place', 'owner_ethnicity'];
    $set = array_flip($sensitive);
    return array_values(array_filter($actions, function ($a) use ($set) {
        if (($a['tool'] ?? '') === 'fill_profile' && isset($set[$a['key'] ?? ''])) return false;
        return true;
    }));
}

function sbcc_resolve_keys(array $settings): array {
    $p = $settings['providers'] ?? [];
    return [
        'perplexity' => $p['perplexity']['apiKey'] ?? '',
        'openai' => $p['openai']['apiKey'] ?? '',
        'anthropic' => $p['anthropic']['apiKey'] ?? '',
        'models' => [
            'perplexity' => $p['perplexity']['model'] ?? 'sonar-pro',
            'openai' => $p['openai']['model'] ?? 'gpt-4o-mini',
            'anthropic' => $p['anthropic']['model'] ?? 'claude-sonnet-4-20250514',
        ],
    ];
}

function sbcc_build_system_prompt(bool $fullAccess, bool $hasResearch, string $researchSource = 'layer'): string {
    $sensitive = $fullAccess
        ? 'User enabled FULL ACCESS — sensitive profile fields may be read and filled.'
        : 'Sensitive fields are REDACTED. Never guess them. Do not fill_profile on sensitive keys.';
    $research = $hasResearch
        ? ($researchSource === 'perplexity'
            ? 'For external facts call web_research (Perplexity).'
            : 'For external facts call web_research (background layer on same site).')
        : 'Research unavailable — use command center data only.';
    return "You are the SBCC AI Assistant.\n$sensitive\n$research\nOne agent provider handles tools. Be concise.";
}

function sbcc_tool_call_to_action(string $name, array $args): ?array {
    switch ($name) {
        case 'fill_profile_field':
            return ['tool' => 'fill_profile', 'key' => $args['key'] ?? '', 'value' => $args['value'] ?? ''];
        case 'add_task':
            return ['tool' => 'add_task'] + $args;
        case 'add_grant_card':
            return ['tool' => 'add_grant'] + $args;
        case 'add_narrative':
            return ['tool' => 'add_narrative'] + $args;
        default:
            return null;
    }
}

function sbcc_agent_tools(): array {
    return [
        [
            'type' => 'function',
            'function' => [
                'name' => 'fill_profile_field',
                'description' => 'Set Application Profile field',
                'parameters' => [
                    'type' => 'object',
                    'properties' => ['key' => ['type' => 'string'], 'value' => ['type' => 'string']],
                    'required' => ['key', 'value'],
                ],
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'web_research',
                'description' => 'Research assistant for external web facts',
                'parameters' => [
                    'type' => 'object',
                    'properties' => ['query' => ['type' => 'string']],
                    'required' => ['query'],
                ],
            ],
        ],
    ];
}

function sbcc_perplexity_chat(string $apiKey, string $model, array $messages): array {
    $res = sbcc_http_json('POST', 'https://api.perplexity.ai/chat/completions', [
        'model' => $model,
        'messages' => $messages,
        'temperature' => 0.2,
        'max_tokens' => 4096,
        'web_search_options' => ['search_context_size' => 'high'],
    ], [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
        'Accept: application/json',
    ]);
    if ($res['code'] >= 400) throw new RuntimeException('Perplexity ' . $res['code']);
    $data = json_decode($res['body'], true);
    return [
        'content' => $data['choices'][0]['message']['content'] ?? '',
        'citations' => $data['citations'] ?? [],
    ];
}

function sbcc_openai_chat(string $apiKey, string $model, array $messages, array $tools = []): array {
    $body = ['model' => $model, 'messages' => $messages, 'temperature' => 0.3, 'max_tokens' => 4096];
    if ($tools) {
        $body['tools'] = $tools;
        $body['tool_choice'] = 'auto';
    }
    $res = sbcc_http_json('POST', 'https://api.openai.com/v1/chat/completions', $body, [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
    ]);
    if ($res['code'] >= 400) throw new RuntimeException('OpenAI ' . $res['code']);
    return json_decode($res['body'], true) ?: [];
}

function sbcc_run_web_research(string $query, array $keys, array $settings, ?array $prefetched = null): array {
    if ($prefetched && !empty($prefetched['content'])) {
        return [
            'content' => $prefetched['content'],
            'citations' => $prefetched['citations'] ?? [],
            'source' => $prefetched['source'] ?? 'layer',
        ];
    }
    if (!empty($keys['perplexity'])) {
        $r = sbcc_perplexity_chat($keys['perplexity'], $keys['models']['perplexity'], [
            ['role' => 'system', 'content' => 'Factual research assistant with citations.'],
            ['role' => 'user', 'content' => $query],
        ]);
        return ['content' => $r['content'], 'citations' => $r['citations'], 'source' => 'perplexity'];
    }
    throw new RuntimeException('LAYER_RESEARCH_REQUIRED');
}

function sbcc_synthesize_search(string $message, array $research, array $keys, string $agentProvider, array $safeContext, array $history): array {
    $agentKey = $keys[$agentProvider] ?? '';
    if ($agentKey === '') {
        return [
            'reply' => $research['content'],
            'mode' => $research['source'] === 'layer' ? 'layer' : 'perplexity',
            'citations' => $research['citations'] ?? [],
        ];
    }
    $system = sbcc_build_system_prompt(false, true, $research['source'] ?? 'layer');
    $ctx = substr(json_encode($safeContext, JSON_PRETTY_PRINT), 0, 8000);
    $msgs = [
        ['role' => 'system', 'content' => "$system\n\nContext:\n$ctx"],
    ];
    foreach (array_slice($history, -6) as $m) {
        $msgs[] = ['role' => $m['role'], 'content' => $m['content']];
    }
    $msgs[] = ['role' => 'user', 'content' => $message . "\n\n--- Research ---\n" . $research['content']];
    $resp = sbcc_openai_chat($agentKey, $keys['models'][$agentProvider], $msgs);
    $reply = $resp['choices'][0]['message']['content'] ?? $research['content'];
    return ['reply' => $reply, 'mode' => $agentProvider, 'citations' => $research['citations'] ?? []];
}

function sbcc_run_agent(array $input): array {
    $message = trim($input['message'] ?? '');
    $history = $input['history'] ?? [];
    $context = $input['context'] ?? [];
    $settings = $input['settings'] ?? [];
    $prefetched = $input['prefetchedResearch'] ?? null;

    $fullAccess = !empty($settings['fullAccess']);
    $keys = sbcc_resolve_keys($settings);
    $intent = sbcc_classify_intent($message);
    $safeContext = sbcc_redact_context($context, $fullAccess, $settings['sensitiveKeys'] ?? []);
    $agentProvider = in_array($settings['activeProvider'] ?? '', ['openai', 'anthropic'], true)
        ? $settings['activeProvider'] : 'openai';
    $agentKey = $keys[$agentProvider] ?? '';
    $layerFallback = ($settings['researchAssistant']['fallbackLayer'] ?? true) !== false;
    $hasResearch = !empty($keys['perplexity']) || $layerFallback || !empty($prefetched['content']);

    if ($intent === 'search') {
        if (!empty($prefetched['content'])) {
            $syn = sbcc_synthesize_search($message, $prefetched, $keys, $agentProvider, $safeContext, $history);
            return [
                'reply' => $syn['reply'],
                'mode' => $syn['mode'],
                'intent' => $intent,
                'actions' => [],
                'citations' => $syn['citations'],
                'researchSource' => $prefetched['source'] ?? 'layer',
            ];
        }
        if (!$hasResearch) {
            return ['reply' => 'Web research unavailable.', 'mode' => 'search_blocked', 'intent' => $intent, 'actions' => [], 'citations' => []];
        }
        try {
            $research = sbcc_run_web_research($message, $keys, $settings, $prefetched);
            $syn = sbcc_synthesize_search($message, $research, $keys, $agentProvider, $safeContext, $history);
            return [
                'reply' => $syn['reply'],
                'mode' => $syn['mode'],
                'intent' => $intent,
                'actions' => [],
                'citations' => $syn['citations'],
                'researchSource' => $research['source'],
            ];
        } catch (RuntimeException $e) {
            if ($e->getMessage() === 'LAYER_RESEARCH_REQUIRED') {
                return [
                    'reply' => '',
                    'needsLayerResearch' => true,
                    'query' => $message,
                    'mode' => 'layer-pending',
                    'intent' => $intent,
                    'actions' => [],
                    'citations' => [],
                ];
            }
            return ['reply' => 'Research failed: ' . $e->getMessage(), 'mode' => 'search_error', 'intent' => $intent, 'actions' => [], 'citations' => []];
        }
    }

    if ($agentKey === '') {
        return [
            'reply' => 'Add an OpenAI or Anthropic API key in AI Settings.',
            'mode' => 'no_provider',
            'intent' => $intent,
            'actions' => [],
            'citations' => [],
        ];
    }

    $system = sbcc_build_system_prompt($fullAccess, $hasResearch, !empty($keys['perplexity']) ? 'perplexity' : 'layer');
    $ctx = substr(json_encode($safeContext, JSON_PRETTY_PRINT), 0, 14000);
    $msgs = [
        ['role' => 'system', 'content' => "$system\n\nContext JSON:\n$ctx"],
    ];
    foreach (array_slice($history, -10) as $m) {
        $msgs[] = ['role' => $m['role'], 'content' => $m['content']];
    }
    $msgs[] = ['role' => 'user', 'content' => $message];

    $resp = sbcc_openai_chat($agentKey, $keys['models'][$agentProvider], $msgs, sbcc_agent_tools());
    $assistant = $resp['choices'][0]['message'] ?? [];
    $reply = $assistant['content'] ?? 'Done.';
    $actions = [];

    foreach ($assistant['tool_calls'] ?? [] as $tc) {
        $name = $tc['function']['name'] ?? '';
        $args = json_decode($tc['function']['arguments'] ?? '{}', true) ?: [];
        if ($name === 'web_research' || $name === 'perplexity_search') {
            try {
                $research = sbcc_run_web_research($args['query'] ?? '', $keys, $settings, $prefetched);
                $reply = $research['content'];
            } catch (RuntimeException $e) {
                if ($e->getMessage() === 'LAYER_RESEARCH_REQUIRED') {
                    return [
                        'reply' => '',
                        'needsLayerResearch' => true,
                        'query' => $args['query'] ?? $message,
                        'mode' => 'layer-pending',
                        'intent' => $intent,
                        'actions' => [],
                        'citations' => [],
                    ];
                }
            }
        } else {
            $action = sbcc_tool_call_to_action($name, $args);
            if ($action) $actions[] = $action;
        }
    }

    return [
        'reply' => $reply,
        'mode' => $agentProvider,
        'intent' => $intent,
        'actions' => sbcc_strip_sensitive_actions($actions, $fullAccess),
        'citations' => [],
    ];
}

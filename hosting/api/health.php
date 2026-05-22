<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    sbcc_cors();
    http_response_code(204);
    exit;
}

sbcc_json(200, [
    'ok' => true,
    'service' => 'sbcc-ai-api',
    'version' => '2.0.0',
    'integrated' => true,
    'agentProviders' => ['openai', 'anthropic'],
    'researchAssistant' => ['perplexity', 'background-layer'],
]);

<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/lib/agent.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    sbcc_cors();
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sbcc_json(405, ['error' => 'POST required']);
}

try {
    $body = sbcc_read_json_body();
    $message = trim($body['message'] ?? '');
    if ($message === '') {
        sbcc_json(400, ['error' => 'message required']);
    }
    $result = sbcc_run_agent([
        'message' => $message,
        'history' => is_array($body['history'] ?? null) ? $body['history'] : [],
        'context' => is_array($body['context'] ?? null) ? $body['context'] : [],
        'settings' => is_array($body['settings'] ?? null) ? $body['settings'] : [],
        'prefetchedResearch' => is_array($body['prefetchedResearch'] ?? null) ? $body['prefetchedResearch'] : null,
    ]);
    sbcc_json(200, $result);
} catch (Throwable $e) {
    sbcc_json(500, [
        'error' => $e->getMessage(),
        'reply' => 'Something went wrong: ' . $e->getMessage(),
        'actions' => [],
        'citations' => [],
    ]);
}

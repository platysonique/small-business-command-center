<?php
declare(strict_types=1);
require __DIR__ . '/../bootstrap.php';
require __DIR__ . '/../lib/research-proxy.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    sbcc_cors();
    http_response_code(204);
    exit;
}

try {
    $target = $_GET['url'] ?? '';
    if ($target === '') {
        sbcc_json(400, ['error' => 'url query param required']);
    }
    $page = sbcc_fetch_proxied_page($target);
    sbcc_cors();
    header('Content-Type: text/html; charset=utf-8');
    header('X-SBCC-Research-Layer: 1');
    http_response_code(200);
    echo $page['html'];
} catch (Throwable $e) {
    sbcc_cors();
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Research proxy error: ' . $e->getMessage();
}

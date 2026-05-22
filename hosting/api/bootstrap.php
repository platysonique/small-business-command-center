<?php
/** SBCC integrated API — shared bootstrap for free PHP web hosting */

declare(strict_types=1);

function sbcc_cors(): void {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

function sbcc_json(int $status, array $data): void {
    sbcc_cors();
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sbcc_read_json_body(): array {
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function sbcc_http_json(string $method, string $url, ?array $body = null, array $headers = [], int $timeout = 60): array {
    if (!function_exists('curl_init')) {
        throw new RuntimeException('PHP curl extension required');
    }
    $ch = curl_init($url);
    $hdrs = $headers;
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => $hdrs,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($resp === false) throw new RuntimeException('HTTP failed: ' . $err);
    return ['code' => $code, 'body' => $resp];
}

function sbcc_http_html(string $url, int $timeout = 25): array {
    if (!function_exists('curl_init')) {
        throw new RuntimeException('PHP curl extension required');
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_HTTPHEADER => [
            'User-Agent: Mozilla/5.0 (compatible; SBCC-ResearchLayer/1.0)',
            'Accept: text/html,application/xhtml+xml',
        ],
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $final = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL) ?: $url;
    curl_close($ch);
    if ($resp === false || $code >= 400) {
        throw new RuntimeException('FETCH_' . $code);
    }
    return ['html' => $resp, 'url' => $final];
}

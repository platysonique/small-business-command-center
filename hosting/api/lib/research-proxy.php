<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function sbcc_validate_research_url(string $raw): string {
    $parts = parse_url($raw);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) {
        throw new RuntimeException('INVALID_URL');
    }
    if (!in_array(strtolower($parts['scheme']), ['http', 'https'], true)) {
        throw new RuntimeException('PROTOCOL_BLOCKED');
    }
    $host = strtolower($parts['host']);
    $blocked = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
    if (in_array($host, $blocked, true)) throw new RuntimeException('HOST_BLOCKED');
    if (preg_match('/^10\./', $host) || preg_match('/^192\.168\./', $host) || preg_match('/^172\.(1[6-9]|2\d|3[01])\./', $host)) {
        throw new RuntimeException('HOST_BLOCKED');
    }
    return $raw;
}

function sbcc_escape_attr(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function sbcc_rewrite_proxy_url(string $href, string $baseUrl, string $proxyBase): string {
    if ($href === '' || str_starts_with($href, '#') || str_starts_with($href, 'javascript:') || str_starts_with($href, 'data:')) {
        return $href;
    }
    try {
        $abs = sbcc_resolve_url($href, $baseUrl);
        sbcc_validate_research_url($abs);
        return $proxyBase . '?url=' . rawurlencode($abs);
    } catch (Throwable) {
        return $href;
    }
}

function sbcc_resolve_url(string $href, string $base): string {
    if (preg_match('#^https?://#i', $href)) return $href;
    $bp = parse_url($base);
    $scheme = $bp['scheme'] ?? 'https';
    $host = $bp['host'] ?? '';
    if (str_starts_with($href, '//')) return $scheme . ':' . $href;
    if (str_starts_with($href, '/')) return $scheme . '://' . $host . $href;
    $path = $bp['path'] ?? '/';
    $dir = preg_replace('#/[^/]*$#', '/', $path);
    return $scheme . '://' . $host . $dir . ltrim($href, '/');
}

function sbcc_rewrite_html_for_proxy(string $html, string $pageUrl, string $proxyBase): string {
    $out = preg_replace('/<script[\s\S]*?<\/script>/i', '', $html) ?? $html;
    $out = preg_replace('/\son\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $out) ?? $out;
    $out = preg_replace('/<meta[^>]+http-equiv\s*=\s*["\']refresh["\'][^>]*>/i', '', $out) ?? $out;

    if (!preg_match('/<base[\s>]/i', $out)) {
        $out = preg_replace('/<head([^>]*)>/i', '<head$1><base href="' . sbcc_escape_attr($pageUrl) . '">', $out, 1) ?? $out;
    }

    $out = preg_replace_callback('/\shref\s*=\s*("([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', function ($m) use ($pageUrl, $proxyBase) {
        $href = $m[2] ?: ($m[3] ?: ($m[4] ?: ''));
        $rew = sbcc_rewrite_proxy_url($href, $pageUrl, $proxyBase);
        return ' href="' . sbcc_escape_attr($rew) . '"';
    }, $out) ?? $out;

    $banner = '<div id="sbcc-proxy-banner" style="position:fixed;top:0;left:0;right:0;z-index:999999;background:#01696f;color:#fff;font:11px sans-serif;padding:4px 8px;pointer-events:none">SBCC research layer (AI only)</div>';
    $out = preg_replace('/<body([^>]*)>/i', '<body$1>' . $banner, $out, 1) ?? $out;

    return $out;
}

function sbcc_proxy_base_from_request(): string {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $script = $_SERVER['SCRIPT_NAME'] ?? '/api/research/proxy.php';
    return $scheme . '://' . $host . $script;
}

function sbcc_fetch_proxied_page(string $targetUrl, ?string $proxyBase = null): array {
    $proxyBase = $proxyBase ?: sbcc_proxy_base_from_request();
    $url = sbcc_validate_research_url($targetUrl);
    $page = sbcc_http_html($url);
    return [
        'html' => sbcc_rewrite_html_for_proxy($page['html'], $page['url'], $proxyBase),
        'finalUrl' => $page['url'],
    ];
}

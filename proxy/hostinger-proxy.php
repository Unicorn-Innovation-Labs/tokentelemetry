<?php
/**
 * TokenTelemetry telemetry proxy — PHP (for Hostinger shared hosting).
 *
 * Same job as the Cloudflare Worker: hold the Aptabase App-Key server-side and
 * forward events, so the open-source app never ships a credential. Use this if
 * you only have Hostinger shared hosting (no Cloudflare). For a faster, global
 * option, prefer cloudflare-worker.js.
 *
 * The Aptabase key must NOT live in a web-readable file. Provide it via either:
 *   1. an environment variable APTABASE_KEY (Hostinger hPanel → Advanced → or
 *      .htaccess:  SetEnv APTABASE_KEY A-US-xxxxxxxx ), or
 *   2. a config file ABOVE the web root, e.g. /home/uXXXX/aptabase-key.php that
 *      does:  <?php return 'A-US-xxxxxxxx';   and is require()'d below.
 *
 * Deploy: upload as e.g.  public_html/e/index.php  so the endpoint is
 *   https://telemetry.<your-domain>/e   (point the subdomain at this folder).
 */

header('Content-Type: text/plain');

// Health check / accidental GET.
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(200);
    echo 'tokentelemetry telemetry proxy';
    exit;
}

// --- Resolve the key (env first, then an out-of-webroot config file) ---------
$key = getenv('APTABASE_KEY') ?: '';
if ($key === '') {
    $cfg = dirname(__DIR__, 3) . '/aptabase-key.php'; // adjust depth to taste
    if (is_readable($cfg)) {
        $key = (string) require $cfg;
    }
}
if ($key === '') { http_response_code(500); exit; }

// --- Region → host (or self-hosted base via APTABASE_HOST) -------------------
$region = explode('-', $key)[1] ?? '';
$hosts  = ['US' => 'https://us.aptabase.com', 'EU' => 'https://eu.aptabase.com'];
$host   = $hosts[$region] ?? (getenv('APTABASE_HOST') ?: '');
if ($host === '') { http_response_code(500); exit; }

// --- Read + size-guard the body ---------------------------------------------
$body = file_get_contents('php://input');
if ($body === false || $body === '' || strlen($body) > 8192) {
    http_response_code($body ? 413 : 400);
    exit;
}

// --- Forward to Aptabase (key stays here). Best-effort. ----------------------
$ch = curl_init($host . '/api/v0/event');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'App-Key: ' . $key],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 5,
]);
curl_exec($ch);
curl_close($ch);

// Always 204 — the app fire-and-forgets; never trigger a retry storm.
http_response_code(204);

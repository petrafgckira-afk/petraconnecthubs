<?php
// Buffer all output so PHP notices/warnings never corrupt the JSON response
ob_start();
error_reporting(0);

if (!function_exists('normalizeUrl')) {
    function normalizeUrl($url) {
        return rtrim(trim((string)$url), '/');
    }
}

$allowed = [
    'https://connecthubs.petrafgc.org',
    'http://localhost:5173',
    'http://localhost:3000',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

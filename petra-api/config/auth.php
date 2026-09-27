<?php
define('JWT_SECRET', 'petra_connect_hubs_secret_2026');

function generateToken($userId, $role) {
    $payload = base64_encode(json_encode([
        'user_id' => $userId,
        'role'    => $role,
        'exp'     => time() + (7 * 24 * 60 * 60) // 7 days
    ]));
    $signature = hash_hmac('sha256', $payload, JWT_SECRET);
    return $payload . '.' . $signature;
}

function verifyToken($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 2) return null;

    [$payload, $signature] = $parts;
    $expectedSig = hash_hmac('sha256', $payload, JWT_SECRET);

    if (!hash_equals($expectedSig, $signature)) return null;

    $data = json_decode(base64_decode($payload), true);
    if (!$data || $data['exp'] < time()) return null;

    return $data;
}

function requireAuth() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit();
    }

    $token = substr($authHeader, 7);
    $data  = verifyToken($token);

    if (!$data) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired token']);
        exit();
    }

    return $data;
}

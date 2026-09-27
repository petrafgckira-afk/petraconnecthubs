<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

requireAuth();

$data       = json_decode(file_get_contents('php://input'), true);
$resourceId = $data['resource_id'] ?? null;

if (!$resourceId) {
    http_response_code(400);
    echo json_encode(['error' => 'resource_id required']);
    exit();
}

$db   = getDB();
$stmt = $db->prepare("UPDATE resources SET download_count = download_count + 1 WHERE id = ?");
$stmt->bind_param('s', $resourceId);
$stmt->execute();
$stmt->close();
$db->close();

echo json_encode(['success' => true]);

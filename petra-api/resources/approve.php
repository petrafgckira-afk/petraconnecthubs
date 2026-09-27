<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$auth = requireAuth();

if (!in_array($auth['role'], ['hub_leader', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$data       = json_decode(file_get_contents('php://input'), true);
$resourceId = $data['resource_id'] ?? null;
$action     = $data['action']      ?? null;

if (!$resourceId || !in_array($action, ['approved', 'rejected'])) {
    http_response_code(400);
    echo json_encode(['error' => 'resource_id and valid action (approved|rejected) required']);
    exit();
}

$db = getDB();
$stmt = $db->prepare("UPDATE resources SET status = ? WHERE id = ?");
$stmt->bind_param('ss', $action, $resourceId);
$stmt->execute();
$affected = $stmt->affected_rows;
$stmt->close();
$db->close();

if ($affected === 0) {
    http_response_code(404);
    echo json_encode(['error' => 'Resource not found']);
    exit();
}

echo json_encode(['success' => true, 'action' => $action]);

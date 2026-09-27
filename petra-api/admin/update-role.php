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
if ($auth['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Admins only']);
    exit();
}

$data    = json_decode(file_get_contents('php://input'), true);
$userId  = $data['user_id'] ?? null;
$newRole = $data['role'] ?? null;

if (!$userId || !$newRole) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id and role are required']);
    exit();
}

$allowed = ['member', 'hub_leader', 'admin'];
if (!in_array($newRole, $allowed)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid role']);
    exit();
}

$db   = getDB();
$stmt = $db->prepare("UPDATE users SET role = ? WHERE id = ?");
$stmt->bind_param('ss', $newRole, $userId);
$stmt->execute();
$affected = $stmt->affected_rows;
$stmt->close();
$db->close();

if ($affected === 0) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit();
}

echo json_encode(['message' => 'Role updated successfully', 'user_id' => $userId, 'role' => $newRole]);

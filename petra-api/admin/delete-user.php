<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/notify.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$auth      = requireAuth();
$adminId   = $auth['user_id'];
if ($auth['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Admins only']);
    exit();
}

$data   = json_decode(file_get_contents('php://input'), true);
$userId = $data['user_id'] ?? null;

if (!$userId) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id is required']);
    exit();
}

if ($userId === $adminId) {
    http_response_code(400);
    echo json_encode(['error' => 'You cannot delete your own account']);
    exit();
}

$db = getDB();

// Prevent deleting another admin
$stmt = $db->prepare("SELECT role, full_name FROM users WHERE id = ? LIMIT 1");
$stmt->bind_param('s', $userId);
$stmt->execute();
$target = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$target) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    $db->close();
    exit();
}

if ($target['role'] === 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Cannot delete another admin account']);
    $db->close();
    exit();
}

// Cascade-delete related rows (connections, messages, hub_members, notifications)
$db->begin_transaction();
try {
    foreach ([
        "DELETE FROM notifications     WHERE user_id = ?",
        "DELETE FROM connection_requests WHERE sender_id = ? OR receiver_id = ?",
        "DELETE FROM messages           WHERE sender_id = ? OR receiver_id = ?",
        "DELETE FROM hub_members        WHERE user_id = ?",
        "DELETE FROM announcements      WHERE created_by = ?",
        "DELETE FROM users              WHERE id = ?",
    ] as $sql) {
        $paramCount = substr_count($sql, '?');
        $params     = array_fill(0, $paramCount, $userId);
        $types      = str_repeat('s', $paramCount);
        $stmt       = $db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $stmt->close();
    }
    $db->commit();
} catch (Exception $e) {
    $db->rollback();
    http_response_code(500);
    echo json_encode(['error' => 'Deletion failed: ' . $e->getMessage()]);
    $db->close();
    exit();
}

$db->close();

echo json_encode([
    'message'    => 'User deleted successfully',
    'deleted_id' => $userId,
    'name'       => $target['full_name'],
]);

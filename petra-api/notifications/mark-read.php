<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$auth           = requireAuth();
$userId         = $auth['user_id'];
$data           = json_decode(file_get_contents('php://input'), true);
$notificationId = $data['notification_id'] ?? null;

if (!$notificationId) {
    http_response_code(400);
    echo json_encode(['error' => 'notification_id is required']);
    exit();
}

$db   = getDB();
$stmt = $db->prepare("
    UPDATE notifications SET is_read = 1
    WHERE id = ? AND user_id = ?
");
$stmt->bind_param('ss', $notificationId, $userId);
$stmt->execute();
$stmt->close();
$db->close();

echo json_encode(['message' => 'Notification marked as read']);

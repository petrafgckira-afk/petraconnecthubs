<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$auth   = requireAuth();
$userId = $auth['user_id'];

$db   = getDB();
$stmt = $db->prepare("
    UPDATE notifications SET is_read = 1
    WHERE user_id = ? AND is_read = 0
");
$stmt->bind_param('s', $userId);
$stmt->execute();
$stmt->close();
$db->close();

echo json_encode(['message' => 'All notifications marked as read']);

<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$auth        = requireAuth();
$userId      = $auth['user_id'];
$data        = json_decode(file_get_contents('php://input'), true);
$otherUserId = trim($data['other_user_id'] ?? '');

if (!$otherUserId) {
    http_response_code(400);
    echo json_encode(['error' => 'other_user_id is required']);
    exit();
}

if ($otherUserId === $userId) {
    http_response_code(400);
    echo json_encode(['error' => 'Cannot remove a connection with yourself']);
    exit();
}

$db = getDB();

// Delete the connection row in either direction.
// The WHERE already ensures the authenticated user is a participant, so no extra auth check is needed.
$stmt = $db->prepare("
    DELETE FROM connection_requests
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
");
$stmt->bind_param('ssss', $userId, $otherUserId, $otherUserId, $userId);

if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(['error' => 'Delete failed: ' . $stmt->error]);
    $stmt->close();
    $db->close();
    exit();
}

$affected = $stmt->affected_rows;
$stmt->close();
$db->close();

if ($affected === 0) {
    http_response_code(404);
    echo json_encode(['error' => 'No connection found to remove']);
    exit();
}

echo json_encode(['message' => 'Connection removed', 'other_user_id' => $otherUserId]);

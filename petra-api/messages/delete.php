<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$auth      = requireAuth();
$userId    = $auth['user_id'];
$data      = json_decode(file_get_contents('php://input'), true);
$messageId = trim($data['message_id'] ?? '');

if (!$messageId) {
    http_response_code(400);
    echo json_encode(['error' => 'message_id is required']);
    exit();
}

$db = getDB();

// Verify the message exists and belongs to the requesting user (only senders can retract)
$stmt = $db->prepare("SELECT id, sender_id FROM messages WHERE id = ? LIMIT 1");
$stmt->bind_param('s', $messageId);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Message not found']);
    $db->close();
    exit();
}

if ($row['sender_id'] !== $userId) {
    http_response_code(403);
    echo json_encode(['error' => 'Only the sender can retract a message']);
    $db->close();
    exit();
}

// Soft-delete: mark as deleted so both parties stop seeing it
$stmt = $db->prepare("UPDATE messages SET is_deleted = 1 WHERE id = ?");
$stmt->bind_param('s', $messageId);

if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to retract message: ' . $stmt->error]);
    $stmt->close();
    $db->close();
    exit();
}

if ($stmt->affected_rows === 0) {
    http_response_code(404);
    echo json_encode(['error' => 'Message not found or already retracted']);
    $stmt->close();
    $db->close();
    exit();
}

$stmt->close();
$db->close();

echo json_encode(['message' => 'Message retracted', 'id' => $messageId]);

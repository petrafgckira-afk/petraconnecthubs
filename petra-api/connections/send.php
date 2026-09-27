<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$auth       = requireAuth();
$userId     = $auth['user_id'];
$data       = json_decode(file_get_contents('php://input'), true);
$receiverId = $data['receiver_id'] ?? null;

if (!$receiverId) {
    http_response_code(400);
    echo json_encode(['error' => 'receiver_id is required']);
    exit();
}

if ($receiverId === $userId) {
    http_response_code(400);
    echo json_encode(['error' => 'Cannot connect with yourself']);
    exit();
}

$db = getDB();

// Check if a connection already exists (in either direction)
$stmt = $db->prepare("
    SELECT id, status FROM connection_requests
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    LIMIT 1
");
$stmt->bind_param('ssss', $userId, $receiverId, $receiverId, $userId);
$stmt->execute();
$existing = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($existing) {
    $db->close();
    echo json_encode(['status' => $existing['status'], 'message' => 'Connection already exists']);
    exit();
}

// Insert new connection
$stmt = $db->prepare("
    INSERT INTO connection_requests (sender_id, receiver_id, status)
    VALUES (?, ?, 'pending')
");
$stmt->bind_param('ss', $userId, $receiverId);
$stmt->execute();
$stmt->close();

// Look up sender name for the notification
$stmtName  = $db->prepare("SELECT full_name FROM users WHERE id = ? LIMIT 1");
$stmtName->bind_param('s', $userId);
$stmtName->execute();
$nameRow   = $stmtName->get_result()->fetch_assoc();
$stmtName->close();
$senderName = $nameRow['full_name'] ?? 'A member';

// Notify the receiver
$notifTitle  = $senderName . ' sent you a connection request';
$notifMsg    = 'You have a new fellowship connection invitation from ' . $senderName . '.';
$notifType   = 'connection';
$stmt = $db->prepare("
    INSERT INTO notifications (user_id, title, message, notification_type)
    VALUES (?, ?, ?, ?)
");
$stmt->bind_param('ssss', $receiverId, $notifTitle, $notifMsg, $notifType);
$stmt->execute();
$stmt->close();
$db->close();

echo json_encode(['status' => 'pending_sent', 'message' => 'Connection request sent']);

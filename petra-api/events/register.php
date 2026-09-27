<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$auth    = requireAuth();
$userId  = $auth['user_id'];
$data    = json_decode(file_get_contents('php://input'), true);
$eventId = $data['event_id'] ?? null;

if (!$eventId) {
    http_response_code(400);
    echo json_encode(['error' => 'event_id is required']);
    exit();
}

$db = getDB();

// Check if already registered
$stmt = $db->prepare("SELECT id FROM event_registrations WHERE event_id = ? AND user_id = ?");
$stmt->bind_param('ss', $eventId, $userId);
$stmt->execute();
$existing = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($existing) {
    // Unregister
    $stmt = $db->prepare("DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?");
    $stmt->bind_param('ss', $eventId, $userId);
    $stmt->execute();
    $stmt->close();
    $registered = false;
} else {
    // Register
    $stmt = $db->prepare("INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)");
    $stmt->bind_param('ss', $eventId, $userId);
    $stmt->execute();
    $stmt->close();
    $registered = true;
}

// Return updated attendee count
$stmt = $db->prepare("SELECT COUNT(*) AS cnt FROM event_registrations WHERE event_id = ?");
$stmt->bind_param('s', $eventId);
$stmt->execute();
$count = (int) $stmt->get_result()->fetch_assoc()['cnt'];
$stmt->close();
$db->close();

echo json_encode(['registered' => $registered, 'attendees_count' => $count]);

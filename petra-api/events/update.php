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
$role   = $auth['role'];

$data     = json_decode(file_get_contents('php://input'), true);
$id       = trim($data['id']          ?? '');
$title    = trim($data['title']       ?? '');
$desc     = trim($data['description'] ?? '');
$date     = trim($data['date']        ?? '');
$time     = trim($data['time']        ?? '00:00');
$location = trim($data['location']    ?? '');

if (!$id || !$title || !$date) {
    http_response_code(400);
    echo json_encode(['error' => 'id, title and date are required']);
    exit();
}

$db = getDB();

$stmt = $db->prepare("SELECT organizer_id FROM events WHERE id = ? LIMIT 1");
$stmt->bind_param('s', $id);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Event not found']);
    $db->close();
    exit();
}

if ($row['organizer_id'] !== $userId && $role !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Not authorised to edit this event']);
    $db->close();
    exit();
}

$eventDatetime = $date . ' ' . $time . ':00';

$stmt = $db->prepare("
    UPDATE events SET title = ?, description = ?, event_date = ?, location = ? WHERE id = ?
");
$stmt->bind_param('sssss', $title, $desc, $eventDatetime, $location, $id);
if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(['error' => 'Update failed: ' . $stmt->error]);
    $stmt->close();
    $db->close();
    exit();
}
if ($stmt->affected_rows === 0) {
    http_response_code(404);
    echo json_encode(['error' => 'Event no longer exists']);
    $stmt->close();
    $db->close();
    exit();
}
$stmt->close();
$db->close();

$dt = new DateTime($eventDatetime);
echo json_encode([
    'message'  => 'Event updated',
    'id'       => $id,
    'title'    => $title,
    'description' => $desc,
    'date'     => $dt->format('Y-m-d'),
    'time'     => $dt->format('g:i A'),
    'timeRaw'  => $dt->format('H:i'),
    'location' => $location,
]);

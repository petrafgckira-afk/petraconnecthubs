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

$auth   = requireAuth();
$userId = $auth['user_id'];
$role   = $auth['role'];

if (!in_array($role, ['hub_leader', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Only hub leaders and admins can create events']);
    exit();
}

$data     = json_decode(file_get_contents('php://input'), true);
$title    = trim($data['title']       ?? '');
$desc     = trim($data['description'] ?? '');
$date     = trim($data['date']        ?? '');
$time     = trim($data['time']        ?? '00:00');
$location = trim($data['location']    ?? 'Petra Full Gospel Church');

if (!$title || !$date) {
    http_response_code(400);
    echo json_encode(['error' => 'title and date are required']);
    exit();
}

$eventDatetime = $date . ' ' . $time . ':00';

// Generate UUID so we can fetch the exact row after insert
$bytes    = random_bytes(16);
$bytes[6] = chr(ord($bytes[6]) & 0x0f | 0x40);
$bytes[8] = chr(ord($bytes[8]) & 0x3f | 0x80);
$newId    = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));

$db   = getDB();
$stmt = $db->prepare("
    INSERT INTO events (id, title, description, event_date, location, organizer_id)
    VALUES (?, ?, ?, ?, ?, ?)
");
$stmt->bind_param('ssssss', $newId, $title, $desc, $eventDatetime, $location, $userId);
if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to create event: ' . $stmt->error]);
    $stmt->close();
    $db->close();
    exit();
}
$stmt->close();

$stmt = $db->prepare("
    SELECT id, title, description, event_date, location, organizer_id
    FROM events WHERE id = ?
");
$stmt->bind_param('s', $newId);
$stmt->execute();
$r = $stmt->get_result()->fetch_assoc();
$stmt->close();

// Notify all users about the new event
$stmtName = $db->prepare("SELECT full_name FROM users WHERE id = ? LIMIT 1");
$stmtName->bind_param('s', $userId);
$stmtName->execute();
$organizerName = $stmtName->get_result()->fetch_assoc()['full_name'] ?? 'A leader';
$stmtName->close();

$stmtAll = $db->prepare("SELECT id FROM users WHERE id != ?");
$stmtAll->bind_param('s', $userId);
$stmtAll->execute();
$allUsers = $stmtAll->get_result()->fetch_all(MYSQLI_ASSOC);
$stmtAll->close();
foreach ($allUsers as $u) {
    createNotification($db, $u['id'],
        'New event: ' . $title,
        $organizerName . ' scheduled "' . $title . '" on ' . $date . ' at ' . $location . '.',
        'event',
        ['eventId' => $newId]
    );
}

$db->close();

if (!$r) {
    http_response_code(500);
    echo json_encode(['error' => 'Event saved but could not be retrieved']);
    exit();
}

$dt = new DateTime($r['event_date']);

http_response_code(201);
echo json_encode([
    'event' => [
        'id'             => $r['id'],
        'hubId'          => 'All',
        'title'          => $r['title'],
        'description'    => $r['description'] ?? '',
        'date'           => $dt->format('Y-m-d'),
        'time'           => $dt->format('g:i A'),
        'location'       => $r['location'],
        'attendeesCount' => 0,
        'isRegistered'   => false,
        'isOwner'        => true,
    ]
]);

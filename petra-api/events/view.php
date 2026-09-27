<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'OPTIONS'])) {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$auth   = requireAuth();
$userId = $auth['user_id'];

$id = trim($_GET['id'] ?? '');
if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'id is required']);
    exit();
}

$db = getDB();

// Fetch event details
$stmt = $db->prepare("
    SELECT e.id, e.title, e.description, e.event_date, e.location, e.organizer_id,
           u.full_name AS organizer_name
    FROM events e
    LEFT JOIN users u ON u.id = e.organizer_id
    WHERE e.id = ?
    LIMIT 1
");
$stmt->bind_param('s', $id);
$stmt->execute();
$event = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$event) {
    http_response_code(404);
    echo json_encode(['error' => 'Event not found']);
    $db->close();
    exit();
}

// Fetch attendee list
$stmt = $db->prepare("
    SELECT u.id, u.full_name, u.profession, u.profile_image
    FROM event_registrations er
    JOIN users u ON u.id = er.user_id
    WHERE er.event_id = ?
    ORDER BY er.registered_at ASC
");
$stmt->bind_param('s', $id);
$stmt->execute();
$attendeeRows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();
$db->close();

$dt = new DateTime($event['event_date']);

echo json_encode([
    'event' => [
        'id'             => $event['id'],
        'title'          => $event['title'],
        'description'    => $event['description'] ?? '',
        'date'           => $dt->format('Y-m-d'),
        'time'           => $dt->format('g:i A'),
        'location'       => $event['location'] ?? '',
        'organizerName'  => $event['organizer_name'] ?? 'Unknown',
        'isOwner'        => $event['organizer_id'] === $userId,
    ],
    'attendees' => array_map(function($a) {
        $parts    = explode(' ', $a['full_name']);
        $initials = strtoupper(implode('', array_map(fn($p) => $p[0] ?? '', $parts)));
        return [
            'id'           => $a['id'],
            'name'         => $a['full_name'],
            'profession'   => $a['profession'],
            'profileImage' => $a['profile_image'],
            'initials'     => substr($initials, 0, 2) ?: '?',
        ];
    }, $attendeeRows),
]);

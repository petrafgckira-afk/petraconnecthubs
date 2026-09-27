<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

$auth   = requireAuth();
$userId = $auth['user_id'];

$db = getDB();

$stmt = $db->prepare("
    SELECT
        e.id,
        e.title,
        e.description,
        e.event_date,
        e.location,
        e.meeting_link,
        e.organizer_id,
        COUNT(er.id)                                     AS attendees_count,
        MAX(CASE WHEN er.user_id = ? THEN 1 ELSE 0 END) AS is_registered
    FROM events e
    LEFT JOIN event_registrations er ON er.event_id = e.id
    WHERE e.event_date >= NOW()
    GROUP BY e.id, e.title, e.description, e.event_date, e.location, e.meeting_link, e.organizer_id
    ORDER BY e.event_date ASC
    LIMIT 20
");
$stmt->bind_param('s', $userId);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();
$db->close();

$events = array_map(function($r) use ($userId) {
    $dt   = new DateTime($r['event_date']);
    return [
        'id'             => $r['id'],
        'hubId'          => 'All',
        'title'          => $r['title'],
        'description'    => $r['description'] ?? '',
        'date'           => $dt->format('Y-m-d'),
        'time'           => $dt->format('g:i A'),
        'timeRaw'        => $dt->format('H:i'),
        'location'       => $r['location'] ?? 'Petra Full Gospel Church',
        'attendeesCount' => (int) $r['attendees_count'],
        'isRegistered'   => (bool) $r['is_registered'],
        'isOwner'        => !empty($r['organizer_id']) && $r['organizer_id'] === $userId,
    ];
}, $rows);

echo json_encode(['events' => $events]);

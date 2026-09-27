<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

$auth   = requireAuth();
$userId = $auth['user_id'];

$db   = getDB();
$stmt = $db->prepare("
    SELECT
        id,
        notification_type AS type,
        title,
        message           AS description,
        is_read,
        meta,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS time
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
");
$stmt->bind_param('s', $userId);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();
$db->close();

// Cast types and parse meta
foreach ($rows as &$row) {
    $row['read'] = (bool) $row['is_read'];
    unset($row['is_read']);
    $row['meta'] = $row['meta'] ? json_decode($row['meta'], true) : null;
}

echo json_encode(['notifications' => $rows]);

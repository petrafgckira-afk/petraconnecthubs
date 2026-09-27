<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

$auth   = requireAuth();
$userId = $auth['user_id'];

$db   = getDB();
$stmt = $db->prepare("
    SELECT
        cr.id,
        cr.sender_id,
        cr.receiver_id,
        cr.status
    FROM connection_requests cr
    WHERE cr.sender_id = ? OR cr.receiver_id = ?
");
$stmt->bind_param('ss', $userId, $userId);
$stmt->execute();
$rows   = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();
$db->close();

// Build a flat dictionary: other_user_id → 'pending_sent' | 'pending_received' | 'connected'
$result = [];
foreach ($rows as $row) {
    $isSender   = $row['sender_id'] === $userId;
    $otherId    = $isSender ? $row['receiver_id'] : $row['sender_id'];
    $status     = $row['status'];

    if ($status === 'accepted') {
        $result[$otherId] = 'connected';
    } elseif ($status === 'pending') {
        $result[$otherId] = $isSender ? 'pending_sent' : 'pending_received';
    }
}

echo json_encode(['connections' => $result]);

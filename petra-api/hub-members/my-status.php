<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

$auth = requireAuth();
$userId = $auth['user_id'];

$db   = getDB();
$stmt = $db->prepare("
    SELECT hm.id, hm.status, hm.joined_at, hm.contribution_interest,
           h.id AS hub_id, h.name AS hub_name
    FROM hub_members hm
    JOIN hubs h ON h.id = hm.hub_id
    WHERE hm.user_id = ?
    LIMIT 1
");
$stmt->bind_param('s', $userId);
$stmt->execute();
$result     = $stmt->get_result();
$membership = $result->fetch_assoc();
$stmt->close();
$db->close();

echo json_encode(['membership' => $membership]);

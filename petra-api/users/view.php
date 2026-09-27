<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

requireAuth();

$targetId = $_GET['id'] ?? null;
if (!$targetId) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing id parameter']);
    exit();
}

$db   = getDB();
$stmt = $db->prepare("
    SELECT u.id, u.full_name, u.profession, u.bio, u.location, u.profile_image,
           u.role, u.created_at,
           hm.status AS hub_status,
           h.name    AS hub_name
    FROM users u
    LEFT JOIN hub_members hm ON hm.user_id = u.id AND hm.status = 'approved'
    LEFT JOIN hubs h         ON h.id = hm.hub_id
    WHERE u.id = ?
    LIMIT 1
");
$stmt->bind_param('s', $targetId);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();
$db->close();

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit();
}

echo json_encode(['user' => $user]);

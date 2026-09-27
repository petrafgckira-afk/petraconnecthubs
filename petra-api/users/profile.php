<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

$auth   = requireAuth();
$userId = $auth['user_id'];

$db   = getDB();
$stmt = $db->prepare("
    SELECT u.id, u.full_name, u.email, u.phone_number, u.profile_image,
           u.gender, u.location, u.profession, u.bio, u.role,
           u.years_of_experience, u.created_at,
           hm.status   AS hub_status,
           h.id        AS hub_id,
           h.name      AS hub_name
    FROM users u
    LEFT JOIN hub_members hm ON hm.user_id = u.id
    LEFT JOIN hubs h         ON h.id = hm.hub_id
    WHERE u.id = ?
    LIMIT 1
");
$stmt->bind_param('s', $userId);
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

<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

$auth = requireAuth();
if ($auth['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Admins only']);
    exit();
}

$db   = getDB();
$stmt = $db->prepare("
    SELECT
        u.id,
        u.full_name,
        u.email,
        u.profession,
        u.role,
        u.account_status,
        u.profile_image,
        u.created_at,
        hm.id          AS membership_id,
        hm.status      AS hub_status,
        h.name         AS hub_name,
        REPLACE(h.name, ' Hub', '') AS hub_type
    FROM users u
    LEFT JOIN hub_members hm ON hm.user_id = u.id
        AND hm.id = (
            SELECT id FROM hub_members
            WHERE user_id = u.id
            ORDER BY FIELD(status, 'approved', 'pending', 'rejected'), joined_at DESC
            LIMIT 1
        )
    LEFT JOIN hubs h ON h.id = hm.hub_id
    ORDER BY u.created_at ASC
");
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();
$db->close();

echo json_encode(['users' => $rows]);

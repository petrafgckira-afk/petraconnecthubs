<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

$auth   = requireAuth();
$userId = $auth['user_id'];
$role   = $auth['role'];

if (!in_array($role, ['hub_leader', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Access denied']);
    exit();
}

$db = getDB();

// Get leader's hub_id (admin sees all pending)
$hubId = null;
if ($role === 'hub_leader') {
    $stmt = $db->prepare("
        SELECT hub_id FROM hub_members WHERE user_id = ? AND status = 'approved' LIMIT 1
    ");
    $stmt->bind_param('s', $userId);
    $stmt->execute();
    $row   = $stmt->get_result()->fetch_assoc();
    $hubId = $row['hub_id'] ?? null;
    $stmt->close();

    if (!$hubId) {
        echo json_encode(['pending' => []]);
        $db->close();
        exit();
    }
}

if ($hubId) {
    $stmt = $db->prepare("
        SELECT
            hm.id AS membership_id,
            hm.user_id,
            hm.hub_id,
            hm.contribution_interest,
            hm.joined_at,
            u.full_name,
            u.email,
            u.profession,
            u.bio,
            u.profile_image,
            h.name AS hub_name
        FROM hub_members hm
        JOIN users u ON u.id = hm.user_id
        JOIN hubs h  ON h.id = hm.hub_id
        WHERE hm.hub_id = ? AND hm.status = 'pending'
        ORDER BY hm.joined_at ASC
    ");
    $stmt->bind_param('s', $hubId);
} else {
    // Admin: all pending across all hubs
    $stmt = $db->prepare("
        SELECT
            hm.id AS membership_id,
            hm.user_id,
            hm.hub_id,
            hm.contribution_interest,
            hm.joined_at,
            u.full_name,
            u.email,
            u.profession,
            u.bio,
            u.profile_image,
            h.name AS hub_name
        FROM hub_members hm
        JOIN users u ON u.id = hm.user_id
        JOIN hubs h  ON h.id = hm.hub_id
        WHERE hm.status = 'pending'
        ORDER BY hm.joined_at ASC
    ");
}

$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();
$db->close();

echo json_encode(['pending' => $rows]);

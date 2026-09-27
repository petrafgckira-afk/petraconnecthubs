<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

requireAuth();
$auth = requireAuth();

if (!in_array($auth['role'], ['hub_leader', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$db     = getDB();
$role   = $auth['role'];
$userId = $db->real_escape_string($auth['user_id']);

if ($role === 'admin') {
    $result = $db->query("
        SELECT r.id, r.hub_id, h.name AS hub_name, r.title, r.description,
               r.file_type, r.file_size, r.file_url AS download_url, r.uploaded_by_name,
               r.uploaded_by_id, r.created_at
        FROM resources r
        JOIN hubs h ON h.id = r.hub_id
        WHERE r.status = 'pending'
        ORDER BY r.created_at ASC
    ");
} else {
    // Resolve hub_leader's hub from hub_members
    $hubResult = $db->query("
        SELECT h.id, h.name
        FROM hub_members hm
        JOIN hubs h ON h.id = hm.hub_id
        WHERE hm.user_id = '$userId' AND hm.status = 'approved'
        LIMIT 1
    ");
    $hubRow = $hubResult->fetch_assoc();

    if (!$hubRow) {
        echo json_encode(['pending' => []]);
        $db->close();
        exit();
    }

    $hubId = $db->real_escape_string($hubRow['id']);
    $result = $db->query("
        SELECT r.id, r.hub_id, h.name AS hub_name, r.title, r.description,
               r.file_type, r.file_size, r.file_url AS download_url, r.uploaded_by_name,
               r.uploaded_by_id, r.created_at
        FROM resources r
        JOIN hubs h ON h.id = r.hub_id
        WHERE r.hub_id = '$hubId' AND r.status = 'pending'
        ORDER BY r.created_at ASC
    ");
}

$pending = [];
while ($row = $result->fetch_assoc()) {
    $pending[] = $row;
}
$db->close();
echo json_encode(['pending' => $pending]);

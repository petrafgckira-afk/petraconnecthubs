<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/notify.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$auth   = requireAuth();
$userId = $auth['user_id'];
$role   = $auth['role'];

if (!in_array($role, ['hub_leader', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Access denied']);
    exit();
}

$data           = json_decode(file_get_contents('php://input'), true);
$membershipId   = $data['membership_id'] ?? null;

if (!$membershipId) {
    http_response_code(400);
    echo json_encode(['error' => 'membership_id is required']);
    exit();
}

$db = getDB();

// Fetch membership details before updating so we can notify the member
$stmtMeta = $db->prepare("
    SELECT hm.user_id, h.id AS hub_id, h.name AS hub_name
    FROM hub_members hm
    JOIN hubs h ON h.id = hm.hub_id
    WHERE hm.id = ? LIMIT 1
");
$stmtMeta->bind_param('s', $membershipId);
$stmtMeta->execute();
$meta = $stmtMeta->get_result()->fetch_assoc();
$stmtMeta->close();

$stmt = $db->prepare("UPDATE hub_members SET status = 'approved' WHERE id = ?");
$stmt->bind_param('s', $membershipId);
$stmt->execute();
$affected = $stmt->affected_rows;
$stmt->close();

if ($affected === 0) {
    $db->close();
    http_response_code(404);
    echo json_encode(['error' => 'Membership record not found']);
    exit();
}

// Notify the approved member
if ($meta) {
    createNotification($db, $meta['user_id'],
        'Hub membership approved',
        'Your request to join ' . $meta['hub_name'] . ' has been approved. Welcome!',
        'approval',
        ['hubId' => $meta['hub_id']]
    );
}

$db->close();

echo json_encode(['message' => 'Member approved successfully']);

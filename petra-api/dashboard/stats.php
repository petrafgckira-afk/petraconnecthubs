<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

$auth   = requireAuth();
$userId = $auth['user_id'];
$role   = $auth['role'];

$db = getDB();

// Get user's hub membership
$stmt = $db->prepare("
    SELECT hm.status, h.id AS hub_id, h.name AS hub_name
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

$hubId   = $membership['hub_id']   ?? null;
$hubName = $membership['hub_name'] ?? null;
$membershipStatus = $membership['status'] ?? 'none';

// Count approved members in user's hub
$hubMemberCount = 0;
if ($hubId) {
    $stmt = $db->prepare("SELECT COUNT(*) AS cnt FROM hub_members WHERE hub_id = ? AND status = 'approved'");
    $stmt->bind_param('s', $hubId);
    $stmt->execute();
    $hubMemberCount = (int) $stmt->get_result()->fetch_assoc()['cnt'];
    $stmt->close();
}

// Count accepted connections
$stmt = $db->prepare("
    SELECT COUNT(*) AS cnt FROM connection_requests
    WHERE (sender_id = ? OR receiver_id = ?) AND status = 'accepted'
");
$stmt->bind_param('ss', $userId, $userId);
$stmt->execute();
$connectionsCount = (int) $stmt->get_result()->fetch_assoc()['cnt'];
$stmt->close();

// Pending approvals (for leaders/admins — members in their hub waiting approval)
$pendingCount = 0;
if (($role === 'hub_leader' || $role === 'admin') && $hubId) {
    $stmt = $db->prepare("SELECT COUNT(*) AS cnt FROM hub_members WHERE hub_id = ? AND status = 'pending'");
    $stmt->bind_param('s', $hubId);
    $stmt->execute();
    $pendingCount = (int) $stmt->get_result()->fetch_assoc()['cnt'];
    $stmt->close();
}

$db->close();

echo json_encode([
    'hub_name'          => $hubName,
    'hub_member_count'  => $hubMemberCount,
    'connections_count' => $connectionsCount,
    'membership_status' => $membershipStatus,
    'pending_approvals' => $pendingCount,
]);

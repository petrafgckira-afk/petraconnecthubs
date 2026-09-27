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

$auth = requireAuth();
if ($auth['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Admins only']);
    exit();
}

$data    = json_decode(file_get_contents('php://input'), true);
$userId  = $data['user_id'] ?? null;
$newRole = $data['role']    ?? null; // optional role to set at approval time

if (!$userId) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id is required']);
    exit();
}

$db = getDB();

// Fetch the user first
$stmt = $db->prepare("SELECT full_name, account_status FROM users WHERE id = ? LIMIT 1");
$stmt->bind_param('s', $userId);
$stmt->execute();
$target = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$target) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    $db->close();
    exit();
}

// Build update — always set account_status='active'; optionally update role too
if ($newRole && in_array($newRole, ['member', 'hub_leader', 'admin'])) {
    $stmt = $db->prepare("UPDATE users SET account_status = 'active', role = ? WHERE id = ?");
    $stmt->bind_param('ss', $newRole, $userId);
} else {
    $stmt = $db->prepare("UPDATE users SET account_status = 'active' WHERE id = ?");
    $stmt->bind_param('s', $userId);
}
$stmt->execute();
$stmt->close();

// Auto-approve the user's pending hub membership (the one they selected during registration)
$stmt = $db->prepare("
    UPDATE hub_members
    SET    status = 'approved', joined_at = NOW()
    WHERE  user_id = ?
      AND  status  = 'pending'
");
$stmt->bind_param('s', $userId);
$stmt->execute();
$hubRowsUpdated = $stmt->affected_rows;
$stmt->close();

// Find the hub name they were approved into (for the notification message)
$hubLabel = '';
if ($hubRowsUpdated > 0) {
    $stmt = $db->prepare("
        SELECT h.name
        FROM   hub_members hm
        JOIN   hubs h ON h.id = hm.hub_id
        WHERE  hm.user_id = ? AND hm.status = 'approved'
        ORDER  BY hm.joined_at DESC
        LIMIT  1
    ");
    $stmt->bind_param('s', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($row) $hubLabel = ' and added to the ' . $row['name'];
}

// Notify the user that their account is now active
createNotification($db, $userId,
    'Account approved',
    'Your Petra Connect Hubs account has been approved' . $hubLabel . '. You can now log in and access your dashboard.',
    'approval',
    null
);

$db->close();

echo json_encode([
    'message' => 'Account approved successfully',
    'user_id' => $userId,
    'name'    => $target['full_name'],
]);

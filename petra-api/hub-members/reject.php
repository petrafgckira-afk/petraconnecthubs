<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

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

$data         = json_decode(file_get_contents('php://input'), true);
$membershipId = $data['membership_id'] ?? null;

if (!$membershipId) {
    http_response_code(400);
    echo json_encode(['error' => 'membership_id is required']);
    exit();
}

$db   = getDB();
$stmt = $db->prepare("UPDATE hub_members SET status = 'rejected' WHERE id = ?");
$stmt->bind_param('s', $membershipId);
$stmt->execute();
$affected = $stmt->affected_rows;
$stmt->close();
$db->close();

if ($affected === 0) {
    http_response_code(404);
    echo json_encode(['error' => 'Membership record not found']);
    exit();
}

echo json_encode(['message' => 'Member rejected']);

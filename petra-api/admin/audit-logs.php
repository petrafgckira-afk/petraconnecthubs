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

$db = getDB();

// POST — write a new audit log entry
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data   = json_decode(file_get_contents('php://input'), true);
    $action = trim($data['action']    ?? '');
    $detail = trim($data['detail']    ?? '');
    $target = $data['target_id']      ?? null;
    $status = $data['status']         ?? 'success';
    $by     = $auth['user_id'];

    if (!$action) {
        http_response_code(400);
        echo json_encode(['error' => 'action is required']);
        $db->close();
        exit();
    }

    $allowed = ['success', 'warning', 'danger'];
    if (!in_array($status, $allowed)) $status = 'success';

    $stmt = $db->prepare(
        "INSERT INTO audit_logs (id, action, performed_by, target_id, detail, status)
         VALUES (UUID(), ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param('sssss', $action, $by, $target, $detail, $status);
    $stmt->execute();
    $stmt->close();
    $db->close();

    http_response_code(201);
    echo json_encode(['message' => 'Log recorded']);
    exit();
}

// GET — fetch recent logs (last 100), joining performer name
$stmt = $db->prepare("
    SELECT
        al.id,
        al.action,
        al.detail,
        al.target_id,
        al.status,
        al.created_at,
        u.full_name AS performed_by_name
    FROM audit_logs al
    JOIN users u ON u.id = al.performed_by
    ORDER BY al.created_at DESC
    LIMIT 100
");
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();
$db->close();

echo json_encode(['logs' => $rows]);

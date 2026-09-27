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

$auth      = requireAuth();
$userId    = $auth['user_id'];
$data      = json_decode(file_get_contents('php://input'), true);
$requestId = $data['request_id'] ?? null;
$action    = $data['action'] ?? null; // 'accept' or 'decline'

if (!$requestId || !in_array($action, ['accept', 'decline'])) {
    http_response_code(400);
    echo json_encode(['error' => 'request_id and action (accept|decline) are required']);
    exit();
}

$newStatus = $action === 'accept' ? 'accepted' : 'declined';

$db = getDB();

// Fetch the request so we know who sent it and can notify them
$stmtReq = $db->prepare("SELECT sender_id FROM connection_requests WHERE id = ? AND receiver_id = ? LIMIT 1");
$stmtReq->bind_param('ss', $requestId, $userId);
$stmtReq->execute();
$requestRow = $stmtReq->get_result()->fetch_assoc();
$stmtReq->close();

$stmt = $db->prepare("
    UPDATE connection_requests SET status = ?
    WHERE id = ? AND receiver_id = ?
");
$stmt->bind_param('sss', $newStatus, $requestId, $userId);
$stmt->execute();
$affected = $stmt->affected_rows;
$stmt->close();

if ($affected === 0) {
    $db->close();
    http_response_code(404);
    echo json_encode(['error' => 'Request not found or not authorized']);
    exit();
}

// Notify the original requester when accepted
if ($action === 'accept' && $requestRow) {
    $senderId = $requestRow['sender_id'];
    $stmtName = $db->prepare("SELECT full_name FROM users WHERE id = ? LIMIT 1");
    $stmtName->bind_param('s', $userId);
    $stmtName->execute();
    $acceptorName = $stmtName->get_result()->fetch_assoc()['full_name'] ?? 'Someone';
    $stmtName->close();

    createNotification($db, $senderId,
        $acceptorName . ' accepted your connection',
        $acceptorName . ' has accepted your connection request. You can now message each other.',
        'connection',
        ['senderId' => $userId]
    );
}

$db->close();

echo json_encode(['status' => $newStatus, 'message' => 'Connection ' . $newStatus]);

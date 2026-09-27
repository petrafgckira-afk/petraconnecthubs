<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$auth = requireAuth();
// All authenticated users can submit; members go to 'pending', leaders/admins go to 'approved'

$data        = json_decode(file_get_contents('php://input'), true);
$hubType     = trim($data['hub_type']     ?? '');
$title       = trim($data['title']        ?? '');
$description = trim($data['description']  ?? '');
$fileType    = $data['file_type']         ?? 'link';
$fileSize    = $data['file_size']         ?? null;
$downloadUrl = trim($data['download_url'] ?? '');

if (!$hubType || !$title || !$downloadUrl) {
    http_response_code(400);
    echo json_encode(['error' => 'hub_type, title, and download_url are required']);
    exit();
}

$allowed = ['pdf', 'video', 'link', 'doc', 'audio', 'image', 'epub'];
if (!in_array($fileType, $allowed)) $fileType = 'link';

$status = ($auth['role'] === 'member') ? 'pending' : 'approved';

$db = getDB();

$stmt = $db->prepare("SELECT id FROM hubs WHERE name = ? OR name = ? LIMIT 1");
$hubFull = $hubType . ' Hub';
$stmt->bind_param('ss', $hubFull, $hubType);
$stmt->execute();
$hubRow = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$hubRow) {
    http_response_code(400);
    echo json_encode(['error' => 'Hub not found: ' . $hubType]);
    $db->close();
    exit();
}
$hubId = $hubRow['id'];

$stmt = $db->prepare("SELECT full_name FROM users WHERE id = ? LIMIT 1");
$stmt->bind_param('s', $auth['user_id']);
$stmt->execute();
$userRow = $stmt->get_result()->fetch_assoc();
$stmt->close();
$uploaderName = $userRow['full_name'] ?? 'Unknown';

$id = bin2hex(random_bytes(16));
$stmt = $db->prepare("
    INSERT INTO resources (id, hub_id, title, description, file_type, file_size, file_url, uploaded_by_id, uploaded_by_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param('ssssssssss', $id, $hubId, $title, $description, $fileType, $fileSize, $downloadUrl, $auth['user_id'], $uploaderName, $status);
$stmt->execute();
$stmt->close();
$db->close();

$msg = ($status === 'pending') ? 'Resource submitted for review' : 'Resource created';
echo json_encode(['message' => $msg, 'id' => $id, 'status' => $status]);

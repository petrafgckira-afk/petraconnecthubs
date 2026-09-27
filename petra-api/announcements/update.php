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

$data    = json_decode(file_get_contents('php://input'), true);
$id      = trim($data['id']      ?? '');
$title   = trim($data['title']   ?? '');
$content = trim($data['content'] ?? '');

if (!$id || !$title || !$content) {
    http_response_code(400);
    echo json_encode(['error' => 'id, title and content are required']);
    exit();
}

$db = getDB();

$stmt = $db->prepare("SELECT created_by FROM announcements WHERE id = ? LIMIT 1");
$stmt->bind_param('s', $id);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Announcement not found']);
    $db->close();
    exit();
}

if ($row['created_by'] !== $userId && $role !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Not authorised to edit this announcement']);
    $db->close();
    exit();
}

$stmt = $db->prepare("UPDATE announcements SET title = ?, message = ? WHERE id = ?");
$stmt->bind_param('sss', $title, $content, $id);
if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(['error' => 'Update failed: ' . $stmt->error]);
    $stmt->close();
    $db->close();
    exit();
}
if ($stmt->affected_rows === 0) {
    http_response_code(404);
    echo json_encode(['error' => 'Announcement no longer exists']);
    $stmt->close();
    $db->close();
    exit();
}
$stmt->close();
$db->close();

echo json_encode(['message' => 'Announcement updated', 'id' => $id, 'title' => $title, 'content' => $content]);

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

$data       = json_decode(file_get_contents('php://input'), true);
$fullName   = trim($data['full_name']   ?? '');
$profession = trim($data['profession']  ?? '');
$bio        = trim($data['bio']         ?? '');
$location   = trim($data['location']    ?? '');

if (!$fullName) {
    http_response_code(400);
    echo json_encode(['error' => 'full_name is required']);
    exit();
}

if (strlen($fullName) > 100) {
    http_response_code(400);
    echo json_encode(['error' => 'full_name must be 100 characters or fewer']);
    exit();
}

$db   = getDB();
$stmt = $db->prepare("
    UPDATE users SET full_name = ?, profession = ?, bio = ?, location = ?
    WHERE id = ?
");
$stmt->bind_param('sssss', $fullName, $profession, $bio, $location, $userId);
$stmt->execute();
$stmt->close();

$stmt = $db->prepare("
    SELECT id, full_name, email, phone_number, profile_image,
           gender, location, profession, bio, role, created_at
    FROM users WHERE id = ?
");
$stmt->bind_param('s', $userId);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();
$db->close();

echo json_encode(['user' => $user, 'message' => 'Profile updated successfully']);

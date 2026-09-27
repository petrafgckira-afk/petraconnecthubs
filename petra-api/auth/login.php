<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);

if (empty($data['email']) || empty($data['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required']);
    exit();
}

$email    = strtolower(trim($data['email']));
$password = $data['password'];

$db   = getDB();
$stmt = $db->prepare("
    SELECT u.id, u.full_name, u.email, u.phone_number, u.profile_image,
           u.gender, u.location, u.profession, u.bio, u.role,
           u.is_active, u.account_status, u.email_verified, u.password_hash,
           h.name AS hub_name
    FROM users u
    LEFT JOIN hub_members hm ON hm.user_id = u.id AND hm.status = 'approved'
    LEFT JOIN hubs h         ON h.id = hm.hub_id
    WHERE u.email = ?
    LIMIT 1
");
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();
$user   = $result->fetch_assoc();
$stmt->close();

if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid email or password']);
    $db->close();
    exit();
}

$row = ['password_hash' => $user['password_hash']];
unset($user['password_hash']);
$db->close();

if (!password_verify($password, $row['password_hash'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid email or password']);
    exit();
}

if ($user['account_status'] === 'pending') {
    http_response_code(403);
    echo json_encode([
        'error'   => 'Your account is pending admin approval. You will be able to log in once an administrator reviews and activates your account.',
        'pending' => true,
    ]);
    exit();
}

if (!$user['is_active']) {
    http_response_code(403);
    echo json_encode(['error' => 'Your account has been deactivated. Contact support.']);
    exit();
}

$token = generateToken($user['id'], $user['role']);

echo json_encode([
    'message' => 'Login successful',
    'token'   => $token,
    'user'    => $user
]);

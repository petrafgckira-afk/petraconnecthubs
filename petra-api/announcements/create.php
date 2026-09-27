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
    echo json_encode(['error' => 'Only hub leaders and admins can post announcements']);
    exit();
}

$data    = json_decode(file_get_contents('php://input'), true);
$title   = trim($data['title']   ?? '');
$content = trim($data['content'] ?? '');

if (!$title || !$content) {
    http_response_code(400);
    echo json_encode(['error' => 'title and content are required']);
    exit();
}

$db = getDB();

// Leaders post to their own hub; admins post platform-wide (null) or to a selected hub
$hubId = null;
if ($role === 'hub_leader') {
    $stmt = $db->prepare("
        SELECT hub_id FROM hub_members WHERE user_id = ? AND status = 'approved' LIMIT 1
    ");
    $stmt->bind_param('s', $userId);
    $stmt->execute();
    $row   = $stmt->get_result()->fetch_assoc();
    $hubId = $row['hub_id'] ?? null;
    $stmt->close();

    if (!$hubId) {
        http_response_code(403);
        echo json_encode(['error' => 'You must be an approved hub member to post announcements']);
        $db->close();
        exit();
    }
} elseif ($role === 'admin' && !empty($data['hub_id'])) {
    // Validate the hub_id exists
    $stmt = $db->prepare("SELECT id FROM hubs WHERE id = ? LIMIT 1");
    $stmt->bind_param('s', $data['hub_id']);
    $stmt->execute();
    $row   = $stmt->get_result()->fetch_assoc();
    $hubId = $row ? $data['hub_id'] : null;
    $stmt->close();
}

// Generate a v4 UUID so we can fetch the exact row after insert
$bytes  = random_bytes(16);
$bytes[6] = chr(ord($bytes[6]) & 0x0f | 0x40);
$bytes[8] = chr(ord($bytes[8]) & 0x3f | 0x80);
$newId  = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));

$stmt = $db->prepare("
    INSERT INTO announcements (id, title, message, hub_id, created_by) VALUES (?, ?, ?, ?, ?)
");
$stmt->bind_param('sssss', $newId, $title, $content, $hubId, $userId);
if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save announcement: ' . $stmt->error]);
    $stmt->close();
    $db->close();
    exit();
}
$stmt->close();

// Fetch the exact row we just created using its known UUID
$stmt = $db->prepare("
    SELECT a.id, a.title, a.message AS content, a.hub_id, a.created_at,
           u.full_name AS author_name, u.role AS author_role,
           REPLACE(h.name, ' Hub', '') AS hub_type
    FROM announcements a
    JOIN users u     ON u.id = a.created_by
    LEFT JOIN hubs h ON h.id = a.hub_id
    WHERE a.id = ?
");
$stmt->bind_param('s', $newId);
$stmt->execute();
$r = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$r) {
    http_response_code(500);
    echo json_encode(['error' => 'Announcement saved but could not be retrieved']);
    $db->close();
    exit();
}
// Notify members of the relevant hub (or all members for platform-wide)
$authorName = $r['author_name'];
$hubLabel   = $r['hub_type'] ? $r['hub_type'] . ' Hub' : 'All Hubs';
if ($hubId) {
    $stmtM = $db->prepare("SELECT user_id FROM hub_members WHERE hub_id = ? AND status = 'approved' AND user_id != ?");
    $stmtM->bind_param('ss', $hubId, $userId);
} else {
    $stmtM = $db->prepare("SELECT id AS user_id FROM users WHERE id != ?");
    $stmtM->bind_param('s', $userId);
}
$stmtM->execute();
$members = $stmtM->get_result()->fetch_all(MYSQLI_ASSOC);
$stmtM->close();
foreach ($members as $m) {
    createNotification($db, $m['user_id'],
        'New announcement: ' . $title,
        $authorName . ' posted in ' . $hubLabel . ': ' . (strlen($content) > 80 ? substr($content, 0, 80) . '…' : $content),
        'announcement',
        ['hubId' => $hubId]
    );
}

$db->close();

$nameParts = explode(' ', $r['author_name']);
$initials  = strtoupper(implode('', array_map(fn($p) => $p[0] ?? '', $nameParts)));
$initials  = substr($initials, 0, 2) ?: 'PC';

$roleLabel = match($r['author_role']) {
    'hub_leader' => 'Hub Leader',
    'admin'      => 'Administrator',
    default      => 'Member'
};

http_response_code(201);
echo json_encode([
    'announcement' => [
        'id'           => $r['id'],
        'hubId'        => $r['hub_id'] ? ($r['hub_type'] ?: 'All') : 'All',
        'title'        => $r['title'],
        'content'      => $r['content'],
        'authorName'   => $r['author_name'],
        'authorRole'   => $roleLabel,
        'authorAvatar' => $initials,
        'date'         => substr($r['created_at'], 0, 10),
        'commentsCount' => 0,
        'likesCount'   => 0,
        'likedByUser'  => false,
        'isOwner'      => true,
    ]
]);

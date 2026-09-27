<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'OPTIONS'])) {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$auth   = requireAuth();
$userId = $auth['user_id'];
$role   = $auth['role'];

$db = getDB();

$baseSelect = "
    SELECT
        a.id,
        a.title,
        a.message AS content,
        a.hub_id,
        a.created_by,
        a.created_at,
        u.full_name  AS author_name,
        u.role       AS author_role,
        REPLACE(h.name, ' Hub', '') AS hub_type
    FROM announcements a
    JOIN users u        ON u.id = a.created_by
    LEFT JOIN hubs h    ON h.id = a.hub_id
";

if ($role === 'admin') {
    // Admins see every announcement across all hubs
    $stmt = $db->prepare($baseSelect . " ORDER BY a.created_at DESC LIMIT 50");
    $stmt->execute();
} else {
    // Find the hub this user belongs to (approved membership)
    $hStmt = $db->prepare("
        SELECT hm.hub_id
        FROM hub_members hm
        WHERE hm.user_id = ? AND hm.status = 'approved'
        LIMIT 1
    ");
    $hStmt->bind_param('s', $userId);
    $hStmt->execute();
    $hRow   = $hStmt->get_result()->fetch_assoc();
    $userHubId = $hRow['hub_id'] ?? null;
    $hStmt->close();

    if ($userHubId) {
        // Member/Leader: platform-wide announcements + their own hub's announcements
        $stmt = $db->prepare($baseSelect . "
            WHERE a.hub_id IS NULL OR a.hub_id = ?
            ORDER BY a.created_at DESC
            LIMIT 50
        ");
        $stmt->bind_param('s', $userHubId);
        $stmt->execute();
    } else {
        // User has no approved hub — show only platform-wide announcements
        $stmt = $db->prepare($baseSelect . "
            WHERE a.hub_id IS NULL
            ORDER BY a.created_at DESC
            LIMIT 50
        ");
        $stmt->execute();
    }
}

$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();
$db->close();

$announcements = array_map(function($r) use ($userId) {
    $nameParts = explode(' ', $r['author_name']);
    $initials  = strtoupper(implode('', array_map(fn($p) => $p[0] ?? '', $nameParts)));
    $initials  = substr($initials, 0, 2) ?: 'PC';

    $roleLabel = match($r['author_role']) {
        'hub_leader' => 'Hub Leader',
        'admin'      => 'Administrator',
        default      => 'Member'
    };

    return [
        'id'            => $r['id'],
        'hubId'         => $r['hub_id'] ? ($r['hub_type'] ?: 'All') : 'All',
        'title'         => $r['title'],
        'content'       => $r['content'],
        'authorName'    => $r['author_name'],
        'authorRole'    => $roleLabel,
        'authorAvatar'  => $initials,
        'date'          => substr($r['created_at'], 0, 10),
        'commentsCount' => 0,
        'likesCount'    => 0,
        'likedByUser'   => false,
        'isOwner'       => $r['created_by'] === $userId,
    ];
}, $rows);

echo json_encode(['announcements' => $announcements]);

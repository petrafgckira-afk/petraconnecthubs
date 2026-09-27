<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

$auth   = requireAuth();
$userId = $auth['user_id'];

$db = getDB();

// Get all unique conversation partners
$stmt = $db->prepare("
    SELECT DISTINCT
        CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS partner_id
    FROM messages
    WHERE sender_id = ? OR receiver_id = ?
");
$stmt->bind_param('sss', $userId, $userId, $userId);
$stmt->execute();
$partners = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$conversations = [];
foreach ($partners as $p) {
    $partnerId = $p['partner_id'];

    // Partner profile
    $stmt = $db->prepare("SELECT id, full_name, profession, profile_image FROM users WHERE id = ?");
    $stmt->bind_param('s', $partnerId);
    $stmt->execute();
    $partner = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$partner) continue;

    // Last non-deleted message in this thread
    $stmt = $db->prepare("
        SELECT content, created_at, sender_id, message_type
        FROM messages
        WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
          AND is_deleted = 0
        ORDER BY created_at DESC LIMIT 1
    ");
    $stmt->bind_param('ssss', $userId, $partnerId, $partnerId, $userId);
    $stmt->execute();
    $lastMsg = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // Unread count (non-deleted messages FROM partner TO me that are unread)
    $stmt = $db->prepare("
        SELECT COUNT(*) AS cnt FROM messages
        WHERE sender_id = ? AND receiver_id = ? AND is_read = 0 AND is_deleted = 0
    ");
    $stmt->bind_param('ss', $partnerId, $userId);
    $stmt->execute();
    $unread = (int) $stmt->get_result()->fetch_assoc()['cnt'];
    $stmt->close();

    $conversations[] = [
        'partner'      => $partner,
        'last_message' => $lastMsg,
        'unread_count' => $unread,
    ];
}

// Sort by most recent message
usort($conversations, fn($a, $b) =>
    strcmp($b['last_message']['created_at'] ?? '', $a['last_message']['created_at'] ?? '')
);

$db->close();
echo json_encode(['conversations' => $conversations]);

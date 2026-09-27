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
$data   = json_decode(file_get_contents('php://input'), true);
$msgId  = trim($data['message_id'] ?? '');
$optIdx = isset($data['option_index']) ? (int) $data['option_index'] : -1;

if (!$msgId || $optIdx < 0) {
    http_response_code(400);
    echo json_encode(['error' => 'message_id and option_index are required']);
    exit();
}

$db = getDB();

// Verify the message is a poll visible to this user
$stmt = $db->prepare(
    "SELECT id, content FROM messages
     WHERE id = ? AND message_type = 'poll' AND is_deleted = 0 LIMIT 1"
);
$stmt->bind_param('s', $msgId);
$stmt->execute();
$msg = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$msg) {
    http_response_code(404);
    echo json_encode(['error' => 'Poll not found']);
    $db->close();
    exit();
}

$pollContent = json_decode($msg['content'], true);
$optCount    = count($pollContent['options'] ?? []);

if ($optIdx >= $optCount) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid option index']);
    $db->close();
    exit();
}

// Check for existing vote
$stmt = $db->prepare(
    "SELECT id, option_index FROM poll_votes WHERE message_id = ? AND user_id = ? LIMIT 1"
);
$stmt->bind_param('ss', $msgId, $userId);
$stmt->execute();
$existing = $stmt->get_result()->fetch_assoc();
$stmt->close();

$myVote = null;
if ($existing) {
    if ((int) $existing['option_index'] === $optIdx) {
        // Same option clicked — toggle vote off
        $stmt = $db->prepare("DELETE FROM poll_votes WHERE id = ?");
        $stmt->bind_param('s', $existing['id']);
        $stmt->execute();
        $stmt->close();
    } else {
        // Different option — switch vote
        $stmt = $db->prepare("UPDATE poll_votes SET option_index = ? WHERE id = ?");
        $stmt->bind_param('is', $optIdx, $existing['id']);
        $stmt->execute();
        $stmt->close();
        $myVote = $optIdx;
    }
} else {
    // First vote
    $vid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0,0xffff), mt_rand(0,0xffff), mt_rand(0,0xffff),
        mt_rand(0,0x0fff) | 0x4000, mt_rand(0,0x3fff) | 0x8000,
        mt_rand(0,0xffff), mt_rand(0,0xffff), mt_rand(0,0xffff)
    );
    $stmt = $db->prepare(
        "INSERT INTO poll_votes (id, message_id, user_id, option_index) VALUES (?, ?, ?, ?)"
    );
    $stmt->bind_param('sssi', $vid, $msgId, $userId, $optIdx);
    $stmt->execute();
    $stmt->close();
    $myVote = $optIdx;
}

// Aggregate updated vote counts
$stmt = $db->prepare(
    "SELECT option_index, COUNT(*) AS cnt FROM poll_votes WHERE message_id = ? GROUP BY option_index"
);
$stmt->bind_param('s', $msgId);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();
$db->close();

$votes = array_fill(0, $optCount, 0);
$total = 0;
foreach ($rows as $r) {
    $i = (int) $r['option_index'];
    if ($i >= 0 && $i < $optCount) {
        $votes[$i]  = (int) $r['cnt'];
        $total     += (int) $r['cnt'];
    }
}

echo json_encode(['votes' => $votes, 'my_vote' => $myVote, 'total_votes' => $total]);

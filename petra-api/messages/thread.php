<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

$auth      = requireAuth();
$userId    = $auth['user_id'];
$partnerId = $_GET['with'] ?? null;

if (!$partnerId) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing with parameter']);
    exit();
}

$since = $_GET['since'] ?? null; // optional: only return messages newer than this timestamp

$db = getDB();

// Fetch partner's profile (only needed on full load, not on poll)
$partner = null;
if (!$since) {
    $stmt = $db->prepare("SELECT id, full_name, profession, profile_image FROM users WHERE id = ?");
    $stmt->bind_param('s', $partnerId);
    $stmt->execute();
    $partner = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$partner) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit();
    }
}

// Fetch messages — full thread or only new ones since a timestamp
if ($since) {
    $stmt = $db->prepare("
        SELECT m.id, m.sender_id, m.receiver_id, m.content, m.message_type, m.audio_url,
               m.waveform_data, m.is_read, m.created_at, m.reply_to_id,
               m.file_url, m.file_meta,
               rm.content AS reply_to_content,
               rm.message_type AS reply_to_message_type,
               rm.sender_id AS reply_to_sender_id,
               rm.is_deleted AS reply_to_is_deleted,
               ru.full_name AS reply_to_sender_name
        FROM messages m
        LEFT JOIN messages rm ON rm.id = m.reply_to_id
        LEFT JOIN users ru ON ru.id = rm.sender_id
        WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
          AND m.created_at > ?
          AND m.is_deleted = 0
        ORDER BY m.created_at ASC
    ");
    $stmt->bind_param('sssss', $userId, $partnerId, $partnerId, $userId, $since);
} else {
    $stmt = $db->prepare("
        SELECT m.id, m.sender_id, m.receiver_id, m.content, m.message_type, m.audio_url,
               m.waveform_data, m.is_read, m.created_at, m.reply_to_id,
               m.file_url, m.file_meta,
               rm.content AS reply_to_content,
               rm.message_type AS reply_to_message_type,
               rm.sender_id AS reply_to_sender_id,
               rm.is_deleted AS reply_to_is_deleted,
               ru.full_name AS reply_to_sender_name
        FROM messages m
        LEFT JOIN messages rm ON rm.id = m.reply_to_id
        LEFT JOIN users ru ON ru.id = rm.sender_id
        WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
          AND m.is_deleted = 0
        ORDER BY m.created_at ASC
    ");
    $stmt->bind_param('ssss', $userId, $partnerId, $partnerId, $userId);
}
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

// Stamp each message so the frontend knows which side to render it on
$messages = array_map(function ($msg) use ($userId) {
    $msg['is_mine']             = ($msg['sender_id'] === $userId);
    $msg['reply_to_is_deleted'] = (bool) ($msg['reply_to_is_deleted'] ?? false);
    return $msg;
}, $rows);

// Attach poll vote data for any poll messages
$pollIds = array_column(
    array_filter($messages, fn($m) => $m['message_type'] === 'poll'),
    'id'
);
if (!empty($pollIds)) {
    $ph    = implode(',', array_fill(0, count($pollIds), '?'));
    $types = str_repeat('s', count($pollIds));

    // Vote counts
    $stmt = $db->prepare("SELECT message_id, option_index, COUNT(*) AS cnt FROM poll_votes WHERE message_id IN ($ph) GROUP BY message_id, option_index");
    $stmt->bind_param($types, ...$pollIds);
    $stmt->execute();
    $voteRows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Current user's votes
    $stmt = $db->prepare("SELECT message_id, option_index FROM poll_votes WHERE message_id IN ($ph) AND user_id = ?");
    $stmt->bind_param($types . 's', ...[...$pollIds, $userId]);
    $stmt->execute();
    $myVoteRows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $voteMap   = [];
    foreach ($voteRows as $r) $voteMap[$r['message_id']][(int)$r['option_index']] = (int)$r['cnt'];
    $myVoteMap = [];
    foreach ($myVoteRows as $r) $myVoteMap[$r['message_id']] = (int)$r['option_index'];

    $messages = array_map(function ($m) use ($voteMap, $myVoteMap) {
        if ($m['message_type'] !== 'poll') return $m;
        $pc       = json_decode($m['content'], true);
        $optCount = count($pc['options'] ?? []);
        $mv       = $voteMap[$m['id']] ?? [];
        $votes    = [];
        $total    = 0;
        for ($i = 0; $i < $optCount; $i++) {
            $c = $mv[$i] ?? 0;
            $votes[] = $c;
            $total  += $c;
        }
        $m['poll_data'] = [
            'votes'       => $votes,
            'my_vote'     => $myVoteMap[$m['id']] ?? null,
            'total_votes' => $total,
        ];
        return $m;
    }, $messages);
}

// Mark incoming messages as read
$stmt = $db->prepare("
    UPDATE messages SET is_read = 1
    WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
");
$stmt->bind_param('ss', $partnerId, $userId);
$stmt->execute();
$stmt->close();

$db->close();
echo json_encode(['messages' => $messages, 'partner' => $partner]);

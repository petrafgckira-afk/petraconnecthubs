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

$auth     = requireAuth();
$senderId = $auth['user_id'];

$data         = json_decode(file_get_contents('php://input'), true);
$receiverId   = $data['receiver_id']  ?? null;
$content      = trim($data['content'] ?? '');
$messageType  = $data['message_type'] ?? 'text';
$audioUrl     = $data['audio_url']    ?? null;
$waveformData = $data['waveform_data'] ?? null;
$replyToId    = isset($data['reply_to_id']) ? (trim($data['reply_to_id']) ?: null) : null;
$fileUrl      = isset($data['file_url'])  ? (trim($data['file_url'])  ?: null) : null;
$fileMeta     = isset($data['file_meta']) ? (trim($data['file_meta']) ?: null) : null;

if (!$receiverId) {
    http_response_code(400);
    echo json_encode(['error' => 'receiver_id is required']);
    exit();
}

// Type-specific validation and content normalisation
if ($messageType === 'poll') {
    $question = trim($data['question'] ?? '');
    $options  = array_values(array_filter(array_map('trim', $data['options'] ?? []), 'strlen'));
    if (!$question || count($options) < 2) {
        http_response_code(400);
        echo json_encode(['error' => 'Poll requires a question and at least 2 options']);
        exit();
    }
    $content = json_encode(['question' => $question, 'options' => $options]);
} elseif (in_array($messageType, ['document','image','video','audio_file'])) {
    if (!$fileUrl) {
        http_response_code(400);
        echo json_encode(['error' => 'file_url is required for ' . $messageType . ' messages']);
        exit();
    }
    if (!$content) {
        $metaArr = $fileMeta ? (json_decode($fileMeta, true) ?? []) : [];
        $content = $metaArr['name'] ?? $messageType;
    }
} elseif (in_array($messageType, ['contact','event'])) {
    if (!$content) {
        http_response_code(400);
        echo json_encode(['error' => 'content (JSON) is required for ' . $messageType . ' messages']);
        exit();
    }
} elseif (!$content && !$audioUrl) {
    http_response_code(400);
    echo json_encode(['error' => 'content or audio_url is required']);
    exit();
}
if (!$content && $messageType === 'audio') $content = '[Voice Message]';

$newId = sprintf(
    '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
    mt_rand(0, 0xffff), mt_rand(0, 0xffff),
    mt_rand(0, 0xffff),
    mt_rand(0, 0x0fff) | 0x4000,
    mt_rand(0, 0x3fff) | 0x8000,
    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
);

$db   = getDB();
$stmt = $db->prepare(
    "INSERT INTO messages (id, sender_id, receiver_id, content, message_type, audio_url, waveform_data, reply_to_id, file_url, file_meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
$stmt->bind_param('ssssssssss', $newId, $senderId, $receiverId, $content, $messageType, $audioUrl, $waveformData, $replyToId, $fileUrl, $fileMeta);
$ok = $stmt->execute();
$stmt->close();

if (!$ok) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send message: ' . $db->error]);
    $db->close();
    exit();
}

// Notify the recipient
$stmtName = $db->prepare("SELECT full_name FROM users WHERE id = ? LIMIT 1");
$stmtName->bind_param('s', $senderId);
$stmtName->execute();
$senderName = $stmtName->get_result()->fetch_assoc()['full_name'] ?? 'Someone';
$stmtName->close();

$preview = match($messageType) {
    'audio'      => '🎤 Sent you a voice message',
    'audio_file' => '🎤 Sent you an audio file',
    'image'      => '📷 Sent you a photo',
    'video'      => '🎬 Sent you a video',
    'document'   => '📄 Sent you a document',
    'poll'       => '📊 Sent you a poll',
    'contact'    => '👤 Shared a contact with you',
    'event'      => '📅 Shared an event with you',
    default      => strlen($content) > 60 ? substr($content, 0, 60) . '…' : $content,
};
createNotification($db, $receiverId,
    $senderName . ' sent you a message',
    $preview,
    'message',
    ['senderId' => $senderId]
);

$stmt = $db->prepare(
    "SELECT m.id, m.sender_id, m.receiver_id, m.content, m.message_type, m.audio_url,
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
     WHERE m.id = ?"
);
$stmt->bind_param('s', $newId);
$stmt->execute();
$message = $stmt->get_result()->fetch_assoc();
$stmt->close();

$message['is_mine']             = true;
$message['reply_to_is_deleted'] = (bool) ($message['reply_to_is_deleted'] ?? false);

// For poll messages, attach initial poll_data (zero votes — just created)
if ($message['message_type'] === 'poll') {
    $pollContent = json_decode($message['content'], true);
    $optCount    = count($pollContent['options'] ?? []);
    $message['poll_data'] = [
        'votes'       => array_fill(0, $optCount, 0),
        'my_vote'     => null,
        'total_votes' => 0,
    ];
}

$db->close();

http_response_code(201);
echo json_encode(['message' => $message]);

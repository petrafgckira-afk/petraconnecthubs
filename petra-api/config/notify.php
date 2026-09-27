<?php
// Helper — insert a notification row.
// $meta is an optional assoc array (e.g. ['senderId'=>'...']) stored as JSON.
function createNotification($db, $userId, $title, $message, $type, $meta = null) {
    $metaJson = $meta ? json_encode($meta) : null;
    $stmt = $db->prepare(
        "INSERT INTO notifications (id, user_id, title, message, notification_type, meta)
         VALUES (UUID(), ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param('sssss', $userId, $title, $message, $type, $metaJson);
    $stmt->execute();
    $stmt->close();
}

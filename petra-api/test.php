<?php
require_once 'config/cors.php';
require_once 'config/database.php';

$db = getDB();

$result = $db->query("SELECT COUNT(*) as hub_count FROM hubs");
$row = $result->fetch_assoc();

echo json_encode([
    'status'    => 'ok',
    'message'   => 'Petra API is connected',
    'hub_count' => (int) $row['hub_count']
]);

$db->close();

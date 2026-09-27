<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

requireAuth();

$db     = getDB();
$result = $db->query("
    SELECT
        h.id,
        h.name,
        h.description,
        COUNT(CASE WHEN hm.status = 'approved' THEN 1 END) AS member_count,
        COUNT(CASE WHEN hm.status = 'pending'  THEN 1 END) AS pending_count
    FROM hubs h
    LEFT JOIN hub_members hm ON hm.hub_id = h.id
    GROUP BY h.id, h.name, h.description
    ORDER BY h.name
");

$hubs = [];
while ($row = $result->fetch_assoc()) {
    $row['member_count']  = (int) $row['member_count'];
    $row['pending_count'] = (int) $row['pending_count'];
    $hubs[] = $row;
}

$db->close();
echo json_encode(['hubs' => $hubs]);

<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

requireAuth();
$auth = requireAuth();
$db   = getDB();

$role   = $auth['role'];
$userId = $db->real_escape_string($auth['user_id']);

if ($role === 'admin') {
    // Admin sees all approved resources across all hubs
    $result = $db->query("
        SELECT r.id, r.hub_id, h.name AS hub_name, r.title, r.description,
               r.file_type, r.file_size, r.file_url AS download_url, r.uploaded_by_name,
               r.download_count, r.created_at
        FROM resources r
        JOIN hubs h ON h.id = r.hub_id
        WHERE r.status = 'approved'
        ORDER BY r.created_at DESC
    ");
} else {
    // member / hub_leader: resolve their hub, then return only that hub's approved resources
    $hubResult = $db->query("
        SELECT COALESCE(h.name,
            CASE
                WHEN u.profession IN ('Medical','Technology','Business','Finance','Education','Media & Creative','Leadership & Ministry')
                    THEN CONCAT(u.profession, ' Hub')
                WHEN u.profession REGEXP 'doctor|medic|nurs|health|pharm|dental|clinic|surgeon' THEN 'Medical Hub'
                WHEN u.profession REGEXP 'tech|engineer|software|developer|programmer|cyber|web|data' THEN 'Technology Hub'
                WHEN u.profession REGEXP 'business|entrepreneur|market|sales|trade|commerce|manager' THEN 'Business Hub'
                WHEN u.profession REGEXP 'financ|account|bank|invest|audit|tax|econom' THEN 'Finance Hub'
                WHEN u.profession REGEXP 'teach|educat|professor|lecturer|school|tutor|instruct' THEN 'Education Hub'
                WHEN u.profession REGEXP 'media|creat|design|journal|film|music|art|photo|content|writer' THEN 'Media & Creative Hub'
                WHEN u.profession REGEXP 'leader|pastor|minister|church|mission|chaplain|bishop' THEN 'Leadership & Ministry Hub'
                ELSE 'Technology Hub'
            END
        ) AS hub_name
        FROM users u
        LEFT JOIN hub_members hm ON hm.user_id = u.id AND hm.status = 'approved'
        LEFT JOIN hubs h         ON h.id = hm.hub_id
        WHERE u.id = '$userId'
        LIMIT 1
    ");
    $hubRow  = $hubResult->fetch_assoc();
    $hubName = $db->real_escape_string($hubRow['hub_name'] ?? 'Technology Hub');

    $result = $db->query("
        SELECT r.id, r.hub_id, h.name AS hub_name, r.title, r.description,
               r.file_type, r.file_size, r.file_url AS download_url, r.uploaded_by_name,
               r.download_count, r.created_at
        FROM resources r
        JOIN hubs h ON h.id = r.hub_id
        WHERE h.name = '$hubName' AND r.status = 'approved'
        ORDER BY r.created_at DESC
    ");
}

$resources = [];
while ($row = $result->fetch_assoc()) {
    $resources[] = $row;
}
$db->close();
echo json_encode(['resources' => $resources]);

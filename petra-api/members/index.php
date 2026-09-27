<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

requireAuth();

$db = getDB();

$result = $db->query("
    SELECT
        u.id,
        u.full_name,
        u.email,
        u.profession,
        u.bio,
        u.location,
        u.role,
        u.profile_image,
        u.created_at,
        hm.status AS membership_status,
        COALESCE(h.name,
            CASE
                WHEN u.profession IN ('Medical','Technology','Business','Finance','Education','Media & Creative','Leadership & Ministry')
                    THEN CONCAT(u.profession, ' Hub')
                WHEN u.profession REGEXP 'doctor|medic|nurs|health|pharm|dental|clinic|surgeon'
                    THEN 'Medical Hub'
                WHEN u.profession REGEXP 'tech|engineer|software|developer|programmer|cyber|web|data'
                    THEN 'Technology Hub'
                WHEN u.profession REGEXP 'business|entrepreneur|market|sales|trade|commerce|manager'
                    THEN 'Business Hub'
                WHEN u.profession REGEXP 'financ|account|bank|invest|audit|tax|econom'
                    THEN 'Finance Hub'
                WHEN u.profession REGEXP 'teach|educat|professor|lecturer|school|tutor|instruct'
                    THEN 'Education Hub'
                WHEN u.profession REGEXP 'media|creat|design|journal|film|music|art|photo|content|writer'
                    THEN 'Media & Creative Hub'
                WHEN u.profession REGEXP 'leader|pastor|minister|church|mission|chaplain|bishop'
                    THEN 'Leadership & Ministry Hub'
                ELSE 'Technology Hub'
            END
        ) AS hub_name
    FROM users u
    LEFT JOIN hub_members hm ON hm.user_id = u.id AND hm.status = 'approved'
    LEFT JOIN hubs h         ON h.id = hm.hub_id
    WHERE u.role != 'admin'
      AND u.account_status = 'active'
    ORDER BY u.full_name
");

$members = [];
while ($row = $result->fetch_assoc()) {
    $members[] = $row;
}

$db->close();
echo json_encode(['members' => $members]);

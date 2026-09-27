<?php
// Buffer all output so any PHP notice/warning can't corrupt the JSON response
ob_start();
error_reporting(0);

// Catch PHP fatal errors and return them as JSON so the client can report them
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        ob_clean();
        http_response_code(500);
        echo json_encode(['error' => 'Fatal: ' . $err['message'] . ' (' . basename($err['file']) . ':' . $err['line'] . ')']);
    }
});

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

function sendError(int $code, string $msg): void {
    ob_clean();
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit();
}

// ── Method guard ──────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError(405, 'Method not allowed');
}

// ── Auth ──────────────────────────────────────────────────────────────────────
$auth = requireAuth();
if (!in_array($auth['role'], ['hub_leader', 'admin'])) {
    sendError(403, 'Unauthorized — hub leaders and admins only');
}

// ── File validation ───────────────────────────────────────────────────────────
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $uploadErrCode = isset($_FILES['file']['error']) ? (int)$_FILES['file']['error'] : UPLOAD_ERR_NO_FILE;
    $uploadErrMsgs = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds the server upload_max_filesize limit.',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds the form upload limit.',
        UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded.',
        UPLOAD_ERR_NO_FILE    => 'No file was received by the server.',
        UPLOAD_ERR_NO_TMP_DIR => 'Server has no temporary directory for uploads.',
        UPLOAD_ERR_CANT_WRITE => 'Server failed to write the file to disk.',
        UPLOAD_ERR_EXTENSION  => 'A PHP extension blocked the upload.',
    ];
    sendError(400, $uploadErrMsgs[$uploadErrCode] ?? "PHP upload error code: $uploadErrCode");
}

// ── MIME → resource type map ──────────────────────────────────────────────────
$mimeMap = [
    'application/pdf'                                                            => 'pdf',
    'application/msword'                                                         => 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'   => 'doc',
    'application/vnd.ms-excel'                                                   => 'doc',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'         => 'doc',
    'application/vnd.ms-powerpoint'                                              => 'doc',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'doc',
    'application/epub+zip'                                                       => 'epub',
    'video/mp4'        => 'video',
    'video/quicktime'  => 'video',
    'video/x-msvideo'  => 'video',
    'video/webm'       => 'video',
    'video/x-matroska' => 'video',
    'video/x-m4v'      => 'video',
    'video/mpeg'       => 'video',
    'video/ogg'        => 'video',
    'audio/mpeg'       => 'audio',
    'audio/wav'        => 'audio',
    'audio/ogg'        => 'audio',
    'audio/mp4'        => 'audio',
    'audio/x-m4a'      => 'audio',
    'audio/aac'        => 'audio',
    'audio/flac'       => 'audio',
    'audio/x-wav'      => 'audio',
    'image/jpeg'       => 'image',
    'image/png'        => 'image',
    'image/gif'        => 'image',
    'image/webp'       => 'image',
    'image/svg+xml'    => 'image',
];

$tmpPath  = $_FILES['file']['tmp_name'];
$origName = basename($_FILES['file']['name']);
$mimeType = mime_content_type($tmpPath);

if (!array_key_exists($mimeType, $mimeMap)) {
    sendError(415, "Unsupported file type: $mimeType");
}
$fileType = $mimeMap[$mimeType];

// ── Save to uploads directory ─────────────────────────────────────────────────
$uploadDir = rtrim(realpath(dirname(__DIR__)), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR;

if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        sendError(500, 'Could not create uploads directory on server.');
    }
}

$ext      = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
$safeName = preg_replace('/[^a-zA-Z0-9_.-]/', '_', pathinfo($origName, PATHINFO_FILENAME));
$filename = $safeName . '_' . uniqid() . ($ext ? '.' . $ext : '');
$destPath = $uploadDir . $filename;

if (!move_uploaded_file($tmpPath, $destPath)) {
    sendError(500, 'Server could not save the uploaded file — check folder permissions.');
}

// ── Build public URL ──────────────────────────────────────────────────────────
$proto   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host    = $_SERVER['HTTP_HOST'];
// Walk up two levels from /resources/upload.php → /petra-api
$apiBase = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/');
$fileUrl = "$proto://$host$apiBase/uploads/$filename";

// ── File size label ───────────────────────────────────────────────────────────
$bytes     = (int)$_FILES['file']['size'];
$sizeLabel = $bytes >= 1048576
    ? round($bytes / 1048576, 1) . ' MB'
    : ($bytes >= 1024 ? round($bytes / 1024, 1) . ' KB' : "$bytes B");

// ── Hub lookup ────────────────────────────────────────────────────────────────
$db      = getDB();
$hubType = trim($_POST['hub_type'] ?? '');

// Try: exact hub name with " Hub" suffix, then exact name, then by id
$hubNameFull = $hubType . ' Hub';
$stmt = $db->prepare("SELECT id FROM hubs WHERE name = ? OR name = ? OR id = ? LIMIT 1");
$stmt->bind_param('sss', $hubNameFull, $hubType, $hubType);
$stmt->execute();
$hubRow = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$hubRow) {
    @unlink($destPath);
    sendError(400, "Hub not found for type: '$hubType'");
}
$hubId = $hubRow['id'];

// ── Insert resource record ────────────────────────────────────────────────────
$title    = trim($_POST['title'] ?? '') ?: pathinfo($origName, PATHINFO_FILENAME);
$desc     = trim($_POST['description'] ?? '');
$userId   = $auth['user_id'];
$userName = $auth['name'] ?? 'Unknown';
$newId    = bin2hex(random_bytes(16));

$ins = $db->prepare("
    INSERT INTO resources
        (id, hub_id, title, description, file_type, file_size, file_url, uploaded_by_name, uploaded_by_id, status, download_count, created_at)
    VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 0, NOW())
");
$ins->bind_param('sssssssss', $newId, $hubId, $title, $desc, $fileType, $sizeLabel, $fileUrl, $userName, $userId);

if (!$ins->execute()) {
    @unlink($destPath);
    $ins->close();
    $db->close();
    sendError(500, 'Database insert failed: ' . $db->error);
}

// $newId already set above (the char UUID we generated)
$ins->close();
$db->close();

// ── Success ───────────────────────────────────────────────────────────────────
ob_clean();
echo json_encode([
    'success'      => true,
    'id'           => $newId,
    'file_type'    => $fileType,
    'file_size'    => $sizeLabel,
    'download_url' => $fileUrl,
]);

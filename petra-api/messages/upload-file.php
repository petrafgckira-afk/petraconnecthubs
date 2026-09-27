<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

requireAuth();

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $code   = $_FILES['file']['error'] ?? -1;
    $errors = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds form upload limit',
        UPLOAD_ERR_PARTIAL    => 'File only partially uploaded',
        UPLOAD_ERR_NO_FILE    => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
        UPLOAD_ERR_CANT_WRITE => 'Cannot write to disk',
    ];
    http_response_code(400);
    echo json_encode(['error' => $errors[$code] ?? 'Upload error ' . $code]);
    exit();
}

$file = $_FILES['file'];
$type = $_POST['type'] ?? 'document'; // document | image | video | audio

// Accepted MIME types per category (empty = allow any)
$allowed = [
    'document' => [],
    'image'    => ['image/jpeg','image/png','image/gif','image/webp','image/bmp','image/svg+xml','image/avif'],
    'video'    => ['video/mp4','video/webm','video/ogg','video/quicktime','video/x-msvideo','video/mpeg','video/3gpp','video/x-matroska'],
    'audio'    => ['audio/mpeg','audio/mp3','audio/wav','audio/ogg','audio/aac','audio/webm','audio/flac','audio/x-m4a','audio/mp4'],
];

$mime  = mime_content_type($file['tmp_name']);
$allow = $allowed[$type] ?? [];
if (!empty($allow) && !in_array($mime, $allow)) {
    http_response_code(400);
    echo json_encode(['error' => 'File type ' . $mime . ' is not allowed for ' . $type . ' uploads']);
    exit();
}

// Directory: documents, images, videos, audios
$subDir  = $type . 's';
$dir     = __DIR__ . '/../uploads/messages/' . $subDir . '/';
if (!is_dir($dir)) mkdir($dir, 0755, true);

// Unique safe filename
$origExt = pathinfo($file['name'], PATHINFO_EXTENSION);
$safeExt = $origExt ? '.' . preg_replace('/[^a-zA-Z0-9]/', '', $origExt) : '';
$newName = bin2hex(random_bytes(12)) . $safeExt;
$dest    = $dir . $newName;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file to disk']);
    exit();
}

$proto = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
$host  = $_SERVER['HTTP_HOST'];
$url   = $proto . '://' . $host . '/petra-api/uploads/messages/' . $subDir . '/' . $newName;

echo json_encode([
    'url'  => $url,
    'name' => $file['name'],
    'size' => (int) $file['size'],
    'mime' => $mime,
]);

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

if (empty($_FILES['photo'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No photo file received']);
    exit();
}

$file = $_FILES['photo'];

if ($file['size'] > 5 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['error' => 'File too large. Maximum is 5 MB']);
    exit();
}

$finfo   = new finfo(FILEINFO_MIME_TYPE);
$mime    = $finfo->file($file['tmp_name']);
$allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

if (!array_key_exists($mime, $allowed)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid file type. Allowed: JPEG, PNG, WebP']);
    exit();
}

$ext  = $allowed[$mime];
$dir  = __DIR__ . '/../uploads/photos/';
$name = 'photo_' . $userId . '_' . time() . '.' . $ext;
$path = $dir . $name;

if (!move_uploaded_file($file['tmp_name'], $path)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save photo']);
    exit();
}

// Square-crop and resize to 400×400 with GD
if (extension_loaded('gd')) {
    $src = null;
    if ($mime === 'image/jpeg') $src = imagecreatefromjpeg($path);
    elseif ($mime === 'image/png')  $src = imagecreatefrompng($path);
    elseif ($mime === 'image/webp') $src = imagecreatefromwebp($path);

    if ($src) {
        $sw   = imagesx($src);
        $sh   = imagesy($src);
        $size = min($sw, $sh);
        $sx   = (int)(($sw - $size) / 2);
        $sy   = (int)(($sh - $size) / 2);
        $out  = imagecreatetruecolor(400, 400);

        // Preserve transparency for PNG
        if ($mime === 'image/png') {
            imagealphablending($out, false);
            imagesavealpha($out, true);
        }

        imagecopyresampled($out, $src, 0, 0, $sx, $sy, 400, 400, $size, $size);

        if ($mime === 'image/jpeg') imagejpeg($out, $path, 90);
        elseif ($mime === 'image/png')  imagepng($out, $path, 8);
        elseif ($mime === 'image/webp') imagewebp($out, $path, 90);

        imagedestroy($src);
        imagedestroy($out);
    }
}

$url = 'http://localhost/petra-api/uploads/photos/' . $name;

$db   = getDB();
$stmt = $db->prepare("UPDATE users SET profile_image = ? WHERE id = ?");
$stmt->bind_param('ss', $url, $userId);
$stmt->execute();
$stmt->close();
$db->close();

echo json_encode(['url' => $url, 'message' => 'Profile photo updated']);

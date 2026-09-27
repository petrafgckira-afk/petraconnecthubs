<?php
require_once '../config/cors.php';
require_once '../config/auth.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

if (empty($_FILES['audio'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No audio file received']);
    exit();
}

$file    = $_FILES['audio'];
$dir     = __DIR__ . '/../uploads/audio/';
$ext     = 'webm'; // MediaRecorder output
$name    = uniqid('voice_', true) . '.' . $ext;
$path    = $dir . $name;

if (!move_uploaded_file($file['tmp_name'], $path)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save audio file']);
    exit();
}

// Remux with ffmpeg to move duration header to front (eliminates playback lag)
$ffmpeg   = 'C:\\Users\\LENOVO\\OneDrive\\Desktop\\petra-connect-hubs\\ffmpeg\\bin\\ffmpeg.exe';
$tmpPath  = $dir . 'tmp_' . $name;

if (file_exists($ffmpeg)) {
    $cmd = '"' . $ffmpeg . '" -y -i "' . $path . '" -c copy "' . $tmpPath . '" 2>/dev/null';
    exec($cmd, $output, $code);
    if ($code === 0 && file_exists($tmpPath)) {
        rename($tmpPath, $path); // replace original with remuxed file
    } elseif (file_exists($tmpPath)) {
        unlink($tmpPath); // clean up failed temp file
    }
}

echo json_encode(['url' => 'http://localhost/petra-api/uploads/audio/' . $name]);

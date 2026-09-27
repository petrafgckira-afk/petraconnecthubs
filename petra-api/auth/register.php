<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

// Catch any uncaught fatal/exception and return clean JSON instead of crashing silently
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        ob_clean();
        http_response_code(500);
        echo json_encode(['error' => 'Server error during registration. Please try again.']);
    }
});

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ob_clean();
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);

$required = ['full_name', 'email', 'password', 'phone_number'];
foreach ($required as $field) {
    if (empty($data[$field])) {
        ob_clean();
        http_response_code(400);
        echo json_encode(['error' => "Field '$field' is required"]);
        exit();
    }
}

$fullName     = trim($data['full_name']);
$email        = strtolower(trim($data['email']));
$password     = $data['password'];
$phone        = trim($data['phone_number']);
$gender       = $data['gender']               ?? null;
$dob          = $data['date_of_birth']         ?? null;
$location     = $data['location']              ?? null;
$profession   = $data['profession']            ?? null;
$experience   = $data['years_of_experience']   ?? null;
$bio          = $data['bio']                   ?? null;
$hubName      = $data['hub_name']              ?? null;
$contribution = $data['contribution_interest'] ?? null;

if (strlen($password) < 6) {
    ob_clean();
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 6 characters']);
    exit();
}

try {
    $db = getDB();

    // ── Duplicate email check ─────────────────────────────────────
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $stmt->store_result();
    $emailExists = $stmt->num_rows > 0;
    $stmt->close();

    if ($emailExists) {
        ob_clean();
        http_response_code(409);
        echo json_encode(['error' => 'An account with this email already exists']);
        $db->close();
        exit();
    }

    // ── Duplicate phone check ─────────────────────────────────────
    $stmt = $db->prepare("SELECT id FROM users WHERE phone_number = ? LIMIT 1");
    $stmt->bind_param('s', $phone);
    $stmt->execute();
    $stmt->store_result();
    $phoneExists = $stmt->num_rows > 0;
    $stmt->close();

    if ($phoneExists) {
        ob_clean();
        http_response_code(409);
        echo json_encode(['error' => 'An account with this phone number already exists']);
        $db->close();
        exit();
    }

    // ── Create user ───────────────────────────────────────────────
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    $stmt = $db->prepare("
        INSERT INTO users
            (full_name, email, phone_number, password_hash, gender, date_of_birth,
             location, profession, years_of_experience, bio, role, account_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'member', 'pending')
    ");
    $stmt->bind_param(
        'ssssssssss',
        $fullName, $email, $phone, $passwordHash,
        $gender, $dob, $location, $profession, $experience, $bio
    );

    if (!$stmt->execute()) {
        $dbErr = $db->error;
        $stmt->close();
        $db->close();
        ob_clean();
        http_response_code(500);
        echo json_encode(['error' => 'Could not create account. Please try again.']);
        exit();
    }
    $stmt->close();

    // ── Fetch the newly created user ──────────────────────────────
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $newUser = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // ── Hub membership (non-fatal — user still reaches step 3) ───
    if ($hubName && $newUser) {
        try {
            $hubNameFull = trim($hubName) . ' Hub';

            $stmt = $db->prepare("SELECT id FROM hubs WHERE name = ? OR name = ? LIMIT 1");
            $stmt->bind_param('ss', $hubNameFull, $hubName);
            $stmt->execute();
            $hub = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if ($hub) {
                $memberId = bin2hex(random_bytes(16));
                $stmt = $db->prepare("
                    INSERT INTO hub_members (id, user_id, hub_id, contribution_interest, status)
                    VALUES (?, ?, ?, ?, 'pending')
                ");
                $stmt->bind_param('ssss', $memberId, $newUser['id'], $hub['id'], $contribution);
                $stmt->execute();
                $stmt->close();
            }
        } catch (Exception $hubEx) {
            // Hub assignment failed — not critical, user account is created.
            // Admin can assign hub manually. Do NOT block the success response.
        }
    }

    $db->close();

} catch (Exception $e) {
    ob_clean();
    http_response_code(500);
    echo json_encode(['error' => 'Registration failed. Please try again later.']);
    exit();
}

// ── Success — account pending admin approval ───────────────────────
ob_clean();
http_response_code(201);
echo json_encode([
    'pending' => true,
    'message' => 'Registration successful. Your account is awaiting admin approval before you can log in.',
]);

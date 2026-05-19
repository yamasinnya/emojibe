<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || empty($data['roles'])) {
    echo json_encode(['success' => false, 'error' => 'Invalid input']);
    exit;
}

if (!file_exists(__DIR__ . '/db_config.php')) {
    echo json_encode(['success' => true, 'saved' => false, 'note' => 'no db config']);
    exit;
}
require_once __DIR__ . '/db_config.php';

try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (PDOException $e) {
    // DBなし環境ではスキップ
    echo json_encode(['success' => true, 'saved' => false, 'note' => 'no db']);
    exit;
}

$totalScore = (int)($data['total_score'] ?? 0);

foreach ($data['roles'] as $role) {
    $roleName = mb_substr($role['name'] ?? '', 0, 100);
    $score = (int)($role['score'] ?? 0);
    $comment = mb_substr($role['comment'] ?? '', 0, 200);
    $emojis = implode('', array_column($role['emojis'] ?? [], 'emoji'));

    $stmt = $pdo->prepare(
        'INSERT INTO game_logs (player, role_id, raw_input, ai_score, ai_comment) VALUES (?, NULL, ?, ?, ?)'
    );
    $stmt->execute(['solo', "{$roleName}: {$emojis}", $score, $comment]);
}

echo json_encode(['success' => true, 'total_score' => $totalScore]);

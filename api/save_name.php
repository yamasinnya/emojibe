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

if (!$data || empty($data['session_id']) || empty($data['player_name'])) {
    echo json_encode(['success' => false, 'error' => 'Invalid input']);
    exit;
}

if (!file_exists(__DIR__ . '/db_config.php')) {
    echo json_encode(['success' => true, 'saved' => false]);
    exit;
}
require_once __DIR__ . '/db_config.php';

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'db error']);
    exit;
}

$stmt = $pdo->prepare(
    'UPDATE game_logs SET player_name=? WHERE session_id=? AND ai_score >= 8'
);
$stmt->execute([
    mb_substr($data['player_name'], 0, 50),
    mb_substr($data['session_id'], 0, 36),
]);

echo json_encode(['success' => true, 'updated' => $stmt->rowCount()]);

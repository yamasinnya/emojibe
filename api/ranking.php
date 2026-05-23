<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

if (file_exists(__DIR__ . '/db_config.php')) require_once __DIR__ . '/db_config.php';

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $stmt = $pdo->query(
        "SELECT role_name, emojis, ai_score, ai_comment, player_name, created_at
         FROM game_logs
         WHERE ai_score >= 8
         ORDER BY ai_score DESC, created_at DESC
         LIMIT 30"
    );
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as &$row) {
        $raw = $row['emojis'] ?? '';
        $decoded = json_decode($raw, true);
        // JSON配列ならそのまま、生文字列なら1要素の配列として包む
        $row['emojis'] = is_array($decoded) ? $decoded : ($raw !== '' ? [$raw] : []);
        $row['ai_score'] = (int)$row['ai_score'];
    }

    echo json_encode(['ranking' => $rows]);
} catch (\Throwable $e) {
    echo json_encode(['ranking' => [], 'error' => 'DB error']);
}

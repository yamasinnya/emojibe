<?php
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if (file_exists(__DIR__ . '/db_config.php')) require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/emojis.php';

// 20枚フィールド + 7枚ホスト手札 = 27枚ユニーク生成
$all        = getRandomEmojisPhp(27);
$fieldEmojis = array_slice($all, 0, 20);
$hostHand    = array_slice($all, 20, 7);
$hiddenIdx   = rand(0, 6);

$roomId   = generateRoomId();
$hostSess = generateUUID();

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->exec("SET time_zone = '+00:00'");

    $pdo->prepare(
        "INSERT INTO rooms (id, field_emojis, status, host_session) VALUES (?, ?, 'waiting', ?)"
    )->execute([$roomId, json_encode($fieldEmojis, JSON_UNESCAPED_UNICODE), $hostSess]);

    $pdo->prepare(
        "INSERT INTO room_players (room_id, session_id, role, initial_hand, hidden_emoji)
         VALUES (?, ?, 'host', ?, ?)"
    )->execute([
        $roomId, $hostSess,
        json_encode($hostHand, JSON_UNESCAPED_UNICODE),
        $hostHand[$hiddenIdx]['emoji']
    ]);

    echo json_encode([
        'room_id'      => $roomId,
        'session_id'   => $hostSess,
        'role'         => 'host',
        'initial_hand' => $hostHand,
        'hidden_idx'   => $hiddenIdx,
        'field_emojis' => $fieldEmojis,
    ]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

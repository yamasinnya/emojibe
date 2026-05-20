<?php
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if (file_exists(__DIR__ . '/db_config.php')) require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/emojis.php';

$data   = json_decode(file_get_contents('php://input'), true) ?? [];
$roomId = $data['room_id'] ?? '';
if (!$roomId) { echo json_encode(['error' => 'room_id required']); exit; }

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->exec("SET time_zone = '+00:00'");
    $pdo->beginTransaction();

    // 部屋確認
    $stmt = $pdo->prepare("SELECT * FROM rooms WHERE id = ? AND status = 'waiting' FOR UPDATE");
    $stmt->execute([$roomId]);
    $room = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$room) {
        $pdo->rollBack();
        echo json_encode(['error' => '部屋が見つかりません（満員か存在しない）']); exit;
    }

    // ホストの手札を取得（絵文字重複回避のため）
    $hostStmt = $pdo->prepare("SELECT initial_hand, hidden_emoji FROM room_players WHERE room_id = ? AND role = 'host'");
    $hostStmt->execute([$roomId]);
    $hostRow     = $hostStmt->fetch(PDO::FETCH_ASSOC);
    $hostHandRaw = $hostRow['initial_hand'] ?? false;
    $hostHiddenEmoji = $hostRow['hidden_emoji'] ?? '';
    $hostHand    = ($hostHandRaw !== false && $hostHandRaw !== null)
                   ? (json_decode($hostHandRaw, true) ?? []) : [];
    // ゲストに見せる際、ホストの非公開カードをマスク
    $hostHandMasked = array_map(function($card) use ($hostHiddenEmoji) {
        return ($card['emoji'] === $hostHiddenEmoji)
            ? ['emoji' => '?', 'name' => '?', 'hidden' => true]
            : $card;
    }, $hostHand);

    $fieldRaw    = $room['field_emojis'] ?? '[]';
    $fieldEmojis = json_decode($fieldRaw, true) ?? [];
    $exclude     = array_column($fieldEmojis, 'emoji');
    foreach ($hostHand as $h) $exclude[] = $h['emoji'];

    // ゲスト手札7枚生成
    $guestHand = getRandomEmojisPhp(7, $exclude);
    $hiddenIdx = rand(0, 6);
    $guestSess = generateUUID();

    // 先攻・後攻ランダム決定
    $firstTurn = rand(0, 1) === 0 ? 'host' : 'guest';
    $deadline  = date('Y-m-d H:i:s', time() + 60); // 初回1分

    $pdo->prepare(
        "INSERT INTO room_players (room_id, session_id, role, initial_hand, hidden_emoji)
         VALUES (?, ?, 'guest', ?, ?)"
    )->execute([
        $roomId, $guestSess,
        json_encode($guestHand),
        $guestHand[$hiddenIdx]['emoji']
    ]);

    $pdo->prepare(
        "UPDATE rooms SET guest_session=?, status='draft', current_turn=?, turn_deadline=? WHERE id=?"
    )->execute([$guestSess, $firstTurn, $deadline, $roomId]);

    $pdo->commit();

    echo json_encode([
        'session_id'       => $guestSess,
        'role'             => 'guest',
        'initial_hand'     => $guestHand,
        'hidden_idx'       => $hiddenIdx,
        'field_emojis'     => $fieldEmojis,
        'opp_initial_hand' => $hostHandMasked,
        'current_turn'     => $firstTurn,
        'turn_deadline'    => $deadline . 'Z',
        'turn_number'      => 1,
    ]);
} catch (\Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

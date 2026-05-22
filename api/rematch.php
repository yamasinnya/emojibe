<?php
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if (file_exists(__DIR__ . '/db_config.php')) require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/emojis.php';

$data      = json_decode(file_get_contents('php://input'), true) ?? [];
$roomId    = $data['room_id']    ?? '';
$sessionId = $data['session_id'] ?? '';

if (!$roomId || !$sessionId) {
    echo json_encode(['error' => 'params required']); exit;
}

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->exec("SET time_zone = '+00:00'");

    // 自分のrole確認（トランザクション外で先に）
    $meStmt = $pdo->prepare("SELECT role FROM room_players WHERE room_id=? AND session_id=?");
    $meStmt->execute([$roomId, $sessionId]);
    $meRow  = $meStmt->fetch(PDO::FETCH_ASSOC);
    if (!$meRow) { echo json_encode(['error' => 'player not found']); exit; }

    $myRole  = $meRow['role'];
    $oppRole = $myRole === 'host' ? 'guest' : 'host';

    $pdo->beginTransaction();

    // ルーム排他ロック
    $roomStmt = $pdo->prepare("SELECT * FROM rooms WHERE id=? FOR UPDATE");
    $roomStmt->execute([$roomId]);
    $room = $roomStmt->fetch(PDO::FETCH_ASSOC);
    if (!$room) { $pdo->rollBack(); echo json_encode(['error' => 'room not found']); exit; }

    // 既に新ルーム作成済み（相手が先に成立させた）
    if (!empty($room['rematch_room_id'])) {
        $newRoomId = $room['rematch_room_id'];
        $pdo->rollBack();
        echoMatchedData($pdo, $newRoomId, $sessionId, $myRole);
        exit;
    }

    $requested = $room['rematch_requested'] ?? '';

    // 自分がすでに申請済み → 待機継続
    if ($requested === $myRole) {
        $pdo->rollBack();
        echo json_encode(['status' => 'waiting']); exit;
    }

    // 誰も申請していない → 自分が申請
    if (!$requested) {
        $pdo->prepare("UPDATE rooms SET rematch_requested=? WHERE id=?")
            ->execute([$myRole, $roomId]);
        $pdo->commit();
        echo json_encode(['status' => 'waiting']); exit;
    }

    // 相手が申請済み（$requested === $oppRole）→ 新ルーム作成
    $playersStmt = $pdo->prepare("SELECT * FROM room_players WHERE room_id=?");
    $playersStmt->execute([$roomId]);
    $hostPlayer = null; $guestPlayer = null;
    foreach ($playersStmt->fetchAll(PDO::FETCH_ASSOC) as $p) {
        if ($p['role'] === 'host') $hostPlayer = $p;
        else                        $guestPlayer = $p;
    }
    if (!$hostPlayer || !$guestPlayer) {
        $pdo->rollBack();
        echo json_encode(['error' => '対戦相手が見つかりません']); exit;
    }

    // 34枚ランダム生成（20 field + 7 host + 7 guest）
    $all            = getRandomEmojisPhp(34);
    $fieldEmojis    = array_slice($all,  0, 20);
    $hostHand       = array_slice($all, 20,  7);
    $guestHand      = array_slice($all, 27,  7);
    $hostHiddenIdx  = rand(0, 6);
    $guestHiddenIdx = rand(0, 6);

    $firstTurn = rand(0, 1) === 0 ? 'host' : 'guest';
    $deadline  = gmdate('Y-m-d H:i:s', time() + 60);
    $newRoomId = generateRoomId();

    $pdo->prepare(
        "INSERT INTO rooms (id, field_emojis, status, host_session, guest_session, current_turn, turn_deadline)
         VALUES (?, ?, 'draft', ?, ?, ?, ?)"
    )->execute([
        $newRoomId, json_encode($fieldEmojis),
        $hostPlayer['session_id'], $guestPlayer['session_id'],
        $firstTurn, $deadline,
    ]);

    $pdo->prepare(
        "INSERT INTO room_players (room_id, session_id, role, initial_hand, hidden_emoji)
         VALUES (?, ?, 'host', ?, ?)"
    )->execute([
        $newRoomId, $hostPlayer['session_id'],
        json_encode($hostHand), $hostHand[$hostHiddenIdx]['emoji'],
    ]);

    $pdo->prepare(
        "INSERT INTO room_players (room_id, session_id, role, initial_hand, hidden_emoji)
         VALUES (?, ?, 'guest', ?, ?)"
    )->execute([
        $newRoomId, $guestPlayer['session_id'],
        json_encode($guestHand), $guestHand[$guestHiddenIdx]['emoji'],
    ]);

    // 旧ルームに新room_idを記録
    $pdo->prepare("UPDATE rooms SET rematch_room_id=?, rematch_requested='both' WHERE id=?")
        ->execute([$newRoomId, $roomId]);

    $pdo->commit();

    // 自分向けレスポンス
    $myHand         = $myRole === 'host' ? $hostHand      : $guestHand;
    $myHiddenIdx    = $myRole === 'host' ? $hostHiddenIdx : $guestHiddenIdx;
    $oppHand        = $myRole === 'host' ? $guestHand     : $hostHand;
    $oppHiddenEmoji = $myRole === 'host'
        ? $guestHand[$guestHiddenIdx]['emoji']
        : $hostHand[$hostHiddenIdx]['emoji'];
    $oppHandMasked  = array_map(
        fn($c) => $c['emoji'] === $oppHiddenEmoji ? ['emoji'=>'?','name'=>'?','hidden'=>true] : $c,
        $oppHand
    );

    echo json_encode([
        'status'           => 'matched',
        'new_room_id'      => $newRoomId,
        'my_role'          => $myRole,
        'session_id'       => $sessionId,
        'initial_hand'     => $myHand,
        'hidden_idx'       => $myHiddenIdx,
        'field_emojis'     => $fieldEmojis,
        'opp_initial_hand' => $oppHandMasked,
        'current_turn'     => $firstTurn,
        'turn_deadline'    => $deadline . 'Z',
    ]);

} catch (\Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

// 既に作成済みの新ルームのデータを返す（相手が先に成立させたケース）
function echoMatchedData(PDO $pdo, string $newRoomId, string $sessionId, string $myRole): void {
    $newRoom = $pdo->prepare("SELECT * FROM rooms WHERE id=?");
    $newRoom->execute([$newRoomId]);
    $newRoom = $newRoom->fetch(PDO::FETCH_ASSOC);

    $myPlayer = $pdo->prepare("SELECT * FROM room_players WHERE room_id=? AND session_id=?");
    $myPlayer->execute([$newRoomId, $sessionId]);
    $myPlayer = $myPlayer->fetch(PDO::FETCH_ASSOC);

    $oppRole   = $myRole === 'host' ? 'guest' : 'host';
    $oppPlayer = $pdo->prepare("SELECT * FROM room_players WHERE room_id=? AND role=?");
    $oppPlayer->execute([$newRoomId, $oppRole]);
    $oppPlayer = $oppPlayer->fetch(PDO::FETCH_ASSOC);

    $myHand        = json_decode($myPlayer['initial_hand'] ?? '[]', true) ?? [];
    $myHiddenEmoji = $myPlayer['hidden_emoji'] ?? '';
    $myHiddenIdx   = 0;
    foreach ($myHand as $i => $card) {
        if ($card['emoji'] === $myHiddenEmoji) { $myHiddenIdx = $i; break; }
    }

    $oppHand        = json_decode($oppPlayer['initial_hand'] ?? '[]', true) ?? [];
    $oppHiddenEmoji = $oppPlayer['hidden_emoji'] ?? '';
    $oppHandMasked  = array_map(
        fn($c) => $c['emoji'] === $oppHiddenEmoji ? ['emoji'=>'?','name'=>'?','hidden'=>true] : $c,
        $oppHand
    );

    echo json_encode([
        'status'           => 'matched',
        'new_room_id'      => $newRoomId,
        'my_role'          => $myRole,
        'session_id'       => $sessionId,
        'initial_hand'     => $myHand,
        'hidden_idx'       => $myHiddenIdx,
        'field_emojis'     => json_decode($newRoom['field_emojis'] ?? '[]', true) ?? [],
        'opp_initial_hand' => $oppHandMasked,
        'current_turn'     => $newRoom['current_turn'],
        'turn_deadline'    => ($newRoom['turn_deadline'] ?? '') . 'Z',
    ]);
}

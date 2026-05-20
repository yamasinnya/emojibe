<?php
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if (file_exists(__DIR__ . '/db_config.php')) require_once __DIR__ . '/db_config.php';

$data      = json_decode(file_get_contents('php://input'), true) ?? [];
$roomId    = $data['room_id']    ?? '';
$sessionId = $data['session_id'] ?? '';
$pickedEmoji = $data['emoji']    ?? '';  // emoji char
$isAuto    = !empty($data['is_auto']);

if (!$roomId || !$sessionId || !$pickedEmoji) {
    echo json_encode(['error' => 'params required']); exit;
}

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->exec("SET time_zone = '+00:00'");
    $pdo->beginTransaction();

    $room = $pdo->prepare("SELECT * FROM rooms WHERE id = ? FOR UPDATE");
    $room->execute([$roomId]);
    $room = $room->fetch(PDO::FETCH_ASSOC);

    if (!$room || $room['status'] !== 'draft') {
        $pdo->rollBack();
        echo json_encode(['error' => 'ドラフト中ではありません']); exit;
    }

    // このプレイヤーの役割確認
    $me = $pdo->prepare("SELECT * FROM room_players WHERE room_id = ? AND session_id = ?");
    $me->execute([$roomId, $sessionId]);
    $me = $me->fetch(PDO::FETCH_ASSOC);
    if (!$me) { $pdo->rollBack(); echo json_encode(['error' => 'player not found']); exit; }

    $now = time();

    // タイムアウトチェック：相手のターンが時間切れなら自動取得
    if ($room['turn_deadline'] && strtotime($room['turn_deadline']) < $now) {
        $expiredTurn = $room['current_turn'];
        if ($expiredTurn !== $me['role']) {
            // 相手が時間切れ → 相手のための自動取得
            $expiredPlayer = $pdo->prepare(
                "SELECT * FROM room_players WHERE room_id = ? AND role = ?"
            );
            $expiredPlayer->execute([$roomId, $expiredTurn]);
            $expiredPlayer = $expiredPlayer->fetch(PDO::FETCH_ASSOC);

            $fieldEmojis   = json_decode($room['field_emojis'], true);
            $allPicked = [];
            $allPlayers = $pdo->prepare("SELECT picked_emojis FROM room_players WHERE room_id = ?");
            $allPlayers->execute([$roomId]);
            foreach ($allPlayers->fetchAll() as $p) {
                foreach (json_decode($p['picked_emojis'] ?? '[]', true) as $e) $allPicked[] = $e['emoji'];
            }
            $available = array_values(array_filter($fieldEmojis, fn($e) => !in_array($e['emoji'], $allPicked)));

            if (!empty($available)) {
                $autoEmoji   = $available[array_rand($available)];
                $turnCountQ = $pdo->prepare("SELECT COUNT(*) FROM draft_logs WHERE room_id=?");
                $turnCountQ->execute([$roomId]);
                $turnCount = (int)$turnCountQ->fetchColumn();

                $expiredPicked = json_decode($expiredPlayer['picked_emojis'] ?? '[]', true);
                $expiredPicked[] = $autoEmoji;
                $pdo->prepare("UPDATE room_players SET picked_emojis=? WHERE room_id=? AND role=?")
                    ->execute([json_encode($expiredPicked), $roomId, $expiredTurn]);
                $pdo->prepare(
                    "INSERT INTO draft_logs (room_id, session_id, turn_number, emoji, is_auto) VALUES (?,?,?,?,1)"
                )->execute([$roomId, $expiredPlayer['session_id'], $turnCount + 1, $autoEmoji['emoji']]);

                // ターン進行
                $room['current_turn'] = $me['role'];
                $turnCount++;
            }
        }
    }

    // 今が自分のターンか確認
    if ($room['current_turn'] !== $me['role']) {
        $pdo->rollBack();
        echo json_encode(['error' => '相手のターンです']); exit;
    }

    // フィールドにその絵文字があるか確認
    $fieldEmojis = json_decode($room['field_emojis'], true);
    $allPickedQ  = $pdo->prepare("SELECT picked_emojis FROM room_players WHERE room_id = ?");
    $allPickedQ->execute([$roomId]);
    $allTaken    = [];
    foreach ($allPickedQ->fetchAll() as $p) {
        foreach (json_decode($p['picked_emojis'] ?? '[]', true) as $e) $allTaken[] = $e['emoji'];
    }
    $emojiObj = null;
    foreach ($fieldEmojis as $fe) {
        if ($fe['emoji'] === $pickedEmoji && !in_array($fe['emoji'], $allTaken)) {
            $emojiObj = $fe; break;
        }
    }
    if (!$emojiObj) {
        $pdo->rollBack();
        echo json_encode(['error' => 'その絵文字は取れません']); exit;
    }

    // 自分の picked_emojis に追加
    $myPicked   = json_decode($me['picked_emojis'] ?? '[]', true);
    $myPicked[] = $emojiObj;
    $pdo->prepare("UPDATE room_players SET picked_emojis=? WHERE room_id=? AND session_id=?")
        ->execute([json_encode($myPicked), $roomId, $sessionId]);

    // ターン番号記録
    $turnNumQ = $pdo->prepare("SELECT COUNT(*) FROM draft_logs WHERE room_id=?");
    $turnNumQ->execute([$roomId]);
    $turnNum = (int)$turnNumQ->fetchColumn() + 1;

    $pdo->prepare(
        "INSERT INTO draft_logs (room_id, session_id, turn_number, emoji, is_auto) VALUES (?,?,?,?,?)"
    )->execute([$roomId, $sessionId, $turnNum, $pickedEmoji, $isAuto ? 1 : 0]);

    // 次のターンへ
    $nextTurn = $me['role'] === 'host' ? 'guest' : 'host';
    $deadline = date('Y-m-d H:i:s', $now + 30);

    // 12ターン（各プレイヤー6回）で終了
    if ($turnNum >= 12) {
        $handDeadline = date('Y-m-d H:i:s', $now + 180); // 3分
        $pdo->prepare(
            "UPDATE rooms SET status='hand', hand_deadline=?, turn_deadline=NULL WHERE id=?"
        )->execute([$handDeadline, $roomId]);
        $newStatus = 'hand';
    } else {
        $pdo->prepare(
            "UPDATE rooms SET current_turn=?, turn_deadline=? WHERE id=?"
        )->execute([$nextTurn, $deadline, $roomId]);
        $newStatus = 'draft';
    }

    $pdo->commit();

    echo json_encode([
        'ok'           => true,
        'status'       => $newStatus,
        'current_turn' => $nextTurn,
        'turn_number'  => $turnNum + 1,
        'turn_deadline'=> $deadline . 'Z',
    ]);
} catch (\Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

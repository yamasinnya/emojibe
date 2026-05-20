<?php
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

if (file_exists(__DIR__ . '/db_config.php')) require_once __DIR__ . '/db_config.php';

$roomId    = $_GET['room_id']    ?? '';
$sessionId = $_GET['session_id'] ?? '';
if (!$roomId || !$sessionId) { echo json_encode(['error' => 'params required']); exit; }

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->exec("SET time_zone = '+00:00'");

    $room = $pdo->prepare("SELECT * FROM rooms WHERE id = ?");
    $room->execute([$roomId]);
    $room = $room->fetch(PDO::FETCH_ASSOC);
    if (!$room) { echo json_encode(['error' => '部屋なし']); exit; }

    // プレイヤー情報取得
    $players = $pdo->prepare("SELECT * FROM room_players WHERE room_id = ?");
    $players->execute([$roomId]);
    $players = $players->fetchAll(PDO::FETCH_ASSOC);

    $me  = null; $opp = null;
    foreach ($players as $p) {
        if ($p['session_id'] === $sessionId) $me  = $p;
        else                                  $opp = $p;
    }
    if (!$me) { echo json_encode(['error' => 'session not found']); exit; }

    $myRole  = $me['role'];
    $oppRole = $myRole === 'host' ? 'guest' : 'host';

    // フィールド絵文字に「誰が取ったか」を付与
    $fieldEmojis  = json_decode($room['field_emojis'] ?? '[]', true) ?? [];
    $myPicked     = json_decode($me['picked_emojis'] ?? '[]', true) ?? [];
    $oppPicked    = $opp ? (json_decode($opp['picked_emojis'] ?? '[]', true) ?? []) : [];
    $myEmojis     = array_column($myPicked, 'emoji');
    $oppEmojis    = array_column($oppPicked, 'emoji');

    $enrichedField = array_map(function($e) use ($myEmojis, $oppEmojis, $myRole, $oppRole) {
        $e['taken_by'] = in_array($e['emoji'], $myEmojis)  ? $myRole
                       : (in_array($e['emoji'], $oppEmojis) ? $oppRole : null);
        return $e;
    }, $fieldEmojis);

    // ターン番号（ドラフトログで集計）
    $turnNum = $pdo->prepare("SELECT COUNT(*) FROM draft_logs WHERE room_id = ?");
    $turnNum->execute([$roomId]);
    $turnNumber = (int)$turnNum->fetchColumn() + 1;

    // 相手の初期手札（非公開カードをマスク）
    $oppHandRaw      = $opp ? ($opp['initial_hand'] ?? '[]') : '[]';
    $oppFullHand     = json_decode($oppHandRaw, true) ?? [];
    $oppHiddenEmoji  = $opp ? ($opp['hidden_emoji'] ?? '') : '';
    $oppHandMasked   = array_map(function($card) use ($oppHiddenEmoji) {
        return ($card['emoji'] === $oppHiddenEmoji)
            ? ['emoji' => '?', 'name' => '?', 'hidden' => true]
            : $card;
    }, $oppFullHand);

    $response = [
        'status'           => $room['status'],
        'my_role'          => $myRole,
        'current_turn'     => $room['current_turn'],
        'turn_deadline'    => $room['turn_deadline'] ? $room['turn_deadline'] . 'Z' : null,
        'hand_deadline'    => $room['hand_deadline']  ? $room['hand_deadline']  . 'Z' : null,
        'turn_number'      => $turnNumber,
        'field_emojis'     => $enrichedField,
        'opp_picked'       => $oppPicked,
        'my_picked'        => $myPicked,
        'opp_initial_hand' => $oppHandMasked,
    ];

    // 採点済み結果（status=done のとき）
    if ($room['status'] === 'done' || $room['status'] === 'scoring') {
        $myResults  = [];
        $oppResults = [];
        if ($opp) {
            $logs = $pdo->prepare(
                "SELECT session_id, role_name, emojis, ai_score, ai_comment
                 FROM game_logs WHERE room_id = ? ORDER BY id"
            );
            $logs->execute([$roomId]);
            foreach ($logs->fetchAll(PDO::FETCH_ASSOC) as $log) {
                $entry = ['role_name'=>$log['role_name'],'emojis'=>$log['emojis'],
                          'score'=>$log['ai_score'],'comment'=>$log['ai_comment']];
                if ($log['session_id'] === $sessionId) $myResults[]  = $entry;
                else                                    $oppResults[] = $entry;
            }
        }

        $myTotal  = array_sum(array_column($myResults, 'score'));
        $oppTotal = array_sum(array_column($oppResults, 'score'));
        $winner   = $myTotal > $oppTotal ? 'me' : ($myTotal < $oppTotal ? 'them' : 'draw');

        $response['my_results']  = $myResults;
        $response['opp_results'] = $oppResults;
        $response['my_total']    = $myTotal;
        $response['opp_total']   = $oppTotal;
        $response['winner']      = count($oppResults) > 0 ? $winner : null;
    }

    echo json_encode($response);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

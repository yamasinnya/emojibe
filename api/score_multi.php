<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if (file_exists(__DIR__ . '/db_config.php')) require_once __DIR__ . '/db_config.php';

$data      = json_decode(file_get_contents('php://input'), true) ?? [];
$roomId    = $data['room_id']    ?? '';
$sessionId = $data['session_id'] ?? '';
$roles     = $data['roles']      ?? [];

if (!$roomId || !$sessionId || empty($roles)) {
    echo json_encode(['error' => 'Invalid input']); exit;
}

$apiKey = defined('ANTHROPIC_API_KEY') ? ANTHROPIC_API_KEY : getenv('ANTHROPIC_API_KEY');

function scoreRole($role, $apiKey) {
    $emojisWithNames = implode('、', array_map(
        fn($e, $n) => "{$e}({$n})",
        (array)$role['emojis'],
        (array)($role['emoji_names'] ?? $role['emojis'])
    ));
    $roleName = mb_substr($role['role_name'], 0, 30);

    if (!$apiKey) return ['score' => 3, 'comment' => 'なかなかいい組み合わせ！'];

    $prompt = <<<PROMPT
以下の絵文字の組み合わせと、プレイヤーがつけた「役名」の噛み合い度を採点してください。

絵文字：{$emojisWithNames}
役名：{$roleName}

採点基準（絵文字単体でなく、役名との組み合わせで判断してください）：
- カテゴリが合ってるだけ（動物3匹など）：1〜2点
- 具体的な状況・情景が浮かぶ：3〜4点
- 固有名詞・作品名・人名で納得感あり：5〜7点
- 誰もが「確かに！」と膝を打つ：8〜10点
- 役名と関係ない絵文字が混じってる：-1〜-3点

以下のJSON形式のみで返してください（他のテキスト不要）：
{"score": 数字, "comment": "一言コメント（日本語、20文字以内）"}
PROMPT;

    $payload = json_encode([
        'model' => 'claude-haiku-4-5-20251001',
        'max_tokens' => 100,
        'messages' => [['role' => 'user', 'content' => $prompt]]
    ]);

    $ctx = stream_context_create(['http' => [
        'method'        => 'POST',
        'header'        => implode("\r\n", [
            'Content-Type: application/json',
            'X-API-Key: ' . $apiKey,
            'anthropic-version: 2023-06-01',
        ]),
        'content'       => $payload,
        'ignore_errors' => true,
        'timeout'       => 15,
    ]]);
    $res = file_get_contents('https://api.anthropic.com/v1/messages', false, $ctx);
    if ($res === false) return ['score' => 3, 'comment' => '採点できませんでした'];

    $api  = json_decode($res, true);
    $text = $api['content'][0]['text'] ?? '';
    $m    = [];
    if (preg_match('/\{[\s\S]*?\}/', $text, $m)) {
        $r = json_decode($m[0], true);
        if (isset($r['score'])) return $r;
    }
    return ['score' => 3, 'comment' => '面白い組み合わせ！'];
}

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->exec("SET time_zone = '+00:00'");

    // 各役を採点して game_logs に保存
    $myResults = [];
    foreach ($roles as $role) {
        $result    = scoreRole($role, $apiKey);
        $emojiStr  = is_array($role['emojis']) ? implode('', $role['emojis']) : $role['emojis'];
        $pdo->prepare(
            "INSERT INTO game_logs (session_id, role_name, emojis, ai_score, ai_comment, room_id)
             VALUES (?, ?, ?, ?, ?, ?)"
        )->execute([$sessionId, $role['role_name'], $emojiStr, $result['score'], $result['comment'], $roomId]);
        $myResults[] = array_merge($role, $result);
    }

    // 採点済みフラグを立てる
    $pdo->prepare("UPDATE room_players SET ready_for_score=1 WHERE room_id=? AND session_id=?")
        ->execute([$roomId, $sessionId]);

    // 両者が採点済みか確認
    $readyCount = $pdo->prepare("SELECT COUNT(*) FROM room_players WHERE room_id=? AND ready_for_score=1");
    $readyCount->execute([$roomId]);
    $bothReady = (int)$readyCount->fetchColumn() >= 2;

    if ($bothReady) {
        $pdo->prepare("UPDATE rooms SET status='done' WHERE id=?")->execute([$roomId]);
    } else {
        $pdo->prepare("UPDATE rooms SET status='scoring' WHERE id=?")->execute([$roomId]);
    }

    echo json_encode([
        'my_results'  => $myResults,
        'opponent_done' => $bothReady,
    ]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

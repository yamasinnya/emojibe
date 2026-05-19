<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (file_exists(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || empty($data['emojis']) || empty($data['role_name'])) {
    echo json_encode(['error' => 'Invalid input']);
    exit;
}

$emojiWithNames = '';
if (!empty($data['emoji_names'])) {
    $emojiWithNames = implode('、', array_map(
        fn($e, $n) => "{$e}({$n})",
        $data['emojis'],
        $data['emoji_names']
    ));
} else {
    $emojiWithNames = implode('', $data['emojis']);
}
$roleName = mb_substr($data['role_name'], 0, 30);

$prompt = <<<PROMPT
以下の絵文字の組み合わせと、プレイヤーがつけた「役名」の噛み合い度を採点してください。

絵文字：{$emojiWithNames}
役名：{$roleName}

採点基準（絵文字単体でなく、役名との組み合わせで判断してください）：
- カテゴリが合ってるだけ（動物3匹など）：1〜2点
- 具体的な状況・情景が浮かぶ：3〜4点
- 固有名詞・作品名・人名で納得感あり：5〜7点
- 誰もが「確かに！」と膝を打つ：8〜10点
- 役名と関係ない絵文字が混じってる：-1〜-3点

AIが知らないマイナーネタは低得点で構いません（御愛嬌）。

以下のJSON形式のみで返してください（他のテキスト不要）：
{"score": 数字, "comment": "一言コメント（日本語、20文字以内）"}
PROMPT;

$apiKey = defined('ANTHROPIC_API_KEY') ? ANTHROPIC_API_KEY : getenv('ANTHROPIC_API_KEY');
if (!$apiKey) {
    echo json_encode(['score' => 3, 'comment' => 'なかなかいい組み合わせ！']);
    exit;
}

$payload = json_encode([
    'model' => 'claude-haiku-4-5-20251001',
    'max_tokens' => 100,
    'messages' => [['role' => 'user', 'content' => $prompt]]
]);

$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => implode("\r\n", [
            'Content-Type: application/json',
            'X-API-Key: ' . $apiKey,
            'anthropic-version: 2023-06-01',
        ]),
        'content' => $payload,
        'ignore_errors' => true,
        'timeout' => 15,
    ]
]);

$response = file_get_contents('https://api.anthropic.com/v1/messages', false, $context);
if ($response === false) {
    echo json_encode(['score' => 3, 'comment' => '採点できませんでした']);
    exit;
}

$apiData = json_decode($response, true);
$text = $apiData['content'][0]['text'] ?? '';
$match = [];
if (preg_match('/\{[\s\S]*?\}/', $text, $match)) {
    $result = json_decode($match[0], true);
    if (isset($result['score'])) {
        echo json_encode($result);
        exit;
    }
}

echo json_encode(['score' => 3, 'comment' => '面白い組み合わせ！']);

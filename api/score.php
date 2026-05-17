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

if (!$data || empty($data['emojis']) || empty($data['role_name'])) {
    echo json_encode(['error' => 'Invalid input']);
    exit;
}

$emojiList = implode('', $data['emojis']);
$emojiWithNames = '';
if (!empty($data['emoji_names'])) {
    $pairs = array_map(null, $data['emojis'], $data['emoji_names']);
    $emojiWithNames = implode('、', array_map(fn($p) => "{$p[0]}({$p[1]})", $pairs));
} else {
    $emojiWithNames = $emojiList;
}
$roleName = mb_substr($data['role_name'], 0, 30);

$prompt = <<<PROMPT
以下の絵文字の組み合わせと役名を採点してください。

絵文字：{$emojiWithNames}
役名：{$roleName}

採点基準：
- カテゴリ共通（動物・食べ物など）：1〜2点
- 情景・状況・雰囲気：3〜4点
- 固有名詞・作品名・人名：5〜7点
- 完璧で誰もが納得する組み合わせ：8〜10点
- 関係ない絵文字が混じっている：-1〜-3点

以下のJSON形式のみで返してください（他のテキストは不要）：
{"score": 数字, "comment": "一言コメント（日本語、20文字以内）"}
PROMPT;

$apiKey = getenv('ANTHROPIC_API_KEY');
if (!$apiKey) {
    // フォールバック：APIキーがない環境用
    echo json_encode(['content' => [['text' => '{"score": 3, "comment": "なかなかいい組み合わせ！"}']]]);
    exit;
}

$payload = json_encode([
    'model' => 'claude-haiku-4-5-20251001',
    'max_tokens' => 150,
    'messages' => [
        ['role' => 'user', 'content' => $prompt]
    ]
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
    http_response_code(500);
    echo json_encode(['error' => 'API request failed']);
    exit;
}

echo $response;

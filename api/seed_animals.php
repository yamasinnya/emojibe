<?php
// 動物カテゴリ 3種組み合わせ一括登録スクリプト
// アクセス: /api/seed_animals.php?token=emojibe2026
set_time_limit(300);
header('Content-Type: text/plain; charset=utf-8');

$token = $_GET['token'] ?? '';
if ($token !== 'emojibe2026') {
    http_response_code(403);
    exit("unauthorized\n");
}

if (!file_exists(__DIR__ . '/db_config.php')) {
    exit("db_config.php not found\n");
}
require_once __DIR__ . '/db_config.php';

$pdo = new PDO(
    'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
    DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$animals = [
    ['🐶', '犬'], ['🐱', '猫'], ['🐭', 'ネズミ'], ['🐹', 'ハムスター'], ['🐰', 'ウサギ'],
    ['🦊', 'キツネ'], ['🦝', 'アライグマ'], ['🐻', 'クマ'], ['🐼', 'パンダ'], ['🐨', 'コアラ'],
    ['🐯', 'トラ'], ['🦁', 'ライオン'], ['🐄', 'ウシ'], ['🐷', 'ブタ'], ['🐑', 'ヒツジ'],
    ['🐐', 'ヤギ'], ['🐪', 'ラクダ'], ['🦒', 'キリン'], ['🐘', 'ゾウ'], ['🦏', 'サイ'],
    ['🦛', 'カバ'], ['🐴', 'ウマ'], ['🐒', 'サル'], ['🦍', 'ゴリラ'], ['🐋', 'クジラ'],
    ['🐬', 'イルカ'], ['🦦', 'カワウソ'], ['🦇', 'コウモリ'], ['🦨', 'スカンク'], ['🦘', 'カンガルー'],
    ['🐿️', 'リス'], ['🦔', 'ハリネズミ'],
    ['🐔', 'ニワトリ'], ['🐧', 'ペンギン'], ['🐦', '青い鳥'], ['🦉', 'フクロウ'], ['🦅', 'ワシ'],
    ['🦆', 'アヒル'], ['🦩', 'フラミンゴ'], ['🦚', 'クジャク'], ['🦜', 'オウム'], ['🦢', '白鳥'],
    ['🦄', 'ユニコーン'],
    ['🐍', 'ヘビ'], ['🦎', 'トカゲ'], ['🐊', 'ワニ'], ['🐢', 'カメ'], ['🐸', 'カエル'], ['🐉', 'ドラゴン'],
    ['🐟', '魚'], ['🐡', 'フグ'], ['🦈', 'サメ'], ['🐙', 'タコ'], ['🦀', 'カニ'], ['🦐', 'エビ'], ['🐌', 'カタツムリ'],
    ['🦋', 'チョウ'], ['🐛', '毛虫'], ['🐜', 'アリ'], ['🐝', 'ハチ'], ['🐞', 'テントウムシ'],
    ['🦗', 'バッタ'], ['🕷️', 'クモ'], ['🦂', 'サソリ'],
    ['🦕', '恐竜（長首）'], ['🦖', '恐竜（肉食）'],
];

echo "=== 動物3種組み合わせ シード ===\n";
echo count($animals) . "匹\n\n";

// Step 1: emojis マスタへ登録（未登録のみ）
$existing = $pdo->query("SELECT emoji FROM emojis WHERE category='動物'")->fetchAll(PDO::FETCH_COLUMN);
$existingSet = array_flip($existing);
$toInsert = array_values(array_filter($animals, fn($a) => !isset($existingSet[$a[0]])));

if ($toInsert) {
    $stmt = $pdo->prepare("INSERT INTO emojis (emoji, name, category) VALUES (?, ?, '動物')");
    foreach ($toInsert as $a) {
        $stmt->execute([$a[0], $a[1]]);
    }
    echo count($toInsert) . "匹をemojisマスタに追加\n";
} else {
    echo "emojisマスタ：登録済み\n";
}

// Step 2: emoji ID を取得（DB登録順）
$rows = $pdo->query(
    "SELECT id, emoji FROM emojis WHERE category='動物' ORDER BY id"
)->fetchAll(PDO::FETCH_ASSOC);
$emojiIds = array_column($rows, 'id', 'emoji');
$emojiList = array_keys($emojiIds);
$n = count($emojiList);
echo "{$n}匹のIDを取得\n\n";

// Step 3: すでに登録済みか確認
$alreadyCount = (int)$pdo->query("SELECT COUNT(*) FROM roles WHERE score=2")->fetchColumn();
$force = isset($_GET['force']);
if ($alreadyCount > 40000 && !$force) {
    echo "すでに {$alreadyCount} ロール登録済み。再実行は ?token=emojibe2026&force=1\n";
    exit;
}

// Step 4: C(n, 3) の全組み合わせを生成してバッチ挿入
echo "組み合わせ生成中...\n";
$combos = [];
for ($i = 0; $i < $n - 2; $i++) {
    for ($j = $i + 1; $j < $n - 1; $j++) {
        for ($k = $j + 1; $k < $n; $k++) {
            $combos[] = [$i, $j, $k];
        }
    }
}
$total = count($combos);
echo "{$total}通りの組み合わせを生成\n\n";

$pdo->beginTransaction();

$batchSize = 500;
$insertedRoles = 0;
$reValues = [];

for ($b = 0; $b < $total; $b += $batchSize) {
    $batch = array_slice($combos, $b, $batchSize);

    // roles にバッチ挿入（name = 絵文字3個連結、score = 2）
    $roleVals = implode(',', array_map(
        fn($c) => "('" . $emojiList[$c[0]] . $emojiList[$c[1]] . $emojiList[$c[2]] . "', 2)",
        $batch
    ));
    $pdo->exec("INSERT INTO roles (name, score) VALUES {$roleVals}");
    $firstId = (int)$pdo->lastInsertId();

    // role_emojis 用バッファに積む（IDは firstId + offset で確定）
    foreach ($batch as $offset => $c) {
        $rid = $firstId + $offset;
        $reValues[] = "({$rid},{$emojiIds[$emojiList[$c[0]]]})";
        $reValues[] = "({$rid},{$emojiIds[$emojiList[$c[1]]]})";
        $reValues[] = "({$rid},{$emojiIds[$emojiList[$c[2]]]})";
    }

    // role_emojis は 3000件ごとにフラッシュ
    if (count($reValues) >= 3000) {
        $pdo->exec("INSERT INTO role_emojis (role_id, emoji_id) VALUES " . implode(',', $reValues));
        $reValues = [];
    }

    $insertedRoles += count($batch);
    echo "  roles: {$insertedRoles}/{$total}\n";
    flush();
}

// 残りの role_emojis をフラッシュ
if ($reValues) {
    $pdo->exec("INSERT INTO role_emojis (role_id, emoji_id) VALUES " . implode(',', $reValues));
}

$pdo->commit();

echo "\n完了！\n";
echo "roles: {$insertedRoles}行\n";
echo "role_emojis: " . ($insertedRoles * 3) . "行\n";

# えもじべ — 仕様書・Claude Code引継ぎファイル

## プロジェクト概要

絵文字を取り合って、意外な共通点で役を作る対戦ゲーム。
フェーズ1はソロモード（タイムアタック）のみ。データを蓄積しながら育てる。

**名前：** えもじべ（emojibe）
**由来：** emoji + jibe（一致する・合う）
**キャッチコピー：** 絵文字で役を作る取り合いゲーム

---

## 世界観・デザイン方針

**舞台：** 小学校の机の上
**イメージ：** ノートの上にシールを並べて取り合う
**UI要素として使える小道具：** 鉛筆、消しゴム、定規、付箋、スタンプ、方眼ノート、手帳

**配色：**
- 背景：木目テクスチャ（机）
- 場：方眼紙ノート（白・薄ベージュ）
- 自分の手帳：緑系
- 相手の手帳：赤系
- シール：白・薄黄色、角丸、少し傾いて貼られてる

**参考ファイル：**
- `emojibe_field.html`（Phaser.jsで作ったバトルフィールドのプロトタイプ）
- このイメージを縦長スマホ向けに再構成する

**レイアウト（縦長スマホ）：**
```
┌─────────────────┐
│   相手の手帳      │
├─────────────────┤
│                 │
│  場のノート       │
│  （シール20枚）   │
│                 │
├─────────────────┤
│   自分の手帳      │
└─────────────────┘
```

---

## 技術スタック

- **フロント：** Phaser.js（CDN）+ HTML/JS
- **サーバー：** PHP（素のPHP、フレームワークなし）
- **DB：** MySQL（Lolipopのもの）
- **APIキー：** サーバー側PHPで管理（フロントに露出させない）
- **デプロイ：** GitHub Actions → LolipopへFTP自動転送
- **FTP情報：** GitHub Secretsで管理

### GitHub Secrets に登録するもの
- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `ANTHROPIC_API_KEY`

### CDN
```html
<script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
```

---

## ファイル構成（推奨）

```
emojibe/
├── index.html          # トップ画面
├── game.html           # ゲーム本体
├── js/
│   ├── scenes/
│   │   ├── TopScene.js      # トップ画面
│   │   ├── FieldScene.js    # バトルフィールド
│   │   ├── HandScene.js     # 手帳・役作り画面
│   │   └── ResultScene.js   # 採点・結果画面
│   ├── emojis.js       # 絵文字リスト定義
│   └── config.js       # Phaser設定
├── api/
│   ├── score.php        # Claude APIで採点
│   └── save_role.php    # 役データを保存
└── .github/
    └── workflows/
        └── deploy.yml   # FTP自動デプロイ
```

---

## DBテーブル設計

```sql
-- 絵文字マスタ
CREATE TABLE emojis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emoji VARCHAR(10) NOT NULL,
  name VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL
);

-- 役テーブル
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  score INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 役と絵文字の中間テーブル
CREATE TABLE role_emojis (
  role_id INT NOT NULL,
  emoji_id INT NOT NULL,
  PRIMARY KEY (role_id, emoji_id)
);

-- ゲームログ
CREATE TABLE game_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player VARCHAR(50),
  role_id INT,
  raw_input VARCHAR(200),
  ai_score INT,
  ai_comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 絵文字リスト（初期セット・約280種）

Unicode 12.0以前縛り（2019年まで）。`emojis.js`に定義。
添付の`絵文字リスト.txt`を参照。

カテゴリ：動物、植物、果物、野菜、料理、飲み物、道具、乗り物、建物、人、国旗、天気、天体、音楽、スポーツ、PC・通信、星座、顔・感情 など

---

## ゲームの流れ（フェーズ1：ソロモード）

```
1. トップ画面
   └─ 「ソロモードで遊ぶ」ボタン

2. バトルフィールド画面（FieldScene）
   ├─ 場のノートに絵文字シール20枚をランダム配置
   ├─ 自分の手帳に手札7枚を配る
   ├─ 1枚を裏向きにして非公開にする
   ├─ 「準備OK」ボタンで開始
   └─ 6ターン繰り返す：
       ・場のシールを1枚タップして取る
       ・手帳に追加される

3. 役作り画面（HandScene）
   ├─ 手帳の上にシールが並んでいる
   ├─ シールをドラッグして役のグループを作る
   ├─ 役名をテキスト入力（鉛筆で手書き風）
   ├─ 「採点！」スタンプボタン
   └─ 複数役を宣言可能（蛇足はマイナス）

4. 採点画面（ResultScene）
   ├─ Claude APIが役ごとに採点・コメント
   ├─ 付箋風に点数が貼られる演出
   ├─ 合計スコア表示
   ├─ 役データをDBに保存
   └─ 「もう一度」「トップへ」ボタン
```

---

## 採点ルール

| 役の種類 | 点数目安 |
|---------|---------|
| カテゴリ共通（動物、食べ物など） | 1〜2点 |
| 情景・状況（失恋した夜など） | 3〜4点 |
| 固有名詞・作品名（ロミジュリなど） | 5〜7点 |
| 完璧な組み合わせ（誰もが納得） | 8〜10点 |
| 蛇足な絵文字を混ぜた場合 | -1〜-3点 |

### Claude APIへの採点プロンプト（score.php）

```
以下の絵文字の組み合わせと役名を採点してください。

絵文字：{emoji_list}
役名：{role_name}

採点基準：
- カテゴリ共通（動物・食べ物など）：1〜2点
- 情景・状況・雰囲気：3〜4点
- 固有名詞・作品名・人名：5〜7点
- 完璧で誰もが納得する組み合わせ：8〜10点
- 関係ない絵文字が混じっている：-1〜-3点

以下のJSON形式で返してください：
{"score": 数字, "comment": "一言コメント（日本語、20文字以内）"}
```

---

## 採点API（score.php）

```php
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$data = json_decode(file_get_contents('php://input'), true);
$emojis = $data['emojis'];
$role_name = $data['role_name'];

$prompt = "絵文字：" . implode('', $emojis) . "\n役名：" . $role_name . "\n...（上記プロンプト）";

$response = file_get_contents('https://api.anthropic.com/v1/messages', false, stream_context_create([
  'http' => [
    'method' => 'POST',
    'header' => "Content-Type: application/json\r\nX-API-Key: " . getenv('ANTHROPIC_API_KEY') . "\r\nanthropicversion: 2023-06-01\r\n",
    'content' => json_encode([
      'model' => 'claude-sonnet-4-20250514',
      'max_tokens' => 200,
      'messages' => [['role' => 'user', 'content' => $prompt]]
    ])
  ]
]));

echo $response;
```

---

## GitHub Actions デプロイ設定（deploy.yml）

```yaml
name: Deploy to Lolipop

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: FTP Deploy
        uses: SamKirkland/FTP-Deploy-Action@v4.3.4
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          local-dir: ./
          server-dir: /public_html/emojibe/
```

---

## Claude Codeへの最初の指示

```
このプロジェクトは「えもじべ」というゲームです。
リポジトリをcloneして、仕様書（emojibe_handoff.md）を読んでから作業してください。

まず以下の順序でセットアップしてください：

1. ファイル構成を仕様書通りに作成する
2. emojis.jsに絵文字リストを定義する（添付の絵文字リスト.txtを参照）
3. Phaser.jsでFieldSceneを実装する
   - emojibe_field.htmlのデザインを縦長スマホ向けに再構成
   - 場のノート（方眼紙）に絵文字シール20枚をランダム配置
   - 手札7枚を配る
   - シールをタップで取る動作
4. .github/workflows/deploy.ymlを作成する
5. git push

技術方針：
- Phaser.js（CDN読み込み）+ 素のJS
- フレームワークなし、Node.js不要
- 自分で読めて直せるシンプルなコード
- スマホ縦長（375×812px基準）
- FTP情報・APIキーはGitHub Secretsから取得

世界観：
- 小学校の机の上
- ノート・手帳・シール・鉛筆・付箋
- 参考：emojibe_field.html（添付）
```

---

## 今後のフェーズ

**フェーズ1（今回）**
- ソロモード
- AI採点
- データ蓄積

**フェーズ2**
- 対人戦モード（リアルタイムマッチング）
- COMモード（蓄積データで思考エンジン）
- 感想戦AI

**フェーズ3（③への展開）**
- 絵文字を地域の名物に差し替え
- 豊後高田版・全国版
- デジ活・RMO文脈での活用

---

*作成：2026年5月*
*制作者：やまし*
*えもじべ = emoji + jibe（一致する・合う）*

# えもじべ — CLAUDE.md

Claude Codeがこのプロジェクトで作業するための指示書。
セッション開始時に必ず読むこと。

---

## プロジェクト概要

**名前：** えもじべ（emojibe）
**由来：** emoji + jibe（一致する・合う）
**内容：** 絵文字を取り合って役名をつけ、AIに採点してもらう対戦ゲーム
**現状：** フェーズ1（ソロモード）ほぼ完成、データ蓄積中

---

## 技術スタック

- **フロント：** Phaser.js 3.60.0（CDN）+ 素のJS、フレームワークなし
- **サーバー：** 素のPHP（フレームワークなし）
- **DB：** MySQL on Lolipop（LAA1551526-emojibe）
- **デプロイ：** GitHub Actions → LolipopへFTP自動転送
- **本番URL：** https://yama.chips.jp/emojibe/

### CDN
```html
<script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
```

### APIキー管理
- `ANTHROPIC_API_KEY` はGitHub Secretsで管理
- PHPサーバー側でのみ使用（フロントに露出させない）
- FTP情報もGitHub Secretsで管理

---

## ファイル構成

```
src/
├── index.html              # トップ画面（素のHTML、Phaserなし）
├── game.html               # ゲーム本体（Phaser読み込み）
├── js/
│   ├── emojis.js           # 絵文字リスト定義（約280種、Unicode 12.0以前）
│   ├── config.js           # Phaser設定
│   └── scenes/
│       ├── BootScene.js    # 起動処理
│       ├── TopScene.js     # タイトル画面
│       ├── FieldScene.js   # バトルフィールド（シール取り合い）
│       ├── HandScene.js    # 手帳・役作り画面
│       └── ResultScene.js  # 採点・結果画面
├── api/
│   └── score.php           # Claude APIで採点・DB保存
└── .github/
    └── workflows/
        └── deploy.yml      # FTP自動デプロイ
```

---

## DBテーブル構成（現在）

### game_logs（メインテーブル）
```sql
CREATE TABLE game_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  emojis VARCHAR(200) NOT NULL,
  ai_score INT NOT NULL,
  ai_comment VARCHAR(200) NOT NULL,
  player_name VARCHAR(50) DEFAULT NULL,  -- 8点以上のみ登録
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### emojis（マスタ、現在は未使用）
```sql
CREATE TABLE emojis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emoji VARCHAR(10) NOT NULL,
  name VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL
);
```

**注意：** roles・role_emojisテーブルは使用しない方針。事前登録は廃止済み。

---

## ゲームの流れ

```
1. index.html（トップ）
   └─ 「ソロモードで遊ぶ」→ game.html

2. FieldScene（シール取り合い）
   ├─ 場のノートに絵文字シール20枚をランダム配置
   ├─ 手札7枚を配る（1枚は裏向き非公開）
   ├─ 「準備OK」で開始
   └─ 6ターン：場のシールをタップして取る
      ※手帳のシールをタップで場に戻せる

3. HandScene（役作り）
   ├─ 手帳のシールをドラッグしてグループを作る
   ├─ 役名をテキスト入力
   ├─ 役の申請は最大3個まで
   ├─ 役の追加・削除が可能
   └─ 「採点！」ボタン

4. ResultScene（採点・結果）
   ├─ Claude APIが役ごとに採点・コメント
   ├─ 合計スコア表示
   ├─ 8点以上で「殿堂入り」→ 名前登録を促す（ゲームセンター方式）
   └─ 「もう一度」「トップへ」ボタン
```

---

## 採点ルール（score.php）

| 役の種類 | 点数 |
|---------|------|
| カテゴリが合ってるだけ | 1〜2点 |
| 具体的な状況・情景・雰囲気 | 3〜4点 |
| 固有名詞・作品名・人名で納得感あり | 5〜7点 |
| 誰もが「確かに！」と膝を打つ完璧な組み合わせ | 8〜10点 |
| 関係ない絵文字が混じってる | -1〜-3点 |

**採点の考え方：**
- 絵文字単体ではなく「絵文字×役名の噛み合い度」で採点
- AIが知らないマイナーネタは低得点で正解（御愛嬌）
- 外部検索は不要・不使用

---

## デザイン方針

**世界観：** 小学校の机の上、ノートにシールを貼って取り合う
**配色：**
- 背景：木目テクスチャ（`#2a1a0a`）
- 場：方眼紙ノート（白・薄ベージュ `#f8f4e8`）
- ボタン：ゴールド系（`#d4a853`）
- 文字：ブラウン系（`#4a3520`）

**絵文字表示：** Twemojiを使用（CC BY 4.0、クレジット表記済み）
**対象画面：** スマホ縦長（375×812px基準）

---

## 開発ルール

1. **シンプルに保つ** — フレームワーク不要、Node.js不要、自分で読めて直せるコード
2. **修正前は必ずgit commit** — デグレ防止
3. **キャッシュ対策** — HTMLのscriptタグに`?v=数字`をつける（変更のたびに数字を上げる）
4. **APIキーはPHP側のみ** — JSに書かない、コードに直書きしない
5. **DBはgame_logsだけ使う** — rolesテーブルは触らない

---

## 今後のフェーズ

**フェーズ1（現在）**
- ソロモード完成
- AI採点・データ蓄積

**フェーズ2**
- 対人戦モード
- COMモード（蓄積データで思考エンジン）
- 感想戦AI
- エラーログ収集（JSエラーをPHP経由で保存）

**フェーズ3**
- 絵文字を地域の名物に差し替え（豊後高田版・全国版）
- デジ活・RMO文脈での活用

---

*作成：2026年5月*
*制作者：やまし*

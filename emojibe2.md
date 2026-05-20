# えもじべ フェーズ2 設計書
## 対人戦モード（ウィンチェスタードラフト式）

*作成：2026年5月*
*制作者：やまし*

---

## 概要

フェーズ1（ソロモード）で確立したAI採点の仕組みをベースに、
2人がリアルタイムで絵文字を取り合う対人戦モードを追加する。

**所要時間：約10分**
**通信方式：3秒ポーリング（WebSocket不使用、ロリポップで動作）**
**通知：ゲーム外（LINEなど）で連絡し合う前提**

---

## ゲームの流れ

```
1. 対戦部屋を作る（ホスト）
   └─ ルームIDが発行される（例：https://yama.chips.jp/emojibe/room/abc123）
   
2. URLを友達に送る（LINEなど）

3. 友達が入室 → マッチング成立
   └─ 3秒ポーリングで入室を検知、自動でゲーム開始

4. ドラフトフェーズ（最大6分）
   ├─ 場に20枚の絵文字シールをランダム配置（両者共通）
   ├─ 手札7枚を配る（1枚は非公開）
   ├─ 先攻・後攻をランダム決定
   └─ 交互に1枚ずつ取り合う（6ターン）
      ・自分のターン：30秒以内にタップ（両者とも初回は1分）
      ・30秒超過：ランダムで自動取得
      ・相手のターン：3秒ポーリングで状態監視

5. 役作りフェーズ（最大3分）
   ├─ 両者同時に役を作る（相手の役は見えない）
   ├─ 役は最大3個まで申告
   ├─ 3分超過：その時点で入力済みの役が全て有効
   └─ 両者が「採点！」を押すか、3分経過で採点へ

6. 採点フェーズ
   ├─ Claude APIが両者の役を採点
   ├─ 結果を同時公開（めくり演出）
   ├─ 合計点数で勝敗判定
   ├─ 8点以上の役は殿堂入り候補
   └─ 「また戦う」「トップへ」ボタン
```

---

## 画面構成

### 新規追加画面

```
index.html（既存）
├─ 「ソロモードで遊ぶ」（既存）
└─ 「対人戦で遊ぶ」（新規追加）
    ├─ 「部屋を作る」→ room_host.html
    └─ 「部屋に入る」→ room_join.html（URLから直接入室）

room_host.html    # ホスト待機画面（ルームID表示・コピー）
game_multi.html   # 対人戦ゲーム本体
```

### game_multi.htmlのレイアウト（縦長スマホ）

```
┌─────────────────┐
│  相手の手帳        │
│  （取った絵文字が見える）│
│  ⏱ 相手のターン...  │
├─────────────────┤
│                 │
│  場のノート       │
│  （シール20枚）   │
│                 │
├─────────────────┤
│  自分の手帳        │
│  ⏱ あなたのターン！ │
│  残り：23秒        │
└─────────────────┘
```

---

## DB設計

### 新規追加テーブル

```sql
-- 対戦部屋
CREATE TABLE rooms (
  id VARCHAR(8) PRIMARY KEY,           -- ルームID（例：abc123）
  field_emojis VARCHAR(500) NOT NULL,  -- 場の絵文字20枚（JSON）
  status ENUM('waiting', 'draft', 'hand', 'scoring', 'done') DEFAULT 'waiting',
  host_session VARCHAR(36) NOT NULL,
  guest_session VARCHAR(36) DEFAULT NULL,
  current_turn ENUM('host', 'guest') DEFAULT 'host',
  turn_deadline TIMESTAMP NULL,        -- ターン制限時刻
  hand_deadline TIMESTAMP NULL,        -- 役作り制限時刻
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 各プレイヤーの手札・取得状況
CREATE TABLE room_players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(8) NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  role ENUM('host', 'guest') NOT NULL,
  initial_hand VARCHAR(200) NOT NULL,  -- 初期手札7枚（JSON）
  hidden_emoji VARCHAR(10) DEFAULT NULL, -- 非公開の1枚
  picked_emojis VARCHAR(200) DEFAULT '[]', -- 取得した絵文字（JSON）
  player_name VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ドラフトログ（何ターン目に何を取ったか）
CREATE TABLE draft_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(8) NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  turn_number INT NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  is_auto BOOLEAN DEFAULT FALSE,       -- タイムアウトによる自動取得か
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### game_logsテーブル（既存・拡張）

```sql
-- room_idカラムを追加（ソロはNULL）
ALTER TABLE game_logs ADD COLUMN room_id VARCHAR(8) DEFAULT NULL;
```

---

## API設計

### 新規追加PHPファイル

```
api/
├── room_create.php    # 部屋作成・ルームID発行
├── room_join.php      # 入室処理
├── room_state.php     # 現在の状態取得（3秒ポーリング用）
├── draft_pick.php     # シール取得
└── score_multi.php    # 対人戦採点・保存
```

### room_state.phpのレスポンス例

```json
{
  "status": "draft",
  "current_turn": "host",
  "turn_deadline": "2026-05-20T10:30:45Z",
  "field_emojis": ["🐶", "🐱", ...],
  "host": {
    "picked": ["🇺🇸", "🤬"],
    "hidden": true,
    "pick_count": 2
  },
  "guest": {
    "picked": ["🎸", "🐍"],
    "hidden": false,
    "pick_count": 2
  }
}
```

---

## タイムアウト処理

### ドラフトのタイムアウト

`draft_pick.php`を叩くたびに、前のターンのタイムアウトをチェック。

```
draft_pick.phpが呼ばれた
　↓
turn_deadlineを過ぎてるか確認
　↓
過ぎてる → ランダムで自動取得してから次のターンへ
過ぎてない → 通常の取得処理
```

### 役作りのタイムアウト

`room_state.php`のポーリングでhand_deadlineを監視。
時間切れになったら、入力済みの役をそのまま採点へ送る。

---

## フロント実装方針

### ポーリング処理（game_multi.html）

```javascript
// 3秒ごとにサーバーの状態を取得
setInterval(async () => {
  const state = await fetch(`api/room_state.php?room_id=${roomId}`).then(r => r.json());
  updateScene(state);
}, 3000);
```

### Phaser.jsとの統合

- `FieldScene`をベースに`FieldSceneMulti`を作成
- 相手のターン中はシールをタップ不可にする
- カウントダウンタイマーをリアルタイム表示

---

## 採点ルール（対人戦版）

フェーズ1と同じ採点基準をClaude APIで使用。

| 役の種類 | 点数 |
|---------|------|
| カテゴリが合ってるだけ | 1〜2点 |
| 具体的な状況・情景 | 3〜4点 |
| 固有名詞・作品名で納得感あり | 5〜7点 |
| 誰もが膝を打つ完璧な組み合わせ | 8〜10点 |
| 関係ない絵文字が混じってる | -1〜-3点 |

### 勝敗判定

- 合計点数が高い方が勝ち
- 同点は引き分け
- 8点以上の役が出たら殿堂入り候補（名前登録を促す）

---

## 実装順序（Claude Codeへの指示順）

```
Step1: DBテーブル作成（rooms, room_players, draft_logs）
Step2: room_create.php + room_host.html（部屋作成・待機画面）
Step3: room_join.php + room_state.php（入室・ポーリング）
Step4: draft_pick.php + FieldSceneMulti（ドラフト画面）
Step5: HandScene流用 + タイムアウト処理
Step6: score_multi.php + ResultSceneMulti（採点・結果）
Step7: index.htmlに「対人戦で遊ぶ」ボタン追加
```

各Stepで動作確認してからgit commitすること。

---

## 今後の拡張（フェーズ2後半）

- 観戦モード（部屋URLを知ってる人が見れる）
- 「異議あり」ボタン（観戦者が採点に参加）
- COMモード（蓄積データで思考エンジン）
- 感想戦AI（対戦後にCOMが「読み」を語る）

---

## 技術的な注意点

- WebSocket不使用（ロリポップ非対応のため）
- ポーリング間隔：3秒
- タイムアウト処理はサーバー側PHPで完結させる（クライアント任せにしない）
- ルームIDは8文字のランダム英数字
- セッションIDはUUID v4（既存のgame_logsと同じ方式）
- 修正前は必ずgit commit
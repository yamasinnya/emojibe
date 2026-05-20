class JoinScene extends Phaser.Scene {
  constructor() { super({ key: 'JoinScene' }); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.graphics().fillStyle(0x2a1a0a, 1).fillRect(0, 0, W, H);
    this.statusText = this.add.text(W / 2, H / 2, '接続中...', {
      fontSize: '16px', color: '#c8b090', fontFamily: 'sans-serif'
    }).setOrigin(0.5);

    const params = new URLSearchParams(location.search);
    const roomId = params.get('room');
    if (!roomId) {
      this.statusText.setText('URLにroom_idがありません');
      return;
    }

    this.joinOrResume(roomId);
  }

  async joinOrResume(roomId) {
    const key    = `emojibe_multi_${roomId}`;
    const stored = sessionStorage.getItem(key);

    try {
      if (stored) {
        // ホストまたは再接続 → room_state.php でカレントステートを取得
        const saved = JSON.parse(stored);
        this.statusText.setText('再接続中...');
        const state = await fetch(
          `api/room_state.php?room_id=${roomId}&session_id=${saved.sessionId}`
        ).then(r => r.json());

        if (state.error) throw new Error(state.error);
        this.startGame(roomId, saved, state);

      } else {
        // ゲスト → room_join.php で入室
        this.statusText.setText('入室中...');
        const data = await fetch('api/room_join.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_id: roomId })
        }).then(r => r.json());

        if (data.error) throw new Error(data.error);

        sessionStorage.setItem(key, JSON.stringify({
          sessionId:   data.session_id,
          role:        'guest',
          initialHand: data.initial_hand,
          hiddenIdx:   data.hidden_idx,
          fieldEmojis: data.field_emojis,
        }));

        this.startGame(roomId, {
          sessionId:   data.session_id,
          role:        'guest',
          initialHand: data.initial_hand,
          hiddenIdx:   data.hidden_idx,
          fieldEmojis: data.field_emojis,
        }, data);
      }
    } catch(e) {
      this.statusText.setText('エラー：' + e.message);
      this.time.delayedCall(2000, () => location.href = 'index.html');
    }
  }

  startGame(roomId, saved, state) {
    if (state.status === 'done' || state.status === 'scoring') {
      // 途中復帰（採点フェーズ）
      this.scene.start('ResultSceneMulti', {
        roomId,
        sessionId: saved.sessionId,
        roles: [],
        resuming: true,
      });
      return;
    }

    const fieldEmojis = state.field_emojis || saved.fieldEmojis || [];

    this.scene.start('FieldSceneMulti', {
      roomId,
      sessionId:     saved.sessionId,
      role:          saved.role,
      initialHand:   saved.initialHand,
      hiddenIdx:     saved.hiddenIdx,
      fieldEmojis,
      currentTurn:   state.current_turn,
      turnDeadline:  state.turn_deadline,
      turnNumber:    state.turn_number || 1,
      myPicked:      state.my_picked   || [],
      oppPicked:     state.opp_picked  || [],
    });
  }
}

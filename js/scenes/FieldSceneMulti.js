class FieldSceneMulti extends Phaser.Scene {
  constructor() { super({ key: 'FieldSceneMulti' }); }

  init(data) {
    this.roomId          = data.roomId;
    this.sessionId       = data.sessionId;
    this.myRole          = data.role;
    this.initialHand     = data.initialHand    || [];
    this.hiddenIdx       = data.hiddenIdx ?? -1;
    this.fieldEmojis     = data.fieldEmojis    || [];
    this.oppInitialHand  = data.oppInitialHand || [];
    this.currentTurn     = data.currentTurn;
    this.turnDeadline    = data.turnDeadline ? new Date(data.turnDeadline) : null;
    this.turnNumber      = data.turnNumber || 1;
    this.myPicked        = data.myPicked    || [];
    this.oppPicked       = data.oppPicked   || [];

    this.fieldStickers    = [];
    this.myHandStickers   = [];
    this.oppHandStickers  = [];
    this.myTakenSlots     = [];
    this.oppTakenSlots    = [];
    this.picking          = false;
    this.roleMakeBtn      = null;
    this.roleMakeBg       = null;
    this.pollEvent        = null;
    this.countdownEvent   = null;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this._drawBg(W, H);
    this._createTopBar(W);
    this._createOppArea(W);
    this._createFieldNotebook(W);
    this._createPlayerArea(W);

    this._placeFieldStickers(W);
    this._placePlayerHand(W);
    this._placeOppInitialHand();
    this._updateOppDisplay();

    this._startPolling();
    this._startCountdown();
    this._applyTurnState();

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  // ── レイアウト定数 ───────────────────────────────────
  // 上部バー        : y=0   h=44
  // 相手エリア      : y=44  h=130
  // フィールドノート : y=179 h=320
  // プレイヤーエリア : y=504 h=155
  // ステータス行    : y=663 h=50

  _drawBg(W, H) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x3d2b1a, 0x3d2b1a, 0x2a1a0a, 0x2a1a0a, 1);
    bg.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) {
      const g = this.add.graphics();
      g.lineStyle(1.5, 0x4a3520, 0.22);
      g.beginPath();
      g.moveTo(0, i * 50 + Phaser.Math.Between(-10, 10));
      g.lineTo(W, i * 50 + Phaser.Math.Between(-10, 10));
      g.strokePath();
    }
  }

  _createTopBar(W) {
    const bar = this.add.graphics();
    bar.fillStyle(0x1a1008, 0.9);
    bar.fillRect(0, 0, W, 44);
    this.add.text(12, 22, 'えもじべ 対人戦', {
      fontSize: '13px', color: '#f5e6c8',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    this.turnInfoText = this.add.text(W - 12, 22, '', {
      fontSize: '11px', color: '#c8b090', fontFamily: 'sans-serif'
    }).setOrigin(1, 0.5);
  }

  _createOppArea(W) {
    const x = 10, y = 48, w = W - 20, h = 126;
    const sh = this.add.graphics();
    sh.fillStyle(0x000000, 0.18);
    sh.fillRoundedRect(x + 3, y + 3, w, h, 8);
    const bg = this.add.graphics();
    bg.fillStyle(0x3a1e0a, 0.7);
    bg.fillRoundedRect(x, y, w, h, 8);
    bg.lineStyle(1, 0xc03020, 0.35);
    bg.strokeRoundedRect(x, y, w, h, 8);
    this.add.text(W / 2, y + 10, '相 手 の 手 帳', {
      fontSize: '10px', color: '#e8a090', fontFamily: 'sans-serif', letterSpacing: 4
    }).setOrigin(0.5);

    // 相手の初期手札行（7枚、サイズ16px）の配置位置を記憶
    const hSize = 16, hGap = 3;
    this.oppHandRowY = y + 30;
    this.oppHandRowX = (W - (7 * hSize + 6 * hGap)) / 2 + hSize / 2;
    this.oppHandStickSize = hSize;
    this.oppHandStickGap  = hGap;

    // 相手の取得スロット（6個、18px）
    const slotSize = 18, gap = 3;
    const totalW = 6 * slotSize + 5 * gap;
    const sx = (W - totalW) / 2;
    const slotY = y + 80;
    for (let i = 0; i < 6; i++) {
      const slotX = sx + i * (slotSize + gap) + slotSize / 2;
      const g = this.add.graphics();
      g.lineStyle(1, 0xc03020, 0.3);
      g.strokeRoundedRect(slotX - slotSize / 2, slotY - slotSize / 2, slotSize, slotSize, 4);
      this.oppTakenSlots.push({ x: slotX, y: slotY, size: slotSize, gfx: g, img: null });
    }
    this.oppStatusText = this.add.text(W / 2, y + 110, '', {
      fontSize: '10px', color: '#e8a090', fontFamily: 'sans-serif'
    }).setOrigin(0.5);
  }

  _createFieldNotebook(W) {
    const x = 10, y = 179, w = W - 20, h = 320;
    const sh = this.add.graphics();
    sh.fillStyle(0x000000, 0.25);
    sh.fillRoundedRect(x + 4, y + 4, w, h, 8);
    const nb = this.add.graphics();
    nb.fillStyle(0xf8f4e8, 1);
    nb.fillRoundedRect(x, y, w, h, 8);
    nb.lineStyle(1, 0xe0d8c0, 1);
    nb.strokeRoundedRect(x, y, w, h, 8);
    const grid = this.add.graphics();
    grid.lineStyle(0.5, 0xc8d0e8, 0.4);
    for (let gy = y + 18; gy < y + h; gy += 18) {
      grid.beginPath(); grid.moveTo(x, gy); grid.lineTo(x + w, gy); grid.strokePath();
    }
    this.add.text(W / 2, y + 14, '場 の シール', {
      fontSize: '10px', color: '#a0988c', fontFamily: 'sans-serif', letterSpacing: 4
    }).setOrigin(0.5);
    this.fieldBounds = { x, y, w, h };
  }

  _createPlayerArea(W) {
    const x = 10, y = 504, w = W - 20, h = 155;
    const sh = this.add.graphics();
    sh.fillStyle(0x000000, 0.2);
    sh.fillRoundedRect(x + 3, y + 3, w, h, 8);
    const nb = this.add.graphics();
    nb.fillStyle(0x2d5a3d, 0.22);
    nb.fillRoundedRect(x, y, w, h, 8);
    nb.lineStyle(1.5, 0x4a7c59, 0.5);
    nb.strokeRoundedRect(x, y, w, h, 8);
    this.add.text(W / 2, y + 14, '自 分 の 手 帳', {
      fontSize: '10px', color: '#a8d5b5', fontFamily: 'sans-serif', letterSpacing: 4
    }).setOrigin(0.5);

    // 自分の取得スロット（6個）
    const slotSize = 30, gap = 4;
    const totalW = 6 * slotSize + 5 * gap;
    const sx = (W - totalW) / 2;
    for (let i = 0; i < 6; i++) {
      const slotX = sx + i * (slotSize + gap) + slotSize / 2;
      const slotY = y + 118;
      const g = this.add.graphics();
      g.lineStyle(1, 0x4a7c59, 0.4);
      g.strokeRoundedRect(slotX - slotSize / 2, slotY - slotSize / 2, slotSize, slotSize, 4);
      this.myTakenSlots.push({ x: slotX, y: slotY, size: slotSize, gfx: g, img: null });
    }
    this.playerBounds = { x, y, w, h };

    // ステータス行
    this.countdownText = this.add.text(W / 2, 672, '', {
      fontSize: '14px', color: '#f5e6c8', fontFamily: 'sans-serif'
    }).setOrigin(0.5);
    this.turnLabel = this.add.text(W / 2, 700, '', {
      fontSize: '20px', color: '#d4a853',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  _placeFieldStickers(W) {
    const nb = this.fieldBounds;
    const cols = 5, rows = 4, size = 40;
    const innerW = nb.w - 50;
    const innerH = nb.h - 40;
    const gapX = (innerW - cols * size) / (cols - 1);
    const gapY = (innerH - rows * size) / (rows - 1);
    const startX = nb.x + 28;
    const startY = nb.y + 34;

    this.fieldEmojis.forEach((emojiData, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (size + gapX) + size / 2 + Phaser.Math.Between(-2, 2);
      const y = startY + row * (size + gapY) + size / 2 + Phaser.Math.Between(-2, 2);
      const angle = Phaser.Math.Between(-8, 8);
      const sticker = this._makeSticker(x, y, emojiData, angle, 0xfffef0, size);
      sticker.originalX = x;
      sticker.originalY = y;
      sticker.fieldIndex = i;
      this.fieldStickers.push(sticker);
    });

    // 取得済み分を反映
    this._syncFieldState();
  }

  _placePlayerHand(W) {
    const y = this.playerBounds.y;
    const size = 28, gap = 4;
    const count = this.initialHand.length;
    const totalW = count * size + (count - 1) * gap;
    const startX = (W - totalW) / 2 + size / 2;

    this.initialHand.forEach((emojiData, i) => {
      const x = startX + i * (size + gap);
      const sticker = this._makeSticker(x, y + 70, emojiData, Phaser.Math.Between(-6, 6), 0xf0fff0, size);
      this.myHandStickers.push(sticker);
    });
  }

  _placeOppInitialHand() {
    const size = this.oppHandStickSize;
    const gap  = this.oppHandStickGap;
    this.oppInitialHand.forEach((emojiData, i) => {
      const x = this.oppHandRowX + i * (size + gap);
      const st = this._makeSticker(x, this.oppHandRowY, emojiData, Phaser.Math.Between(-5, 5), 0xfff0ee, size);
      this.oppHandStickers.push(st);
    });
  }

  _makeSticker(x, y, emojiData, angle, bgColor, size) {
    const container = this.add.container(x, y);
    const half = size / 2;
    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.93);
    bg.fillRoundedRect(-half, -half, size, size, 5);
    bg.lineStyle(1, 0xd0c8b0, 0.65);
    bg.strokeRoundedRect(-half, -half, size, size, 5);

    let inner;
    if (emojiData.hidden) {
      inner = this.add.text(0, 1, '?', {
        fontSize: `${Math.floor(size * 0.55)}px`,
        color: '#8a7560', fontFamily: 'sans-serif', fontStyle: 'bold'
      }).setOrigin(0.5);
    } else {
      inner = this.add.image(0, 0, emojiKey(emojiData.emoji))
        .setDisplaySize(Math.floor(size * 0.65), Math.floor(size * 0.65));
    }
    container.add([bg, inner]);
    container.setAngle(angle);
    container.setScale(0);
    this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 250, delay: Math.random() * 300, ease: 'Back.out' });
    return { container, bg, img: inner, emojiData, taken: false };
  }

  _syncFieldState() {
    // 既に取得済みの絵文字を反映
    const myEmojis  = this.myPicked.map(e => e.emoji);
    const oppEmojis = this.oppPicked.map(e => e.emoji);

    this.fieldStickers.forEach(st => {
      if (myEmojis.includes(st.emojiData.emoji)) {
        st.taken = true;
        this._animateTakenToSlot(st, 'me', false);
      } else if (oppEmojis.includes(st.emojiData.emoji)) {
        st.taken = true;
        this._fadeOutFieldSticker(st);
      }
    });
    this._updateOppDisplay();
  }

  _animateTakenToSlot(sticker, who, animate = true) {
    const filledCount = this.myTakenSlots.filter(s => s.img).length;
    if (who !== 'me' || filledCount >= 6) return;

    const slot = this.myTakenSlots[filledCount];
    sticker.taken = true;
    sticker.container.disableInteractive();

    if (animate) {
      this.tweens.add({
        targets: sticker.container,
        x: slot.x, y: slot.y, scaleX: 0.85, scaleY: 0.85, angle: Phaser.Math.Between(-6, 6),
        duration: 350, ease: 'Back.inOut',
      });
    } else {
      sticker.container.setPosition(slot.x, slot.y);
      sticker.container.setScale(0.85);
    }
    slot.img = sticker;
  }

  _fadeOutFieldSticker(sticker) {
    sticker.taken = true;
    sticker.container.disableInteractive();
    this.tweens.add({ targets: sticker.container, alpha: 0.15, scaleX: 0.7, scaleY: 0.7, duration: 400 });
  }

  _updateOppDisplay() {
    this.oppPicked.forEach((emojiData, i) => {
      if (i >= 6) return;
      const slot = this.oppTakenSlots[i];
      if (slot.img) return;
      const img = this.add.image(slot.x, slot.y, emojiKey(emojiData.emoji)).setDisplaySize(13, 13);
      slot.img = img;
    });
    const oppTotal = this.oppPicked.length;
    this.oppStatusText.setText(oppTotal > 0 ? `${oppTotal}枚取得` : '');
  }

  _applyTurnState() {
    const isMyTurn = this.currentTurn === this.myRole;
    if (isMyTurn) {
      this._enableFieldInteraction();
      this.turnLabel.setText('あなたのターン！');
      this.turnLabel.setColor('#d4a853');
    } else {
      this._disableFieldInteraction();
      this.turnLabel.setText('相手のターン...');
      this.turnLabel.setColor('#e8a090');
    }
    this.turnInfoText.setText(`${this.myPicked.length + this.oppPicked.length + 1}手目 / 12`);
  }

  _enableFieldInteraction() {
    this.fieldStickers.forEach(st => {
      if (st.taken) return;
      const size = 40;
      st.container.setInteractive(
        new Phaser.Geom.Rectangle(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4),
        Phaser.Geom.Rectangle.Contains
      );
      st.container.off('pointerover').off('pointerout').off('pointerdown');
      st.container.on('pointerover', () => {
        if (!st.taken) this.tweens.add({ targets: st.container, scaleX: 1.25, scaleY: 1.25, duration: 100 });
      });
      st.container.on('pointerout', () => {
        if (!st.taken) this.tweens.add({ targets: st.container, scaleX: 1, scaleY: 1, duration: 100 });
      });
      st.container.on('pointerdown', () => {
        if (!st.taken && !this.picking && this.currentTurn === this.myRole)
          this._pickSticker(st);
      });
    });
  }

  _disableFieldInteraction() {
    this.fieldStickers.forEach(st => {
      if (!st.taken) st.container.disableInteractive();
    });
  }

  async _pickSticker(sticker) {
    this.picking = true;
    this._disableFieldInteraction();

    try {
      const res = await fetch('api/draft_pick.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id:    this.roomId,
          session_id: this.sessionId,
          emoji:      sticker.emojiData.emoji,
        })
      });
      const data = await res.json();

      if (data.error) {
        this._showFlash('エラー: ' + data.error, 0xc03020);
        this.picking = false;
        this._applyTurnState();
        return;
      }

      this.myPicked.push(sticker.emojiData);
      this._animateTakenToSlot(sticker, 'me', true);

      this.currentTurn  = data.current_turn;
      this.turnDeadline = data.turn_deadline ? new Date(data.turn_deadline) : null;
      this.turnNumber   = data.turn_number;

      if (data.status === 'hand') {
        this.time.delayedCall(600, () => this._onDraftDone(data));
      } else {
        this._applyTurnState();
      }
    } catch (e) {
      this._showFlash('通信エラー', 0xc03020);
    }

    this.picking = false;
  }

  _startPolling() {
    this.pollEvent = this.time.addEvent({
      delay: 3000, loop: true,
      callback: this._pollState, callbackScope: this
    });
  }

  async _pollState() {
    if (this.picking) return;
    try {
      const res = await fetch(
        `api/room_state.php?room_id=${this.roomId}&session_id=${this.sessionId}`
      );
      const state = await res.json();
      if (!state || state.error) return;

      // 相手の取得を反映
      const prevOppCount = this.oppPicked.length;
      this.oppPicked = state.opp_picked || [];
      if (this.oppPicked.length > prevOppCount) {
        // 相手が新たに取った絵文字を field から消す
        for (let i = prevOppCount; i < this.oppPicked.length; i++) {
          const picked = this.oppPicked[i];
          const st = this.fieldStickers.find(s => !s.taken && s.emojiData.emoji === picked.emoji);
          if (st) this._fadeOutFieldSticker(st);
        }
        this._updateOppDisplay();
      }

      if (state.status === 'hand') {
        this._onDraftDone(state);
        return;
      }

      if (state.current_turn !== this.currentTurn) {
        this.currentTurn  = state.current_turn;
        this.turnDeadline = state.turn_deadline ? new Date(state.turn_deadline) : null;
        this._applyTurnState();
      }
    } catch (e) {}
  }

  _startCountdown() {
    this.countdownEvent = this.time.addEvent({
      delay: 1000, loop: true,
      callback: this._updateCountdown, callbackScope: this
    });
  }

  _updateCountdown() {
    if (!this.turnDeadline) { this.countdownText.setText(''); return; }
    const secs = Math.max(0, Math.floor((this.turnDeadline - Date.now()) / 1000));
    if (this.currentTurn === this.myRole) {
      this.countdownText.setText(`残り ${secs} 秒`);
      this.countdownText.setColor(secs <= 5 ? '#ff4444' : '#f5e6c8');
      if (secs === 0 && !this.picking) this._autoPickRandom();
    } else {
      this.countdownText.setText('');
    }
  }

  _autoPickRandom() {
    const available = this.fieldStickers.filter(st => !st.taken);
    if (available.length === 0) return;
    const st = available[Phaser.Math.Between(0, available.length - 1)];
    this._pickSticker(st);
  }

  _onDraftDone(state) {
    if (this.pollEvent) { this.pollEvent.remove(); this.pollEvent = null; }
    if (this.countdownEvent) { this.countdownEvent.remove(); this.countdownEvent = null; }
    this.countdownText.setText('');
    this.turnLabel.setText('ドラフト終了！役を作ろう！');
    this.turnLabel.setColor('#a8d5b5');
    this.time.delayedCall(600, () => this._showRoleMakeButton());
  }

  _showRoleMakeButton() {
    const W = this.scale.width;
    const btnY = 740, btnW = 210, btnH = 44;
    this.roleMakeBg = this.add.graphics();
    const draw = (c) => {
      this.roleMakeBg.clear();
      this.roleMakeBg.fillStyle(c, 1);
      this.roleMakeBg.fillRoundedRect(W / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, 22);
    };
    draw(0x4a7c59);
    this.roleMakeBtn = this.add.text(W / 2, btnY, '役を作る！', {
      fontSize: '18px', color: '#f0fff0',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.roleMakeBtn.on('pointerover', () => draw(0x5a9c6a));
    this.roleMakeBtn.on('pointerout',  () => draw(0x4a7c59));
    this.roleMakeBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => {
        const fullHand = [...this.initialHand, ...this.myPicked];
        this.scene.start('HandScene', {
          hand:        fullHand,
          nextScene:   'ResultSceneMulti',
          roomId:      this.roomId,
          sessionId:   this.sessionId,
        });
      });
    });
  }

  _showFlash(msg, color) {
    const W = this.scale.width;
    const flash = this.add.text(W / 2, 460, msg, {
      fontSize: '14px', color: '#fff',
      fontFamily: 'sans-serif', fontStyle: 'bold',
      backgroundColor: '#' + color.toString(16).padStart(6, '0'),
      padding: { x: 12, y: 7 }
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: flash, y: 440, alpha: 0, duration: 1200, delay: 600, onComplete: () => flash.destroy() });
  }

  shutdown() {
    if (this.pollEvent)      this.pollEvent.remove();
    if (this.countdownEvent) this.countdownEvent.remove();
  }
}

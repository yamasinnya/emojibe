class ResultSceneMulti extends Phaser.Scene {
  constructor() { super({ key: 'ResultSceneMulti' }); }

  init(data) {
    this.roles     = data.roles     || [];
    this.sessionId = data.sessionId || '';
    this.roomId    = data.roomId    || '';
    this.resuming  = data.resuming  || false;

    this.myResults         = [];
    this.oppResults        = [];
    this.myTotal           = 0;
    this.nextCardY         = 0;
    this.pollEvent         = null;
    this.scoringDone       = false;
    this._rematchPending   = false;
    this._rematchPollEvent = null;
    this.popupLayer        = null;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this._drawBg(W, H);
    this._createResultArea(W);
    this._createButtons(W);

    this.waitingText = this.add.text(W / 2, 582, '採点中... しばらくお待ちください', {
      fontSize: '12px', color: '#c8b090', fontFamily: 'sans-serif'
    }).setOrigin(0.5);

    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.time.delayedCall(600, () => this._startScoring());
  }

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
    const bar = this.add.graphics();
    bar.fillStyle(0x1a1008, 0.85);
    bar.fillRect(0, 0, W, 50);
    this.add.text(W / 2, 25, '採　点　結　果 (対人戦)', {
      fontSize: '13px', color: '#f5e6c8', fontFamily: 'sans-serif', letterSpacing: 3
    }).setOrigin(0.5);
  }

  _createResultArea(W) {
    const nbX = 12, nbY = 58, nbW = W - 24, nbH = 500;
    const sh = this.add.graphics();
    sh.fillStyle(0x000000, 0.2);
    sh.fillRoundedRect(nbX + 4, nbY + 4, nbW, nbH, 8);
    const nb = this.add.graphics();
    nb.fillStyle(0xf8f4e8, 1);
    nb.fillRoundedRect(nbX, nbY, nbW, nbH, 8);
    nb.lineStyle(1, 0xe0d8c0, 1);
    nb.strokeRoundedRect(nbX, nbY, nbW, nbH, 8);
    const grid = this.add.graphics();
    grid.lineStyle(0.5, 0xc8d0e8, 0.4);
    for (let gy = nbY + 18; gy < nbY + nbH; gy += 18) {
      grid.beginPath(); grid.moveTo(nbX, gy); grid.lineTo(nbX + nbW, gy); grid.strokePath();
    }
    this.resultAreaBounds = { x: nbX, y: nbY, w: nbW, h: nbH };
    this.nextCardY = nbY + 18;
  }

  _createButtons(W) {
    const againBtn = this.add.text(W / 2 - 70, 618, 'もう一度', {
      fontSize: '14px', color: '#f5e6c8',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      backgroundColor: '#4a3520', padding: { x: 16, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    againBtn.on('pointerdown', () => {
      if (this._rematchPending) return;
      this._rematchPending = true;
      againBtn.setAlpha(0.5);
      this._startRematch();
    });

    const homeBtn = this.add.text(W / 2 + 70, 618, 'トップへ', {
      fontSize: '14px', color: '#2a1a0a',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      backgroundColor: '#d4a853', padding: { x: 16, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    homeBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => { location.href = 'index.html'; });
    });
  }

  async _startScoring() {
    if (this.resuming) {
      // 再接続時は直接ポーリングで結果を待つ
      this._waitForOpponent();
      return;
    }

    // 自分の役を採点・送信
    const roles = this.roles.map(r => ({
      role_name:   r.name,
      emojis:      r.emojis.map(e => e.emoji),
      emoji_names: r.emojis.map(e => e.name),
    }));

    try {
      const res = await fetch('api/score_multi.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: this.roomId, session_id: this.sessionId, roles })
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      this.myResults = data.my_results || [];
      this.myTotal   = this.myResults.reduce((s, r) => s + r.score, 0);

      // 自分のカードを表示
      let idx = 0;
      const showNext = () => {
        if (idx >= this.myResults.length) {
          this._showMyTotal();
          if (data.opponent_done) {
            this.time.delayedCall(800, () => this._fetchAndShowOpponent());
          } else {
            this._waitForOpponent();
          }
          return;
        }
        this._showRoleCard(this.myResults[idx], '自分');
        idx++;
        this.time.delayedCall(800, showNext);
      };
      showNext();

    } catch (e) {
      if (this.waitingText) this.waitingText.setText('採点エラー');
    }
  }

  _showRoleCard(result, label) {
    const W = this.scale.width;
    const cardX = this.resultAreaBounds.x + 16;
    const cardY = this.nextCardY;
    const cardW = this.resultAreaBounds.w - 32;
    const cardH = 66;
    this.nextCardY += cardH + 6;

    const scoreColor = result.score >= 8 ? 0xffd700
                     : result.score >= 5 ? 0xffa040
                     : result.score >= 3 ? 0xf0e060
                     : result.score < 0  ? 0xffc0c0
                     : 0xfff8d0;

    const cc = this.add.container(cardX + cardW / 2, cardY + cardH / 2);
    cc.setAngle(Phaser.Math.Between(-1, 1));
    cc.setAlpha(0); cc.setScale(0.75); cc.setDepth(1);

    const card = this.add.graphics();
    card.fillStyle(scoreColor, 0.95);
    card.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
    card.lineStyle(1, 0xd0c0a0, 0.7);
    card.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);

    const nameText = this.add.text(-cardW / 2 + 10, -cardH / 2 + 10,
      `[${label}] ${result.role_name}`,
      { fontSize: '13px', color: '#4a3520', fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif', fontStyle: 'bold' }
    );

    const emojiImgs = [];
    const emojiStr = (result.emojis || []);
    const emojis = Array.isArray(emojiStr) ? emojiStr : [...(emojiStr || '')];
    emojis.slice(0, 6).forEach((e, idx) => {
      const ec = typeof e === 'string' ? e : e.emoji;
      try {
        const img = this.add.image(-cardW / 2 + 14 + idx * 22, -cardH / 2 + 34, emojiKey(ec)).setDisplaySize(18, 18);
        emojiImgs.push(img);
      } catch(_) {}
    });

    const scoreStr = result.score >= 0 ? `+${result.score}点` : `${result.score}点`;
    const scoreText = this.add.text(cardW / 2 - 10, -cardH / 2 + 8, scoreStr, {
      fontSize: '18px', color: result.score >= 0 ? '#c03020' : '#606060',
      fontFamily: 'sans-serif', fontStyle: 'bold'
    }).setOrigin(1, 0);

    const chatIcon = this.add.text(cardW / 2 - 14, cardH / 2 - 8, '💬', {
      fontSize: '18px'
    }).setOrigin(1, 1);

    const hitZone = this.add.zone(0, 0, cardW, cardH).setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => { if (!this.popupLayer) this._showPopup(result); });

    cc.add([card, nameText, ...emojiImgs, scoreText, chatIcon, hitZone]);
    this.tweens.add({ targets: cc, alpha: 1, scaleX: 1, scaleY: 1, duration: 400, ease: 'Back.out' });
  }

  _showMyTotal() {
    const W = this.scale.width;
    const totalY = this.nextCardY + 6;
    this.nextCardY = totalY + 36;

    const tc = this.add.container(W / 2, totalY).setDepth(1).setAlpha(0);
    const bg = this.add.graphics();
    bg.fillStyle(0x4a7c59, 1);
    bg.fillRoundedRect(-100, -17, 200, 34, 8);
    const label = this.add.text(0, 0,
      `自分の合計　${this.myTotal >= 0 ? '+' : ''}${this.myTotal}点`, {
      fontSize: '15px', color: '#f0fff0',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5);
    tc.add([bg, label]);
    this.tweens.add({ targets: tc, alpha: 1, y: totalY - 6, duration: 500, ease: 'Back.out' });
  }

  _waitForOpponent() {
    if (this.waitingText) {
      this.waitingText.setY(this.nextCardY + 20);
      this.waitingText.setText('相手の採点を待っています...');
    }
    this.pollEvent = this.time.addEvent({
      delay: 3000, loop: true,
      callback: this._pollForOpponent, callbackScope: this
    });
  }

  async _pollForOpponent() {
    try {
      const res   = await fetch(`api/room_state.php?room_id=${this.roomId}&session_id=${this.sessionId}`);
      const state = await res.json();
      if (state.status === 'done') {
        if (this.pollEvent) { this.pollEvent.remove(); this.pollEvent = null; }
        this.oppResults = state.opp_results || [];
        this._showOpponentResults(state);
      }
    } catch (e) {}
  }

  async _fetchAndShowOpponent() {
    try {
      const res   = await fetch(`api/room_state.php?room_id=${this.roomId}&session_id=${this.sessionId}`);
      const state = await res.json();
      this.oppResults = state.opp_results || [];
      this._showOpponentResults(state);
    } catch (e) {}
  }

  _showOpponentResults(state) {
    if (this.waitingText) { this.waitingText.destroy(); this.waitingText = null; }

    const W = this.scale.width;

    // 相手のカードを1枚ずつ表示
    let idx = 0;
    const showNext = () => {
      if (idx >= this.oppResults.length) {
        this._showWinner(state);
        return;
      }
      this._showRoleCard(this.oppResults[idx], '相手');
      idx++;
      this.time.delayedCall(700, showNext);
    };
    showNext();
  }

  _showWinner(state) {
    const W = this.scale.width;
    const oppTotal = state.opp_total ?? this.oppResults.reduce((s, r) => s + r.score, 0);
    const winner   = state.winner;

    const winnerY = this.nextCardY + 8;
    const wc = this.add.container(W / 2, winnerY).setDepth(2).setAlpha(0);

    const myT  = this.myTotal;
    const oppT = oppTotal;
    let label, bgColor;
    if (winner === 'me')   { label = `あなたの勝ち！🏆  ${myT}点 vs ${oppT}点`; bgColor = 0xd4a853; }
    else if (winner === 'them') { label = `相手の勝ち...  ${myT}点 vs ${oppT}点`; bgColor = 0x7a5a30; }
    else                    { label = `引き分け！  ${myT}点 vs ${oppT}点`;          bgColor = 0x4a7c59; }

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 1);
    bg.fillRoundedRect(-130, -20, 260, 40, 10);
    const text = this.add.text(0, 0, label, {
      fontSize: '14px', color: '#fff',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5);
    wc.add([bg, text]);
    this.tweens.add({ targets: wc, alpha: 1, y: winnerY - 8, duration: 600, ease: 'Back.out' });

    // 殿堂入り確認
    const allResults = [...this.myResults, ...this.oppResults];
    const best = allResults.reduce((a, b) => a.score > b.score ? a : b, { score: -99 });
    const myBest = this.myResults.reduce((a, b) => a.score > b.score ? a : b, { score: -99 });
    if (myBest.score >= 8) {
      this.time.delayedCall(2500, () => this._showNameInput(myBest));
    }
  }

  _showNameInput(bestRole) {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs = [];

    const overlay = this.add.graphics().setDepth(50);
    overlay.fillStyle(0x000000, 0.72);
    overlay.fillRect(0, 0, W, H);
    const cardH = 200, cardY = H / 2 - cardH / 2, cardX = 24, cardW = W - 48;
    overlay.fillStyle(0xf8f4e8, 1);
    overlay.fillRoundedRect(cardX, cardY, cardW, cardH, 12);
    objs.push(overlay);

    objs.push(this.add.text(W / 2, cardY + 32, '🏆  殿堂入り！', {
      fontSize: '18px', color: '#c03020',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(51));

    objs.push(this.add.text(W / 2, cardY + 66,
      `「${bestRole.role_name}」 +${bestRole.score}点`, {
      fontSize: '13px', color: '#7a5a30',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif'
    }).setOrigin(0.5).setDepth(51));

    objs.push(this.add.text(W / 2, cardY + 96, '名前をつけますか？', {
      fontSize: '13px', color: '#4a3520', fontFamily: 'sans-serif'
    }).setOrigin(0.5).setDepth(51));

    const regBg = this.add.graphics().setDepth(51);
    const drawReg = (c) => {
      regBg.clear(); regBg.fillStyle(c, 1);
      regBg.fillRoundedRect(W / 2 - 104, cardY + 128, 96, 38, 19);
    };
    drawReg(0xc0302a);
    objs.push(regBg);

    const regBtn = this.add.text(W / 2 - 56, cardY + 147, '名前を入れる', {
      fontSize: '12px', color: '#fff0f0',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(52);
    objs.push(regBtn);
    regBtn.on('pointerover', () => drawReg(0xd84040));
    regBtn.on('pointerout',  () => drawReg(0xc0302a));
    regBtn.on('pointerdown', () => {
      const name = window.prompt('ニックネームを入れてね（10文字以内）');
      if (name && name.trim()) {
        const trimmed = name.trim().slice(0, 10);
        fetch('api/save_name.php', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: this.sessionId, player_name: trimmed })
        }).catch(() => {});
        objs.forEach(o => o.destroy());
        const flash = this.add.text(this.scale.width / 2, this.scale.height / 2,
          `${trimmed} さん、登録完了！🏆`, {
          fontSize: '15px', color: '#fff',
          fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif', fontStyle: 'bold',
          backgroundColor: '#c03020', padding: { x: 20, y: 12 }
        }).setOrigin(0.5).setDepth(55);
        this.tweens.add({ targets: flash, y: flash.y - 40, alpha: 0, duration: 1800, delay: 1000, onComplete: () => flash.destroy() });
      }
    });

    const skipBg = this.add.graphics().setDepth(51);
    const drawSkip = (c) => {
      skipBg.clear(); skipBg.fillStyle(c, 1);
      skipBg.fillRoundedRect(W / 2 + 8, cardY + 128, 96, 38, 19);
    };
    drawSkip(0x7c5a2d);
    objs.push(skipBg);
    const skipBtn = this.add.text(W / 2 + 56, cardY + 147, 'スキップ', {
      fontSize: '12px', color: '#f5e6c8',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(52);
    objs.push(skipBtn);
    skipBtn.on('pointerover', () => drawSkip(0x9a7040));
    skipBtn.on('pointerout',  () => drawSkip(0x7c5a2d));
    skipBtn.on('pointerdown', () => objs.forEach(o => o.destroy()));
  }

  _showPopup(result) {
    if (this.popupLayer) return;
    this.popupLayer = [];

    const W = this.scale.width;
    const H = this.scale.height;
    const popW = W - 60;
    const popH = 220;
    const popX = 30;
    const popY = H / 2 - popH / 2;

    const isHall    = result.score >= 8;
    const popColor  = isHall ? 0xfefce8 : 0xfffbeb;
    const popBorder = isHall ? 0xf59e0b : 0xfbbf24;

    // 暗幕（ふわっと）
    const overlay = this.add.graphics().setDepth(20).setAlpha(0);
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(0, 0, W, H);
    this.popupLayer.push(overlay);

    // 影
    const shadow = this.add.graphics().setDepth(21);
    shadow.fillStyle(0x000000, 0.15);
    shadow.fillRoundedRect(popX + 4, popY + 4, popW, popH, 16);

    // 付箋風カード
    const popBg = this.add.graphics().setDepth(22);
    popBg.fillStyle(popColor, 1);
    popBg.fillRoundedRect(popX, popY, popW, popH, 16);
    popBg.lineStyle(2, popBorder, 1);
    popBg.strokeRoundedRect(popX, popY, popW, popH, 16);
    this.popupLayer.push(shadow, popBg);

    // スタンプ風点数（右上）
    const scoreStr = result.score >= 0 ? `+${result.score}点` : `${result.score}点`;
    const scoreStamp = this.add.text(popX + popW - 16, popY + 16, scoreStr, {
      fontSize: '28px',
      color: isHall ? '#b45309' : '#c2410c',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(23);
    this.popupLayer.push(scoreStamp);

    // 役名
    const roleTxt = this.add.text(popX + 20, popY + 20, result.role_name || '', {
      fontSize: '16px',
      color: '#44403c',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold',
      wordWrap: { width: popW - 100 },
    }).setDepth(23);
    this.popupLayer.push(roleTxt);

    // 絵文字（大きめ・canvas画像）
    const emojiObjs = [];
    const emojis = Array.isArray(result.emojis) ? result.emojis : [];
    emojis.slice(0, 6).forEach((e, i) => {
      const ec = typeof e === 'string' ? e : e.emoji;
      try {
        const img = this.add.image(popX + 24 + i * 42, popY + 78, emojiKey(ec))
          .setDisplaySize(36, 36).setOrigin(0, 0.5).setDepth(23);
        emojiObjs.push(img);
        this.popupLayer.push(img);
      } catch(_) {}
    });

    // 区切り線
    const divLine = this.add.graphics().setDepth(23);
    divLine.lineStyle(1, 0xe5e7eb, 0.8);
    divLine.lineBetween(popX + 20, popY + 118, popX + popW - 20, popY + 118);
    this.popupLayer.push(divLine);

    // コメント（折り返しあり）
    const commentTxt = this.add.text(popX + 20, popY + 130, result.comment || '', {
      fontSize: '13px',
      color: '#57534e',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      wordWrap: { width: popW - 44, useAdvancedWrap: true },
      lineSpacing: 4,
    }).setDepth(23);
    this.popupLayer.push(commentTxt);

    // 閉じるヒント
    const closeTxt = this.add.text(W / 2, popY + popH + 20, 'タップして閉じる', {
      fontSize: '12px',
      color: '#d4a853',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
    }).setOrigin(0.5).setDepth(23);
    this.popupLayer.push(closeTxt);

    // ふわっと表示（y +10 → 元位置）
    const popItems = [shadow, popBg, scoreStamp, roleTxt, ...emojiObjs, divLine, commentTxt, closeTxt];
    popItems.forEach(o => { o.setAlpha(0); o.y += 10; });
    this.tweens.add({ targets: overlay,   alpha: 1, duration: 180, ease: 'Power2' });
    this.tweens.add({ targets: popItems,  alpha: 1, y: '-=10', duration: 220, ease: 'Power2' });

    // 全画面タップで閉じる（ポップアップ中は背景カードタップ不可）
    const closeZone = this.add.zone(0, 0, W, H)
      .setOrigin(0, 0).setInteractive().setDepth(24);
    closeZone.on('pointerdown', () => {
      this.tweens.add({
        targets: [...popItems, overlay],
        alpha: 0,
        duration: 150,
        ease: 'Power2',
        onComplete: () => {
          this.popupLayer.forEach(o => o.destroy());
          closeZone.destroy();
          this.popupLayer = null;
        }
      });
    });
    this.popupLayer.push(closeZone);
  }

  _startRematch() {
    const W = this.scale.width;
    this._rematchText = this.add.text(W / 2, 648, 'リマッチ申請中... 相手を待っています', {
      fontSize: '11px', color: '#c8b090', fontFamily: 'sans-serif'
    }).setOrigin(0.5).setDepth(10);
    this._rematchDeadline = Date.now() + 30000;
    this._pollRematch();
    this._rematchPollEvent = this.time.addEvent({
      delay: 3000, loop: true,
      callback: this._pollRematch, callbackScope: this
    });
  }

  async _pollRematch() {
    if (Date.now() > this._rematchDeadline) {
      if (this._rematchPollEvent) { this._rematchPollEvent.remove(); this._rematchPollEvent = null; }
      if (this._rematchText) this._rematchText.setText('相手が応答しませんでした');
      this.time.delayedCall(3000, () => { location.href = 'index.html'; });
      return;
    }
    try {
      const res  = await fetch('api/rematch.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: this.roomId, session_id: this.sessionId })
      });
      const data = await res.json();
      if (data.status === 'matched') {
        if (this._rematchPollEvent) { this._rematchPollEvent.remove(); this._rematchPollEvent = null; }
        sessionStorage.setItem(`emojibe_multi_${data.new_room_id}`, JSON.stringify({
          sessionId:      data.session_id,
          role:           data.my_role,
          initialHand:    data.initial_hand,
          hiddenIdx:      data.hidden_idx,
          fieldEmojis:    data.field_emojis,
          oppInitialHand: data.opp_initial_hand || [],
        }));
        sessionStorage.removeItem(`emojibe_multi_${this.roomId}`);
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(300, () => {
          location.href = `game_multi.html?room=${data.new_room_id}`;
        });
      }
    } catch(_) {}
  }

  shutdown() {
    if (this.pollEvent)         this.pollEvent.remove();
    if (this._rematchPollEvent) this._rematchPollEvent.remove();
    if (this.popupLayer)        { this.popupLayer.forEach(o => o.destroy()); this.popupLayer = null; }
  }
}

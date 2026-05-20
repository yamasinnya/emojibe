class ResultSceneMulti extends Phaser.Scene {
  constructor() { super({ key: 'ResultSceneMulti' }); }

  init(data) {
    this.roles     = data.roles     || [];
    this.sessionId = data.sessionId || '';
    this.roomId    = data.roomId    || '';
    this.resuming  = data.resuming  || false;

    this.myResults    = [];
    this.oppResults   = [];
    this.myTotal      = 0;
    this.nextCardY    = 0;
    this.pollEvent    = null;
    this.scoringDone  = false;
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
    this.nextCardY = nbY + 28;
  }

  _createButtons(W) {
    const againBtn = this.add.text(W / 2 - 70, 618, 'もう一度', {
      fontSize: '14px', color: '#f5e6c8',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      backgroundColor: '#4a3520', padding: { x: 16, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    againBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('JoinScene'));
    });

    const homeBtn = this.add.text(W / 2 + 70, 618, 'トップへ', {
      fontSize: '14px', color: '#2a1a0a',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      backgroundColor: '#d4a853', padding: { x: 16, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    homeBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('TopScene'));
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
    const cardH = 88;
    this.nextCardY += cardH + 10;

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

    const emojiStr = (result.emojis || []);
    const emojis = (typeof emojiStr === 'string' ? emojiStr.split('') : emojiStr);
    emojis.slice(0, 6).forEach((e, idx) => {
      const ec = typeof e === 'string' ? e : e.emoji;
      try {
        this.add.image(-cardW / 2 + 14 + idx * 22, -cardH / 2 + 40, emojiKey(ec)).setDisplaySize(18, 18);
      } catch(_) {}
    });

    const scoreStr = result.score >= 0 ? `+${result.score}点` : `${result.score}点`;
    const scoreText = this.add.text(cardW / 2 - 10, -cardH / 2 + 14, scoreStr, {
      fontSize: '20px', color: result.score >= 0 ? '#c03020' : '#606060',
      fontFamily: 'sans-serif', fontStyle: 'bold'
    }).setOrigin(1, 0);

    const comment = this.add.text(-cardW / 2 + 10, -cardH / 2 + 60, result.comment || '', {
      fontSize: '11px', color: '#6a5a40', fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif'
    });

    cc.add([card, nameText, scoreText, comment]);
    this.tweens.add({ targets: cc, alpha: 1, scaleX: 1, scaleY: 1, duration: 400, ease: 'Back.out' });
  }

  _showMyTotal() {
    const W = this.scale.width;
    const totalY = this.nextCardY + 14;
    this.nextCardY = totalY + 50;

    const tc = this.add.container(W / 2, totalY).setDepth(1).setAlpha(0);
    const bg = this.add.graphics();
    bg.fillStyle(0x4a7c59, 1);
    bg.fillRoundedRect(-120, -22, 240, 44, 8);
    const label = this.add.text(0, 0,
      `自分の合計　${this.myTotal >= 0 ? '+' : ''}${this.myTotal}点`, {
      fontSize: '18px', color: '#f0fff0',
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
      if (state.status === 'done' || (state.opp_results && state.opp_results.length > 0)) {
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
    // VS仕切り線
    const divY = this.nextCardY + 10;
    this.nextCardY = divY + 28;
    const divText = this.add.text(W / 2, divY, '── VS ──', {
      fontSize: '13px', color: '#c03020', fontFamily: 'sans-serif'
    }).setOrigin(0.5).setDepth(1);

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

    const winnerY = this.nextCardY + 20;
    const wc = this.add.container(W / 2, winnerY).setDepth(2).setAlpha(0);

    const myT  = this.myTotal;
    const oppT = oppTotal;
    let label, bgColor;
    if (winner === 'me')   { label = `あなたの勝ち！🏆  ${myT}点 vs ${oppT}点`; bgColor = 0xd4a853; }
    else if (winner === 'them') { label = `相手の勝ち...  ${myT}点 vs ${oppT}点`; bgColor = 0x7a5a30; }
    else                    { label = `引き分け！  ${myT}点 vs ${oppT}点`;          bgColor = 0x4a7c59; }

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 1);
    bg.fillRoundedRect(-145, -28, 290, 56, 10);
    const text = this.add.text(0, 0, label, {
      fontSize: '16px', color: '#fff',
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

  shutdown() {
    if (this.pollEvent) this.pollEvent.remove();
  }
}

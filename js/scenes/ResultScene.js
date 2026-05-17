class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  init(data) {
    this.roles = data.roles || [];
    this.scores = [];
    this.totalScore = 0;
    this.scoringIndex = 0;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.createBackground(W, H);
    this.createResultArea(W, H);
    this.createButtons(W, H);

    this.add.text(W / 2, H - 38, '採点中... しばらくお待ちください', {
      fontSize: '12px',
      color: '#c8b090',
      fontFamily: 'sans-serif'
    }).setOrigin(0.5);

    this.cameras.main.fadeIn(400, 0, 0, 0);

    // 採点開始（少し待ってから）
    this.time.delayedCall(600, () => this.scoreNextRole());
  }

  createBackground(W, H) {
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

    this.add.text(W / 2, 25, '採　点　結　果', {
      fontSize: '14px',
      color: '#f5e6c8',
      fontFamily: 'sans-serif',
      letterSpacing: 5
    }).setOrigin(0.5);
  }

  createResultArea(W, H) {
    const nbX = 12;
    const nbY = 58;
    const nbW = W - 24;
    const nbH = 600;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.2);
    shadow.fillRoundedRect(nbX + 4, nbY + 4, nbW, nbH, 8);

    const nb = this.add.graphics();
    nb.fillStyle(0xf8f4e8, 1);
    nb.fillRoundedRect(nbX, nbY, nbW, nbH, 8);
    nb.lineStyle(1, 0xe0d8c0, 1);
    nb.strokeRoundedRect(nbX, nbY, nbW, nbH, 8);

    const grid = this.add.graphics();
    grid.lineStyle(0.5, 0xc8d0e8, 0.4);
    for (let gy = nbY + 18; gy < nbY + nbH; gy += 18) {
      grid.beginPath();
      grid.moveTo(nbX, gy);
      grid.lineTo(nbX + nbW, gy);
      grid.strokePath();
    }

    this.resultAreaBounds = { x: nbX, y: nbY, w: nbW, h: nbH };
    this.nextCardY = nbY + 30;
  }

  createButtons(W, H) {
    const againBtn = this.add.text(W / 2 - 70, H - 42, 'もう一度', {
      fontSize: '14px',
      color: '#f5e6c8',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      backgroundColor: '#4a3520',
      padding: { x: 16, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    againBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('FieldScene'));
    });

    const homeBtn = this.add.text(W / 2 + 70, H - 42, 'トップへ', {
      fontSize: '14px',
      color: '#2a1a0a',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      backgroundColor: '#d4a853',
      padding: { x: 16, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    homeBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('TopScene'));
    });
  }

  async scoreNextRole() {
    if (this.scoringIndex >= this.roles.length) {
      this.showTotal();
      return;
    }

    const role = this.roles[this.scoringIndex];
    this.scoringIndex++;

    let result;
    try {
      result = await this.fetchScore(role);
    } catch (e) {
      // APIエラー時はフォールバックスコア
      result = { score: 1, comment: '採点できませんでした' };
    }

    this.totalScore += result.score;
    this.scores.push({ ...role, ...result });
    this.showRoleCard(role, result);

    // 次の役へ
    this.time.delayedCall(800, () => this.scoreNextRole());
  }

  async fetchScore(role) {
    const emojiList = role.emojis.map(e => `${e.emoji}(${e.name})`).join('、');
    const response = await fetch('api/score.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emojis: role.emojis.map(e => e.emoji),
        emoji_names: role.emojis.map(e => e.name),
        role_name: role.name
      })
    });

    if (!response.ok) throw new Error('API error');

    const data = await response.json();
    if (data.content && data.content[0] && data.content[0].text) {
      const text = data.content[0].text;
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    }
    return { score: 1, comment: '面白い組み合わせ！' };
  }

  showRoleCard(role, result) {
    const W = this.scale.width;
    const cardX = this.resultAreaBounds.x + 16;
    const cardY = this.nextCardY;
    const cardW = this.resultAreaBounds.w - 32;
    const cardH = 100;

    this.nextCardY += cardH + 12;

    // 付箋風カード（少し回転）
    const angle = Phaser.Math.Between(-2, 2);
    const cardContainer = this.add.container(cardX + cardW / 2, cardY + cardH / 2);
    cardContainer.setAngle(angle);
    cardContainer.setAlpha(0);
    cardContainer.setScale(0.7);

    const scoreColor = result.score >= 8 ? 0xffd700
                     : result.score >= 5 ? 0xffa040
                     : result.score >= 3 ? 0xf0e060
                     : result.score < 0  ? 0xffc0c0
                     : 0xfff8d0;

    const card = this.add.graphics();
    card.fillStyle(scoreColor, 0.95);
    card.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
    card.lineStyle(1, 0xd0c0a0, 0.7);
    card.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);

    const roleName = this.add.text(-cardW / 2 + 12, -cardH / 2 + 12, role.name, {
      fontSize: '15px',
      color: '#4a3520',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold'
    });

    const emojiImgs = role.emojis.map((e, idx) =>
      this.add.image(-cardW / 2 + 22 + idx * 30, -cardH / 2 + 50, emojiKey(e.emoji))
        .setDisplaySize(24, 24)
    );

    const scoreStr = result.score >= 0 ? `+${result.score}点` : `${result.score}点`;
    const scoreText = this.add.text(cardW / 2 - 12, -cardH / 2 + 16, scoreStr, {
      fontSize: '22px',
      color: result.score >= 0 ? '#c03020' : '#606060',
      fontFamily: 'sans-serif',
      fontStyle: 'bold'
    }).setOrigin(1, 0);

    const commentText = this.add.text(-cardW / 2 + 12, -cardH / 2 + 70, result.comment, {
      fontSize: '12px',
      color: '#6a5a40',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif'
    });

    cardContainer.add([card, roleName, ...emojiImgs, scoreText, commentText]);

    this.tweens.add({
      targets: cardContainer,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 450,
      ease: 'Back.out'
    });
  }

  showTotal() {
    const W = this.scale.width;
    const totalY = this.nextCardY + 20;

    const totalContainer = this.add.container(W / 2, totalY);
    totalContainer.setAlpha(0);

    const totalBg = this.add.graphics();
    totalBg.fillStyle(0xd4a853, 1);
    totalBg.fillRoundedRect(-130, -28, 260, 56, 8);

    const label = this.add.text(-10, 0, `合計　${this.totalScore >= 0 ? '+' : ''}${this.totalScore}点！`, {
      fontSize: '24px',
      color: '#2a1a0a',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    totalContainer.add([totalBg, label]);

    this.tweens.add({
      targets: totalContainer,
      alpha: 1,
      y: totalY - 10,
      duration: 600,
      ease: 'Back.out'
    });

    // DBに保存
    this.saveToDb();
  }

  saveToDb() {
    fetch('api/save_role.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roles: this.scores,
        total_score: this.totalScore
      })
    }).catch(() => {});
  }
}

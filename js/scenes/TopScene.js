class TopScene extends Phaser.Scene {
  constructor() { super({ key: 'TopScene' }); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.createBackground(W, H);
    this.createNotebook(W, H);
    this.createPlayButton(W, H);
    this.createVersionText(W, H);

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  createBackground(W, H) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x3d2b1a, 0x3d2b1a, 0x2a1a0a, 0x2a1a0a, 1);
    bg.fillRect(0, 0, W, H);

    for (let i = 0; i < 18; i++) {
      const g = this.add.graphics();
      g.lineStyle(1.5, 0x4a3520, 0.25);
      g.beginPath();
      const y1 = i * 50 + Phaser.Math.Between(-12, 12);
      const y2 = i * 50 + Phaser.Math.Between(-12, 12);
      g.moveTo(0, y1);
      g.lineTo(W, y2);
      g.strokePath();
    }
  }

  createNotebook(W, H) {
    const nbX = W / 2 - 140;
    const nbY = H / 2 - 220;
    const nbW = 280;
    const nbH = 210;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.25);
    shadow.fillRoundedRect(nbX + 5, nbY + 5, nbW, nbH, 8);

    const nb = this.add.graphics();
    nb.fillStyle(0xf8f4e8, 1);
    nb.fillRoundedRect(nbX, nbY, nbW, nbH, 8);
    nb.lineStyle(1, 0xe0d8c0, 1);
    nb.strokeRoundedRect(nbX, nbY, nbW, nbH, 8);

    const grid = this.add.graphics();
    grid.lineStyle(0.5, 0xc8d0e8, 0.5);
    for (let gx = nbX + 20; gx < nbX + nbW; gx += 18) {
      grid.beginPath();
      grid.moveTo(gx, nbY);
      grid.lineTo(gx, nbY + nbH);
      grid.strokePath();
    }
    for (let gy = nbY + 20; gy < nbY + nbH; gy += 18) {
      grid.beginPath();
      grid.moveTo(nbX, gy);
      grid.lineTo(nbX + nbW, gy);
      grid.strokePath();
    }

    this.add.text(W / 2, nbY + 42, 'えもじべ', {
      fontSize: '44px',
      color: '#4a3520',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(W / 2, nbY + 102, 'emoji + jibe', {
      fontSize: '14px',
      color: '#8a7560',
      fontFamily: 'sans-serif',
      letterSpacing: 3
    }).setOrigin(0.5);

    this.add.text(W / 2, nbY + 136, '絵文字で役を作る取り合いゲーム', {
      fontSize: '13px',
      color: '#6a5a40',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif'
    }).setOrigin(0.5);

    const decos = [
      { emoji: '🎲', x: nbX + 28, y: nbY + 28 },
      { emoji: '🌸', x: nbX + nbW - 28, y: nbY + 28 },
      { emoji: '⭐', x: nbX + 28, y: nbY + nbH - 28 },
      { emoji: '🎯', x: nbX + nbW - 28, y: nbY + nbH - 28 },
    ];
    decos.forEach(d => {
      this.add.image(d.x, d.y, emojiKey(d.emoji)).setDisplaySize(22, 22);
    });
  }

  createPlayButton(W, H) {
    const btnY = H / 2 + 55;
    const btnW = 220;
    const btnH = 48;

    const btnBg = this.add.graphics();
    const drawBtn = (color) => {
      btnBg.clear();
      btnBg.fillStyle(color, 1);
      btnBg.fillRoundedRect(W / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, 24);
    };
    drawBtn(0xd4a853);

    const btnText = this.add.text(W / 2, btnY, 'ソロモードで遊ぶ', {
      fontSize: '17px',
      color: '#2a1a0a',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btnText.on('pointerover', () => {
      drawBtn(0xe8c070);
      this.tweens.add({ targets: btnText, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    btnText.on('pointerout', () => {
      drawBtn(0xd4a853);
      this.tweens.add({ targets: btnText, scaleX: 1, scaleY: 1, duration: 100 });
    });
    btnText.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => {
        this.scene.start('FieldScene');
      });
    });
  }

  createVersionText(W, H) {
    this.add.text(W / 2, H - 28, 'v0.1.0 — やまし制作', {
      fontSize: '11px',
      color: '#6a5040',
      fontFamily: 'sans-serif',
      alpha: 0.5
    }).setOrigin(0.5).setAlpha(0.5);
  }
}

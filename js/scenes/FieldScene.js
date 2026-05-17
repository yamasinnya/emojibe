class FieldScene extends Phaser.Scene {
  constructor() { super({ key: 'FieldScene' }); }

  init() {
    this.playerHand = [];
    this.takenEmojis = [];
    this.fieldStickers = [];
    this.handStickers = [];
    this.turn = 0;
    this.maxTurns = 6;
    this.gameStarted = false;
    this.selectedSticker = null;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.createBackground(W, H);

    // 場のノート（方眼紙）
    this.createFieldNotebook(W, H);

    // プレイヤー手帳エリア
    this.createHandbookArea(W, H);

    // 情報バー（ターン・採点ボタン）
    this.createInfoBar(W, H);

    // 絵文字を配る
    this.dealEmojis(W, H);

    this.cameras.main.fadeIn(400, 0, 0, 0);

    // シール登場アニメが終わったら自動スタート
    this.time.delayedCall(800, () => this.startGame());
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
  }

  createFieldNotebook(W, H) {
    const nbX = 14;
    const nbY = 58;
    const nbW = W - 28;
    const nbH = 400;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.25);
    shadow.fillRoundedRect(nbX + 4, nbY + 4, nbW, nbH, 8);

    const nb = this.add.graphics();
    nb.fillStyle(0xf8f4e8, 1);
    nb.fillRoundedRect(nbX, nbY, nbW, nbH, 8);
    nb.lineStyle(1, 0xe0d8c0, 1);
    nb.strokeRoundedRect(nbX, nbY, nbW, nbH, 8);

    const grid = this.add.graphics();
    grid.lineStyle(0.5, 0xc8d0e8, 0.45);
    for (let gx = nbX + 20; gx < nbX + nbW; gx += 18) {
      grid.beginPath();
      grid.moveTo(gx, nbY);
      grid.lineTo(gx, nbY + nbH);
      grid.strokePath();
    }
    for (let gy = nbY + 18; gy < nbY + nbH; gy += 18) {
      grid.beginPath();
      grid.moveTo(nbX, gy);
      grid.lineTo(nbX + nbW, gy);
      grid.strokePath();
    }

    // 綴じ穴
    for (let i = 0; i < 5; i++) {
      const hole = this.add.graphics();
      hole.fillStyle(0xd0c8b0, 1);
      hole.fillCircle(nbX + 14, nbY + 40 + i * 72, 5);
      hole.lineStyle(1, 0xb8b0a0, 1);
      hole.strokeCircle(nbX + 14, nbY + 40 + i * 72, 5);
    }

    this.add.text(W / 2, nbY + 14, '場　の　シール', {
      fontSize: '11px',
      color: '#a0988c',
      fontFamily: 'sans-serif',
      letterSpacing: 4
    }).setOrigin(0.5);

    this.fieldNotebookBounds = { x: nbX, y: nbY, w: nbW, h: nbH };
  }

  createHandbookArea(W, H) {
    const nbX = 14;
    const nbY = 476;
    const nbW = W - 28;
    const nbH = 240;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.2);
    shadow.fillRoundedRect(nbX + 4, nbY + 4, nbW, nbH, 8);

    const nb = this.add.graphics();
    nb.fillStyle(0x2d5a3d, 0.18);
    nb.fillRoundedRect(nbX, nbY, nbW, nbH, 8);
    nb.lineStyle(1.5, 0x4a7c59, 0.5);
    nb.strokeRoundedRect(nbX, nbY, nbW, nbH, 8);

    this.add.text(W / 2, nbY + 14, '自 分 の 手 帳', {
      fontSize: '11px',
      color: '#a8d5b5',
      fontFamily: 'sans-serif',
      letterSpacing: 4
    }).setOrigin(0.5);

    this.handbookBounds = { x: nbX, y: nbY, w: nbW, h: nbH };
  }

  createInfoBar(W, H) {
    // 上部バー背景
    const bar = this.add.graphics();
    bar.fillStyle(0x1a1008, 0.85);
    bar.fillRect(0, 0, W, 54);

    this.add.text(14, 14, 'えもじべ', {
      fontSize: '15px',
      color: '#f5e6c8',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold'
    });

    this.turnText = this.add.text(W / 2, 27, '', {
      fontSize: '12px',
      color: '#f5e6c8',
      fontFamily: 'sans-serif'
    }).setOrigin(0.5);
  }

  dealEmojis(W, H) {
    // 手札7枚 + 場20枚 = 27枚をユニークに引く
    const allDrawn = getRandomEmojis(27);
    const initialHand = allDrawn.slice(0, 7);
    const fieldPool = allDrawn.slice(7, 27);

    this.playerHand = [...initialHand];

    // 場のシールを配置（5列×4行）
    const cols = 5;
    const rows = 4;
    const stickerSize = 40;
    const nb = this.fieldNotebookBounds;
    const innerW = nb.w - 50;
    const innerH = nb.h - 50;
    const gapX = (innerW - cols * stickerSize) / (cols - 1);
    const gapY = (innerH - rows * stickerSize) / (rows - 1);
    const startX = nb.x + 28;
    const startY = nb.y + 36;

    fieldPool.forEach((emojiData, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (stickerSize + gapX) + stickerSize / 2 + Phaser.Math.Between(-3, 3);
      const y = startY + row * (stickerSize + gapY) + stickerSize / 2 + Phaser.Math.Between(-3, 3);
      const angle = Phaser.Math.Between(-9, 9);
      const sticker = this.createSticker(x, y, emojiData, angle, 0xfffef0, stickerSize);
      this.fieldStickers.push(sticker);
    });

    // 初期手札を手帳エリアに配置（1枚は裏向き）
    this.placeHandStickers(initialHand, W, H);
  }

  placeHandStickers(handEmojis, W, H) {
    const hb = this.handbookBounds;
    const count = handEmojis.length;
    const stickerSize = 36;
    const totalW = count * stickerSize + (count - 1) * 6;
    const startX = (W - totalW) / 2 + stickerSize / 2;
    const y = hb.y + 65;

    handEmojis.forEach((emojiData, i) => {
      const x = startX + i * (stickerSize + 6);
      const angle = Phaser.Math.Between(-10, 10);
      const sticker = this.createSticker(x, y, emojiData, angle, 0xf0fff0, stickerSize);
      this.handStickers.push(sticker);
    });

    // 取った絵文字用のスロット表示
    this.takenRow = [];
    const takenStartX = (W - (this.maxTurns * (stickerSize + 6) - 6)) / 2 + stickerSize / 2;
    const takenY = hb.y + 120;
    for (let i = 0; i < this.maxTurns; i++) {
      const x = takenStartX + i * (stickerSize + 6);
      const slot = this.add.graphics();
      slot.lineStyle(1, 0x4a7c59, 0.35);
      slot.strokeRoundedRect(x - stickerSize / 2, takenY - stickerSize / 2, stickerSize, stickerSize, 5);
      this.takenRow.push({ x, y: takenY, slot });
    }
  }

  startGame() {
    this.gameStarted = true;
    this.turn = 1;
    this.updateTurnText();
    this.enableFieldStickerInteraction();
  }

  updateTurnText() {
    if (this.turn <= this.maxTurns) {
      this.turnText.setText(`ターン ${this.turn} / ${this.maxTurns}　— シールを1枚取ろう`);
    } else {
      this.turnText.setText('全部取った！役を作ろう');
    }
  }

  enableFieldStickerInteraction() {
    this.fieldStickers.forEach(sticker => {
      if (sticker.taken) return;

      sticker.container.setInteractive(
        new Phaser.Geom.Rectangle(-22, -22, 44, 44),
        Phaser.Geom.Rectangle.Contains
      );

      sticker.container.on('pointerover', () => {
        if (!this.gameStarted || sticker.taken) return;
        this.tweens.add({
          targets: sticker.container,
          scaleX: 1.25, scaleY: 1.25,
          duration: 120, ease: 'Back.out'
        });
      });

      sticker.container.on('pointerout', () => {
        if (!sticker.taken) {
          this.tweens.add({
            targets: sticker.container,
            scaleX: 1, scaleY: 1,
            duration: 120
          });
        }
      });

      sticker.container.on('pointerdown', () => {
        if (!this.gameStarted || sticker.taken || this.turn > this.maxTurns) return;
        this.takeSticker(sticker);
      });
    });
  }

  takeSticker(sticker) {
    sticker.taken = true;
    sticker.container.disableInteractive();

    const takenSlot = this.takenRow[this.turn - 1];
    const targetX = takenSlot.x;
    const targetY = takenSlot.y;

    this.tweens.add({
      targets: sticker.container,
      x: targetX,
      y: targetY,
      scaleX: 0.9,
      scaleY: 0.9,
      angle: Phaser.Math.Between(-8, 8),
      duration: 380,
      ease: 'Back.inOut',
      onComplete: () => {
        this.takenEmojis.push(sticker.emojiData);
        this.turn++;
        if (this.turn > this.maxTurns) {
          this.onAllTurnsDone();
        } else {
          this.updateTurnText();
        }
      }
    });
  }

  onAllTurnsDone() {
    this.updateTurnText();
    this.time.delayedCall(500, () => this.showRoleMakeButton());
  }

  showRoleMakeButton() {
    const W = this.scale.width;
    const H = this.scale.height;
    const btnY = H - 48;
    const btnW = 200;
    const btnH = 42;

    const bg = this.add.graphics();
    const draw = (color) => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(W / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, 21);
    };
    draw(0x4a7c59);

    const btn = this.add.text(W / 2, btnY, '役を作る！', {
      fontSize: '18px',
      color: '#f0fff0',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => draw(0x5a9c6a));
    btn.on('pointerout', () => draw(0x4a7c59));
    btn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => {
        const fullHand = [...this.playerHand, ...this.takenEmojis];
        this.scene.start('HandScene', { hand: fullHand });
      });
    });
  }

  createSticker(x, y, emojiData, angle, bgColor, size = 40) {
    const container = this.add.container(x, y);
    const half = size / 2;

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.93);
    bg.fillRoundedRect(-half, -half, size, size, 6);
    bg.lineStyle(1, 0xd0c8b0, 0.65);
    bg.strokeRoundedRect(-half, -half, size, size, 6);

    const emojiImg = this.add.image(0, 0, emojiKey(emojiData.emoji))
      .setDisplaySize(Math.floor(size * 0.65), Math.floor(size * 0.65));

    container.add([bg, emojiImg]);
    container.setAngle(angle);
    container.setScale(0);

    this.tweens.add({
      targets: container,
      scaleX: 1, scaleY: 1,
      duration: 280,
      delay: Math.random() * 350,
      ease: 'Back.out'
    });

    return { container, emojiData, taken: false };
  }

}

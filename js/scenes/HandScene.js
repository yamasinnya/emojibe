class HandScene extends Phaser.Scene {
  constructor() { super({ key: 'HandScene' }); }

  init(data) {
    this.hand = data.hand || [];
    this.roles = [];
    this.selectedEmojis = [];
    this.selectedIndices = new Set();
    this.stickerContainers = [];
    this.roleListItems = [];
    this.inputEl = null;
    this.nextScene  = data.nextScene  || 'ResultScene';
    this.roomId     = data.roomId     || null;
    this.sessionId  = data.sessionId  || null;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.createBackground(W, H);
    this.createHandbook(W, H);
    this.createRolePanel(W, H);
    this.createInput(W, H);
    this.createButtons(W, H);
    this.placeHandStickers(W, H);
    this.updateUI();

    this.cameras.main.fadeIn(400, 0, 0, 0);
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

    // 上部バー
    const bar = this.add.graphics();
    bar.fillStyle(0x1a1008, 0.85);
    bar.fillRect(0, 0, W, 50);

    this.add.text(W / 2, 25, '役　を　作　ろ　う', {
      fontSize: '14px',
      color: '#f5e6c8',
      fontFamily: 'sans-serif',
      letterSpacing: 4
    }).setOrigin(0.5);
  }

  createHandbook(W, H) {
    const nbX = 12;
    const nbY = 56;
    const nbW = W - 24;
    const nbH = 170;

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

    this.add.text(W / 2, nbY + 14, '自 分 の 手 帳', {
      fontSize: '11px',
      color: '#a0988c',
      fontFamily: 'sans-serif',
      letterSpacing: 4
    }).setOrigin(0.5);

    this.handbookBounds = { x: nbX, y: nbY, w: nbW, h: nbH };
  }

  createRolePanel(W, H) {
    const nbX = 12;
    const nbY = 234;
    const nbW = W - 24;
    const nbH = 123;

    const nb = this.add.graphics();
    nb.fillStyle(0x1a1008, 0.7);
    nb.fillRoundedRect(nbX, nbY, nbW, nbH, 8);
    nb.lineStyle(1, 0x4a3520, 0.6);
    nb.strokeRoundedRect(nbX, nbY, nbW, nbH, 8);

    this.add.text(W / 2, nbY + 14, '宣 言 し た 役', {
      fontSize: '11px',
      color: '#c8b090',
      fontFamily: 'sans-serif',
      letterSpacing: 4
    }).setOrigin(0.5);

    this.rolePanelBounds = { x: nbX, y: nbY, w: nbW, h: nbH };
    this.roleListY = nbY + 34;
  }

  createInput(W, H) {
    const inputY = 413;

    this.add.text(W / 2, inputY - 18, '役名を入力', {
      fontSize: '11px',
      color: '#c8b090',
      fontFamily: 'sans-serif'
    }).setOrigin(0.5);

    const input = this.add.dom(W / 2 - 25, inputY, 'input');
    input.node.type = 'text';
    input.node.placeholder = '例：夕焼けの海、失恋した夜…';
    input.node.maxLength = 20;
    input.node.style.cssText = [
      'width: 270px',
      'padding: 10px 16px',
      'font-size: 15px',
      'font-family: Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      'border: 2px solid #b0a080',
      'border-radius: 20px',
      'background: rgba(255,254,240,0.97)',
      'text-align: center',
      'outline: none',
      'color: #4a3520',
      'box-sizing: border-box',
    ].join(';');
    input.setOrigin(0.5, 0.5);

    this.inputEl = input;
  }

  createButtons(W, H) {
    // 「役を追加」ボタン
    const addBtnY = 473;
    const addBg = this.add.graphics();
    const drawAdd = (color) => {
      addBg.clear();
      addBg.fillStyle(color, 1);
      addBg.fillRoundedRect(W / 2 - 110, addBtnY - 18, 220, 36, 18);
    };
    drawAdd(0x7c5a2d);

    this.addBtn = this.add.text(W / 2, addBtnY, '+ この役を追加', {
      fontSize: '14px',
      color: '#f5e6c8',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.addBtn.on('pointerover', () => drawAdd(0x9a7040));
    this.addBtn.on('pointerout', () => drawAdd(0x7c5a2d));
    this.addBtn.on('pointerdown', () => this.addRole());

    // 「採点！」スタンプボタン
    const scoreBtnY = 533;
    const scoreBg = this.add.graphics();
    const drawScore = (color) => {
      scoreBg.clear();
      scoreBg.fillStyle(color, 1);
      scoreBg.fillRoundedRect(W / 2 - 90, scoreBtnY - 22, 180, 44, 10);
    };
    drawScore(0xc0302a);

    this.scoreBtn = this.add.text(W / 2, scoreBtnY, '採　点　！', {
      fontSize: '20px',
      color: '#fff0f0',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold',
      letterSpacing: 4
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.scoreBtn.on('pointerover', () => drawScore(0xd84040));
    this.scoreBtn.on('pointerout', () => drawScore(0xc0302a));
    this.scoreBtn.on('pointerdown', () => this.submitForScoring());

    this.selectionHintText = this.add.text(W / 2, 585, '手帳のシールをタップして選ぼう', {
      fontSize: '12px',
      color: '#c8b090',
      fontFamily: 'sans-serif'
    }).setOrigin(0.5);

    this.selectionCountText = this.add.text(W / 2, 607, '', {
      fontSize: '12px',
      color: '#a8d5b5',
      fontFamily: 'sans-serif'
    }).setOrigin(0.5);
  }

  placeHandStickers(W, H) {
    const count = this.hand.length;
    const stickerSize = 40;
    const gap = 4;
    const cols = 7;
    const rows = Math.ceil(count / cols);
    const hb = this.handbookBounds;

    const totalW = cols * (stickerSize + gap) - gap;
    const startX = (W - totalW) / 2 + stickerSize / 2;
    const startY = hb.y + 50;
    const rowGap = stickerSize + 8;

    this.hand.forEach((emojiData, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (stickerSize + gap);
      const y = startY + row * rowGap;
      const angle = Phaser.Math.Between(-8, 8);
      const sticker = this.createHandSticker(x, y, emojiData, angle, stickerSize, i);
      this.stickerContainers.push(sticker);
    });
  }

  createHandSticker(x, y, emojiData, angle, size, index) {
    const container = this.add.container(x, y);
    const half = size / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0xfffef0, 0.95);
    bg.fillRoundedRect(-half, -half, size, size, 5);
    bg.lineStyle(1, 0xd0c8b0, 0.7);
    bg.strokeRoundedRect(-half, -half, size, size, 5);

    const emojiImg = this.add.image(0, 0, emojiKey(emojiData.emoji))
      .setDisplaySize(Math.floor(size * 0.65), Math.floor(size * 0.65));

    container.add([bg, emojiImg]);
    container.setAngle(angle);

    container.setInteractive(
      new Phaser.Geom.Rectangle(-half - 2, -half - 2, size + 4, size + 4),
      Phaser.Geom.Rectangle.Contains
    );

    container.on('pointerdown', () => this.toggleStickerSelection(index, bg, container, half, size));

    return { container, bg, emojiData, index, half, size, selected: false };
  }

  toggleStickerSelection(index, bg, container, half, size) {
    const stickerObj = this.stickerContainers[index];
    stickerObj.selected = !stickerObj.selected;

    if (stickerObj.selected) {
      this.selectedIndices.add(index);
      bg.clear();
      bg.fillStyle(0xb8e8c8, 0.95);
      bg.fillRoundedRect(-half, -half, size, size, 5);
      bg.lineStyle(2, 0x4a7c59, 1);
      bg.strokeRoundedRect(-half, -half, size, size, 5);
      this.tweens.add({ targets: container, scaleX: 1.1, scaleY: 1.1, duration: 100 });
    } else {
      this.selectedIndices.delete(index);
      bg.clear();
      bg.fillStyle(0xfffef0, 0.95);
      bg.fillRoundedRect(-half, -half, size, size, 5);
      bg.lineStyle(1, 0xd0c8b0, 0.7);
      bg.strokeRoundedRect(-half, -half, size, size, 5);
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
    }

    this.updateSelectionCount();
  }

  updateSelectionCount() {
    const n = this.selectedIndices.size;
    if (n === 0) {
      this.selectionCountText.setText('');
    } else {
      const names = [...this.selectedIndices].map(i => this.hand[i].name).join('・');
      this.selectionCountText.setText(`選択中: ${names}`);
    }
  }

  addRole() {
    if (this.roles.length >= 3) {
      this.showFlash('役は3つまでです！', 0xc08030);
      return;
    }

    if (this.selectedIndices.size === 0) {
      this.showFlash('シールを選んでね！', 0xc08030);
      return;
    }

    if (this.selectedIndices.size < 3) {
      this.showFlash('シールを3枚以上選んでね！', 0xc08030);
      return;
    }

    const roleName = this.inputEl.node.value.trim();
    if (!roleName) {
      this.showFlash('役名を入力してね！', 0xc08030);
      return;
    }

    const selectedEmojis = [...this.selectedIndices].map(i => this.hand[i]);
    this.roles.push({ name: roleName, emojis: selectedEmojis });

    // 選択を解除（グレーアウトせず、また選べる状態に戻す）
    this.selectedIndices.forEach(i => {
      const sticker = this.stickerContainers[i];
      sticker.selected = false;
      sticker.bg.clear();
      sticker.bg.fillStyle(0xfffef0, 0.95);
      sticker.bg.fillRoundedRect(-sticker.half, -sticker.half, sticker.size, sticker.size, 5);
      sticker.bg.lineStyle(1, 0xd0c8b0, 0.7);
      sticker.bg.strokeRoundedRect(-sticker.half, -sticker.half, sticker.size, sticker.size, 5);
      sticker.container.setScale(1);
    });

    this.selectedIndices.clear();
    this.inputEl.node.value = '';
    this.inputEl.node.blur();
    this.selectionCountText.setText('');
    this.updateRoleList();
    this.showFlash(`「${roleName}」を追加！`, 0x4a7c59);
  }

  updateRoleList() {
    this.roleListItems.forEach(t => t.destroy());
    this.roleListItems = [];

    this.roles.forEach((role, i) => {
      const emojisStr = role.emojis.map(e => e.emoji).join('');
      const text = this.add.text(
        this.rolePanelBounds.x + 14,
        this.roleListY + i * 28,
        `${i + 1}. ${role.name}　${emojisStr}`,
        {
          fontSize: '13px',
          color: '#f5e6c8',
          fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif'
        }
      );
      this.roleListItems.push(text);

      const del = this.add.text(
        this.rolePanelBounds.x + this.rolePanelBounds.w - 14,
        this.roleListY + i * 28,
        '✕',
        { fontSize: '13px', color: '#ff8888', fontFamily: 'sans-serif' }
      ).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setDepth(5);
      del.on('pointerdown', () => this.deleteRole(i));
      this.roleListItems.push(del);
    });
  }

  deleteRole(i) {
    this.roles.splice(i, 1);
    this.updateRoleList();
  }

  showFlash(message, color) {
    const W = this.scale.width;
    const flash = this.add.text(W / 2, 222, message, {
      fontSize: '15px',
      color: '#ffffff',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold',
      backgroundColor: '#' + color.toString(16).padStart(6, '0'),
      padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(10);

    this.tweens.add({
      targets: flash,
      y: 192,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => flash.destroy()
    });
  }

  updateUI() {
    // 初期ヒントテキスト更新はselectionCountTextで行う
  }

  submitForScoring() {
    if (this.roles.length === 0) {
      this.showFlash('役を最低1つ作ってね！', 0xc08030);
      return;
    }

    if (this.inputEl) {
      this.inputEl.destroy();
    }

    const sessionId = this.sessionId || (crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      }));

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.start(this.nextScene, { roles: this.roles, sessionId, roomId: this.roomId });
    });
  }

  shutdown() {
    if (this.inputEl) {
      this.inputEl.destroy();
    }
  }
}

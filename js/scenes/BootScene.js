class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.graphics().fillStyle(0x2a1a0a, 1).fillRect(0, 0, W, H);
    this.add.text(W / 2, H / 2 - 20, 'えもじべ', {
      fontSize: '38px',
      color: '#f5e6c8',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 + 24, 'シールを準備中...', {
      fontSize: '12px',
      color: '#c8b090',
      fontFamily: 'sans-serif'
    }).setOrigin(0.5);

    // システムのエモジフォントでキャンバスに描画してテクスチャ化
    const SIZE = 72;
    EMOJIS.forEach(e => {
      this._makeEmojiTexture(e.emoji, SIZE);
    });

    // TopScene の装飾絵文字（EMOJISにないものも含む）
    ['🎲', '🌸', '⭐', '🎯'].forEach(emoji => {
      this._makeEmojiTexture(emoji, SIZE);
    });

    this.time.delayedCall(400, () => this.scene.start('TopScene'));
  }

  _makeEmojiTexture(emoji, size) {
    const key = emojiKey(emoji);
    if (this.textures.exists(key)) return;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.font = `${Math.floor(size * 0.72)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + 2);
    this.textures.addCanvas(key, canvas);
  }
}

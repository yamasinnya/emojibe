class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.graphics().fillStyle(0x2a1a0a, 1).fillRect(0, 0, W, H);

    this.add.text(W / 2, H / 2 - 80, 'えもじべ', {
      fontSize: '38px',
      color: '#f5e6c8',
      fontFamily: 'Hiragino Maru Gothic Pro, Yu Gothic, sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const barW = 240, barH = 10;
    const barX = W / 2 - barW / 2;
    const barY = H / 2;

    this.add.graphics().fillStyle(0x4a3520, 1).fillRoundedRect(barX, barY, barW, barH, 5);
    const bar = this.add.graphics();

    this.add.text(W / 2, barY + 26, 'シールを準備中...', {
      fontSize: '12px',
      color: '#c8b090',
      fontFamily: 'sans-serif'
    }).setOrigin(0.5);

    this.load.on('progress', v => {
      bar.clear();
      bar.fillStyle(0xd4a853, 1);
      bar.fillRoundedRect(barX, barY, barW * v, barH, 5);
    });

    this.load.on('loaderror', file => {
      console.warn('emoji load failed:', file.key);
    });

    const BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/';
    EMOJIS.forEach(e => {
      const cp = twemoji.convert.toCodePoint(e.emoji);
      this.load.image('emoji_' + cp, BASE + cp + '.png');
    });
  }

  create() {
    this.scene.start('TopScene');
  }
}

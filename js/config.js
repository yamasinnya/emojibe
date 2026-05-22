const GameConfig = {
  type: Phaser.AUTO,
  width: 375,
  height: 812,
  resolution: window.devicePixelRatio || 1,
  backgroundColor: '#2a1a0a',
  parent: 'game-container',
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, TopScene, FieldScene, HandScene, ResultScene]
};

new Phaser.Game(GameConfig);

const config = {
  type: Phaser.AUTO,
  width: 375,
  height: 812,
  backgroundColor: '#2a1a0a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  dom: { createContainer: true },
  parent: 'game-container',
  scene: [BootSceneMulti, JoinScene, FieldSceneMulti, HandScene, ResultSceneMulti]
};

new Phaser.Game(config);

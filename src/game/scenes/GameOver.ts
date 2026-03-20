import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameOverText : Phaser.GameObjects.Text;

    constructor ()
    {
        super('GameOver');
    }

    private updateLayout (width = this.scale.width, height = this.scale.height)
    {
        const centerX = width / 2;
        const centerY = height / 2;

        this.background.setPosition(centerX, centerY);
        this.background.setDisplaySize(width, height);
        this.gameOverText.setPosition(centerX, centerY);
        this.gameOverText.setWordWrapWidth(Math.max(width - 64, 220), true);
    }

    create ()
    {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        this.camera = this.cameras.main
        this.camera.setBackgroundColor(0xff0000);

        this.background = this.add.image(centerX, centerY, 'background');
        this.background.setDisplaySize(width, height);
        this.background.setAlpha(0.5);

        this.gameOverText = this.add.text(centerX, centerY, 'Game Over', {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);
        this.gameOverText.setWordWrapWidth(Math.max(width - 64, 220), true);

        this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
            this.updateLayout(gameSize.width, gameSize.height);
        });
        
        EventBus.emit('current-scene-ready', this);
    }

    changeScene ()
    {
        this.scene.start('MainMenu');
    }

    shutdown ()
    {
        this.scale.off('resize');
    }
}

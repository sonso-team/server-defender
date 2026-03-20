import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameText: Phaser.GameObjects.Text;

    constructor ()
    {
        super('Game');
    }

    private updateLayout (width = this.scale.width, height = this.scale.height)
    {
        const centerX = width / 2;
        const centerY = height / 2;

        this.background.setPosition(centerX, centerY);
        this.background.setDisplaySize(width, height);
        this.gameText.setPosition(centerX, centerY);
        this.gameText.setWordWrapWidth(Math.max(width - 64, 220), true);
    }

    create ()
    {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x00ff00);

        this.background = this.add.image(centerX, centerY, 'background');
        this.background.setDisplaySize(width, height);
        this.background.setAlpha(0.5);

        this.gameText = this.add.text(centerX, centerY, 'Make something fun!\nand share it with us:\nsupport@phaser.io', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);
        this.gameText.setWordWrapWidth(Math.max(width - 64, 220), true);

        this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
            this.updateLayout(gameSize.width, gameSize.height);
        });

        EventBus.emit('current-scene-ready', this);
    }

    changeScene ()
    {
        this.scene.start('GameOver');
    }

    shutdown ()
    {
        this.scale.off('resize');
    }
}

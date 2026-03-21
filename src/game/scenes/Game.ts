import { EventBus } from '../EventBus';
import { VaporwaveGridBackground } from '../VaporwaveGridBackground';
import { Scene } from 'phaser';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    backgroundEffect!: VaporwaveGridBackground;
    gameText: Phaser.GameObjects.Text;
    private readonly handleResize = (gameSize: Phaser.Structs.Size) => {
        this.updateLayout(gameSize.width, gameSize.height);
    };

    constructor ()
    {
        super('Game');
    }

    private updateLayout (width = this.scale.width, height = this.scale.height)
    {
        const centerX = width / 2;
        const centerY = height / 2;

        this.backgroundEffect.resize(width, height);
        this.gameText.setPosition(centerX, centerY);
        this.gameText.setWordWrapWidth(Math.max(width - 64, 220), true);
    }

    create ()
    {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x0f092b);

        this.backgroundEffect = new VaporwaveGridBackground(this);

        this.gameText = this.add.text(centerX, centerY, 'Make something fun!\nand share it with us:\nsupport@phaser.io', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);
        this.gameText.setWordWrapWidth(Math.max(width - 64, 220), true);

        this.scale.on('resize', this.handleResize);

        EventBus.emit('current-scene-ready', this);
    }

    update (_time: number, delta: number)
    {
        this.backgroundEffect.update(delta);
    }

    changeScene ()
    {
        this.scene.start('GameOver');
    }

    shutdown ()
    {
        this.scale.off('resize', this.handleResize);
        this.backgroundEffect.destroy();
    }
}

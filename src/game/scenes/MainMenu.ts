import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { Background } from '../Background';

type ButtonState = 'default' | 'hover' | 'active';

export class MainMenu extends Scene
{
    backgroundEffect!: Background;
    startButtonGraphics!: Phaser.GameObjects.Graphics;
    startButtonLabel!: Phaser.GameObjects.Text;
    startButtonHitArea!: Phaser.GameObjects.Zone;
    private buttonState: ButtonState = 'default';
    private readonly handleResize = (gameSize: Phaser.Structs.Size) => {
        this.updateLayout(gameSize.width, gameSize.height);
    };

    constructor ()
    {
        super('MainMenu');
    }

    private updateLayout (width = this.scale.width, height = this.scale.height)
    {
        const centerX = width / 2;
        const centerY = height / 2;
        const buttonWidth = Phaser.Math.Clamp(width * 0.34, 220, 340);
        const buttonHeight = Phaser.Math.Clamp(height * 0.082, 56, 68);

        this.backgroundEffect.resize(width, height);
        this.drawStartButton(centerX, centerY, buttonWidth, buttonHeight, this.buttonState);

        this.startButtonLabel.setPosition(centerX, centerY);
        this.startButtonLabel.setFontSize(Math.round(buttonHeight * 0.4));

        this.startButtonHitArea.setPosition(centerX, centerY);
        this.startButtonHitArea.setSize(buttonWidth, buttonHeight);
    }

    create ()
    {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        const buttonWidth = Phaser.Math.Clamp(width * 0.34, 220, 340);
        const buttonHeight = Phaser.Math.Clamp(height * 0.082, 56, 68);

        this.cameras.main.setBackgroundColor(0x0f092b);
        this.backgroundEffect = new Background(this);

        this.startButtonGraphics = this.add.graphics().setDepth(120);
        this.drawStartButton(centerX, centerY, buttonWidth, buttonHeight, this.buttonState);

        this.startButtonLabel = this.add.text(centerX, centerY, 'Начать', {
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: Math.round(buttonHeight * 0.4),
            fontStyle: '600',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setDepth(125);

        this.startButtonHitArea = this.add.zone(centerX, centerY, buttonWidth, buttonHeight)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(130);

        this.startButtonHitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
            this.buttonState = 'hover';
            this.drawStartButton(this.startButtonHitArea.x, this.startButtonHitArea.y, this.startButtonHitArea.width, this.startButtonHitArea.height, this.buttonState);
        });

        this.startButtonHitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
            this.buttonState = 'default';
            this.drawStartButton(this.startButtonHitArea.x, this.startButtonHitArea.y, this.startButtonHitArea.width, this.startButtonHitArea.height, this.buttonState);
        });

        this.startButtonHitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
            this.buttonState = 'active';
            this.drawStartButton(this.startButtonHitArea.x, this.startButtonHitArea.y, this.startButtonHitArea.width, this.startButtonHitArea.height, this.buttonState);
            this.changeScene();
        });

        this.startButtonHitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
            this.buttonState = 'hover';
            this.drawStartButton(this.startButtonHitArea.x, this.startButtonHitArea.y, this.startButtonHitArea.width, this.startButtonHitArea.height, this.buttonState);
        });

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
        this.scale.on('resize', this.handleResize);

        EventBus.emit('current-scene-ready', this);
    }

    update (_time: number, delta: number)
    {
        this.backgroundEffect.update(delta);
    }
    
    changeScene ()
    {
        this.scene.start('Game');
    }

    shutdown ()
    {
        this.scale.off('resize', this.handleResize);
        this.startButtonHitArea.removeAllListeners();
        this.backgroundEffect.destroy();
    }

    private drawStartButton (centerX: number, centerY: number, width: number, height: number, state: ButtonState)
    {
        const radius = Math.round(height * 0.5);
        const left = centerX - (width / 2);
        const top = centerY - (height / 2);
        const fillColor = state === 'active' ? 0x1f70d0 : state === 'hover' ? 0x2e8ff9 : 0x2582f0;
        const borderColor = state === 'active' ? 0xa6cdff : 0xc7deff;

        this.startButtonGraphics.clear();
        this.startButtonGraphics.fillStyle(fillColor, 1);
        this.startButtonGraphics.fillRoundedRect(left, top, width, height, radius);
        this.startButtonGraphics.lineStyle(2, borderColor, 0.95);
        this.startButtonGraphics.strokeRoundedRect(left, top, width, height, radius);
    }
}

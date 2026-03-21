import { EventBus } from '../EventBus';
import { Background } from '../Background';
import { Scene } from 'phaser';
import { GameState, type GameStateSnapshot } from '../core/GameState';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    backgroundEffect!: Background;
    hudText: Phaser.GameObjects.Text;
    private gameState!: GameState;
    private unsubscribeState?: () => void;
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

        this.backgroundEffect.resize(width, height);
        this.hudText.setPosition(centerX, 28);
        this.hudText.setWordWrapWidth(Math.max(width - 48, 240), true);
    }

    create ()
    {
        const { width } = this.scale;
        const centerX = width / 2;

        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x0f092b);

        this.gameState = new GameState({ initialLives: 3, initialPhase: 'running' });
        this.backgroundEffect = new Background(this);

        this.hudText = this.add.text(centerX, 28, '', {
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: 28,
            fontStyle: '700',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5, 0).setDepth(200);
        this.hudText.setWordWrapWidth(Math.max(width - 48, 240), true);

        this.unsubscribeState = this.gameState.subscribe((snapshot) => {
            this.renderHud(snapshot);
        });

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
        this.scale.on('resize', this.handleResize);

        EventBus.emit('current-scene-ready', this);
    }

    update (_time: number, delta: number)
    {
        this.backgroundEffect.update(delta);
        this.gameState.advanceTime(delta);
    }

    changeScene ()
    {
        // Reserved for explicit game-over flow once combat systems are implemented.
    }

    shutdown ()
    {
        this.unsubscribeState?.();
        this.unsubscribeState = undefined;
        this.scale.off('resize', this.handleResize);
        this.backgroundEffect.destroy();
    }

    private renderHud (snapshot: GameStateSnapshot)
    {
        const seconds = (snapshot.elapsedMs / 1000).toFixed(1);
        this.hudText.setText(`Очки: ${snapshot.score}   Жизни: ${snapshot.lives}   Время: ${seconds}s`);
    }
}

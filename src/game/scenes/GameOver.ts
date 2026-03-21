import { EventBus } from '../EventBus';
import { Background } from '../Background';
import { Scene } from 'phaser';

interface GameOverData
{
    score?: number;
    elapsedMs?: number;
}

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    backgroundEffect!: Background;
    private score = 0;
    private elapsedMs = 0;
    private readonly handleResize = (gameSize: Phaser.Structs.Size) => {
        this.updateLayout(gameSize.width, gameSize.height);
    };

    constructor ()
    {
        super('GameOver');
    }

    private updateLayout (width = this.scale.width, height = this.scale.height)
    {
        this.backgroundEffect.resize(width, height);
    }

    create (data: GameOverData)
    {
        this.score = data?.score ?? 0;
        this.elapsedMs = data?.elapsedMs ?? 0;

        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x0f092b);

        this.backgroundEffect = new Background(this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
        this.scale.on('resize', this.handleResize);
        EventBus.emit('game-over-data', { score: this.score, elapsedMs: this.elapsedMs });
        
        EventBus.emit('current-scene-ready', this);
    }

    update (_time: number, delta: number)
    {
        this.backgroundEffect.update(delta);
    }

    shutdown ()
    {
        this.scale.off('resize', this.handleResize);
        this.backgroundEffect.destroy();
    }
}

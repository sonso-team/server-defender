import { EventBus } from '../EventBus';
import { Background } from '../Background';
import { Scene } from 'phaser';
import { GameState, type GameStateSnapshot } from '../core/GameState';
import { EnemySystem } from '../systems/EnemySystem';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    backgroundEffect!: Background;
    hudText: Phaser.GameObjects.Text;
    private gameState!: GameState;
    private enemySystem!: EnemySystem;
    private unsubscribeState?: () => void;
    private centerMarker!: Phaser.GameObjects.Graphics;
    private serverSprite!: Phaser.GameObjects.Image;
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
        const markerRadius = this.getCenterMarkerRadius(width, height);

        this.backgroundEffect.resize(width, height);
        this.enemySystem.resize(width, height);
        this.drawCenterMarker(centerX, centerY, markerRadius);
        this.serverSprite.setPosition(centerX, centerY);
        this.applyServerSpriteScale(width);
        this.hudText.setPosition(centerX, 28);
        this.hudText.setWordWrapWidth(Math.max(width - 48, 240), true);
    }

    create ()
    {
        const { width } = this.scale;
        const { height } = this.scale;
        const centerX = width / 2;
        const markerRadius = this.getCenterMarkerRadius(width, height);

        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x0f092b);

        this.gameState = new GameState({ initialLives: 3, initialPhase: 'running' });
        this.backgroundEffect = new Background(this);

        this.centerMarker = this.add.graphics().setDepth(130);
        this.drawCenterMarker(centerX, this.scale.height / 2, markerRadius);
        this.serverSprite = this.add.image(centerX, this.scale.height / 2, 'server').setDepth(160);
        this.applyServerSpriteScale(width);

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

        this.enemySystem = new EnemySystem(this, this.gameState, {
            serverHitRadius: 56,
            onEnemyReachedServer: () => {
                const livesLeft = this.gameState.damageServer(1);
                if (livesLeft <= 0)
                {
                    this.scene.start('GameOver');
                }
            }
        });

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
        this.scale.on('resize', this.handleResize);

        EventBus.emit('current-scene-ready', this);
    }

    update (_time: number, delta: number)
    {
        this.backgroundEffect.update(delta);
        this.gameState.advanceTime(delta);
        this.enemySystem.update(delta);
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
        this.enemySystem.destroy();
        this.serverSprite.destroy();
        this.centerMarker.destroy();
        this.gameState.setPhase('paused');
        this.backgroundEffect.destroy();
    }

    private renderHud (snapshot: GameStateSnapshot)
    {
        const seconds = (snapshot.elapsedMs / 1000).toFixed(1);
        this.hudText.setText(`Score: ${snapshot.score}   Lives: ${snapshot.lives}   Time: ${seconds}s`);
    }

    private drawCenterMarker (centerX: number, centerY: number, radius: number)
    {
        const dashCount = 32;
        const gapFraction = 0.45;
        const fullArc = Math.PI * 2;
        const arcStep = fullArc / dashCount;
        const dashArcLength = arcStep * (1 - gapFraction);

        this.centerMarker.clear();
        this.centerMarker.fillStyle(0x57a7ff, 0.16);
        this.centerMarker.fillCircle(centerX, centerY, radius);
        this.centerMarker.lineStyle(3, 0x6f84ff, 0.75);

        for (let i = 0; i < dashCount; i++)
        {
            const startAngle = i * arcStep;
            const endAngle = startAngle + dashArcLength;

            this.centerMarker.beginPath();
            this.centerMarker.arc(centerX, centerY, radius, startAngle, endAngle, false);
            this.centerMarker.strokePath();
        }
    }

    private getCenterMarkerRadius (viewportWidth: number, viewportHeight: number)
    {
        const shortSide = Math.min(viewportWidth, viewportHeight);

        if (viewportWidth <= 480)
        {
            return Math.round(shortSide * 0.34);
        }

        if (viewportWidth <= 768)
        {
            return Math.round(shortSide * 0.33);
        }

        if (viewportWidth <= 1024)
        {
            return Math.round(shortSide * 0.31);
        }

        return Phaser.Math.Clamp(Math.round(shortSide * 0.3), 50, 80);
    }

    private applyServerSpriteScale (viewportWidth: number)
    {
        const baseWidth = Math.max(1, this.serverSprite.width);

        let targetWidth = 114;
        if (viewportWidth <= 480)
        {
            targetWidth = 74;
        }
        else if (viewportWidth <= 768)
        {
            targetWidth = 88;
        }
        else if (viewportWidth <= 1024)
        {
            targetWidth = 100;
        }

        this.serverSprite.setScale(targetWidth / baseWidth);
    }
}

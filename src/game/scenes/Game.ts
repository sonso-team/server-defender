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
        const markerRadius = this.getCenterMarkerRadius(width);

        this.backgroundEffect.resize(width, height);
        this.enemySystem.resize(width, height);
        this.drawCenterMarker(centerX, centerY, markerRadius);
        this.serverSprite.setPosition(centerX, centerY);
        this.applyServerSpriteScale(markerRadius);
        this.hudText.setPosition(centerX, 28);
        this.hudText.setWordWrapWidth(Math.max(width - 48, 240), true);
    }

    create ()
    {
        const { width } = this.scale;
        const centerX = width / 2;
        const markerRadius = this.getCenterMarkerRadius(width);

        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x0f092b);

        this.gameState = new GameState({ initialLives: 3, initialPhase: 'running' });
        this.backgroundEffect = new Background(this);

        this.centerMarker = this.add.graphics().setDepth(130);
        this.drawCenterMarker(centerX, this.scale.height / 2, markerRadius);
        this.serverSprite = this.add.image(centerX, this.scale.height / 2, 'server').setDepth(160);
        this.applyServerSpriteScale(markerRadius);

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

    private getCenterMarkerRadius (viewportWidth: number)
    {
        const mobileBreakpoint = 768;
        const desktopBreakpoint = 1280;
        const mobileDiameterRatio = 0.5;
        const desktopDiameterRatio = 0.2;
        const minDiameter = 40;

        const interpolation = Phaser.Math.Clamp(
            (viewportWidth - mobileBreakpoint) / (desktopBreakpoint - mobileBreakpoint),
            0,
            1
        );
        const diameterRatio = Phaser.Math.Linear(mobileDiameterRatio, desktopDiameterRatio, interpolation);
        const diameter = Math.max(minDiameter, viewportWidth * diameterRatio);

        // Circle: same visual size for width/height, diameter is percentage of viewport width.
        return Math.round(diameter / 2);
    }

    private applyServerSpriteScale (markerRadius: number)
    {
        const baseWidth = Math.max(1, this.serverSprite.width);
        const markerDiameter = markerRadius * 2;
        const targetWidth = markerDiameter * 0.7;

        this.serverSprite.setScale(targetWidth / baseWidth);
    }
}

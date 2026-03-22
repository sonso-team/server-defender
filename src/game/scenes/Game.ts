import { EventBus } from '../EventBus';
import { Background } from '../Background';
import { Scene } from 'phaser';
import { GameState, type GameStateSnapshot, type EnemyType } from '../core/GameState';
import { EnemySystem } from '../systems/EnemySystem';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    backgroundEffect!: Background;
    private scoreText!: Phaser.GameObjects.Text;
    private timerText!: Phaser.GameObjects.Text;
    private heartImages: Phaser.GameObjects.Image[] = [];
    private readonly heartSize = 30;
    private readonly heartGap = 5;
    private gameState!: GameState;
    private enemySystem!: EnemySystem;
    private unsubscribeState?: () => void;
    private centerMarker!: Phaser.GameObjects.Graphics;
    private serverSprite!: Phaser.GameObjects.Image;
    private readonly HIT_SCORES: Record<EnemyType, number> = {
        red: 5, green: 20, blue: 5, orange: 5
    };
    private scoreMultiplier = 1;
    private maxLives = 3;
    private isGameOverTransitioning = false;
    private bgImage!: Phaser.GameObjects.Image;
    private firewallAngle = 0;
    private serverBaseScale = 1;
    private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
        this.enemySystem.tryHitEnemy(pointer.worldX, pointer.worldY);
    };
    private readonly handleResize = (gameSize: Phaser.Structs.Size) => {
        this.updateLayout(gameSize.width, gameSize.height);
    };

    constructor ()
    {
        super('Game');
    }

    private updateLayout (width = this.scale.width, height = this.scale.height)
    {
        if (!this.backgroundEffect || !this.enemySystem || !this.centerMarker || !this.serverSprite || !this.scoreText || !this.timerText || this.heartImages.length === 0)
        {
            return;
        }

        const centerX = width / 2;
        const centerY = height / 2;
        const markerRadius = this.getCenterMarkerRadius(width);

        this.bgImage.setPosition(centerX, centerY).setDisplaySize(width, height);
        this.backgroundEffect.resize(width, height);
        this.enemySystem.resize(width, height);
        this.enemySystem.setFirewallRadius(markerRadius);
        this.drawCenterMarker(centerX, centerY, markerRadius);
        this.serverSprite.setPosition(centerX, centerY);
        this.applyServerSpriteScale(markerRadius);
        this.enemySystem.setServerHitRadius(this.getServerHitRadius());
        this.scoreText.setPosition(centerX, height / 2 - markerRadius - 70);
        this.timerText.setPosition(16, 16);
        const totalHeartsWidth = this.maxLives * this.heartSize + (this.maxLives - 1) * this.heartGap;
        const heartsStartX = width - 16 - totalHeartsWidth;
        this.heartImages.forEach((img, i) => {
            img.setPosition(heartsStartX + i * (this.heartSize + this.heartGap) + this.heartSize / 2, 20 + this.heartSize / 2);
        });
    }

    create ()
    {
        const { width } = this.scale;
        const centerX = width / 2;
        const markerRadius = this.getCenterMarkerRadius(width);

        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x0f092b);

        this.bgImage = this.add.image(width / 2, this.scale.height / 2, 'game-bg')
            .setDepth(-1001)
            .setDisplaySize(width, this.scale.height);

        this.gameState = new GameState({ initialLives: 3, initialPhase: 'running' });
        this.maxLives = this.gameState.getMaxLives();
        this.backgroundEffect = new Background(this);

        this.centerMarker = this.add.graphics().setDepth(130);
        this.drawCenterMarker(centerX, this.scale.height / 2, markerRadius);
        this.serverSprite = this.add.image(centerX, this.scale.height / 2, 'server').setDepth(160);
        this.applyServerSpriteScale(markerRadius);

        this.scoreText = this.add.text(centerX, this.scale.height / 2 - markerRadius - 70, '', {
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: 28,
            fontStyle: '700',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5, 0).setDepth(200);

        this.timerText = this.add.text(16, 16, '', {
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: 17,
            fontStyle: '600',
            color: '#c8d8ff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'left'
        }).setOrigin(0, 0).setDepth(200);

        const totalHeartsWidth = this.maxLives * this.heartSize + (this.maxLives - 1) * this.heartGap;
        const heartsStartX = width - 16 - totalHeartsWidth;
        for (let i = 0; i < this.maxLives; i++)
        {
            const img = this.add.image(
                heartsStartX + i * (this.heartSize + this.heartGap) + this.heartSize / 2,
                20 + this.heartSize / 2,
                'heart'
            ).setDisplaySize(this.heartSize, this.heartSize).setDepth(200);
            this.heartImages.push(img);
        }

        this.unsubscribeState = this.gameState.subscribe((snapshot) => {
            this.renderHud(snapshot);
        });

        const serverHitRadius = this.getServerHitRadius();
        this.enemySystem = new EnemySystem(this, this.gameState, {
            firewallRadius: markerRadius,
            serverHitRadius,
            onEnemyHit: (type, x, y) => {
                this.gameState.addScore(this.HIT_SCORES[type] * this.scoreMultiplier);
                this.flashFirewallAt(x, y);
            },
            onEnemyReachedServer: () => {
                this.flashServerHit();
                const livesLeft = this.gameState.damageServer(1);
                if (livesLeft <= 0)
                {
                    this.goToGameOver();
                }
            }
        });

        this.input.addPointer(9);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
        this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
        this.scale.on('resize', this.handleResize);

        EventBus.emit('current-scene-ready', this);
    }

    update (_time: number, delta: number)
    {
        if (!this.backgroundEffect || !this.gameState || !this.enemySystem)
        {
            return;
        }

        this.backgroundEffect.update(delta);
        this.gameState.advanceTime(delta);
        this.enemySystem.update(delta);
        this.tickMultiplier();

        this.firewallAngle = (this.firewallAngle + delta * 0.000186) % (Math.PI * 2);
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        this.drawCenterMarker(cx, cy, this.getCenterMarkerRadius(this.scale.width), this.firewallAngle);

        const pulse = 1 + Math.sin(this.time.now * 0.0011) * 0.045;
        this.serverSprite.setScale(this.serverBaseScale * pulse);
    }

    private tickMultiplier ()
    {
        const elapsed = this.gameState.getElapsedMs();
        const next = elapsed >= 210_000 ? 4 : elapsed >= 150_000 ? 3 : elapsed >= 90_000 ? 2 : 1;

        if (next !== this.scoreMultiplier)
        {
            this.scoreMultiplier = next;
            this.showMultiplierPopup(next);
        }
    }

    private showMultiplierPopup (multiplier: number)
    {
        const { width, height } = this.scale;
        const color = multiplier >= 3 ? '#ff4422' : '#ffdd00';

        const label = this.add.text(width / 2, height / 2 - 70, `×${multiplier} МНОЖИТЕЛЬ!`, {
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: '34px',
            fontStyle: '800',
            color,
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(400).setAlpha(0);

        this.tweens.add({
            targets: label,
            alpha: 1,
            y: height / 2 - 100,
            duration: 280,
            ease: 'Cubic.easeOut',
            onComplete: () =>
            {
                this.tweens.add({
                    targets: label,
                    alpha: 0,
                    y: height / 2 - 135,
                    delay: 1400,
                    duration: 500,
                    ease: 'Cubic.easeIn',
                    onComplete: () => { label.destroy(); }
                });
            }
        });
    }

    changeScene ()
    {
    }

    shutdown ()
    {
        this.unsubscribeState?.();
        this.unsubscribeState = undefined;
        this.scale.off('resize', this.handleResize);
        this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
        this.enemySystem?.destroy();
        this.serverSprite?.destroy();
        this.centerMarker?.destroy();
        this.heartImages.forEach(img => img.destroy());
        this.heartImages = [];
        this.scoreText?.destroy();
        this.timerText?.destroy();
        this.isGameOverTransitioning = false;
        this.gameState?.setPhase('paused');
        this.backgroundEffect?.destroy();
    }

    private renderHud (snapshot: GameStateSnapshot)
    {
        const seconds = (snapshot.elapsedMs / 1000).toFixed(1);
        this.scoreText.setText(`${snapshot.score} очк.`);
        this.timerText.setText(`Время: ${seconds}s`);
        this.heartImages.forEach((img, i) => {
            img.setTexture(i < snapshot.lives ? 'heart' : 'heart-broken');
        });
    }

    private drawCenterMarker (centerX: number, centerY: number, radius: number, rotationOffset = 0)
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
            const startAngle = i * arcStep + rotationOffset;
            const endAngle = startAngle + dashArcLength;

            this.centerMarker.beginPath();
            this.centerMarker.arc(centerX, centerY, radius, startAngle, endAngle, false);
            this.centerMarker.strokePath();
        }
    }

    private flashFirewallAt (x: number, y: number)
    {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;
        const angle = Math.atan2(y - centerY, x - centerX);
        const radius = this.getCenterMarkerRadius(this.scale.width);

        const flash = this.add.graphics().setDepth(131);
        flash.lineStyle(6, 0xffffff, 0.9);
        flash.beginPath();
        flash.arc(centerX, centerY, radius, angle - 0.28, angle + 0.28, false);
        flash.strokePath();

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 350,
            ease: 'Cubic.easeOut',
            onComplete: () => { flash.destroy(); }
        });
    }

    private flashServerHit ()
    {
        const s = this.serverSprite;
        const overlay = this.add.image(s.x, s.y, 'server')
            .setScale(s.scaleX, s.scaleY)
            .setDepth(s.depth + 1)
            .setTintFill(0xaa0000)
            .setAlpha(0.5);
        this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 2000,
            ease: 'Cubic.easeOut',
            onComplete: () => { overlay.destroy(); }
        });
    }

    private getCenterMarkerRadius (viewportWidth: number)
    {
        const mobileBreakpoint = 768;
        const desktopBreakpoint = 1280;
        const mobileDiameterRatio = 0.75;
        const desktopDiameterRatio = 0.253;
        const minDiameter = 40;

        const interpolation = Phaser.Math.Clamp(
            (viewportWidth - mobileBreakpoint) / (desktopBreakpoint - mobileBreakpoint),
            0,
            1
        );
        const diameterRatio = Phaser.Math.Linear(mobileDiameterRatio, desktopDiameterRatio, interpolation);
        const diameter = Math.max(minDiameter, viewportWidth * diameterRatio);

        return Math.round(diameter / 2);
    }

    private applyServerSpriteScale (markerRadius: number)
    {
        const baseWidth = Math.max(1, this.serverSprite.width);
        const markerDiameter = markerRadius * 2;
        const targetWidth = markerDiameter * 0.3;

        this.serverSprite.setScale(targetWidth / baseWidth);
        this.serverBaseScale = this.serverSprite.scaleX;
    }

    private getServerHitRadius ()
    {
        return Phaser.Math.Clamp(this.serverSprite.displayWidth * 0.38, 18, 72);
    }

    private goToGameOver ()
    {
        if (this.isGameOverTransitioning)
        {
            return;
        }

        this.isGameOverTransitioning = true;
        this.gameState.setPhase('gameover');
        const snapshot = this.gameState.getSnapshot();

        this.scene.start('GameOver', {
            score: snapshot.score,
            elapsedMs: snapshot.elapsedMs
        });
    }
}

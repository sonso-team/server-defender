import { Scene } from 'phaser';
import { EventBus } from '../core/EventBus';
import { Background } from '../background/Background';
import { GameState } from '../core/GameState';
import { EnemySystem } from '../systems/enemy/EnemySystem';
import { GameHud } from '../hud/GameHud';
import { HIT_SCORES, SCORE_MULTIPLIER_THRESHOLDS } from '../config/constants';

export class Game extends Scene
{
    private backgroundEffect!: Background;
    private gameState!: GameState;
    private enemySystem!: EnemySystem;
    private hud!: GameHud;
    private bgImage!: Phaser.GameObjects.Image;
    private centerMarker!: Phaser.GameObjects.Graphics;
    private serverSprite!: Phaser.GameObjects.Image;
    private serverBaseScale = 1;
    private firewallAngle   = 0;
    private scoreMultiplier = 1;
    private isGameOverTransitioning = false;
    private unsubscribeState?: () => void;

    private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) =>
    {
        this.enemySystem.tryHitEnemy(pointer.worldX, pointer.worldY);
    };

    private readonly handleResize = (gameSize: Phaser.Structs.Size) =>
    {
        this.updateLayout(gameSize.width, gameSize.height);
    };

    constructor ()
    {
        super('Game');
    }

    private static readonly REQUIRED_TEXTURES = [
        'game-bg', 'server', 'enemy',
        'little-bro', 'big-bro', 'orange-enemy',
        'heart', 'heart-broken',
    ] as const;

    create ()
    {
        const missing = Game.REQUIRED_TEXTURES.filter(key => !this.textures.exists(key));

        if (missing.length > 0)
        {
            this.loadMissingTextures(missing);
            this.load.once(Phaser.Loader.Events.COMPLETE, () => this.initScene());
            this.load.start();
        }
        else
        {
            this.initScene();
        }
    }

    private loadMissingTextures (missing: readonly string[])
    {
        this.load.setPath('assets');

        const loaders: Record<string, () => void> = {
            'game-bg':       () => this.load.image('game-bg',     'background/background.png'),
            'server':        () => this.load.svg('server',        'characters/server-chan.svg',  { width: 256, height: 256 }),
            'enemy':         () => this.load.image('enemy',       'characters/virus-kun.png'),
            'little-bro':    () => this.load.svg('little-bro',   'characters/little-bro.svg',   { width: 128, height: 128 }),
            'big-bro':       () => this.load.svg('big-bro',      'characters/big-bro.svg',      { width: 128, height: 128 }),
            'orange-enemy':  () => this.load.svg('orange-enemy', 'characters/orange.svg',       { width: 128, height: 128 }),
            'heart':         () => this.load.svg('heart',        'heart.svg',                   { width: 64,  height: 64  }),
            'heart-broken':  () => this.load.svg('heart-broken', 'heart-broken.svg',            { width: 64,  height: 64  }),
        };

        for (const key of missing)
        {
            loaders[key]?.();
        }
    }

    private initScene ()
    {
        const { width, height } = this.scale;
        const centerX      = width / 2;
        const centerY      = height / 2;
        const markerRadius = this.getFirewallRadius(width);

        this.cameras.main.setBackgroundColor(0x0f092b);

        this.bgImage = this.add.image(centerX, centerY, 'game-bg')
            .setDepth(-1001)
            .setDisplaySize(width, height);

        this.backgroundEffect = new Background(this);

        this.centerMarker = this.add.graphics().setDepth(130);
        this.drawFirewall(centerX, centerY, markerRadius);

        this.serverSprite = this.add.image(centerX, centerY, 'server').setDepth(160);
        this.applyServerScale(markerRadius);

        this.gameState = new GameState({ initialLives: 3, initialPhase: 'running' });
        this.hud = new GameHud(this, this.gameState.getMaxLives(), markerRadius);

        this.unsubscribeState = this.gameState.subscribe(snapshot => this.hud.render(snapshot));

        this.enemySystem = new EnemySystem(this, this.gameState, {
            firewallRadius:  markerRadius,
            serverHitRadius: this.getServerHitRadius(),
            onEnemyHit: (type, x, y) =>
            {
                this.gameState.addScore(HIT_SCORES[type] * this.scoreMultiplier);
                this.flashFirewallAt(x, y);
            },
            onEnemyReachedServer: () =>
            {
                this.flashServerHit();
                const livesLeft = this.gameState.damageServer(1);
                if (livesLeft <= 0) { this.goToGameOver(); }
            },
        });

        this.input.addPointer(9);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
        this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
        this.scale.on('resize', this.handleResize);

        EventBus.emit('current-scene-ready', this);
    }

    update (_time: number, delta: number)
    {
        if (!this.backgroundEffect || !this.gameState || !this.enemySystem) { return; }

        this.backgroundEffect.update(delta);
        this.gameState.advanceTime(delta);
        this.enemySystem.update(delta);
        this.tickScoreMultiplier();

        this.firewallAngle = (this.firewallAngle + delta * 0.000186) % (Math.PI * 2);
        this.drawFirewall(this.scale.width / 2, this.scale.height / 2, this.getFirewallRadius(this.scale.width), this.firewallAngle);

        const pulse = 1 + Math.sin(this.time.now * 0.0011) * 0.045;
        this.serverSprite.setScale(this.serverBaseScale * pulse);
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
        this.hud?.destroy();
        this.isGameOverTransitioning = false;
        this.gameState?.setPhase('paused');
        this.backgroundEffect?.destroy();
    }

    // ─── Лейаут ────────────────────────────────────────────────────────────────

    private updateLayout (width = this.scale.width, height = this.scale.height)
    {
        if (!this.backgroundEffect || !this.enemySystem || !this.centerMarker || !this.serverSprite || !this.hud)
        {
            return;
        }

        const centerX      = width / 2;
        const centerY      = height / 2;
        const markerRadius = this.getFirewallRadius(width);

        this.bgImage.setPosition(centerX, centerY).setDisplaySize(width, height);
        this.backgroundEffect.resize(width, height);
        this.enemySystem.resize(width, height);
        this.enemySystem.setFirewallRadius(markerRadius);
        this.drawFirewall(centerX, centerY, markerRadius);
        this.serverSprite.setPosition(centerX, centerY);
        this.applyServerScale(markerRadius);
        this.enemySystem.setServerHitRadius(this.getServerHitRadius());
        this.hud.resize(width, height, markerRadius);
    }

    // ─── Файрвол ───────────────────────────────────────────────────────────────

    private drawFirewall (centerX: number, centerY: number, radius: number, rotationOffset = 0)
    {
        const dashCount  = 32;
        const gapFraction = 0.45;
        const arcStep    = (Math.PI * 2) / dashCount;
        const dashArcLen = arcStep * (1 - gapFraction);

        this.centerMarker.clear();
        this.centerMarker.fillStyle(0x57a7ff, 0.16);
        this.centerMarker.fillCircle(centerX, centerY, radius);
        this.centerMarker.lineStyle(3, 0x6f84ff, 0.75);

        for (let i = 0; i < dashCount; i++)
        {
            const startAngle = i * arcStep + rotationOffset;
            this.centerMarker.beginPath();
            this.centerMarker.arc(centerX, centerY, radius, startAngle, startAngle + dashArcLen, false);
            this.centerMarker.strokePath();
        }
    }

    private flashFirewallAt (x: number, y: number)
    {
        const cx     = this.scale.width / 2;
        const cy     = this.scale.height / 2;
        const angle  = Math.atan2(y - cy, x - cx);
        const radius = this.getFirewallRadius(this.scale.width);

        const flash = this.add.graphics().setDepth(131);
        flash.lineStyle(6, 0xffffff, 0.9);
        flash.beginPath();
        flash.arc(cx, cy, radius, angle - 0.28, angle + 0.28, false);
        flash.strokePath();

        this.tweens.add({
            targets:  flash,
            alpha:    0,
            duration: 350,
            ease:     'Cubic.easeOut',
            onComplete: () => { flash.destroy(); },
        });
    }

    // ─── Сервер ────────────────────────────────────────────────────────────────

    private flashServerHit ()
    {
        const s       = this.serverSprite;
        const overlay = this.add.image(s.x, s.y, 'server')
            .setScale(s.scaleX, s.scaleY)
            .setDepth(s.depth + 1)
            .setTintFill(0xaa0000)
            .setAlpha(0.5);

        this.tweens.add({
            targets:  overlay,
            alpha:    0,
            duration: 2000,
            ease:     'Cubic.easeOut',
            onComplete: () => { overlay.destroy(); },
        });
    }

    private applyServerScale (markerRadius: number)
    {
        const targetWidth = markerRadius * 2 * 0.3;
        this.serverSprite.setScale(targetWidth / Math.max(1, this.serverSprite.width));
        this.serverBaseScale = this.serverSprite.scaleX;
    }

    private getServerHitRadius (): number
    {
        return Phaser.Math.Clamp(this.serverSprite.displayWidth * 0.38, 18, 72);
    }

    // ─── Множитель очков ───────────────────────────────────────────────────────

    private tickScoreMultiplier ()
    {
        const elapsed = this.gameState.getElapsedMs();
        const next    = SCORE_MULTIPLIER_THRESHOLDS.find(t => elapsed >= t.fromMs)?.value ?? 1;
        if (next === this.scoreMultiplier) { return; }
        this.scoreMultiplier = next;
        this.showMultiplierPopup(next);
    }

    private showMultiplierPopup (multiplier: number)
    {
        const { width, height } = this.scale;
        const color = multiplier >= 3 ? '#ff4422' : '#ffdd00';

        const label = this.add.text(width / 2, height / 2 - 70, `×${multiplier} МНОЖИТЕЛЬ!`, {
            fontFamily:      'Montserrat, Arial, sans-serif',
            fontSize:        '34px',
            fontStyle:       '800',
            color,
            stroke:          '#000000',
            strokeThickness: 5,
        }).setOrigin(0.5).setDepth(400).setAlpha(0);

        this.tweens.add({
            targets:  label,
            alpha:    1,
            y:        height / 2 - 100,
            duration: 280,
            ease:     'Cubic.easeOut',
            onComplete: () =>
            {
                this.tweens.add({
                    targets:  label,
                    alpha:    0,
                    y:        height / 2 - 135,
                    delay:    1400,
                    duration: 500,
                    ease:     'Cubic.easeIn',
                    onComplete: () => { label.destroy(); },
                });
            },
        });
    }

    // ─── Конец игры ────────────────────────────────────────────────────────────

    private goToGameOver ()
    {
        if (this.isGameOverTransitioning) { return; }
        this.isGameOverTransitioning = true;
        this.gameState.setPhase('gameover');
        const { score, elapsedMs } = this.gameState.getSnapshot();
        this.scene.start('GameOver', { score, elapsedMs });
    }

    // ─── Вспомогательные методы ────────────────────────────────────────────────

    private getFirewallRadius (viewportWidth: number): number
    {
        const t = Phaser.Math.Clamp(
            (viewportWidth - 768) / (1280 - 768),
            0, 1,
        );
        const diameter = Math.max(40, viewportWidth * Phaser.Math.Linear(0.75, 0.253, t));
        return Math.round(diameter / 2);
    }
}

import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { type EnemyState, type EnemyType, GameState } from '../core/GameState';

interface EnemySystemOptions
{
    maxEnemies?: number;
    minSpawnIntervalMs?: number;
    maxSpawnIntervalMs?: number;
    minSpeed?: number;
    maxSpeed?: number;
    spawnMargin?: number;
    turnIntervalMinMs?: number;
    turnIntervalMaxMs?: number;
    inwardBias?: number;
    turnResponsiveness?: number;
    maxDriftFactor?: number;
    firewallRadius?: number;
    serverHitRadius?: number;
    enemyWidthDesktopPx?: number;
    enemyWidthTabletPx?: number;
    enemyWidthMobilePx?: number;
    onEnemyHit?: (type: EnemyType) => void;
    onEnemyDestroyed?: (enemyId: string) => void;
    onEnemyReachedServer?: (enemyId: string) => void;
}

// ─── Per-type configuration ───────────────────────────────────────────────────

interface EnemyTypeConfig
{
    textureKey: string;
    hp: number;       // minimum HP (also fixed HP for 1-HP types)
    hpMax: number;    // maximum HP — randomised at spawn; equals hp for fixed-HP types
    speedMultiplier: number;
    sizeMultiplier: number;       // relative to base red size
    tapRadiusMultiplier: number;  // hitbox = max(14, displayWidth * this)
    tint: number | null;          // null = no tint (types use own textures)
    // hitTints[hp - 1] = tint applied after a hit when that many HP remain
    hitTints: number[];
    deathFlashColor: number;
    deathRingColor: number;
    deathBitPalette: string[];
    deathBurstScale: number;   // explosion size multiplier
    deathDuration: number;     // animation duration multiplier
    deathSpriteColor: number;  // tintFill applied to sprite on death
}

const ENEMY_TYPE_CONFIG: Record<EnemyType, EnemyTypeConfig> = {
    red: {
        textureKey: 'enemy',
        hp: 1,
        hpMax: 1,
        speedMultiplier: 1.2,
        sizeMultiplier: 1.0,
        tapRadiusMultiplier: 0.65,
        tint: null,
        hitTints: [],
        deathFlashColor: 0x5f84ff,
        deathRingColor: 0x658bff,
        deathBitPalette: ['#5145f1', '#7c33f3', '#6f51f3', '#6d53e4'],
        deathBurstScale: 1.0,
        deathDuration: 1.0,
        deathSpriteColor: 0x9cb5ff
    },
    green: {
        textureKey: 'little-bro',
        hp: 1,
        hpMax: 1,
        speedMultiplier: 2.4,
        sizeMultiplier: 0.65,
        tapRadiusMultiplier: 1.3,  // bigger hitbox — these little guys are hard to tap
        tint: null,
        hitTints: [],
        deathFlashColor: 0x44ff66,
        deathRingColor: 0x22cc44,
        deathBitPalette: ['#22ff55', '#44ee44', '#88ff22', '#55dd33'],
        deathBurstScale: 0.7,
        deathDuration: 0.7,
        deathSpriteColor: 0x88ffaa
    },
    blue: {
        textureKey: 'big-bro',
        hp: 3,
        hpMax: 6,  // randomised per-spawn between hp and hpMax
        speedMultiplier: 0.456,
        sizeMultiplier: 1.35,
        tapRadiusMultiplier: 0.65,
        tint: null,
        // hitTints: index 0 = 1 HP left (critical red), higher indices = intermediate damage tints
        hitTints: [0xff4466, 0xff8899, 0xbbddff, 0x99ddff, 0xcceeff],
        deathFlashColor: 0x44aaff,
        deathRingColor: 0x2288ee,
        deathBitPalette: ['#2277ff', '#4499ff', '#66bbff', '#88ccff', '#aaddff'],
        deathBurstScale: 1.6,
        deathDuration: 1.5,
        deathSpriteColor: 0x88ccff
    },
    orange: {
        textureKey: 'orange-enemy',
        hp: 1,
        hpMax: 1,
        speedMultiplier: 1.3,
        sizeMultiplier: 0.9,
        tapRadiusMultiplier: 0.65,
        tint: null,
        hitTints: [],
        deathFlashColor: 0xff8800,
        deathRingColor: 0xdd6600,
        deathBitPalette: ['#ff8800', '#ffaa22', '#ffcc44', '#dd6600', '#ff5500'],
        deathBurstScale: 1.2,
        deathDuration: 1.0,
        deathSpriteColor: 0xffaa44
    }
};

// ─── Difficulty stages ─────────────────────────────────────────────────────────

interface DifficultyStage
{
    fromMs: number;
    maxEnemies: number;
    minSpawnIntervalMs: number;
    maxSpawnIntervalMs: number;
    minSpeed: number;
    maxSpeed: number;
    typeWeights: Partial<Record<EnemyType, number>>;
}

const DIFFICULTY_STAGES: DifficultyStage[] = [
    {   // 0 – 15 s : tutorial, only red
        fromMs: 0,
        maxEnemies: 5,
        minSpawnIntervalMs: 1800,
        maxSpawnIntervalMs: 2400,
        minSpeed: 55,
        maxSpeed: 70,
        typeWeights: { red: 1 }
    },
    {   // 15 – 40 s : blue joins
        fromMs: 15_000,
        maxEnemies: 6,
        minSpawnIntervalMs: 1400,
        maxSpawnIntervalMs: 1900,
        minSpeed: 60,
        maxSpeed: 80,
        typeWeights: { red: 4, blue: 1 }
    },
    {   // 40 – 80 s : greens join
        fromMs: 40_000,
        maxEnemies: 7,
        minSpawnIntervalMs: 1100,
        maxSpawnIntervalMs: 1550,
        minSpeed: 68,
        maxSpeed: 90,
        typeWeights: { red: 3, blue: 2, green: 1 }
    },
    {   // 80 – 120 s : splitters join (×2 mult kicks in at 90 s)
        fromMs: 80_000,
        maxEnemies: 8,
        minSpawnIntervalMs: 850,
        maxSpawnIntervalMs: 1250,
        minSpeed: 75,
        maxSpeed: 102,
        typeWeights: { red: 3, blue: 2, green: 2, orange: 1 }
    },
    {   // 120 – 180 s : ramping hard
        fromMs: 120_000,
        maxEnemies: 10,
        minSpawnIntervalMs: 600,
        maxSpawnIntervalMs: 920,
        minSpeed: 84,
        maxSpeed: 116,
        typeWeights: { red: 3, blue: 2, green: 2, orange: 1 }
    },
    {   // 180 s+ : penetration mode (×3 mult kicks in at 150 s)
        fromMs: 180_000,
        maxEnemies: 13,
        minSpawnIntervalMs: 350,
        maxSpawnIntervalMs: 600,
        minSpeed: 96,
        maxSpeed: 138,
        typeWeights: { red: 3, blue: 2, green: 3, orange: 2 }
    }
];

// ─── Runtime types ────────────────────────────────────────────────────────────

interface EnemyRuntime
{
    id: string;
    type: EnemyType;
    hp: number;
    maxHp: number;
    sprite: GameObjects.Image;
    velocity: PhaserMath.Vector2;
    speed: number;
    driftFactor: number;
    turnTimerMs: number;
    syncTimerMs: number;
    inFirewall: boolean;
    enteredFirewallAtMs: number | null;
    tapRadius: number;
    frozenUntilMs: number; // game-time ms until which movement is suppressed
}

const MAX_DELTA_MS = 250;
const POSITION_SYNC_INTERVAL_MS = 100;

// ─── EnemySystem ──────────────────────────────────────────────────────────────

export class EnemySystem
{
    private readonly options:
        Required<Omit<EnemySystemOptions, 'onEnemyHit' | 'onEnemyDestroyed' | 'onEnemyReachedServer'>>
        & Pick<EnemySystemOptions, 'onEnemyHit' | 'onEnemyDestroyed' | 'onEnemyReachedServer'>;
    private readonly enemies = new Map<string, EnemyRuntime>();
    private width: number;
    private height: number;
    private readonly center = new PhaserMath.Vector2();
    private spawnTimerMs = 0;
    private enemySeq = 0;

    constructor (
        private readonly scene: Scene,
        private readonly gameState: GameState,
        options: EnemySystemOptions = {}
    )
    {
        this.options = {
            maxEnemies:          options.maxEnemies          ?? 10,
            minSpawnIntervalMs:  options.minSpawnIntervalMs  ?? 920,
            maxSpawnIntervalMs:  options.maxSpawnIntervalMs  ?? 1580,
            minSpeed:            options.minSpeed            ?? 76,
            maxSpeed:            options.maxSpeed            ?? 98,
            spawnMargin:         options.spawnMargin         ?? 84,
            turnIntervalMinMs:   options.turnIntervalMinMs   ?? 260,
            turnIntervalMaxMs:   options.turnIntervalMaxMs   ?? 1920,
            inwardBias:          options.inwardBias          ?? 0.82,
            turnResponsiveness:  options.turnResponsiveness  ?? 7.2,
            maxDriftFactor:      options.maxDriftFactor      ?? 3.42,
            firewallRadius:      options.firewallRadius      ?? 120,
            serverHitRadius:     options.serverHitRadius     ?? 56,
            enemyWidthDesktopPx: options.enemyWidthDesktopPx ?? 58,
            enemyWidthTabletPx:  options.enemyWidthTabletPx  ?? 50,
            enemyWidthMobilePx:  options.enemyWidthMobilePx  ?? 42,
            onEnemyHit:           options.onEnemyHit,
            onEnemyDestroyed:     options.onEnemyDestroyed,
            onEnemyReachedServer: options.onEnemyReachedServer
        };

        this.width = this.scene.scale.width;
        this.height = this.scene.scale.height;
        this.center.set(this.width / 2, this.height / 2);
        this.resetSpawnTimer();
    }

    resize (width: number, height: number)
    {
        this.width = width;
        this.height = height;
        this.center.set(width / 2, height / 2);
    }

    setServerHitRadius (radius: number)
    {
        const safeRadius = Number.isFinite(radius) ? Math.max(4, radius) : this.options.serverHitRadius;
        this.options.serverHitRadius = safeRadius;
    }

    setFirewallRadius (radius: number)
    {
        const safeRadius = Number.isFinite(radius) ? Math.max(8, radius) : this.options.firewallRadius;
        this.options.firewallRadius = safeRadius;
    }

    tryHitEnemy (worldX: number, worldY: number)
    {
        if (this.gameState.getPhase() !== 'running')
        {
            return false;
        }

        let selectedEnemy: EnemyRuntime | null = null;
        let selectedDistance = Number.POSITIVE_INFINITY;

        for (const enemy of this.enemies.values())
        {
            if (!enemy.inFirewall)
            {
                continue;
            }

            const distance = PhaserMath.Distance.Between(worldX, worldY, enemy.sprite.x, enemy.sprite.y);
            if (distance > enemy.tapRadius)
            {
                continue;
            }

            if (distance < selectedDistance)
            {
                selectedDistance = distance;
                selectedEnemy = enemy;
            }
        }

        if (!selectedEnemy)
        {
            return false;
        }

        selectedEnemy.hp -= 1;
        this.options.onEnemyHit?.(selectedEnemy.type);

        if (selectedEnemy.hp <= 0)
        {
            this.resolveEnemyDestroyed(selectedEnemy);
        }
        else
        {
            this.playHitFlash(selectedEnemy);
        }

        return true;
    }

    update (deltaMs: number)
    {
        if (this.gameState.getPhase() !== 'running')
        {
            return;
        }

        const safeDeltaMs = Number.isFinite(deltaMs) ? Math.max(0, Math.min(deltaMs, MAX_DELTA_MS)) : 0;
        if (safeDeltaMs <= 0)
        {
            return;
        }

        this.tickSpawn(safeDeltaMs);
        this.tickEnemies(safeDeltaMs);
    }

    destroy ()
    {
        for (const enemy of this.enemies.values())
        {
            enemy.sprite.destroy();
        }

        this.enemies.clear();
        this.gameState.clearEnemies();
    }

    // ─── Spawn ────────────────────────────────────────────────────────────────

    private tickSpawn (deltaMs: number)
    {
        this.spawnTimerMs -= deltaMs;
        if (this.spawnTimerMs > 0)
        {
            return;
        }

        this.resetSpawnTimer();
        this.trySpawnEnemy();
    }

    private getGlobalSpeedMultiplier (): number
    {
        const elapsed = this.gameState.getElapsedMs();
        if (elapsed >= 180_000) return 3;
        if (elapsed >= 120_000) return 2;
        if (elapsed >= 60_000)  return 1.5;
        return 1;
    }

    private getCurrentStage (): DifficultyStage
    {
        const elapsed = this.gameState.getElapsedMs();
        let stage = DIFFICULTY_STAGES[0];

        for (const s of DIFFICULTY_STAGES)
        {
            if (elapsed >= s.fromMs)
            {
                stage = s;
            }
            else
            {
                break;
            }
        }

        return stage;
    }

    private resetSpawnTimer ()
    {
        const stage = this.getCurrentStage();
        this.spawnTimerMs = PhaserMath.Between(stage.minSpawnIntervalMs, stage.maxSpawnIntervalMs);
    }

    private pickEnemyType (): EnemyType
    {
        const { typeWeights } = this.getCurrentStage();
        const entries = Object.entries(typeWeights) as [EnemyType, number][];
        const total = entries.reduce((sum, [, w]) => sum + w, 0);
        const roll = PhaserMath.FloatBetween(0, total);
        let cumulative = 0;

        for (const [type, weight] of entries)
        {
            cumulative += weight;
            if (roll < cumulative)
            {
                return type;
            }
        }

        return 'red';
    }

    private trySpawnEnemy ()
    {
        const stage = this.getCurrentStage();

        if (this.enemies.size >= stage.maxEnemies)
        {
            return;
        }

        const type = this.pickEnemyType();
        const typeCfg = ENEMY_TYPE_CONFIG[type];

        const id = `enemy-${++this.enemySeq}`;
        const angle = PhaserMath.FloatBetween(0, Math.PI * 2);
        const spawnRadius = (Math.hypot(this.width, this.height) * 0.5) + this.options.spawnMargin;
        const spawnPosition = new PhaserMath.Vector2(
            this.center.x + (Math.cos(angle) * spawnRadius),
            this.center.y + (Math.sin(angle) * spawnRadius)
        );

        const toCenter = new PhaserMath.Vector2(
            this.center.x - spawnPosition.x,
            this.center.y - spawnPosition.y
        ).normalize();
        const driftFactor = PhaserMath.FloatBetween(-this.options.maxDriftFactor, this.options.maxDriftFactor);
        const direction = this.composeDirection(toCenter, driftFactor);
        const speed = PhaserMath.FloatBetween(stage.minSpeed, stage.maxSpeed) * typeCfg.speedMultiplier;
        const hp = PhaserMath.Between(typeCfg.hp, typeCfg.hpMax);

        const sprite = this.scene.add.image(spawnPosition.x, spawnPosition.y, typeCfg.textureKey).setDepth(140);
        this.applyEnemySize(sprite, type);

        if (typeCfg.tint !== null)
        {
            sprite.setTint(typeCfg.tint);
        }

        const runtimeEnemy: EnemyRuntime = {
            id,
            type,
            hp,
            maxHp: hp,
            sprite,
            velocity: direction.scale(speed),
            speed,
            driftFactor,
            turnTimerMs: PhaserMath.Between(this.options.turnIntervalMinMs, this.options.turnIntervalMaxMs),
            syncTimerMs: 0,
            inFirewall: false,
            enteredFirewallAtMs: null,
            tapRadius: this.getEnemyTapRadius(sprite.displayWidth, type),
            frozenUntilMs: 0
        };

        this.enemies.set(id, runtimeEnemy);

        const stateEnemy: EnemyState = {
            id,
            type,
            x: spawnPosition.x,
            y: spawnPosition.y,
            state: 'approaching',
            spawnedAtMs: this.gameState.getElapsedMs(),
            enteredFirewallAtMs: null
        };

        this.gameState.upsertEnemy(stateEnemy);
    }

    // ─── Movement ─────────────────────────────────────────────────────────────

    private tickEnemies (deltaMs: number)
    {
        const deltaSec = deltaMs / 1000;

        for (const enemy of this.enemies.values())
        {
            enemy.turnTimerMs -= deltaMs;
            if (enemy.turnTimerMs <= 0)
            {
                enemy.driftFactor = PhaserMath.FloatBetween(-this.options.maxDriftFactor, this.options.maxDriftFactor);
                enemy.turnTimerMs = PhaserMath.Between(this.options.turnIntervalMinMs, this.options.turnIntervalMaxMs);
            }

            const toCenter = new PhaserMath.Vector2(
                this.center.x - enemy.sprite.x,
                this.center.y - enemy.sprite.y
            );
            const distanceToCenter = toCenter.length();

            if (distanceToCenter <= this.options.serverHitRadius)
            {
                this.resolveEnemyReachedServer(enemy);
                continue;
            }

            if (this.gameState.getElapsedMs() < enemy.frozenUntilMs)
            {
                continue;
            }

            const wasInFirewall = enemy.inFirewall;
            enemy.inFirewall = distanceToCenter <= this.options.firewallRadius;
            if (enemy.inFirewall && !wasInFirewall)
            {
                enemy.enteredFirewallAtMs = this.gameState.getElapsedMs();
            }

            const toCenterNormalized = distanceToCenter > 0
                ? toCenter.scale(1 / distanceToCenter)
                : new PhaserMath.Vector2(0, 1);
            const desiredDirection = this.composeDirection(toCenterNormalized, enemy.driftFactor);
            const currentDirection = enemy.velocity.clone().normalize();
            const turnLerp = Math.min(1, this.options.turnResponsiveness * deltaSec);
            const nextDirection = currentDirection.lerp(desiredDirection, turnLerp).normalize();

            enemy.velocity.copy(nextDirection.scale(enemy.speed * this.getGlobalSpeedMultiplier()));
            enemy.sprite.x += enemy.velocity.x * deltaSec;
            enemy.sprite.y += enemy.velocity.y * deltaSec;

            enemy.syncTimerMs -= deltaMs;
            if (enemy.syncTimerMs <= 0)
            {
                enemy.syncTimerMs = POSITION_SYNC_INTERVAL_MS;
                this.gameState.patchEnemy(enemy.id, {
                    x: enemy.sprite.x,
                    y: enemy.sprite.y,
                    state: enemy.inFirewall ? 'in_firewall' : 'approaching',
                    enteredFirewallAtMs: enemy.enteredFirewallAtMs
                });
            }
        }
    }

    private composeDirection (toCenter: PhaserMath.Vector2, driftFactor: number)
    {
        const perpendicular = new PhaserMath.Vector2(-toCenter.y, toCenter.x);
        const desired = toCenter.clone().scale(this.options.inwardBias).add(perpendicular.scale(driftFactor));

        if (desired.lengthSq() <= Number.EPSILON)
        {
            return toCenter.clone();
        }

        desired.normalize();

        // Enforce progress to the center: no backward trajectories.
        if (desired.dot(toCenter) < 0.45)
        {
            return toCenter.clone().lerp(desired, 0.2).normalize();
        }

        return desired;
    }

    // ─── Resolve ──────────────────────────────────────────────────────────────

    private resolveEnemyDestroyed (enemy: EnemyRuntime)
    {
        const { x, y } = enemy.sprite;

        this.gameState.patchEnemy(enemy.id, {
            x,
            y,
            state: 'dead',
            enteredFirewallAtMs: enemy.enteredFirewallAtMs
        });
        this.gameState.removeEnemy(enemy.id);
        this.enemies.delete(enemy.id);
        this.playEnemyDeathAnimation(enemy);

        if (enemy.type === 'orange')
        {
            this.spawnSplitterChildren(enemy);
        }

        this.options.onEnemyDestroyed?.(enemy.id);
    }

    private resolveEnemyReachedServer (enemy: EnemyRuntime)
    {
        this.gameState.patchEnemy(enemy.id, {
            x: enemy.sprite.x,
            y: enemy.sprite.y,
            state: 'hit_server',
            enteredFirewallAtMs: enemy.enteredFirewallAtMs
        });
        this.gameState.removeEnemy(enemy.id);
        this.enemies.delete(enemy.id);
        enemy.sprite.destroy();

        this.options.onEnemyReachedServer?.(enemy.id);
    }

    // ─── Size helpers ─────────────────────────────────────────────────────────

    private applyEnemySize (sprite: GameObjects.Image, type: EnemyType)
    {
        const baseWidth = Math.max(1, sprite.width);
        const targetWidth = this.getTargetEnemyWidth() * ENEMY_TYPE_CONFIG[type].sizeMultiplier;
        sprite.setScale(targetWidth / baseWidth);
    }

    private getTargetEnemyWidth ()
    {
        if (this.width <= 480)
        {
            return this.options.enemyWidthMobilePx;
        }

        if (this.width <= 768)
        {
            return this.options.enemyWidthTabletPx;
        }

        return this.options.enemyWidthDesktopPx;
    }

    private getEnemyTapRadius (displayWidth: number, type: EnemyType)
    {
        return Math.max(14, displayWidth * ENEMY_TYPE_CONFIG[type].tapRadiusMultiplier);
    }

    // ─── Animations ───────────────────────────────────────────────────────────

    /**
     * Flash when blue tank takes a hit but survives.
     * White tint → scale pulse → restore HP-based tint + small chip particles.
     */
    private playHitFlash (enemy: EnemyRuntime)
    {
        const { sprite } = enemy;
        if (!sprite.active)
        {
            return;
        }

        const cfg = ENEMY_TYPE_CONFIG[enemy.type];
        const origScaleX = sprite.scaleX;
        const origScaleY = sprite.scaleY;

        sprite.setTintFill(0xffffff);

        // Chip particles (small 0/1 bits scattered on hit)
        const originX = sprite.x;
        const originY = sprite.y;
        for (let i = 0; i < 4; i++)
        {
            const chipAngle = PhaserMath.FloatBetween(0, Math.PI * 2);
            const travel = PhaserMath.FloatBetween(18, 40);
            const glyph = PhaserMath.Between(0, 1) === 0 ? '0' : '1';
            const color = cfg.deathBitPalette[PhaserMath.Between(0, cfg.deathBitPalette.length - 1)];

            const chip = this.scene.add.text(originX, originY, glyph, {
                fontFamily: 'Montserrat, Arial, sans-serif',
                fontSize: `${PhaserMath.Between(9, 15)}px`,
                fontStyle: '700',
                color
            }).setOrigin(0.5).setDepth(sprite.depth + 1).setAlpha(0.9);

            this.scene.tweens.add({
                targets: chip,
                x: originX + (Math.cos(chipAngle) * travel),
                y: originY + (Math.sin(chipAngle) * travel),
                alpha: 0,
                scale: 0.5,
                duration: PhaserMath.Between(180, 310),
                ease: 'Cubic.easeOut',
                onComplete: () => { chip.destroy(); }
            });
        }

        // Scale punch + tint restore
        this.scene.tweens.add({
            targets: sprite,
            scaleX: origScaleX * 1.22,
            scaleY: origScaleY * 1.22,
            duration: 72,
            ease: 'Sine.easeOut',
            yoyo: true,
            onComplete: () =>
            {
                if (!sprite.active)
                {
                    return;
                }

                const tintForHp = cfg.hitTints[enemy.hp - 1];
                if (tintForHp !== undefined)
                {
                    sprite.setTint(tintForHp);
                }
                else if (cfg.tint !== null)
                {
                    sprite.setTint(cfg.tint);
                }
                else
                {
                    sprite.clearTint();
                }
            }
        });
    }

    /**
     * Full death explosion — colours, bit count, ring sizes, durations
     * all scale with the enemy type config.
     */
    private playEnemyDeathAnimation (enemy: EnemyRuntime)
    {
        const { sprite } = enemy;
        const cfg = ENEMY_TYPE_CONFIG[enemy.type];
        const originX = sprite.x;
        const originY = sprite.y;
        const baseScaleX = sprite.scaleX;
        const baseScaleY = sprite.scaleY;
        const baseDepth = sprite.depth;

        const burstRadius = Math.max(22, sprite.displayWidth) * cfg.deathBurstScale;
        const dur = cfg.deathDuration;

        // Core flash
        const coreR = Math.max(6, sprite.displayWidth * 0.15);
        const coreFlash = this.scene.add.circle(originX, originY, coreR, cfg.deathFlashColor, 0.72)
            .setDepth(baseDepth + 3);
        coreFlash.setBlendMode(Phaser.BlendModes.ADD);

        this.scene.tweens.add({
            targets: coreFlash,
            scaleX: 4.4,
            scaleY: 4.4,
            alpha: 0,
            duration: Math.round(234 * Math.max(0.55, dur)),
            ease: 'Expo.easeOut',
            onComplete: () => { coreFlash.destroy(); }
        });

        // Primary shock ring
        const ringR = Math.max(4, sprite.displayWidth * 0.1);
        const shockRing = this.scene.add.circle(originX, originY, ringR).setDepth(baseDepth + 2);
        shockRing.setStrokeStyle(3, cfg.deathRingColor, 0.95);

        this.scene.tweens.add({
            targets: shockRing,
            scaleX: 3.2,
            scaleY: 3.2,
            alpha: 0,
            duration: Math.round(288 * Math.max(0.55, dur)),
            ease: 'Cubic.easeOut',
            onComplete: () => { shockRing.destroy(); }
        });

        // Blue tank gets a second, wider and slower shockwave ring
        if (enemy.type === 'blue')
        {
            const outerRing = this.scene.add.circle(originX, originY, ringR * 1.5).setDepth(baseDepth + 1);
            outerRing.setStrokeStyle(2, cfg.deathRingColor, 0.55);

            this.scene.tweens.add({
                targets: outerRing,
                scaleX: 6.0,
                scaleY: 6.0,
                alpha: 0,
                duration: 540,
                ease: 'Sine.easeOut',
                delay: 55,
                onComplete: () => { outerRing.destroy(); }
            });
        }

        // Bit burst (0/1 glyphs)
        const bitCount = enemy.type === 'blue' ? 22 : enemy.type === 'green' ? 10 : 15;
        const fontSize = enemy.type === 'green'
            ? { min: 9, max: 16 }
            : { min: 14, max: 24 };

        for (let i = 0; i < bitCount; i++)
        {
            const bitAngle = PhaserMath.FloatBetween(0, Math.PI * 2);
            const travel = PhaserMath.FloatBetween(burstRadius * 0.45, burstRadius * 1.2);
            const glyph = PhaserMath.Between(0, 1) === 0 ? '0' : '1';
            const color = cfg.deathBitPalette[PhaserMath.Between(0, cfg.deathBitPalette.length - 1)];

            const bit = this.scene.add.text(originX, originY, glyph, {
                fontFamily: 'Montserrat, Arial, sans-serif',
                fontSize: `${PhaserMath.Between(fontSize.min, fontSize.max)}px`,
                fontStyle: '700',
                color
            })
                .setOrigin(0.5)
                .setDepth(baseDepth + 1)
                .setRotation(PhaserMath.FloatBetween(-0.35, 0.35))
                .setAlpha(0.95);

            this.scene.tweens.add({
                targets: bit,
                x: originX + (Math.cos(bitAngle) * travel * PhaserMath.FloatBetween(0.95, 1.35)),
                y: originY + (Math.sin(bitAngle) * travel * PhaserMath.FloatBetween(0.95, 1.35)),
                alpha: 0,
                scaleX: PhaserMath.FloatBetween(0.52, 0.88),
                scaleY: PhaserMath.FloatBetween(0.52, 0.88),
                angle: PhaserMath.Between(-180, 180),
                duration: Math.round(PhaserMath.Between(414, 630) * Math.max(0.55, dur)),
                ease: 'Cubic.easeOut',
                onComplete: () => { bit.destroy(); }
            });
        }

        // Sprite death tween
        sprite.setTintFill(cfg.deathSpriteColor);

        this.scene.tweens.add({
            targets: sprite,
            y: originY + PhaserMath.Between(34, 58),
            scaleX: baseScaleX * 1.34,
            scaleY: baseScaleY * 1.34,
            alpha: 0,
            angle: sprite.angle + PhaserMath.Between(-26, 26),
            duration: Math.round(387 * Math.max(0.55, dur)),
            ease: 'Sine.easeIn',
            onComplete: () =>
            {
                sprite.clearTint();
                sprite.destroy();
            }
        });
    }

    // ─── Splitter ─────────────────────────────────────────────────────────────

    /**
     * Spawns 2 green children at the orange splitter's death position,
     * fanning out ±45° from the parent's last movement direction.
     */
    private spawnSplitterChildren (parent: EnemyRuntime)
    {
        const parentDir = parent.velocity.lengthSq() > 0
            ? parent.velocity.clone().normalize()
            : new PhaserMath.Vector2(0, -1);

        for (let i = 0; i < 2; i++)
        {
            const sideAngle = (i === 0 ? -1 : 1) * (Math.PI / 4);
            const cos = Math.cos(sideAngle);
            const sin = Math.sin(sideAngle);
            const childDir = new PhaserMath.Vector2(
                parentDir.x * cos - parentDir.y * sin,
                parentDir.x * sin + parentDir.y * cos
            );

            this.spawnEnemyAtPosition('green', parent.sprite.x, parent.sprite.y, childDir, 500);
        }
    }

    /**
     * Spawns an enemy of the given type at an arbitrary world position
     * with an initial direction vector. Used by the splitter mechanic.
     */
    private spawnEnemyAtPosition (type: EnemyType, x: number, y: number, direction: PhaserMath.Vector2, freezeMs = 0)
    {
        if (this.enemies.size >= this.options.maxEnemies)
        {
            return;
        }

        const typeCfg = ENEMY_TYPE_CONFIG[type];
        const id = `enemy-${++this.enemySeq}`;
        const speed = PhaserMath.FloatBetween(this.options.minSpeed, this.options.maxSpeed) * typeCfg.speedMultiplier;
        const inFirewall = PhaserMath.Distance.Between(x, y, this.center.x, this.center.y) <= this.options.firewallRadius;

        const sprite = this.scene.add.image(x, y, typeCfg.textureKey).setDepth(140);
        this.applyEnemySize(sprite, type);

        if (typeCfg.tint !== null)
        {
            sprite.setTint(typeCfg.tint);
        }

        const runtimeEnemy: EnemyRuntime = {
            id,
            type,
            hp: typeCfg.hp,
            maxHp: typeCfg.hp,
            sprite,
            velocity: direction.clone().normalize().scale(speed),
            speed,
            driftFactor: PhaserMath.FloatBetween(-this.options.maxDriftFactor, this.options.maxDriftFactor),
            turnTimerMs: PhaserMath.Between(this.options.turnIntervalMinMs, this.options.turnIntervalMaxMs),
            syncTimerMs: 0,
            inFirewall,
            enteredFirewallAtMs: inFirewall ? this.gameState.getElapsedMs() : null,
            tapRadius: this.getEnemyTapRadius(sprite.displayWidth, type),
            frozenUntilMs: freezeMs > 0 ? this.gameState.getElapsedMs() + freezeMs : 0
        };

        this.enemies.set(id, runtimeEnemy);

        this.gameState.upsertEnemy({
            id,
            type,
            x,
            y,
            state: inFirewall ? 'in_firewall' : 'approaching',
            spawnedAtMs: this.gameState.getElapsedMs(),
            enteredFirewallAtMs: runtimeEnemy.enteredFirewallAtMs
        });
    }
}

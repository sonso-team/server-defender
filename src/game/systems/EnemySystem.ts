import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { type EnemyState, GameState } from '../core/GameState';

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
    onEnemyDestroyed?: (enemyId: string) => void;
    onEnemyReachedServer?: (enemyId: string) => void;
}

interface EnemyRuntime
{
    id: string;
    sprite: GameObjects.Image;
    velocity: PhaserMath.Vector2;
    speed: number;
    driftFactor: number;
    turnTimerMs: number;
    syncTimerMs: number;
    inFirewall: boolean;
    enteredFirewallAtMs: number | null;
    tapRadius: number;
}

const MAX_DELTA_MS = 250;
const POSITION_SYNC_INTERVAL_MS = 100;

export class EnemySystem
{
    private readonly options:
        Required<Omit<EnemySystemOptions, 'onEnemyDestroyed' | 'onEnemyReachedServer'>>
        & Pick<EnemySystemOptions, 'onEnemyDestroyed' | 'onEnemyReachedServer'>;
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
            maxEnemies: options.maxEnemies ?? 10,
            minSpawnIntervalMs: options.minSpawnIntervalMs ?? 920,
            maxSpawnIntervalMs: options.maxSpawnIntervalMs ?? 1580,
            minSpeed: options.minSpeed ?? 76,
            maxSpeed: options.maxSpeed ?? 98,
            spawnMargin: options.spawnMargin ?? 84,
            turnIntervalMinMs: options.turnIntervalMinMs ?? 260,
            turnIntervalMaxMs: options.turnIntervalMaxMs ?? 1920,
            inwardBias: options.inwardBias ?? 0.82,
            turnResponsiveness: options.turnResponsiveness ?? 7.2,
            maxDriftFactor: options.maxDriftFactor ?? 3.42,
            firewallRadius: options.firewallRadius ?? 120,
            serverHitRadius: options.serverHitRadius ?? 56,
            enemyWidthDesktopPx: options.enemyWidthDesktopPx ?? 58,
            enemyWidthTabletPx: options.enemyWidthTabletPx ?? 50,
            enemyWidthMobilePx: options.enemyWidthMobilePx ?? 42,
            onEnemyDestroyed: options.onEnemyDestroyed,
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

        this.resolveEnemyDestroyed(selectedEnemy);
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

    private resetSpawnTimer ()
    {
        this.spawnTimerMs = PhaserMath.Between(this.options.minSpawnIntervalMs, this.options.maxSpawnIntervalMs);
    }

    private trySpawnEnemy ()
    {
        if (this.enemies.size >= this.options.maxEnemies)
        {
            return;
        }

        const id = `enemy-${++this.enemySeq}`;
        const angle = PhaserMath.FloatBetween(0, Math.PI * 2);
        const spawnRadius = (Math.hypot(this.width, this.height) * 0.5) + this.options.spawnMargin;
        const spawnPosition = new PhaserMath.Vector2(
            this.center.x + (Math.cos(angle) * spawnRadius),
            this.center.y + (Math.sin(angle) * spawnRadius)
        );

        const toCenter = new PhaserMath.Vector2(this.center.x - spawnPosition.x, this.center.y - spawnPosition.y).normalize();
        const driftFactor = PhaserMath.FloatBetween(-this.options.maxDriftFactor, this.options.maxDriftFactor);
        const direction = this.composeDirection(toCenter, driftFactor);
        const speed = PhaserMath.FloatBetween(this.options.minSpeed, this.options.maxSpeed);

        const sprite = this.scene.add.image(spawnPosition.x, spawnPosition.y, 'enemy')
            .setDepth(140);
        this.applyEnemySize(sprite);

        const runtimeEnemy: EnemyRuntime = {
            id,
            sprite,
            velocity: direction.scale(speed),
            speed,
            driftFactor,
            turnTimerMs: PhaserMath.Between(this.options.turnIntervalMinMs, this.options.turnIntervalMaxMs),
            syncTimerMs: 0,
            inFirewall: false,
            enteredFirewallAtMs: null,
            tapRadius: this.getEnemyTapRadius(sprite.displayWidth)
        };

        this.enemies.set(id, runtimeEnemy);

        const stateEnemy: EnemyState = {
            id,
            x: spawnPosition.x,
            y: spawnPosition.y,
            state: 'approaching',
            spawnedAtMs: this.gameState.getElapsedMs(),
            enteredFirewallAtMs: null
        };

        this.gameState.upsertEnemy(stateEnemy);
    }

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

            const toCenter = new PhaserMath.Vector2(this.center.x - enemy.sprite.x, this.center.y - enemy.sprite.y);
            const distanceToCenter = toCenter.length();
            if (distanceToCenter <= this.options.serverHitRadius)
            {
                this.resolveEnemyReachedServer(enemy);
                continue;
            }

            const wasInFirewall = enemy.inFirewall;
            enemy.inFirewall = distanceToCenter <= this.options.firewallRadius;
            if (enemy.inFirewall && !wasInFirewall)
            {
                enemy.enteredFirewallAtMs = this.gameState.getElapsedMs();
            }

            const toCenterNormalized = distanceToCenter > 0 ? toCenter.scale(1 / distanceToCenter) : new PhaserMath.Vector2(0, 1);
            const desiredDirection = this.composeDirection(toCenterNormalized, enemy.driftFactor);
            const currentDirection = enemy.velocity.clone().normalize();
            const turnLerp = Math.min(1, this.options.turnResponsiveness * deltaSec);
            const nextDirection = currentDirection.lerp(desiredDirection, turnLerp).normalize();

            enemy.velocity.copy(nextDirection.scale(enemy.speed));
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

    private resolveEnemyDestroyed (enemy: EnemyRuntime)
    {
        this.gameState.patchEnemy(enemy.id, {
            x: enemy.sprite.x,
            y: enemy.sprite.y,
            state: 'dead',
            enteredFirewallAtMs: enemy.enteredFirewallAtMs
        });
        this.gameState.removeEnemy(enemy.id);
        this.enemies.delete(enemy.id);
        enemy.sprite.destroy();

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

    private applyEnemySize (sprite: GameObjects.Image)
    {
        const baseWidth = Math.max(1, sprite.width);
        const targetWidth = this.getTargetEnemyWidth();
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

    private getEnemyTapRadius (displayWidth: number)
    {
        return Math.max(14, displayWidth * 0.6); //а это хитбоксы врагов
    }
}

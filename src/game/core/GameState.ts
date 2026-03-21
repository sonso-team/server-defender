export type GamePhase = 'menu' | 'running' | 'paused' | 'gameover';

export type EnemyStatus = 'spawned' | 'approaching' | 'in_firewall' | 'hit_server' | 'dead';

export type EnemyType = 'red' | 'green' | 'blue' | 'orange';

export interface EnemyState
{
    id: string;
    type: EnemyType;
    x: number;
    y: number;
    state: EnemyStatus;
    spawnedAtMs: number;
    enteredFirewallAtMs: number | null;
}

interface MutableGameStateSnapshot
{
    score: number;
    lives: number;
    elapsedMs: number;
    phase: GamePhase;
    enemies: EnemyState[];
}

export interface GameStateSnapshot extends Readonly<Omit<MutableGameStateSnapshot, 'enemies'>>
{
    readonly enemies: readonly Readonly<EnemyState>[];
}

interface GameStateOptions
{
    initialLives?: number;
    initialPhase?: GamePhase;
}

type GameStateListener = (snapshot: GameStateSnapshot) => void;

const MAX_DELTA_MS = 250;

export class GameState
{
    private readonly initialLives: number;
    private readonly initialPhase: GamePhase;
    private score = 0;
    private lives: number;
    private elapsedMs = 0;
    private phase: GamePhase;
    private readonly enemies = new Map<string, EnemyState>();
    private readonly listeners = new Set<GameStateListener>();

    constructor (options: GameStateOptions = {})
    {
        this.initialLives = Math.max(1, options.initialLives ?? 3);
        this.initialPhase = options.initialPhase ?? 'menu';
        this.lives = this.initialLives;
        this.phase = this.initialPhase;
    }

    reset ()
    {
        this.score = 0;
        this.lives = this.initialLives;
        this.elapsedMs = 0;
        this.phase = this.initialPhase;
        this.enemies.clear();
        this.emitChange();
    }

    setPhase (phase: GamePhase)
    {
        if (this.phase === phase)
        {
            return;
        }

        this.phase = phase;
        this.emitChange();
    }

    start ()
    {
        this.setPhase('running');
    }

    advanceTime (deltaMs: number)
    {
        if (this.phase !== 'running')
        {
            return;
        }

        const safeDelta = Number.isFinite(deltaMs) ? Math.max(0, Math.min(deltaMs, MAX_DELTA_MS)) : 0;
        if (safeDelta <= 0)
        {
            return;
        }

        this.elapsedMs += safeDelta;
        this.emitChange();
    }

    addScore (points: number)
    {
        const safePoints = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
        if (safePoints <= 0)
        {
            return this.score;
        }

        this.score += safePoints;
        this.emitChange();
        return this.score;
    }

    damageServer (amount = 1)
    {
        const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
        if (safeAmount <= 0 || this.phase === 'gameover')
        {
            return this.lives;
        }

        this.lives = Math.max(0, this.lives - safeAmount);

        if (this.lives === 0)
        {
            this.phase = 'gameover';
        }

        this.emitChange();
        return this.lives;
    }

    upsertEnemy (enemy: EnemyState)
    {
        if (!enemy.id)
        {
            return;
        }

        this.enemies.set(enemy.id, { ...enemy });
        this.emitChange();
    }

    patchEnemy (id: string, patch: Partial<Omit<EnemyState, 'id'>>)
    {
        const enemy = this.enemies.get(id);
        if (!enemy)
        {
            return;
        }

        this.enemies.set(id, { ...enemy, ...patch, id });
        this.emitChange();
    }

    removeEnemy (id: string)
    {
        if (!this.enemies.delete(id))
        {
            return;
        }

        this.emitChange();
    }

    clearEnemies ()
    {
        if (this.enemies.size === 0)
        {
            return;
        }

        this.enemies.clear();
        this.emitChange();
    }

    getSnapshot (): GameStateSnapshot
    {
        return this.createSnapshot();
    }

    getPhase ()
    {
        return this.phase;
    }

    getElapsedMs ()
    {
        return this.elapsedMs;
    }

    getMaxLives ()
    {
        return this.initialLives;
    }

    subscribe (listener: GameStateListener)
    {
        this.listeners.add(listener);
        listener(this.createSnapshot());

        return () => {
            this.listeners.delete(listener);
        };
    }

    private createSnapshot (): GameStateSnapshot
    {
        const enemies = Array.from(this.enemies.values(), (enemy) => Object.freeze({ ...enemy }));
        return Object.freeze({
            score: this.score,
            lives: this.lives,
            elapsedMs: this.elapsedMs,
            phase: this.phase,
            enemies: Object.freeze(enemies)
        });
    }

    private emitChange ()
    {
        if (this.listeners.size === 0)
        {
            return;
        }

        const snapshot = this.createSnapshot();
        for (const listener of this.listeners)
        {
            listener(snapshot);
        }
    }
}

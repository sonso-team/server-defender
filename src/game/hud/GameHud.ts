import { Scene } from 'phaser';
import type { GameStateSnapshot } from '../core/GameState';

const HEART_SIZE = 30;
const HEART_GAP  = 3;

export class GameHud
{
    private readonly scoreText: Phaser.GameObjects.Text;
    private readonly timerText: Phaser.GameObjects.Text;
    private readonly heartImages: Phaser.GameObjects.Image[] = [];
    private readonly maxLives: number;

    constructor (scene: Scene, maxLives: number, markerRadius: number)
    {
        this.maxLives = maxLives;

        const { width, height } = scene.scale;
        const centerX = width / 2;

        this.scoreText = scene.add.text(centerX, height / 2 - markerRadius - 70, '', {
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: 28,
            fontStyle: '700',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(200);

        this.timerText = scene.add.text(16, 16, '', {
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: 17,
            fontStyle: '600',
            color: '#c8d8ff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'left',
        }).setOrigin(0, 0).setDepth(200);

        const totalHeartsWidth = maxLives * HEART_SIZE + (maxLives - 1) * HEART_GAP;
        const heartsStartX     = width - 16 - totalHeartsWidth;

        for (let i = 0; i < maxLives; i++)
        {
            const img = scene.add.image(
                heartsStartX + i * (HEART_SIZE + HEART_GAP) + HEART_SIZE / 2,
                20 + HEART_SIZE / 2,
                'heart',
            ).setDisplaySize(HEART_SIZE, HEART_SIZE).setDepth(200);
            this.heartImages.push(img);
        }
    }

    resize (width: number, height: number, markerRadius: number)
    {
        const centerX          = width / 2;
        const totalHeartsWidth = this.maxLives * HEART_SIZE + (this.maxLives - 1) * HEART_GAP;
        const heartsStartX     = width - 16 - totalHeartsWidth;

        this.scoreText.setPosition(centerX, height / 2 - markerRadius - 70);
        this.timerText.setPosition(16, 16);

        this.heartImages.forEach((img, i) =>
        {
            img.setPosition(
                heartsStartX + i * (HEART_SIZE + HEART_GAP) + HEART_SIZE / 2,
                20 + HEART_SIZE / 2,
            );
        });
    }

    render (snapshot: GameStateSnapshot)
    {
        const seconds = (snapshot.elapsedMs / 1000).toFixed(1);
        this.scoreText.setText(`${snapshot.score} очк.`);
        this.timerText.setText(`Время: ${seconds}s`);
        this.heartImages.forEach((img, i) =>
        {
            img.setTexture(i < snapshot.lives ? 'heart' : 'heart-broken');
        });
    }

    destroy ()
    {
        this.scoreText.destroy();
        this.timerText.destroy();
        this.heartImages.forEach(img => img.destroy());
        this.heartImages.length = 0;
    }
}

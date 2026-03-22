import { Scene } from 'phaser';
import { Background } from '../background/Background';

export class Preloader extends Scene
{
    private backgroundEffect!: Background;
    private progressOutline!: Phaser.GameObjects.Rectangle;
    private progressBar!: Phaser.GameObjects.Rectangle;
    private progressValue = 0;

    private readonly handleResize = (gameSize: Phaser.Structs.Size) =>
    {
        this.updateLayout(gameSize.width, gameSize.height);
    };

    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        const { width, height } = this.scale;
        const centerX           = width / 2;
        const centerY           = height / 2;
        const progressBoxWidth  = Math.min(width * 0.7, 468);
        const progressBarPadding = 4;
        const progressBarWidth  = progressBoxWidth - progressBarPadding * 2;

        this.cameras.main.setBackgroundColor(0x0f092b);
        this.backgroundEffect = new Background(this);

        this.progressOutline = this.add.rectangle(centerX, centerY, progressBoxWidth, 32).setStrokeStyle(1, 0xffffff);
        this.progressBar     = this.add.rectangle(centerX - progressBarWidth / 2, centerY, progressBarPadding, 28, 0xffffff).setOrigin(0, 0.5);

        this.load.on('progress', (progress: number) =>
        {
            this.progressValue     = progress;
            this.progressBar.width = progressBarPadding + progressBarWidth * progress;
        });

        this.scale.on('resize', this.handleResize);
    }

    preload ()
    {
        this.load.setPath('assets');

        this.load.image('game-bg',     'background/background.png');
        this.load.svg('server',        'characters/server-chan.svg',  { width: 256, height: 256 });
        this.load.image('enemy',       'characters/virus-kun.png');
        this.load.svg('little-bro',   'characters/little-bro.svg',  { width: 128, height: 128 });
        this.load.svg('big-bro',      'characters/big-bro.svg',     { width: 128, height: 128 });
        this.load.svg('orange-enemy', 'characters/orange.svg',      { width: 128, height: 128 });
        this.load.svg('heart',        'heart.svg',                   { width: 64,  height: 64  });
        this.load.svg('heart-broken', 'heart-broken.svg',            { width: 64,  height: 64  });
    }

    create ()
    {
        this.scene.start('MainMenu');
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

    private updateLayout (width = this.scale.width, height = this.scale.height)
    {
        const progressBoxWidth  = Math.min(width * 0.7, 468);
        const progressBarPadding = 4;
        const progressBarWidth  = progressBoxWidth - progressBarPadding * 2;
        const centerX           = width / 2;
        const centerY           = height / 2;

        this.backgroundEffect.resize(width, height);
        this.progressOutline.setPosition(centerX, centerY);
        this.progressOutline.width = progressBoxWidth;
        this.progressBar.setPosition(centerX - progressBarWidth / 2, centerY);
        this.progressBar.width = progressBarPadding + progressBarWidth * this.progressValue;
    }
}

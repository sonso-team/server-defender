import { Scene } from 'phaser';

export class Preloader extends Scene
{
    background!: Phaser.GameObjects.Image;
    progressOutline!: Phaser.GameObjects.Rectangle;
    progressBar!: Phaser.GameObjects.Rectangle;

    constructor ()
    {
        super('Preloader');
    }

    private updateLayout (width = this.scale.width, height = this.scale.height)
    {
        const centerX = width / 2;
        const centerY = height / 2;
        const progressBoxWidth = Math.min(width * 0.7, 468);
        const progressBarPadding = 4;
        const progressBarWidth = progressBoxWidth - (progressBarPadding * 2);
        const progress = (this.progressBar.width - progressBarPadding) / progressBarWidth;

        this.background.setPosition(centerX, centerY);
        this.background.setDisplaySize(width, height);

        this.progressOutline.setPosition(centerX, centerY);
        this.progressOutline.width = progressBoxWidth;

        this.progressBar.setPosition(centerX - (progressBarWidth / 2), centerY);
        this.progressBar.width = progressBarPadding + (progressBarWidth * Math.max(progress, 0));
    }

    init ()
    {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        const progressBoxWidth = Math.min(width * 0.7, 468);
        const progressBarPadding = 4;
        const progressBarWidth = progressBoxWidth - (progressBarPadding * 2);

        //  We loaded this image in our Boot Scene, so we can display it here
        this.background = this.add.image(centerX, centerY, 'background');
        this.background.setDisplaySize(width, height);

        //  A simple progress bar. This is the outline of the bar.
        this.progressOutline = this.add.rectangle(centerX, centerY, progressBoxWidth, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        this.progressBar = this.add.rectangle(centerX - (progressBarWidth / 2), centerY, progressBarPadding, 28, 0xffffff);
        this.progressBar.setOrigin(0, 0.5);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {

            //  Update the progress bar to the current screen width budget.
            this.progressBar.width = progressBarPadding + (progressBarWidth * progress);

        });

        this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
            this.updateLayout(gameSize.width, gameSize.height);
        });
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        this.load.image('logo', 'logo.png');
        this.load.image('star', 'star.png');
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start('MainMenu');
    }

    shutdown ()
    {
        this.scale.off('resize');
    }
}

import { GameObjects, Scene } from 'phaser';

import { EventBus } from '../EventBus';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    logoTween: Phaser.Tweens.Tween | null = null;

    constructor ()
    {
        super('MainMenu');
    }

    private updateLayout (width = this.scale.width, height = this.scale.height)
    {
        const centerX = width / 2;
        const centerY = height / 2;
        const verticalOffset = Math.min(height * 0.12, 84);

        this.background.setPosition(centerX, centerY);
        this.background.setDisplaySize(width, height);

        if (!this.logoTween)
        {
            this.logo.setPosition(centerX, centerY - verticalOffset);
        }

        this.title.setPosition(centerX, centerY + verticalOffset);
    }

    create ()
    {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        const verticalOffset = Math.min(height * 0.12, 84);

        this.background = this.add.image(centerX, centerY, 'background');
        this.background.setDisplaySize(width, height);

        this.logo = this.add.image(centerX, centerY - verticalOffset, 'logo').setDepth(100);

        this.title = this.add.text(centerX, centerY + verticalOffset, 'Main Menu', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
            this.updateLayout(gameSize.width, gameSize.height);
        });

        EventBus.emit('current-scene-ready', this);
    }
    
    changeScene ()
    {
        if (this.logoTween)
        {
            this.logoTween.stop();
            this.logoTween = null;
        }

        this.scene.start('Game');
    }

    moveLogo (vueCallback: ({ x, y }: { x: number, y: number }) => void)
    {
        if (this.logoTween)
        {
            if (this.logoTween.isPlaying())
            {
                this.logoTween.pause();
            }
            else
            {
                this.logoTween.play();
            }
        } 
        else
        {
            const { width, height } = this.scale;
            const targetX = width * 0.75;
            const targetY = height * 0.15;

            this.logoTween = this.tweens.add({
                targets: this.logo,
                x: { value: targetX, duration: 3000, ease: 'Back.easeInOut' },
                y: { value: targetY, duration: 1500, ease: 'Sine.easeOut' },
                yoyo: true,
                repeat: -1,
                onUpdate: () => {
                    if (vueCallback)
                    {
                        vueCallback({
                            x: Math.floor(this.logo.x),
                            y: Math.floor(this.logo.y)
                        });
                    }
                }
            });
        }
    }

    shutdown ()
    {
        this.scale.off('resize');
    }
}

import { Scene } from 'phaser';

interface Star {
    nx: number;
    ny: number;
    size: number;
    phase: number;
}

export class Background
{
    private readonly graphics: Phaser.GameObjects.Graphics;
    private width: number;
    private height: number;
    private travelOffset = 0;

    private readonly backgroundColor = 0x0f092b;
    private readonly gridColor = 0xa7a7bb;
    private readonly glowColor = 0x655ea6;
    private readonly stars: Star[];

    constructor (private readonly scene: Scene)
    {
        this.graphics = this.scene.add.graphics().setDepth(-1000).setScrollFactor(0);
        this.width = this.scene.scale.width;
        this.height = this.scene.scale.height;

        // Pre-generate star positions (normalized coords, upper half only)
        this.stars = Array.from({ length: 80 }, (_, i) => {
            const rng = this.seededRng(i * 7919 + 31337);
            return {
                nx:    rng(),
                ny:    rng() * 0.46,
                size:  0.6 + rng() * 1.4,
                phase: rng() * Math.PI * 2
            };
        });

        this.draw();
    }

    resize (width: number, height: number)
    {
        this.width = width;
        this.height = height;
        this.draw();
    }

    update (delta: number)
    {
        this.travelOffset = (this.travelOffset + (delta * 0.00018)) % 1;
        this.draw();
    }

    destroy ()
    {
        this.graphics.destroy();
    }

    private seededRng (seed: number): () => number
    {
        let s = seed;
        return () => {
            s = (s * 1664525 + 1013904223) & 0xffffffff;
            return (s >>> 0) / 0xffffffff;
        };
    }

    private getEdgeInset (width: number)
    {
        if (width <= 768)
        {
            return 0;
        }

        if (width <= 1024)
        {
            return Math.max(width * 0.08, 8);
        }

        if (width <= 1440)
        {
            return Math.max(width * 0.14, 10);
        }

        return Math.max(width * 0.2, 12);
    }

    private draw ()
    {
        const horizonY = this.height * 0.5;
        const halfWidth = this.width / 2;
        const floorHeight = this.height - horizonY;
        const ceilingHeight = horizonY;
        const edgeInset = this.getEdgeInset(this.width);
        const laneCount = Math.max(14, Math.floor(this.width / 54));
        const rowCount = Math.max(14, Math.floor(this.height / 46));
        const leftAnchorX = halfWidth - (1);
        const rightAnchorX = halfWidth + 1;
        const leftSpan = leftAnchorX - edgeInset;
        const rightSpan = (this.width - edgeInset) - rightAnchorX;

        this.graphics.clear();
        this.graphics.fillStyle(this.backgroundColor, 0.75);
        this.graphics.fillRect(0, 0, this.width, this.height);

        this.graphics.fillStyle(this.glowColor, 0.14);

        this.graphics.lineStyle(1.3, this.gridColor, 0.4);
        this.graphics.lineBetween(halfWidth, 0, halfWidth, this.height);

        this.drawStars(horizonY);
        this.drawPerspectiveFan(leftAnchorX, leftSpan, laneCount);
        this.drawPerspectiveFan(rightAnchorX, rightSpan, laneCount, true);
        this.drawRows(leftAnchorX, rightAnchorX, leftSpan, rightSpan, rowCount, floorHeight, ceilingHeight, horizonY);
        this.drawHorizonGlow(horizonY);
    }

    private drawStars (horizonY: number)
    {
        const t = this.travelOffset * Math.PI * 2;
        for (const star of this.stars)
        {
            const x = star.nx * this.width;
            const y = star.ny * horizonY;
            const alpha = 0.35 + Math.sin(t * 0.7 + star.phase) * 0.28;
            this.graphics.fillStyle(0xddeeff, alpha);
            this.graphics.fillCircle(x, y, star.size);
        }
    }

    private drawHorizonGlow (horizonY: number)
    {
        const layers = [
            { halfH: 2,   alpha: 0.30 },
            { halfH: 8,   alpha: 0.14 },
            { halfH: 22,  alpha: 0.07 },
            { halfH: 55,  alpha: 0.04 },
            { halfH: 110, alpha: 0.02 }
        ];
        for (const layer of layers)
        {
            this.graphics.fillStyle(0xaa66ff, layer.alpha);
            this.graphics.fillRect(0, horizonY - layer.halfH, this.width, layer.halfH * 2);
        }
    }

    private drawPerspectiveFan (anchorX: number, span: number, laneCount: number, mirror = false)
    {
        for (let i = 1; i <= laneCount; i++)
        {
            const normalized = i / laneCount;
            const x = mirror
                ? anchorX + (span * normalized)
                : anchorX - (span * normalized);
            this.graphics.lineBetween(anchorX, this.height * 0.5, x, this.height);
            this.graphics.lineBetween(anchorX, this.height * 0.5, x, 0);
        }
    }

    private drawRows (
        leftAnchorX: number,
        rightAnchorX: number,
        leftSpan: number,
        rightSpan: number,
        rowCount: number,
        floorHeight: number,
        ceilingHeight: number,
        horizonY: number
    )
    {
        for (let i = 0; i < rowCount; i++)
        {
            const progress = ((i / rowCount) + this.travelOffset) % 1;
            const perspective = progress * progress;
            const leftX = leftAnchorX - (leftSpan * perspective);
            const rightX = rightAnchorX + (rightSpan * perspective);
            const alpha = 0.08 + (progress * 0.42);
            const bottomY = horizonY + (perspective * floorHeight);
            const topY = horizonY - (perspective * ceilingHeight);

            this.graphics.lineStyle(1.5, this.gridColor, alpha);
            this.graphics.lineBetween(leftX, bottomY, rightX, bottomY);
            this.graphics.lineBetween(leftX, topY, rightX, topY);
        }
    }
}

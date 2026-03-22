import { useEffect, useRef, useState } from 'react';
import { PhaserGame } from '../shared/phaser/PhaserGame';
import type { PhaserGameRef } from '../shared/phaser/types';
import { IntroModal } from '../widgets/IntroModal';
import { GameOverScreen } from '../widgets/GameOverScreen';
import { EventBus } from '../game/core/EventBus';

interface GameOverPayload
{
    score: number;
    elapsedMs: number;
}

export function App ()
{
    const phaserRef   = useRef<PhaserGameRef>(null);
    const [isIntroOpen, setIsIntroOpen]       = useState(true);
    const [activeSceneKey, setActiveSceneKey] = useState('');
    const [gameOverData, setGameOverData]     = useState<GameOverPayload>({ score: 0, elapsedMs: 0 });

    useEffect(() =>
    {
        EventBus.on('game-over-data', setGameOverData);
        return () => { EventBus.off('game-over-data', setGameOverData); };
    }, []);

    const startScene = (key: string) =>
    {
        const { game, scene } = phaserRef.current ?? {};
        if (scene) { scene.scene.start(key); }
        else       { game?.scene.start(key); }
        setActiveSceneKey(key);
    };

    const handleStart = () =>
    {
        setIsIntroOpen(false);
        startScene('Game');
    };

    const handleRestart = () =>
    {
        setIsIntroOpen(false);
        startScene('Game');
    };

    const isGameOver = activeSceneKey === 'GameOver';

    return (
        <div id="app">
            <div className="game-background">
                <PhaserGame ref={phaserRef} onSceneChange={setActiveSceneKey} />
            </div>

            {isIntroOpen && !isGameOver && (
                <IntroModal onStart={handleStart} />
            )}

            {isGameOver && (
                <GameOverScreen
                    bottomText="Узнавай первым о новых продуктах и мероприятиях DDoS-Guard. Подписывайся на наши соцсети."
                    canRestart={true}
                    description="Спасибо за игру! Результаты розыгрыша появятся в течении нескольких часов"
                    onRestart={handleRestart}
                    scoreCaption="Итоговый счёт"
                    scoreValue={gameOverData.score}
                    telegramText="Мы в Телеграм"
                    title="Игра окончена!"
                    vkText="Мы в Вконтакте"
                />
            )}
        </div>
    );
}

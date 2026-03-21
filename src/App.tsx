import { useEffect, useRef, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { Layout } from './components/Layout';
import { GameOverMenu } from './components/GameOverMenu';

import { EventBus } from './game/EventBus';

interface GameOverPayload
{
    score: number;
    elapsedMs: number;
}

function App()
{
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [isIntroOpen, setIsIntroOpen] = useState(true);
    const [activeSceneKey, setActiveSceneKey] = useState<string>('');
    const [gameOverData, setGameOverData] = useState<GameOverPayload>({ score: 0, elapsedMs: 0 });

    const currentScene = (scene: Phaser.Scene) => {
        setActiveSceneKey(scene.scene.key);
    };

    useEffect(() => {
        const onGameOverData = (payload: GameOverPayload) => {
            setGameOverData(payload);
        };

        EventBus.on('game-over-data', onGameOverData);

        return () => {
            EventBus.off('game-over-data', onGameOverData);
        };
    }, []);

    const startScene = (sceneKey: string) =>
    {
        const game = phaserRef.current?.game;
        if (!game)
        {
            return;
        }

        const activeScene = phaserRef.current?.scene;
        if (activeScene)
        {
            // ScenePlugin.start stops the currently bound scene before starting next one.
            activeScene.scene.start(sceneKey);
        }
        else
        {
            game.scene.start(sceneKey);
        }

        setActiveSceneKey(sceneKey);
    };

    const handleStartGame = () =>
    {
        setIsIntroOpen(false);
        startScene('Game');
    };

    const handleRestartFromGameOver = () =>
    {
        setIsIntroOpen(false);
        startScene('MainMenu');
    };

    const isMainMenuStartVisible = !isIntroOpen && activeSceneKey === 'MainMenu';
    const isGameOverVisible = activeSceneKey === 'GameOver';

    return (
        <div id="app">
            <div className="game-background">
                <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
            </div>
            {!isGameOverVisible && (
                <Layout>
                    {isIntroOpen && (
                        <div className="intro-modal-overlay" role="presentation">
                            <section
                                aria-describedby="game-intro-description"
                                aria-labelledby="game-intro-title"
                                aria-modal="true"
                                className="intro-modal"
                                role="dialog"
                            >
                                <div className="intro-modal__content">
                                    <h1 className="intro-modal__title" id="game-intro-title">Как играть</h1>
                                    <div className="intro-modal__description" id="game-intro-description">
                                        <p>Уничтожай вредоносные запросы, нажимая на них в зоне файрвола. Пропустил - сервер получает урон.</p>
                                    </div>
                                    <p className="intro-modal__footer bold">Продержись как можно дольше!</p>
                                </div>

                                <button className="intro-modal__action" onClick={handleStartGame} type="button">
                                    Начать
                                </button>
                            </section>
                        </div>
                    )}
                    {isMainMenuStartVisible && (
                        <div className="menu-start-overlay">
                            <button className="menu-start-button" onClick={handleStartGame} type="button">
                                Начать
                            </button>
                        </div>
                    )}
                </Layout>
            )}
            {isGameOverVisible && (
                <GameOverMenu
                    bottomText="Узнавай первым о новых продуктах и мероприятиях DDoS-Guard. Подписывайся на наши соцсети."
                    canRestart={true}
                    description="Тут типо какой-то текст который через пропсы прокидывается создателем лобби типа адуреть ты крутой перец выиграй пачку кириешек с диким огурцом"
                    onRestart={handleRestartFromGameOver}
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

export default App;

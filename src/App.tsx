import { useRef, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { Layout } from './components/Layout';


function App()
{
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [isIntroOpen, setIsIntroOpen] = useState(true);

    const currentScene = (_scene: Phaser.Scene) => {};

    const handleStartGame = () =>
    {
        setIsIntroOpen(false);

        const game = phaserRef.current?.game;
        if (!game)
        {
            return;
        }

        game.scene.start('Game');
    };

    return (
        <div id="app">
            <div className="game-background">
                <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
            </div>
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
                                    <p><span className='bold'>Ты — последняя линия защиты сервера.</span> Вредоносные DDoS-запросы летят со всех сторон. Твоя задача уничтожать их, пока они не прорвались через файрвол.</p>
                                    <p><span className='bold'>Нажимай на враждебные запросы, </span> <br /> когда они входят в зону файрвола (пунктирная область вокруг сервера). Тапнул вовремя — запрос уничтожен. Пропустил — сервер получает урон.</p>
                                    <p>Атака усиливается с каждой секундой. <br /> <span className='bold'>Продержись как можно дольше </span> <br /> и набери максимум очков.</p>
                                </div>
                                <p className="intro-modal__footer">Удачи, защитник!</p>
                            </div>

                            <button className="intro-modal__action" onClick={handleStartGame} type="button">
                                Начать
                            </button>
                        </section>
                    </div>
                )}
            </Layout>
        </div>
    );
}

export default App;

import { useRef } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';

function App()
{
    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef<IRefPhaserGame | null>(null);

    // Event emitted from the PhaserGame component
    const currentScene = (_scene: Phaser.Scene) => {};

    return (
        <div id="app">
            <div className="game-shell">
                <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
            </div>
        </div>
    )
}

export default App

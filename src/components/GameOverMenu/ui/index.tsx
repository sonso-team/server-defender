import { TelegramSocialPill, VkSocialPill } from '../../../shared/ui/SocialPills';
import './game-over-menu.scss';

export interface GameOverMenuProps
{
    title: string;
    scoreValue: number | string;
    scoreCaption: string;
    description: string;
    canRestart: boolean;
    restartText?: string;
    bottomText: string;
    vkText: string;
    telegramText: string;
    vkHref?: string;
    telegramHref?: string;
    logoSrc?: string;
    logoAlt?: string;
    onRestart?: () => void;
}

export function GameOverMenu({
    title,
    scoreValue,
    scoreCaption,
    description,
    canRestart,
    restartText = 'Рестарт',
    bottomText,
    vkText,
    telegramText,
    vkHref,
    telegramHref,
    logoSrc = '/assets/logo/logo.svg',
    logoAlt = 'DDOS-GUARD',
    onRestart
}: GameOverMenuProps)
{
    return (
        <section className="game-over-screen" role="region" aria-label={title}>
            <div className="game-over-screen__content">
                <header className="game-over-screen__header">
                    <img alt={logoAlt} className="game-over-screen__logo" src={logoSrc} />
                </header>

                <h1 className="game-over-screen__title">{title}</h1>

                <div className="game-over-screen__score-card">
                    <strong className="game-over-screen__score-value">{scoreValue}</strong>
                    <p className="game-over-screen__score-caption">{scoreCaption}</p>
                </div>

                <p className="game-over-screen__description">{description}</p>

                {canRestart && (
                    <button className="intro-modal__action game-over-screen__restart" onClick={onRestart} type="button">
                        {restartText}
                    </button>
                )}

                <div className="game-over-screen__bottom">
                    <p className="game-over-screen__bottom-text">{bottomText}</p>

                    <div className="game-over-screen__socials">
                        <VkSocialPill href={vkHref} text={vkText} />
                        <TelegramSocialPill href={telegramHref} text={telegramText} />
                    </div>
                </div>
            </div>
        </section>
    );
}

import './social-pills.scss';

export interface SocialPillProps
{
    text: string;
    href?: string;
}

function SocialPill({
    text,
    href,
    iconSrc,
    iconAlt,
    modifier
}: SocialPillProps & {
    iconSrc: string;
    iconAlt: string;
    modifier: string;
})
{
    const safeHref = href ?? '#';

    return (
        <a
            className={`social-pill social-pill--${modifier}`}
            href={safeHref}
            onClick={(event) => {
                if (!href)
                {
                    event.preventDefault();
                }
            }}
            rel={href ? 'noreferrer noopener' : undefined}
            target={href ? '_blank' : undefined}
        >
            <img alt={iconAlt} className="social-pill__icon" src={iconSrc} />
            <span className="social-pill__text">{text}</span>
        </a>
    );
}

export function VkSocialPill(props: SocialPillProps)
{
    return (
        <SocialPill
            iconAlt="ВКонтакте"
            iconSrc="/assets/icons/vk.svg"
            modifier="vk"
            {...props}
        />
    );
}

export function TelegramSocialPill(props: SocialPillProps)
{
    return (
        <SocialPill
            iconAlt="Telegram"
            iconSrc="/assets/icons/telegram.svg"
            modifier="telegram"
            {...props}
        />
    );
}

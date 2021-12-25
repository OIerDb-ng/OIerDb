import twemoji from 'twemoji';

export function getEmoji(emoji: string, className?: string) {
    return twemoji.parse(emoji, {
        base: 'https://lf9-cdn-tos.bytecdntp.com/cdn/expire-1-y/twemoji/13.0.1/',
        size: 'svg',
        ext: '.svg',
        className,
    });
}

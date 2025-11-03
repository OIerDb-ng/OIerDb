import { AWARD_EMOJI_MAPPINGS } from '~/constants/awards';

interface AwardEmojiProps {
  level: string;
}

export const AwardEmoji: React.FC<AwardEmojiProps> = ({ level }) => {
  const mapping = AWARD_EMOJI_MAPPINGS.find((m) =>
    m.keywords.some((keyword) => level.includes(keyword)),
  );

  return mapping?.emoji ? <span>{mapping.emoji}</span> : null;
};

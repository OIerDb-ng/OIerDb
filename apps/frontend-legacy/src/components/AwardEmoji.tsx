import React, { memo } from 'react';

import { EmojiRenderer } from '@/components/EmojiRenderer';

interface AwardEmojiProps {
  level: string;
}

const AwardEmoji: React.FC<AwardEmojiProps> = (props) => {
  const keywordsOfType = [['金'], ['银'], ['铜']];
  const emojis = ['🥇', '🥈', '🥉'];

  const type = keywordsOfType.findIndex((keywords) =>
    keywords.some((keyword) => props.level.includes(keyword)),
  );
  const emoji = emojis[type];

  return emoji ? <EmojiRenderer>{emoji}</EmojiRenderer> : null;
};

export default memo(AwardEmoji);

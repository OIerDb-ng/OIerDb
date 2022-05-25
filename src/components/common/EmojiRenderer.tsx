import React, { useEffect, useRef } from 'react';
import { Ref } from 'semantic-ui-react';
import twemoji from 'twemoji';

interface EmojiRendererProps {
  emojiClassName?: string;
  children: React.ReactElement | string;
}

export const EmojiRenderer: React.FC<EmojiRendererProps> = (props) => {
  const refElement = useRef<HTMLElement>();
  useEffect(() => {
    if (refElement.current)
      twemoji.parse(refElement.current, {
        base: 'https://cdnjs.baoshuo.ren/ajax/libs/twemoji/13.1.0/',
        size: 'svg',
        ext: '.svg',
        className: props.emojiClassName,
      });
  });

  return (
    <Ref innerRef={refElement}>
      {typeof props.children !== 'object' ? (
        <span>{props.children}</span>
      ) : (
        props.children
      )}
    </Ref>
  );
};

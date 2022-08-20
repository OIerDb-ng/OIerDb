import React, { useEffect, useRef } from 'react';
import { Ref } from 'semantic-ui-react';
import twemoji from 'twemoji';
import { version as twemojiVersion } from 'twemoji/package.json';

interface EmojiRendererProps {
  emojiClassName?: string;
  children: React.ReactElement | string;
}

const cdnjsBaseUrl = import.meta.env.VITE_BAOSHUO_CDNJS
  ? '//cdnjs.baoshuo.ren/ajax/libs'
  : '//cdnjs.cloudflare.com/ajax/libs';

export const EmojiRenderer: React.FC<EmojiRendererProps> = (props) => {
  const refElement = useRef<HTMLElement>();
  useEffect(() => {
    if (refElement.current)
      twemoji.parse(refElement.current, {
        base: `${cdnjsBaseUrl}/twemoji/${twemojiVersion}/`,
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

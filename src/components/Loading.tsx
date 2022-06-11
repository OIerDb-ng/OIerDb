import React, { useEffect, useState } from 'react';
import { Segment, Dimmer, Loader } from 'semantic-ui-react';

type LoadingProps = {
  name?: string;
  progress?: number;
};

export const Loading: React.FC<LoadingProps> = ({
  name = 'OIerDb',
  progress,
}) => {
  const [slowNetwork, setSlowNetwork] = useState(0);

  useEffect(() => {
    const time1 = setTimeout(() => setSlowNetwork(1), 5000);
    const time2 = setTimeout(() => setSlowNetwork(2), 20000);

    return () => {
      clearTimeout(time1);
      clearTimeout(time2);
    };
  });

  const message: string[] = [
    '正在加载 ' + name + '...',
    '仍在加载...',
    '您的网络连接速度可能较慢，请耐心等待...',
  ];

  return (
    <Segment style={{ height: 100 }}>
      <Dimmer active inverted>
        <Loader indeterminate>
          {message[slowNetwork]}
          {progress ?? <> ({progress} %)</>}
        </Loader>
      </Dimmer>
    </Segment>
  );
};

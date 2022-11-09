import React, { memo, useState, useEffect } from 'react';
import { Header, Segment, Dimmer, Loader } from 'semantic-ui-react';
import styles from './Stats.module.less';

const Stats: React.FC = () => {
  const [data, setData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('https://stat.api.baoshuo.dev/info?site=oier.baoshuo.dev')
      .then((res) => {
        if (!res.ok) throw 'fetch error';

        return res.json();
      })
      .then((res) => {
        if (res.error) throw 'result error';

        setData(res);
        setLoading(false);
      })
      .catch(() => setError(true));
  }, []);

  return (
    <>
      <Header
        className={styles.header}
        block
        as="h4"
        content="统计"
        attached="top"
        icon="info"
      />
      <Segment attached="bottom">
        {loading ? (
          <div className={styles.loadingContainer}>
            <Dimmer active inverted>
              <Loader indeterminate>正在加载...</Loader>
            </Dimmer>
          </div>
        ) : error ? (
          <>
            <p>加载失败。</p>
            <p>
              请前往{' '}
              <a
                href="https://stat.xtom.com/oier.baoshuo.dev"
                target="_blank"
                rel="noreferrer noopener nofollow"
              >
                xTom Analytics
              </a>{' '}
              获取统计信息。
            </p>
          </>
        ) : (
          <>
            <p>自 2022 年 5 月以来：</p>
            <ul style={{ paddingLeft: 26 }}>
              <li>总访问量：{data.pageviews} 次；</li>
              <li>总访客数：{data.visitors} 人。</li>
            </ul>
            <p>
              详细统计信息可以在{' '}
              <a
                href="https://stat.xtom.com/oier.baoshuo.dev"
                target="_blank"
                rel="noreferrer noopener nofollow"
              >
                xTom Analytics
              </a>{' '}
              上查看。
            </p>
          </>
        )}
      </Segment>
    </>
  );
};

export default memo(Stats);

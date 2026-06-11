import { Button, Checkbox, Container, Paper } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';

import { useLocalStorage } from '~/hooks/use-local-storage';

import type { Route } from './+types/about';
import * as styles from './about.css';

export function meta({}: Route.MetaArgs) {
  return [{ title: '关于 - OIerDb' }];
}

const FAQ = () => (
  <section className={styles.section}>
    <h2 className={styles.sectionTitle}>常见问题</h2>
    <Paper withBorder p="md" radius="sm">
      <h3 className={styles.question}>这是什么网站？</h3>
      <p className={styles.paragraph}>
        这是一个信息学竞赛选手获奖记录并对学校进行排名的数据库。本网站名为「OIerDb」。数据库诞生在
        2018 年 2 月，有时也会咕咕咕的更新。
      </p>
      <p className={styles.paragraph}>
        OIerDb 原始数据不接受任何修改，除非是为了与{' '}
        <a href="https://www.noi.cn" target="_blank" rel="noreferrer" className={styles.link}>
          NOI 官网
        </a>{' '}
        保持一致。但学校和人的合并、拼音生成等其他问题可以通过在 GitHub 上{' '}
        <a
          href="https://github.com/OIerDb-ng/OIerDb-data-generator/issues/new/choose"
          target="_blank"
          rel="noreferrer noopener"
          className={styles.link}
        >
          发送 issue
        </a>{' '}
        的方式申请修改。
      </p>

      <h3 className={styles.question}>我能够做什么？</h3>
      <p className={styles.paragraph}>
        你能够在这个网站上查询选手的获奖记录，目前可以通过姓名、姓名首字母缩写、省份、年级和学校来进行查询。
      </p>
      <p className={styles.paragraph}>
        欢迎加入 OIerDb 用户 QQ 群：
        <a
          href="https://jq.qq.com/?_wv=1027&k=qcFzvx32"
          target="_blank"
          rel="noreferrer"
          className={styles.link}
        >
          813305282
        </a>
        。
      </p>
      <p className={`${styles.paragraph} ${styles.starText}`}>
        🌟 如果您觉得这个网站有所帮助，请在 GitHub 上为{' '}
        <a
          href="https://github.com/OIerDb-ng/OIerDb"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          OIerDb-ng/OIerDb
        </a>{' '}
        <b>点亮 Star</b>，谢谢！
      </p>
    </Paper>
  </section>
);

/*
  本项目基于 AGPL 3.0 许可协议开源。
  在您自行部署本项目时，请保留此处的作者信息。
*/
const Developers = () => (
  <section className={styles.section}>
    <h2 className={styles.sectionTitle}>开发者</h2>
    <Paper withBorder p="md" radius="sm">
      <ul className={styles.list}>
        <li>
          <a href="https://baoshuo.ren" target="_blank" rel="noreferrer" className={styles.link}>
            宝硕
          </a>
        </li>
        <li>
          <a href="https://men.ci" target="_blank" rel="noreferrer" className={styles.link}>
            Menci
          </a>
        </li>
        <li>
          <a href="https://bytew.net" target="_blank" rel="noreferrer" className={styles.link}>
            nocriz
          </a>
        </li>
        <li>
          <a
            href="https://github.com/yhx-12243"
            target="_blank"
            rel="noreferrer"
            className={styles.link}
          >
            yhx-12243
          </a>
        </li>
      </ul>
      <p className={styles.paragraph}>以上排名不分先后，感谢他们的贡献。</p>
    </Paper>
  </section>
);

const friendLinks = [
  { name: 'LibreOJ', url: 'https://loj.ac' },
  { name: 'HydroOJ', url: 'https://hydro.ac' },
];

const FriendLinks = () => (
  <section className={styles.section}>
    <h2 className={styles.sectionTitle}>友情链接</h2>
    <Paper withBorder p="md" radius="sm">
      <ul className={styles.list}>
        {friendLinks.map(({ name, url }) => (
          <li key={name}>
            <a href={url} target="_blank" rel="noreferrer" className={styles.link}>
              {name}
            </a>
          </li>
        ))}
      </ul>
    </Paper>
  </section>
);

const Stats = () => {
  const [data, setData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('https://stat.api.baoshuo.dev/info?site=oier.baoshuo.dev')
      .then((res) => {
        if (!res.ok) throw new Error('fetch error');
        return res.json();
      })
      .then((res) => {
        if (res.error) throw new Error('result error');
        setData(res);
        setLoading(false);
      })
      .catch(() => setError(true));
  }, []);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>统计</h2>
      <Paper withBorder p="md" radius="sm">
        {loading ? (
          <p className={styles.paragraph}>正在加载…</p>
        ) : error ? (
          <>
            <p className={styles.paragraph}>加载失败。</p>
            <p className={styles.paragraph}>
              请前往{' '}
              <a
                href="https://stat.xtom.com/oier.baoshuo.dev"
                target="_blank"
                rel="noreferrer noopener nofollow"
                className={styles.link}
              >
                xTom Analytics
              </a>{' '}
              获取统计信息。
            </p>
          </>
        ) : (
          <>
            <p className={styles.paragraph}>自 2022 年 5 月以来：</p>
            <ul className={styles.list}>
              <li>总访问量：{data.pageviews} 次；</li>
              <li>总访客数：{data.visitors} 人。</li>
            </ul>
            <p className={styles.paragraph}>
              详细统计信息可以在{' '}
              <a
                href="https://stat.xtom.com/oier.baoshuo.dev"
                target="_blank"
                rel="noreferrer noopener nofollow"
                className={styles.link}
              >
                xTom Analytics
              </a>{' '}
              上查看。
            </p>
          </>
        )}
      </Paper>
    </section>
  );
};

const Config = () => {
  const [clearingCache, setClearingCache] = useState(false);
  const [displayGender, setDisplayGender] = useLocalStorage('display_gender', false);

  const clearCache = useCallback(async () => {
    setClearingCache(true);

    localStorage.clear();

    try {
      await navigator.serviceWorker
        ?.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())));
    } catch {
      // ignore
    }

    try {
      indexedDB.deleteDatabase('oierdb-ng');
    } catch {
      // ignore
    }

    location.reload();
  }, []);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>配置</h2>
      <Paper withBorder p="md" radius="sm">
        <h3 className={styles.question}>清除缓存</h3>
        <p className={styles.paragraph}>
          清除缓存后，将会从服务器重新获取最新数据。清除缓存可能需要一段时间，完成后页面将自动刷新。
        </p>
        <Button onClick={clearCache} loading={clearingCache} color="red" size="sm">
          清除缓存
        </Button>

        <h3 className={styles.question}>性别显示</h3>
        <Checkbox
          checked={displayGender}
          onChange={(event) => setDisplayGender(event.currentTarget.checked)}
          label="展示在 NOI 公示时显示的登记性别"
        />
      </Paper>
    </section>
  );
};

export default function About() {
  return (
    <Container size="md" className={styles.container}>
      <img src="/logo.png" alt="OIerDb" className={styles.logo} />
      <h1 className={styles.title}>OIerDb</h1>
      <p className={styles.subtitle}>
        OIerDb 是中国信息学竞赛选手的一个数据库
        <br />
        <small>OIerDb is a database for Chinese OI participants</small>
      </p>

      <FAQ />
      <Stats />
      <Developers />
      <FriendLinks />
      <Config />
    </Container>
  );
}

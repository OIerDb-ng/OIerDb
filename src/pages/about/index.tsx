import React, { useCallback, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Button, Checkbox, Header, Segment } from 'semantic-ui-react';
import { deleteDB } from 'idb';
import { useLocalStorage } from 'usehooks-ts';
import FAQ from '@/components/FAQ';
import Stats from '@/components/Stats';
import styles from './index.module.less';

const AboutHeader: React.FC = () => (
  <>
    <img
      width={128}
      src="/logo.png"
      title="OIerDb"
      style={{ margin: '0 auto', display: 'block' }}
    />
    <h1 style={{ textAlign: 'center' }}>OIerDb</h1>
    <p style={{ textAlign: 'center' }}>
      OIerDb 是中国信息学竞赛选手的一个数据库
      <br />
      <small>OIerDb is a database for Chinese OI participants</small>
    </p>
  </>
);

/*
  本项目基于 AGPL 3.0 许可协议开源。
  在您自行部署本项目时，请保留此处的作者信息。
*/
const Developers = () => (
  <>
    <Header
      className={styles.header}
      block
      as="h4"
      content="开发者"
      attached="top"
      icon="users"
    />
    <Segment attached="bottom">
      <ul style={{ marginTop: 0, paddingLeft: 26 }}>
        <li>
          <a href="https://baoshuo.ren">宝硕</a>
        </li>
        <li>
          <a href="https://men.ci">Menci</a>
        </li>
        <li>
          <a href="https://bytew.net">nocriz</a>
        </li>
        <li>
          <a href="https://github.com/yhx-12243">yhx-12243</a>
        </li>
      </ul>
      <p>以上排名不分先后，感谢他们的贡献。</p>
    </Segment>
  </>
);

const links = [
  {
    name: 'LibreOJ',
    url: 'https://loj.ac',
  },
  {
    name: 'HydroOJ',
    url: 'https://hydro.ac',
  },
];

const FriendLinks: React.FC = () => (
  <>
    <Header
      className={styles.header}
      block
      as="h4"
      content="友情链接"
      attached="top"
      icon="linkify"
    />
    <Segment attached="bottom">
      <ul style={{ marginTop: 0, marginBottom: 0, paddingLeft: 26 }}>
        {links.map(({ name, url }) => (
          <li key={name}>
            {/* eslint-disable-next-line react/jsx-no-target-blank */}
            <a href={url} target="_blank">
              {name}
            </a>
          </li>
        ))}
      </ul>
    </Segment>
  </>
);

const Config: React.FC = () => {
  // Clear cache
  const [clearingCache, setClearingCache] = useState(false);

  const clearCache = useCallback(async () => {
    setClearingCache(true);

    localStorage.clear();

    try {
      await deleteDB('OIerDb');
    } catch (e) {
      console.error(e);
    }

    location.reload();
  }, [setClearingCache]);

  // Gender display
  const [displayGender, setDisplayGender] = useLocalStorage(
    'display_gender',
    false
  );

  return (
    <>
      <Header
        className={styles.header}
        block
        as="h4"
        content="配置"
        attached="top"
        icon="configure"
      />
      <Segment attached="bottom">
        <h5>清除缓存</h5>
        <p>
          清除缓存后，将会从服务器重新获取最新数据。清除缓存可能需要一段时间，完成后页面将自动刷新。
        </p>
        <Button loading={clearingCache} onClick={clearCache} color="red">
          清除缓存
        </Button>

        <h5>性别显示</h5>
        <Checkbox
          defaultChecked={displayGender}
          onClick={useCallback(
            (_, data) => setDisplayGender(data.checked),
            [setDisplayGender]
          )}
          label="展示在 NOI 公示时显示的登记性别"
        />
      </Segment>
    </>
  );
};

const About: React.FC = () => (
  <>
    <Helmet>
      <title>关于</title>
    </Helmet>

    <AboutHeader />
    <FAQ />
    <Stats />
    <Developers />
    <FriendLinks />
    <Config />
  </>
);

export default About;

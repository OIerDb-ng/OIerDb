import React from 'react';
import { Header, Segment } from 'semantic-ui-react';
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

const About: React.FC = () => (
  <>
    <AboutHeader />
    <FAQ />
    <Stats />
    <Developers />
  </>
);

export default About;

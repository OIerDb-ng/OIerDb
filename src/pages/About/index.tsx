import React from 'react';

// Components
import { Header, Segment } from 'semantic-ui-react';
import { FAQ } from '@/components/Home';

// Logo
import logo from '@/assets/logo-white.png';

// Styles
import styles from './index.module.less';

const AboutHeader: React.FC = () => (
  <>
    <img
      width={128}
      src={logo}
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

const Stats: React.FC = () => (
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
      本站的访客统计信息可以{' '}
      <a href="https://stat.xtom.com/oier.baoshuo.dev" target="_blank">
        在 xTom Analytics 上查看
      </a>{' '}
      。
    </Segment>
  </>
);

const Develpoers = () => (
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
      <h5>前端</h5>
      <ul>
        <li>
          <a href="https://baoshuo.ren">宝硕</a>
        </li>
        <li>
          <a href="https://men.ci">Menci</a>
        </li>
      </ul>
      <h5>数据处理</h5>
      <ul>
        <li>
          <a href="https://bytew.net">norciz</a>
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
    <Develpoers />
  </>
);

export default About;

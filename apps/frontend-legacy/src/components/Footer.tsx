import React from 'react';

// Components
import { Container, Segment, Icon } from 'semantic-ui-react';

// Styles
import styles from './Footer.module.less';

// 本项目（LexRank）与其上游
const REPO_URL = 'https://github.com/xiangyanhao/OIerDb-LexRank';
const UPSTREAM_URL = 'https://github.com/OIerDb-ng/OIerDb';

/*
  本项目基于 AGPL 3.0 许可协议开源。
  在您自行部署本项目时，请保留此处的作者信息。
*/
const Footer: React.FC = () => (
  <Segment vertical>
    <Container textAlign="center">
      <div className={styles.footerIcons}>
        <code>{window.appVersion.substring(0, 7)}</code>
        <a href={REPO_URL} title="本仓库源代码" target="_blank" rel="noreferrer noopener">
          <Icon name="github" style={{ margin: '0 .25rem 0' }} />
          Source Code
        </a>
      </div>
      {import.meta.env.VITE_LOCAL_PREVIEW === 'true' && (
        <div style={{ marginTop: '.5rem', color: '#14b8a6', fontSize: '.8em' }}>
          OIerDb LexRank · GitHub Pages 部署版 · 分层优先排名由 Yanhao Xiang 二次开发 · AGPL-3.0
        </div>
      )}
      <div className={styles.footerText}>
        上游 OIerDb 作者与贡献者：{' '}
        <a
          href="https://baoshuo.ren"
          target="_blank"
          rel="noreferrer"
        >
          Baoshuo
        </a>
        {' · '}
        <a href="https://men.ci" target="_blank" rel="noreferrer">
          Menci
        </a>
        {' · '}
        <a href="https://bytew.net" target="_blank" rel="noreferrer">
          nocriz
        </a>{' '}
        {' · '}
        <a href="https://github.com/yhx-12243" target="_blank" rel="noreferrer">
          yhx-12243
        </a>
      </div>
      <div className={styles.footerText}>
        LexRank 二次开发与维护：{' '}
        <a href="https://github.com/xiangyanhao" target="_blank" rel="noreferrer">
          Yanhao Xiang
        </a>
      </div>
      <div className={styles.footerMeta}>
        源代码：<a href={REPO_URL} target="_blank" rel="noreferrer noopener">xiangyanhao/OIerDb-LexRank</a>
        {' · 上游项目：'}
        <a href={UPSTREAM_URL} target="_blank" rel="noreferrer noopener">OIerDb-ng/OIerDb</a>
        {' · 许可：'}
        <a
          href="https://www.gnu.org/licenses/agpl-3.0.html"
          target="_blank"
          rel="noreferrer noopener"
        >
          AGPL-3.0
        </a>
      </div>
    </Container>
  </Segment>
);

export default Footer;

import React from 'react';

// Components
import { Container, Segment, Icon } from 'semantic-ui-react';
import { EmojiRenderer } from './EmojiRenderer';

// Styles
import styles from './Footer.module.less';

const Footer: React.FC = () => (
  <Segment vertical>
    <Container textAlign="center">
      <div className={styles.footerIcons}>
        <code>{window.appVersion.substring(0, 7)}</code>
        <a
          href="https://github.com/renbaoshuo/OIerDb"
          title="GitHub"
          target="_blank"
          rel="noreferrer noopener"
        >
          <Icon name="github" style={{ margin: '0 .25rem 0' }} />
          Source Code
        </a>
      </div>
      {/* 人员按字典序排列 */}
      <div className={styles.footerText}>
        Made with &nbsp;
        <i>
          <EmojiRenderer>💖</EmojiRenderer>
        </i>
        &nbsp; by{' '}
        <a
          href="https://baoshuo.ren/?utm_source=oier.baoshuo.dev"
          target="_blank"
        >
          Baoshuo
        </a>
        {', '}
        <a href="https://men.ci" target="_blank">
          Menci
        </a>
        {', '}
        <a href="https://bytew.net" target="_blank">
          nocriz
        </a>{' '}
        and{' '}
        <a href="https://github.com/yhx-12243" target="_blank">
          yhx-12243
        </a>
      </div>
    </Container>
  </Segment>
);

export default Footer;

import React from 'react';

// Components
import { Container, Segment, Icon } from 'semantic-ui-react';
import { EmojiRenderer } from '../common/EmojiRenderer';

// Styles
import styles from './index.module.less';

export const Footer: React.FC = () => (
  <>
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
        <div className={styles.footerText}>
          Made with &nbsp;
          <i>
            <EmojiRenderer>💖</EmojiRenderer>
          </i>
          &nbsp; by{' '}
          <a href="https://baoshuo.ren" target="_blank">
            Baoshuo
          </a>{' '}
          and{' '}
          <a href="https://men.ci" target="_blank">
            Menci
          </a>
        </div>
      </Container>
    </Segment>
  </>
);

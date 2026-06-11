import { Container } from '@mantine/core';

import * as styles from './footer.css';

const appVersion = (
  typeof __APP_VERSION__ !== 'undefined' ? (__APP_VERSION__ as string) : 'dev'
).substring(0, 7);

/*
  本项目基于 AGPL 3.0 许可协议开源。
  在您自行部署本项目时，请保留此处的作者信息。
*/
export const Footer: React.FC = () => (
  <footer className={styles.footer}>
    <Container size="md">
      <div className={styles.inner}>
        <div>
          <code>{appVersion}</code>
          {' · '}
          <a
            href="https://github.com/renbaoshuo/OIerDb"
            target="_blank"
            rel="noreferrer noopener"
            className={styles.link}
          >
            Source Code
          </a>
        </div>
        <div>
          Made with 💖 by{' '}
          <a
            href="https://baoshuo.ren/?utm_source=oier.baoshuo.dev"
            target="_blank"
            rel="noreferrer"
            className={styles.link}
          >
            Baoshuo
          </a>
        </div>
      </div>
    </Container>
  </footer>
);

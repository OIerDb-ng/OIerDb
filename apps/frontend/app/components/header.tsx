import { Burger, Container, Drawer, Group, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link } from 'react-router';

import * as styles from './header.css';

import '@fontsource/saira/latin-500.css';

interface NavItem {
  label: string;
  to: string;
}

const navItems: NavItem[] = [
  { label: '首页', to: '/' },
  { label: '选手', to: '/oier' },
  { label: '学校', to: '/school' },
  { label: '比赛', to: '/contest' },
  { label: '关于', to: '/about' },
];

export const Header: React.FC = () => {
  const [opened, { toggle, close }] = useDisclosure(false);

  return (
    <>
      <header className={styles.header}>
        <Container size="md" className={styles.container}>
          <div className={styles.inner}>
            <Link to="/" className={styles.logo}>
              <img src="/logo.png" alt="OIerDb" width={28} height={28} />
              <span>OIerDb</span>
            </Link>

            <Group className={styles.group} visibleFrom="sm">
              {navItems.map((item) => (
                <Link key={item.to} to={item.to} className={styles.item}>
                  {item.label}
                </Link>
              ))}
            </Group>

            <Burger
              className={styles.burger}
              opened={opened}
              onClick={toggle}
              size="sm"
              hiddenFrom="sm"
              aria-label="Toggle navigation"
            />
          </div>
        </Container>
      </header>

      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="180px"
        padding="0"
        withCloseButton={false}
        hiddenFrom="sm"
      >
        <Stack gap={0}>
          <Link to="/" className={styles.mobileLogo} onClick={close}>
            <img src="/logo.png" alt="OIerDb" width={28} height={28} />
            <span>OIerDb</span>
          </Link>

          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className={styles.mobileItem} onClick={close}>
              {item.label}
            </Link>
          ))}
        </Stack>
      </Drawer>
    </>
  );
};

import { Burger, Container, Drawer, Group, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link } from 'react-router';

import * as styles from './header.css';

import '@fontsource/saira/latin-500';

interface NavItem {
  label: string;
  to: string;
}

const navItems: NavItem[] = [{ label: '首页', to: '/' }];

export const Header: React.FC = () => {
  const [opened, { toggle, close }] = useDisclosure(false);

  return (
    <>
      <header className={styles.header}>
        <Container size="md" className={styles.container}>
          <div className={styles.inner}>
            <Link to="/" className={styles.logo}>
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: '#000',
                  width: 28,
                  height: 28,
                }}
              />
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
            <span
              style={{
                display: 'inline-block',
                backgroundColor: '#000',
                width: 28,
                height: 28,
              }}
            />
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

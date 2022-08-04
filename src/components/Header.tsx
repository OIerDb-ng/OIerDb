import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Container,
  Icon,
  Menu,
  Sidebar,
  type SemanticICONS,
} from 'semantic-ui-react';
import { useScreenWidthWithin } from '@/utils/useScreenWidthWithin';
import styles from './Header.module.less';

// Header Buttons
const headerButtons: {
  name: string;
  to: string;
  icon: SemanticICONS;
}[] = [
  {
    name: '首页',
    to: '/',
    icon: 'home',
  },
  {
    name: '选手',
    to: '/oier',
    icon: 'user',
  },
  {
    name: '学校',
    to: '/school',
    icon: 'building',
  },
  {
    name: '比赛',
    to: '/contest',
    icon: 'calendar',
  },
  {
    name: '关于',
    to: '/about',
    icon: 'info circle',
  },
];

const Header: React.FC = () => {
  const wide = useScreenWidthWithin(768, Infinity);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (
      sidebarOpen !==
      document.documentElement.classList.contains(styles.sidebarOpen)
    )
      document.documentElement.classList.toggle(styles.sidebarOpen);
  }, [sidebarOpen]);

  const sidebarOpenStatusClassName = sidebarOpen
    ? ' ' + styles.sidebarOpen
    : '';

  return (
    <>
      <Menu fixed="top" borderless>
        <Container>
          <Menu.Item as={Link} to="/">
            <img src="/logo.png" style={{ marginRight: '0.75em' }} />
            <div style={{ fontSize: '20px' }}>
              <b>OIerDb</b>
            </div>
          </Menu.Item>
          {(wide &&
            headerButtons.map((button) => (
              <Menu.Item key={button.name} as={Link} to={button.to}>
                <Icon name={button.icon} />
                {button.name}
              </Menu.Item>
            ))) || (
            <Menu.Item
              position="right"
              icon="bars"
              onClick={() => setSidebarOpen(true)}
            ></Menu.Item>
          )}
        </Container>
      </Menu>
      {!wide && (
        <>
          <div
            className={styles.sidebarDimmer + sidebarOpenStatusClassName}
            onClick={() => setSidebarOpen(false)}
          ></div>
          <Sidebar
            as={Menu}
            className={styles.sidebarMenu + sidebarOpenStatusClassName}
            animation="push"
            direction="right"
            vertical
            visible
          >
            <Menu.Item
              as={Link}
              to="/"
              style={{ fontSize: '20px', textAlign: 'center' }}
              onClick={() => setSidebarOpen(false)}
            >
              <b>OIerDb</b>
            </Menu.Item>
            {headerButtons.map((button) => (
              <Menu.Item
                key={button.name}
                as={Link}
                to={button.to}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon name={button.icon} />
                {button.name}
              </Menu.Item>
            ))}
          </Sidebar>
        </>
      )}
    </>
  );
};

export default Header;

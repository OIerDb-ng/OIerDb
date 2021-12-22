import React from 'react';
import { Link } from 'react-router-dom';

// Components
import { Container, Icon, Menu } from 'semantic-ui-react';

// Logo
import logo from '@/assets/logo-white.png';

const Header: React.FC = () => (
    <>
        <Menu fixed="top" borderless>
            <Container>
                <Menu.Item as={Link} to="/">
                    <img src={logo} style={{ marginRight: '0.75em' }} />
                    <div style={{ fontSize: '20px' }}>
                        <b>OIerDb</b>
                    </div>
                </Menu.Item>
                <Menu.Item as={Link} to="/">
                    <Icon name="home" />
                    首页
                </Menu.Item>
                <Menu.Item
                    position="right"
                    as="a"
                    href="https://github.com/renbaoshuo/OIerDb"
                    target="_blank"
                    style={{ fontSize: '1.25rem' }}
                    icon
                >
                    <Icon name="github"></Icon>
                </Menu.Item>
            </Container>
        </Menu>
    </>
);

export default Header;

// Favicon
const favicon = document.createElement('link');
favicon.rel = 'shortcut icon';
favicon.href = logo;
document.head.appendChild(favicon);

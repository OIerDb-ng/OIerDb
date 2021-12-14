import React from 'react';
import { Container, Icon, Menu } from 'semantic-ui-react';

export default () => (
    <>
        <Menu fixed="top" borderless>
            <Container>
                <Menu.Item>
                    <div style={{ fontSize: '20px' }}>
                        <b>OIerDb</b>
                    </div>
                </Menu.Item>
                <Menu.Item
                    position="right"
                    as="a"
                    href="https://github.com/renbaoshuo/OIerDb-frontend"
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

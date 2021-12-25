import React, { useState } from 'react';

// Components
import {
    Header,
    Message,
    Icon,
    Segment,
    Dimmer,
    Loader,
} from 'semantic-ui-react';

export const Loading: React.FC = () => {
    const [slowNetwork, setSlowNetwork] = useState(0);

    setTimeout(() => setSlowNetwork(1), 5000);
    setTimeout(() => setSlowNetwork(2), 20000);

    const message: string[] = [
        '正在加载 OIerDb...',
        '仍在加载...',
        '您的网络连接速度可能较慢，请耐心等待...',
    ];

    return (
        <>
            <Segment style={{ height: 100 }}>
                <Dimmer active inverted>
                    <Loader indeterminate>{message[slowNetwork]}</Loader>
                </Dimmer>
            </Segment>
        </>
    );
};

export const ErrorWhenLoadingOIerDb: React.FC = () => {
    return (
        <>
            <Message error>
                <Icon name="remove" />
                初始化 OIerDb 时出现了错误，请打开控制台以获取详细信息。
            </Message>
        </>
    );
};

export const NotSupportIndexedDB: React.FC = () => {
    return (
        <>
            <Header as="h3" dividing>
                请更新浏览器
            </Header>
            <div>
                <Message error>
                    <Icon name="remove" />
                    您的浏览器不支持 <code>indexedDB</code>。
                </Message>
                <p>
                    推荐使用最新版的{' '}
                    <a href="https://www.google.cn/chrome/" target="_blank">
                        Google Chrome 浏览器
                    </a>{' '}
                    访问 OIerDb NG。
                </p>
            </div>
        </>
    );
};

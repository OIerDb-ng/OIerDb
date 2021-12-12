import { Header, Message, Icon } from 'semantic-ui-react';

export function ErrorWhenLoadingOIerDB() {
    return (
        <div style={{ padding: '1.5rem 0' }}>
            <Message error>
                <Icon name="remove" />
                初始化 OIerDB 时出现了错误，请打开控制台以获取详细信息。
            </Message>
        </div>
    );
}

export function NotSupportIndexedDB() {
    return (
        <div style={{ padding: '1.5rem 0' }}>
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
                    访问 OIerDB NG。
                </p>
            </div>
        </div>
    );
}

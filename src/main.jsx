import React from 'react';
import ReactDOM from 'react-dom';
import 'semantic-ui-css/semantic.min.css';
import { Container, Header, Message, Icon } from 'semantic-ui-react';

const notSupportIndexedDB = !globalThis || !globalThis.indexedDB;

const App = () => {
    if (notSupportIndexedDB) {
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
    return (
        <>
            <div>Hello World!</div>
        </>
    );
};

ReactDOM.render(
    <React.StrictMode>
        <Container>
            <App />
        </Container>
    </React.StrictMode>,
    document.getElementById('app')
);

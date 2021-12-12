import React from 'react';
import ReactDOM from 'react-dom';
import 'semantic-ui-css/semantic.min.css';
import { Container, Header, Message, Icon } from 'semantic-ui-react';

// OIerDB
import './utils/OIerDB';
import 'https://renbaoshuo.github.io/OIerDB-data-generator/static.js';
import 'https://renbaoshuo.github.io/OIerDB-data-generator/result.sha512.js';

const notSupportIndexedDB = !globalThis || !globalThis.indexedDB;

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loadedOIerDB: false,
            errorWhenLoadingOIerDB: false,
        };
    }

    async componentDidMount() {
        // 加载 OIerDB
        if (await OIerDB.init()) {
            this.setState({
                loadedOIerDB: true,
                errorWhenLoadingOIerDB: false,
            });
        } else {
            this.setState({
                loadedOIerDB: false,
                errorWhenLoadingOIerDB: true,
            });
        }
    }

    render() {
        // 不支持 indexedDB 时显示提示信息
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
                            <a
                                href="https://www.google.cn/chrome/"
                                target="_blank"
                            >
                                Google Chrome 浏览器
                            </a>{' '}
                            访问 OIerDB NG。
                        </p>
                    </div>
                </div>
            );
        }

        // 加载失败时的提示信息
        if (!this.state.loadedOIerDB && this.state.errorWhenLoadingOIerDB) {
            return (
                <>
                    <div style={{ padding: '1.5rem 0' }}>
                        <Message error>
                            <Icon name="remove" />
                            初始化 OIerDB
                            时出现了错误，请打开控制台以获取详细信息。
                        </Message>
                    </div>
                </>
            );
        }

        // 加载成功时的提示信息
        return (
            <>
                <div>Hello World!</div>
            </>
        );
    }
}

ReactDOM.render(
    <React.StrictMode>
        <Container>
            <App />
        </Container>
    </React.StrictMode>,
    document.getElementById('app')
);

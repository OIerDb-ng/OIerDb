import React from 'react';
import ReactDOM from 'react-dom';

// Semantic UI
import 'semantic-ui-css/semantic.min.css';
import { Container } from 'semantic-ui-react';

// Components
import {
    Loading,
    NotSupportIndexedDB,
    ErrorWhenLoadingOIerDB,
} from './components/Home';

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
            return <NotSupportIndexedDB />;
        }

        // 加载失败时的提示信息
        if (!this.state.loadedOIerDB && this.state.errorWhenLoadingOIerDB) {
            return <ErrorWhenLoadingOIerDB />;
        }

        // 加载时的提示信息
        if (!this.state.loadedOIerDB) {
            return <Loading />;
        }

        return <>Loaded OIerDB.</>;
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

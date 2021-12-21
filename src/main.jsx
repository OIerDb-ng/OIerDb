import React from 'react';
import ReactDOM from 'react-dom';

// Semantic UI
import 'semantic-ui-css/semantic.min.css';
import { Container } from 'semantic-ui-react';

// Components
import Header from './components/Header';
import Footer from './components/Footer';
import {
    Loading,
    NotSupportIndexedDB,
    ErrorWhenLoadingOIerDb,
} from './components/App';

// Pages
import Home from './pages/Home';

// Styles
import './main.css';

// 是否支持 indexedDB
const notSupportIndexedDB = !globalThis || !globalThis.indexedDB;

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loadedOIerDb: false,
            errorWhenLoadingOIerDb: false,
        };
    }

    async componentDidMount() {
        // 加载 OIerDb
        if (await OIerDb.init()) {
            this.setState({
                loadedOIerDb: true,
                errorWhenLoadingOIerDb: false,
            });
        } else {
            this.setState({
                loadedOIerDb: false,
                errorWhenLoadingOIerDb: true,
            });
        }
    }

    render() {
        // 不支持 indexedDB
        if (notSupportIndexedDB) {
            return <NotSupportIndexedDB />;
        }

        // 加载失败时的提示信息
        if (!this.state.loadedOIerDb && this.state.errorWhenLoadingOIerDb) {
            return <ErrorWhenLoadingOIerDb />;
        }

        // 加载中
        if (!this.state.loadedOIerDb) {
            return <Loading />;
        }

        return (
            <>
                <Home />
            </>
        );
    }
}

ReactDOM.render(
    <React.StrictMode>
        <Header />
        <Container style={{ paddingTop: '1.5rem' }}>
            <App />
        </Container>
        <Footer />
    </React.StrictMode>,
    document.getElementById('app')
);

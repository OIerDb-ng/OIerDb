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
} from './components/Home';
import Search from './components/Search';
import FAQ from './components/FAQ';

// Styles
import './main.css';

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
        // 不支持 indexedDB 时显示提示信息
        if (notSupportIndexedDB) {
            return <NotSupportIndexedDB />;
        }

        // 加载失败时的提示信息
        if (!this.state.loadedOIerDb && this.state.errorWhenLoadingOIerDb) {
            return <ErrorWhenLoadingOIerDb />;
        }

        // 加载时的提示信息
        if (!this.state.loadedOIerDb) {
            return <Loading />;
        }

        return (
            <>
                <Search />
            </>
        );
    }
}

ReactDOM.render(
    <React.StrictMode>
        <Header />
        <Container style={{ paddingTop: '1.5rem' }}>
            <App />
            <FAQ />
        </Container>
        <Footer />
    </React.StrictMode>,
    document.getElementById('app')
);

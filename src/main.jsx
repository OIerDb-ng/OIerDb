import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Semantic UI
import 'semantic-ui-css/semantic.min.css';
import { Container } from 'semantic-ui-react';

// Components
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
    Loading,
    NotSupportIndexedDB,
    ErrorWhenLoadingOIerDb,
} from '@/components/App';

// Pages
import Home from '@/pages/Home';
import Person from '@/pages/Person';
import NotFound from '@/pages/404';

// Styles
import './main.css';

// 是否支持 indexedDB
const notSupportIndexedDB = !globalThis || !globalThis.indexedDB;

export default function App() {
    const [loadedOIerDb, setLoadedOIerDb] = useState(false);
    const [errorLoadingOIerDb, setErrorLoadingOIerDb] = useState(false);

    useEffect(() => {
        (async () => {
            // 加载 OIerDb
            if (await OIerDb.init()) {
                setLoadedOIerDb(true);
            } else {
                setErrorLoadingOIerDb(true);
            }
        })();
    }, []);

    // 不支持 indexedDB
    if (notSupportIndexedDB) {
        return <NotSupportIndexedDB />;
    }

    // 加载失败时的提示信息
    if (!loadedOIerDb && errorLoadingOIerDb) {
        return <ErrorWhenLoadingOIerDb />;
    }

    // 加载中
    if (!loadedOIerDb) {
        return <Loading />;
    }

    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="*" element={<NotFound />} />
            <Route path="/oier/:uid" element={<Person />} />
        </Routes>
    );
}

ReactDOM.render(
    <React.StrictMode>
        <BrowserRouter>
            <Header />
            <Container style={{ padding: '1.5rem' }}>
                <App />
            </Container>
            <Footer />
        </BrowserRouter>
    </React.StrictMode>,
    document.getElementById('app')
);

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Semantic UI
import 'semantic-ui-css/semantic.min.css';
import { Container } from 'semantic-ui-react';

// Components
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import {
  Loading,
  NotSupportIndexedDB,
  ErrorWhenLoadingOIerDb,
} from '@/components/App';

// Pages
import { Home } from '@/pages/Home';
import { Person } from '@/pages/Person';
import { Person as PersonInfo } from '@/pages/Person/Person';
import { School } from '@/pages/School';
import { School as SchoolInfo } from '@/pages/School/School';
import { NotFound } from '@/pages/404';
import { About } from '@/pages/About';

// Styles
import './main.css';
import styles from './main.module.less';

// 是否支持 indexedDB
const notSupportIndexedDB = !globalThis || !globalThis.indexedDB;

const App: React.FC = () => {
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
      <Route path="/oier" element={<Person />} />
      <Route path="/oier/:uid" element={<PersonInfo />} />
      <Route path="/school" element={<School />} />
      <Route path="/school/:id" element={<SchoolInfo />} />
      <Route path="/about" element={<About />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <Header />
      <Container className={styles.container}>
        <App />
      </Container>
      <Footer />
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('app')
);

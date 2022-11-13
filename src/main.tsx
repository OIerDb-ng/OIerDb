import React, { lazy, useEffect, useState, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'semantic-ui-react';
import { initDb } from '@/libs/OIerDb';
import {
  enableAutoPageviews,
  enableAutoTrackMultiDomain,
} from '@/libs/plausible';
import toast, { confirm } from '@/utils/toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  NotSupportIndexedDB,
  ErrorWhenLoadingOIerDb,
} from '@/components/Errors';
import Loading from '@/components/Loading';

// Pages
const Home = lazy(() => import('@/pages/Home'));
const OIerList = lazy(() => import('@/pages/oier/index'));
const PersonInfo = lazy(() => import('@/pages/oier/[uid]'));
const SchoolList = lazy(() => import('@/pages/school/index'));
const SchoolInfo = lazy(() => import('@/pages/school/[id]'));
const Contest = lazy(() => import('@/pages/Contest'));
const ContestInfo = lazy(() => import('@/pages/Contest/Contest'));
const NotFound = lazy(() => import('@/pages/404'));
const About = lazy(() => import('@/pages/About'));

// Styles
import './main.css';
import styles from './main.module.less';
import 'noty/lib/noty.css';
import 'noty/lib/themes/semanticui.css';

// 是否支持 indexedDB
const notSupportIndexedDB = !globalThis || !globalThis.indexedDB;

const updateSW = registerSW({
  onNeedRefresh() {
    confirm.info('检测到新版本，是否更新？', [
      {
        name: '确定',
        color: 'green',
        callback() {
          localStorage.removeItem('staticSha512');
          localStorage.removeItem('resultSha512');

          updateSW(true);
        },
      },
      {
        name: '取消',
        type: 'close',
      },
    ]);
  },
  onOfflineReady() {
    toast.info('已完成脱机工作准备。', 3000);
  },
});

const App: React.FC = () => {
  const [loadedOIerDb, setLoadedOIerDb] = useState(false);
  const [errorLoadingOIerDb, setErrorLoadingOIerDb] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    (async () => {
      // 加载 OIerDb
      try {
        window.OIerDb = await initDb(setProgress);
        setLoadedOIerDb(true);
      } catch (e) {
        console.error(e);
        setErrorLoadingOIerDb(true);
      }
    })();
  }, []);

  useEffect(() => enableAutoPageviews(), []);
  useEffect(() => enableAutoTrackMultiDomain(), []);

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
    return <Loading progress={progress} />;
  }

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/oier" element={<Navigate replace to="/oiers" />} />
        <Route path="/oiers" element={<OIerList />} />
        <Route path="/oier/:uid" element={<PersonInfo />} />
        <Route path="/school" element={<Navigate replace to="/schools" />} />
        <Route path="/schools" element={<SchoolList />} />
        <Route path="/school/:id" element={<SchoolInfo />} />
        <Route path="/contest" element={<Navigate replace to="/contests" />} />
        <Route path="/contests" element={<Contest />} />
        <Route path="/contest/:id" element={<ContestInfo />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const rootElement = document.getElementById('app');
createRoot(rootElement).render(
  <BrowserRouter>
    <Header />
    <Container className={styles.container}>
      <App />
    </Container>
    <Footer />
  </BrowserRouter>
);

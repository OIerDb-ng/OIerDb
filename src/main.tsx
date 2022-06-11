import React, { lazy, useEffect, useState, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Semantic UI
import { Container } from 'semantic-ui-react';

// Utils
import { initDb } from '@/libs/OIerDb';
import toast, { confirm } from '@/utils/toast';

// Components
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import {
  NotSupportIndexedDB,
  ErrorWhenLoadingOIerDb,
} from '@/components/Errors';
import { Loading } from '@/components/Loading';

// Pages
const Home = lazy(() => import('@/pages/Home'));
const Person = lazy(() => import('@/pages/Person'));
const PersonInfo = lazy(() => import('@/pages/Person/Person'));
const School = lazy(() => import('@/pages/School'));
const SchoolInfo = lazy(() => import('@/pages/School/School'));
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
      if ((window.OIerDb = await initDb(setProgress))) {
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
    return <Loading progress={progress} />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense fallback={<Loading name="首页" />}>
            <Home />
          </Suspense>
        }
      />
      <Route
        path="/oier"
        element={
          <Suspense fallback={<Loading name="选手列表" />}>
            <Person />
          </Suspense>
        }
      />
      <Route
        path="/oier/:uid"
        element={
          <Suspense fallback={<Loading name="选手详情" />}>
            <PersonInfo />
          </Suspense>
        }
      />
      <Route
        path="/school"
        element={
          <Suspense fallback={<Loading name="学校列表" />}>
            <School />
          </Suspense>
        }
      />
      <Route
        path="/school/:id"
        element={
          <Suspense fallback={<Loading name="学校详情" />}>
            <SchoolInfo />
          </Suspense>
        }
      />
      <Route
        path="/about"
        element={
          <Suspense fallback={<Loading name="关于页面" />}>
            <About />
          </Suspense>
        }
      />
      <Route
        path="*"
        element={
          <Suspense fallback={<Loading name="404" />}>
            <NotFound />
          </Suspense>
        }
      />
    </Routes>
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

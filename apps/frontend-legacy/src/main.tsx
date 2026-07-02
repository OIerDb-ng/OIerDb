import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Helmet } from 'react-helmet';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Container } from 'semantic-ui-react';

import {
  ErrorWhenLoadingOIerDb,
  NotSupportIndexedDB,
} from '@/components/Errors';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import Loading from '@/components/Loading';
import { initDb } from '@/libs/OIerDb';
import {
  enableAutoPageviews,
  enableAutoTrackMultiDomain,
} from '@/libs/plausible';

// Pages
const Home = lazy(() => import('@/pages/index'));
const OIerList = lazy(() => import('@/pages/oier/index'));
const PersonInfo = lazy(() => import('@/pages/oier/[uid]'));
const SchoolList = lazy(() => import('@/pages/school/index'));
const SchoolInfo = lazy(() => import('@/pages/school/[id]'));
const Contest = lazy(() => import('@/pages/contest'));
const ContestInfo = lazy(() => import('@/pages/contest/[id]'));
const CustomSearch = lazy(() => import('@/pages/custom-search'));
const NotFound = lazy(() => import('@/pages/404'));
const About = lazy(() => import('@/pages/about'));

// Styles
import './main.less';
import styles from './main.module.less';

// 是否支持 indexedDB
const notSupportIndexedDB = !globalThis || !globalThis.indexedDB;

// 取消注册先前的 Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

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
        <Route path="/custom-search" element={<CustomSearch />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const rootElement = document.getElementById('app');
createRoot(rootElement).render(
  <BrowserRouter>
    <Helmet defaultTitle="OIerDb NG" titleTemplate="%s - OIerDb NG" />
    <Header />
    <Container className={styles.container}>
      <App />
    </Container>
    <Footer />
  </BrowserRouter>
);

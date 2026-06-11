import { Outlet } from 'react-router';

import { Footer } from '~/components/footer';
import { Header } from '~/components/header';

import * as styles from './layout.css';

const Layout: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <div className={styles.layout}>
    <Header />

    <main className={styles.main}>
      <Outlet />
    </main>

    <Footer />
  </div>
);

export default Layout;

import { Outlet } from 'react-router';

import { Header } from '~/components/header';

import * as styles from './layout.css';

const Layout: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <div className={styles.layout}>
    <Header />

    <main>
      <Outlet />
    </main>
  </div>
);

export default Layout;

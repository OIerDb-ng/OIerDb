import React from 'react';

// Components
import { FAQ } from '@/components/Home';
import { Search } from '@/components/Search';

const Home: React.FC = () => (
  <>
    <Search />
    <FAQ />
  </>
);

export default Home;

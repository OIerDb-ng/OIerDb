import React from 'react';

// Components
import { FAQ } from '@/components/Home';
import Search from '@/components/Search';

const HomePage: React.FC = () => (
    <>
        <Search />
        <FAQ />
    </>
);

export default HomePage;

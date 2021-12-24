import React from 'react';

// Components
import { FAQ } from '@/components/Home';
import { Search } from '@/components/Search';

export const Home: React.FC = () => (
    <>
        <Search />
        <FAQ />
    </>
);

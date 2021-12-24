import React from 'react';

// Components
import { FAQ } from '@/components/Home';

// Logo
import logo from '@/assets/logo-white.png';

const AboutHeader: React.FC = () => (
    <>
        <img
            width={128}
            src={logo}
            title="OIerDb"
            style={{ margin: '0 auto', display: 'block' }}
        />
        <h1 style={{ textAlign: 'center' }}>OIerDb</h1>
        <p style={{ textAlign: 'center' }}>
            OIerDb 是中国信息学竞赛选手的一个数据库
            <br />
            <small>OIerDb is a database for Chinese OI participants</small>
        </p>
    </>
);

export const About: React.FC = () => (
    <>
        <AboutHeader />
        <FAQ />
    </>
);

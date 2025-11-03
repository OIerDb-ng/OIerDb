import { Link } from 'react-router';

import type { DbOIer } from '@oierdb/core';

import { getGrade } from '~/utils/grade';

import * as styles from './oier-intro.css';

interface OIerIntroProps {
  oier: DbOIer;
}

export const OIerIntro: React.FC<OIerIntroProps> = ({ oier }) => {
  const currentGrade = getGrade(oier.enroll_middle);
  const rankPage = Math.ceil((oier.rank + 1) / 30);

  return (
    <div className={styles.container}>
      <h4 className={styles.heading}>选手信息</h4>
      <p>现在{currentGrade}。</p>
      <p>
        OIerDb 排名：
        <Link to={`/oier?page=${rankPage}`}>{oier.rank + 1}</Link>（{oier.oierdb_score} 分）。
      </p>
      <p>CCF 程序设计能力等级：{oier.ccf_level} 级（仅供参考）。</p>
    </div>
  );
};

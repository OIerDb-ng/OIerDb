import React, { lazy } from 'react';
import { useParams } from 'react-router-dom';
import PersonInfo from '@/components/PersonInfo';

const NotFound = lazy(() => import('@/pages/404'));

const OIerInfo: React.FC = () => {
  // 获取参数
  const params = useParams();
  const uid = Number(params.uid) || -1;
  const oier = OIerDb.oiers.find((oier) => oier.uid === uid);

  // 未找到显示 404 页面
  if (!oier) return <NotFound />;

  return (
    <>
      <h2>{oier.name}</h2>
      <PersonInfo oier={oier} />
    </>
  );
};

export default OIerInfo;

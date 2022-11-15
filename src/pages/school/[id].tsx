import React, { lazy } from 'react';
import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';
import SchoolInfo from '@/components/SchoolInfo';

const NotFound = lazy(() => import('@/pages/404'));

const School: React.FC = () => {
  const params = useParams();
  const id = Number(params.id) ?? -1;
  const school = OIerDb.schools.find((school) => school.id === id);

  if (!school) return <NotFound />;

  return (
    <>
      <Helmet>
        <title>{school.name}</title>
      </Helmet>

      <h2>{school.name}</h2>
      <SchoolInfo school={school} />
    </>
  );
};

export default School;

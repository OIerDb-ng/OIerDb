import { Pagination } from '@mantine/core';
import { useNavigate, useSearchParams } from 'react-router';

import * as styles from './pagination.css';

interface PaginationControlProps {
  page: number;
  total: number;
}

export const PaginationControl: React.FC<PaginationControlProps> = ({ page, total }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  if (total <= 1) return null;

  return (
    <div className={styles.container}>
      <Pagination
        value={page}
        total={total}
        onChange={(p) => {
          const params = new URLSearchParams(searchParams);
          params.set('page', String(p));
          navigate(`?${params.toString()}`);
        }}
      />
    </div>
  );
};

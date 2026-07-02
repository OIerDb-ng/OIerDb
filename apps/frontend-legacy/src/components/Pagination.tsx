import React from 'react';
import { Pagination as SemanticUIPagination, Icon } from 'semantic-ui-react';
import useScreenWidthWithin from '@/utils/useScreenWidthWithin';
import usePartialSearchParams from '@/utils/usePartialSearchParams';
import styles from './Pagination.module.less';

interface PaginationProps {
  total: number;
  perPage: number;
}

const Pagination: React.FC<PaginationProps> = (props) => {
  const [searchParams, setSearchParams] = usePartialSearchParams();

  const screenWidthLessThan376 = useScreenWidthWithin(0, 376);
  const screenWidthLessThan450 = useScreenWidthWithin(0, 450);
  const screenWidthLessThan680 = useScreenWidthWithin(0, 680);
  const screenWidthLessThan768 = useScreenWidthWithin(0, 768);
  const screenWidthLessThan1024 = useScreenWidthWithin(0, 1024);

  const page = Number(searchParams.get('page')) || 1;
  const setPage = (page: string) => setSearchParams({ page });
  const totalPages = Math.ceil(props.total / props.perPage);

  let siblingRange: number, size: string;
  if (screenWidthLessThan376) {
    siblingRange = 0;
    size = 'small';
  } else if (screenWidthLessThan450) {
    siblingRange = 0;
  } else if (screenWidthLessThan680) {
    siblingRange = 1;
  } else if (screenWidthLessThan768) {
    siblingRange = 2;
  } else if (screenWidthLessThan1024) {
    siblingRange = 3;
  } else {
    siblingRange = 4;
  }

  return (
    <div className={styles.paginationContainer}>
      <SemanticUIPagination
        firstItem={null}
        lastItem={null}
        size={size}
        siblingRange={siblingRange}
        ellipsisItem={{
          content: '...',
          disabled: true,
          icon: true,
        }}
        prevItem={{
          content: <Icon name="angle left" />,
          icon: true,
          disabled: page === 1,
        }}
        nextItem={{
          content: <Icon name="angle right" />,
          icon: true,
          disabled: page === totalPages,
        }}
        activePage={page}
        totalPages={totalPages}
        onPageChange={(_, data) => setPage(data.activePage as string)}
      />
    </div>
  );
};

export default Pagination;

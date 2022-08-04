import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pagination, Table, Icon } from 'semantic-ui-react';
import { useScreenWidthWithin } from '@/utils/useScreenWidthWithin';
import fixChineseSpace from '@/utils/fixChineseSpace';

const Contests: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const data = useMemo(
    () =>
      OIerDb.contests
        .filter((contest) => !contest.type.endsWith('D类'))
        .reverse(),
    []
  );

  const page = Number(searchParams.get('page')) || 1;
  const setPage = (page: string) => setSearchParams({ page });
  const totalPages = Math.ceil(data.length / 20);

  const screenWidthLessThan376 = useScreenWidthWithin(0, 376);
  const screenWidthLessThan450 = useScreenWidthWithin(0, 450);
  const screenWidthLessThan680 = useScreenWidthWithin(0, 680);
  const screenWidthLessThan768 = useScreenWidthWithin(0, 768);
  const screenWidthLessThan1024 = useScreenWidthWithin(0, 1024);

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
    <>
      <h2>比赛列表</h2>
      <Table celled unstackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={1}>#</Table.HeaderCell>
            <Table.HeaderCell>名称</Table.HeaderCell>
            <Table.HeaderCell width={2}>参赛人数</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data.slice(20 * (page - 1), 20 * page).map((contest) => (
            <Table.Row key={contest.id}>
              <Table.Cell>{contest.id}</Table.Cell>
              <Table.Cell>
                <Link to={'/contest/' + contest.id}>
                  {fixChineseSpace(contest.name)}
                </Link>
              </Table.Cell>
              <Table.Cell>{contest.n_contestants()}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Pagination
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
    </>
  );
};

export default Contests;

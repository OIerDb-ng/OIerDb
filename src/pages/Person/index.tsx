import { Link, useSearchParams } from 'react-router-dom';

// Components
import { Pagination, Table, Icon } from 'semantic-ui-react';

// Utils
import { useScreenWidthWithin } from '@/utils/useScreenWidthWithin';

const PersonRank: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const setPage = (page: string) => setSearchParams({ page });
  const totalPages = Math.ceil(OIerDb.oiers.length / 30);

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
      <h2>全国信息学竞赛选手排名</h2>
      <Table celled unstackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={1}>#</Table.HeaderCell>
            <Table.HeaderCell>姓名</Table.HeaderCell>
            <Table.HeaderCell width={2}>省份</Table.HeaderCell>
            <Table.HeaderCell width={2}>评分</Table.HeaderCell>
            <Table.HeaderCell width={2}>CCF 评级</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {OIerDb.oiers.slice(30 * (page - 1), 30 * page).map((oier) => (
            <Table.Row key={oier.uid}>
              <Table.Cell>{oier.rank + 1}</Table.Cell>
              <Table.Cell>
                <Link to={'/oier/' + oier.uid}>{oier.name}</Link>
              </Table.Cell>
              <Table.Cell>{oier.provinces.join('、')}</Table.Cell>
              <Table.Cell>{oier.oierdb_score}</Table.Cell>
              <Table.Cell>{oier.ccf_level}</Table.Cell>
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

const Person: React.FC = () => (
  <>
    <PersonRank />
  </>
);

export default Person;

import { Link, useSearchParams } from 'react-router-dom';
import { Table } from 'semantic-ui-react';
import Pagination from '@/components/Pagination';

const Person: React.FC = () => {
  const [searchParams] = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;

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
      <Pagination total={OIerDb.oiers.length} perPage={30} />
    </>
  );
};

export default Person;

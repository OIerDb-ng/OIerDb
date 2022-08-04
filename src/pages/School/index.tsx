import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Table } from 'semantic-ui-react';
import Pagination from '@/components/Pagination';

const School: React.FC = () => {
  const [searchParams] = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;

  return (
    <>
      <h2>全国信息学竞赛学校排名</h2>
      <Table celled unstackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={1}>#</Table.HeaderCell>
            <Table.HeaderCell>学校</Table.HeaderCell>
            <Table.HeaderCell width={2}>省份</Table.HeaderCell>
            <Table.HeaderCell width={2}>评分</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {OIerDb.schools.slice(30 * (page - 1), 30 * page).map((school) => (
            <Table.Row key={school.id}>
              <Table.Cell>{school.rank + 1}</Table.Cell>
              <Table.Cell>
                <Link to={'/school/' + school.id}>{school.name}</Link>
              </Table.Cell>
              <Table.Cell>{school.province}</Table.Cell>
              <Table.Cell>{school.score}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <Pagination total={OIerDb.schools.length} perPage={30} />
    </>
  );
};

export default School;

import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Table } from 'semantic-ui-react';
import { Helmet } from 'react-helmet';
import Pagination from '@/components/Pagination';
import fixContestName from '@/utils/fixContestName';
import fixChineseSpace from '@/utils/fixChineseSpace';

const Contests: React.FC = () => {
  const [searchParams] = useSearchParams();

  const data = useMemo(() => Array.from(OIerDb.contests).reverse(), []);

  const page = Number(searchParams.get('page')) || 1;
  const perPage = 20;

  return (
    <>
      <Helmet>
        <title>比赛列表</title>
      </Helmet>

      <h2>比赛列表</h2>
      <Table celled unstackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={1} textAlign="center">
              #
            </Table.HeaderCell>
            <Table.HeaderCell>名称</Table.HeaderCell>
            <Table.HeaderCell width={2}>参赛人数</Table.HeaderCell>
            <Table.HeaderCell width={2}>获奖人数</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data.slice(perPage * (page - 1), perPage * page).map((contest) => (
            <Table.Row key={contest.id}>
              <Table.Cell textAlign="center">{contest.id + 1}</Table.Cell>
              <Table.Cell>
                <Link to={'/contest/' + contest.id}>
                  {fixChineseSpace(fixContestName(contest.name))}
                </Link>
              </Table.Cell>
              <Table.Cell>{contest.capacity ?? '-'}</Table.Cell>
              <Table.Cell>{contest.contestants.length}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <Pagination total={OIerDb.contests.length} perPage={perPage} />
    </>
  );
};

export default Contests;

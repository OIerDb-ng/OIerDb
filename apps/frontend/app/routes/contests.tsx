import { Container, Table } from '@mantine/core';
import { Link } from 'react-router';

import { getClient } from '~/libs/client';
import { fixChineseSpace, fixContestName } from '~/utils/format';

import { PaginationControl } from '../components/pagination';
import type { Route } from './+types/contests';
import * as styles from './contests.css';

const PER_PAGE = 20;

export function meta({}: Route.MetaArgs) {
  return [{ title: '比赛列表 - OIerDb' }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

  const client = getClient();
  const results = await client.listContests({ page, perPage: PER_PAGE });

  return { results, page };
}

export default function ContestsPage({ loaderData }: Route.ComponentProps) {
  const { results, page } = loaderData;

  return (
    <Container size="md" className={styles.container}>
      <h2 className={styles.heading}>比赛列表</h2>

      <Table.ScrollContainer minWidth={400}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>名称</Table.Th>
              <Table.Th>参赛人数</Table.Th>
              <Table.Th>获奖人数</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {results.contests.map((contest) => (
              <Table.Tr key={contest.id}>
                <Table.Td>{contest.id + 1}</Table.Td>
                <Table.Td>
                  <Link to={`/contest/${contest.id}`}>
                    {fixChineseSpace(fixContestName(contest.name))}
                  </Link>
                </Table.Td>
                <Table.Td>{contest.capacity ?? '-'}</Table.Td>
                <Table.Td>{contest.length}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <PaginationControl page={page} total={results.totalPages} />
    </Container>
  );
}

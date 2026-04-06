import { Container, Table } from '@mantine/core';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { getClient } from '~/libs/client';

import { PaginationControl } from '../components/pagination';
import { ProvinceSelect } from '../components/province-select';
import type { Route } from './+types/oiers';
import * as styles from './oiers.css';

const PER_PAGE = 30;

export function meta({}: Route.MetaArgs) {
  return [{ title: '选手排名 - OIerDb' }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const province = url.searchParams.get('province') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

  const client = getClient();
  const results = await client.listOIers({
    province: province || undefined,
    page,
    perPage: PER_PAGE,
  });

  return { results, province, page };
}

export default function OiersPage({ loaderData }: Route.ComponentProps) {
  const { results, province, page } = loaderData;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleProvinceChange = (value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('province', value);
    } else {
      params.delete('province');
    }
    params.delete('page');
    navigate(`?${params.toString()}`);
  };

  return (
    <Container size="md" className={styles.container}>
      <div className={styles.heading}>
        <ProvinceSelect value={province || null} onChange={handleProvinceChange} />
        <span className={styles.headingText}>信息学奥林匹克竞赛选手排名</span>
      </div>

      <Table.ScrollContainer minWidth={500}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>姓名</Table.Th>
              <Table.Th>省份</Table.Th>
              <Table.Th>OIerDb 分</Table.Th>
              <Table.Th>CCF 评级</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {results.oiers.map((oier, i) => (
              <Table.Tr key={oier.uid}>
                <Table.Td>{(page - 1) * PER_PAGE + i + 1}</Table.Td>
                <Table.Td>
                  <Link to={`/oier/${oier.uid}`}>{oier.name}</Link>
                </Table.Td>
                <Table.Td>{oier.provinces.join('、')}</Table.Td>
                <Table.Td>{oier.oierdb_score.toFixed(2)}</Table.Td>
                <Table.Td>{oier.ccf_level}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <PaginationControl page={page} total={results.totalPages} />
    </Container>
  );
}

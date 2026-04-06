import {
  Button,
  Collapse,
  Container,
  Group,
  Select,
  SimpleGrid,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { getClient } from '~/libs/client';
import { getCurrentAcademicYear, getGrade } from '~/utils/grade';

import { PaginationControl } from '../components/pagination';
import { ProvinceSelect } from '../components/province-select';
import type { Route } from './+types/main';
import * as styles from './main.css';

const PER_PAGE = 30;

// Build grade options for enroll_middle select
function buildGradeOptions() {
  const currentYear = getCurrentAcademicYear();
  const options: { value: string; label: string }[] = [{ value: '', label: '全部年级' }];
  for (let year = currentYear + 6; year >= currentYear - 11; year--) {
    options.push({ value: String(year), label: getGrade(year) });
  }
  return options;
}

const gradeOptions = buildGradeOptions();

export function meta({}: Route.MetaArgs) {
  return [{ title: 'OIerDb' }, { name: 'description', content: '信息学竞赛选手数据库' }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  const province = url.searchParams.get('province') ?? '';
  const grade = url.searchParams.get('grade') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

  if (!q && !province && !grade) {
    return { q, province, grade, results: null, page, totalPages: 0 };
  }

  const client = getClient();
  const hasChinese = /[\u4e00-\u9fa5]/.test(q);
  const results = await client.listOIers({
    ...(q ? (hasChinese ? { name: q } : { initials: q }) : {}),
    province: province || undefined,
    enroll_middle: grade ? Number(grade) : undefined,
    page,
    perPage: PER_PAGE,
  });

  return { q, province, grade, results, page, totalPages: results.totalPages };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const {
    q: initQ,
    province: initProvince,
    grade: initGrade,
    results,
    page,
    totalPages,
  } = loaderData;

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [q, setQ] = useState(initQ);
  const [province, setProvince] = useState(initProvince);
  const [grade, setGrade] = useState(initGrade);
  const [advanced, setAdvanced] = useState(!!(initProvince || initGrade));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (province) params.set('province', province);
    if (grade) params.set('grade', grade);
    navigate(`/?${params.toString()}`);
  };

  const hasSearch = !!(
    searchParams.get('q') ||
    searchParams.get('province') ||
    searchParams.get('grade')
  );

  return (
    <Container size="md" className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.searchBox}>
        <div className={styles.searchTitle}>搜索选手</div>

        <TextInput
          placeholder="键入选手姓名或拼音首字母…"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          mb="xs"
        />

        <Group gap="xs" mb="xs">
          <Text
            component="span"
            className={styles.advancedToggle}
            onClick={() => setAdvanced((v) => !v)}
          >
            {advanced ? '▲ 收起高级搜索' : '▼ 高级搜索'}
          </Text>
          <Button type="submit" size="xs">
            搜索
          </Button>
        </Group>

        <Collapse in={advanced}>
          <SimpleGrid cols={{ base: 1, sm: 2 }} className={styles.advancedPanel}>
            <ProvinceSelect
              label="省份"
              value={province || null}
              onChange={(v) => setProvince(v ?? '')}
            />
            <Select
              label="年级"
              data={gradeOptions}
              value={grade}
              onChange={(v) => setGrade(v ?? '')}
            />
          </SimpleGrid>
        </Collapse>
      </form>

      {hasSearch && results && results.oiers.length === 0 && (
        <Text c="dimmed">未找到符合条件的选手。</Text>
      )}

      {results && results.oiers.length > 0 && (
        <>
          <div className={styles.resultHeading}>共 {results.total} 条结果</div>
          <Table.ScrollContainer minWidth={600}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>姓名</Table.Th>
                  <Table.Th>省份</Table.Th>
                  <Table.Th>年级</Table.Th>
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
                    <Table.Td>{getGrade(oier.enroll_middle)}</Table.Td>
                    <Table.Td>{oier.oierdb_score.toFixed(2)}</Table.Td>
                    <Table.Td>{oier.ccf_level}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <PaginationControl page={page} total={totalPages} />
        </>
      )}
    </Container>
  );
}

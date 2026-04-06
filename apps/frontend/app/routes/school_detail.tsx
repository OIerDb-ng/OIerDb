import { Container, Table } from '@mantine/core';
import { data, Link, useSearchParams } from 'react-router';

import { getClient } from '~/libs/client';
import { getGrade } from '~/utils/grade';

import { PaginationControl } from '../components/pagination';
import type { Route } from './+types/school_detail';
import * as styles from './school_detail.css';

const PER_PAGE = 30;

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: 'Not Found - OIerDb' }];
  return [{ title: `${loaderData.school.name} - OIerDb` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const id = Number(params.id);
  if (isNaN(id)) throw data({ message: 'Invalid ID' }, { status: 400 });

  const client = getClient();
  const result = await client.getSchool(id);
  if (!result) throw data({ message: 'School not found' }, { status: 404 });

  return result;
}

type AwardCounts = Record<string, Record<string, Record<string, number>>>;

// Build a summary of award counts by contest type
function buildAwardSummary(awardCounts: AwardCounts) {
  // awardCounts: { [type]: { [year]: { [level]: count } } }
  const typeSummary: Record<string, Record<string, number>> = {};
  for (const [type, years] of Object.entries(awardCounts)) {
    typeSummary[type] = {};
    for (const levels of Object.values(years)) {
      for (const [level, count] of Object.entries(levels)) {
        typeSummary[type][level] = (typeSummary[type][level] ?? 0) + count;
      }
    }
  }
  return typeSummary;
}

export default function SchoolDetailPage({ loaderData }: Route.ComponentProps) {
  const { school, members_map } = loaderData;
  const [searchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  // Sort members by rank
  const sortedMemberIds = [...school.member_ids].sort((a, b) => {
    const rankA = members_map[a]?.rank ?? Infinity;
    const rankB = members_map[b]?.rank ?? Infinity;
    return rankA - rankB;
  });

  const totalPages = Math.ceil(sortedMemberIds.length / PER_PAGE);
  const pageSlice = sortedMemberIds.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Build award summary
  const awardSummary = buildAwardSummary(school.award_counts as AwardCounts);
  const awardTypes = Object.keys(awardSummary).sort();
  // Collect all unique award levels across all types
  const allLevels = Array.from(
    new Set(Object.values(awardSummary).flatMap((l) => Object.keys(l))),
  ).sort();

  const schoolRankPage = Math.ceil((school.rank + 1) / 30);

  return (
    <Container size="md" className={styles.container}>
      <h2 className={styles.name}>{school.name}</h2>

      <div className={styles.section}>
        <div className={styles.sectionHeading}>学校信息</div>
        <p>
          位于{school.province}
          {school.city}。
        </p>
        <p>
          OIerDb 排名：
          <Link to={`/school?page=${schoolRankPage}`}>{school.rank + 1}</Link>（
          {school.score.toFixed(2)} 分）。
        </p>
      </div>

      {awardTypes.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeading}>获奖概况</div>
          <Table.ScrollContainer minWidth={300}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>比赛类型</Table.Th>
                  {allLevels.map((l) => (
                    <Table.Th key={l}>{l}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {awardTypes.map((type) => (
                  <Table.Tr key={type}>
                    <Table.Td>{type}</Table.Td>
                    {allLevels.map((l) => (
                      <Table.Td key={l}>{awardSummary[type][l] ?? '-'}</Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeading}>选手列表</div>
        <Table.ScrollContainer minWidth={500}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>姓名</Table.Th>
                <Table.Th>年级</Table.Th>
                <Table.Th>全国排名</Table.Th>
                <Table.Th>OIerDb 分</Table.Th>
                <Table.Th>CCF 评级</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pageSlice.map((uid, i) => {
                const oier = members_map[uid];
                if (!oier) return null;
                return (
                  <Table.Tr key={uid}>
                    <Table.Td>{(page - 1) * PER_PAGE + i + 1}</Table.Td>
                    <Table.Td>
                      <Link to={`/oier/${oier.uid}`}>{oier.name}</Link>
                    </Table.Td>
                    <Table.Td>{getGrade(oier.enroll_middle)}</Table.Td>
                    <Table.Td>{oier.rank + 1}</Table.Td>
                    <Table.Td>{oier.oierdb_score.toFixed(2)}</Table.Td>
                    <Table.Td>{oier.ccf_level}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        <PaginationControl page={page} total={totalPages} />
      </div>
    </Container>
  );
}

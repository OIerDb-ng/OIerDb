import { Container, Table, useMantineColorScheme } from '@mantine/core';
import { data, Link } from 'react-router';

import type { DbRecord } from '@oierdb/core';

import { AwardEmoji } from '~/components/award-emoji';
import { getClient } from '~/libs/client';
import { getProgressColor } from '~/utils/color';
import { fixChineseSpace, fixContestName } from '~/utils/format';
import { getGrade } from '~/utils/grade';

import { PaginationControl } from '../components/pagination';
import type { Route } from './+types/contest_detail';
import * as styles from './contest_detail.css';

const PER_PAGE = 50;

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: 'Not Found - OIerDb' }];
  const { contest } = loaderData.data;
  return [{ title: `${fixChineseSpace(fixContestName(contest.name))} - OIerDb` }];
}

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const id = Number(params.id);
  if (isNaN(id)) throw data({ message: 'Invalid ID' }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

  const client = getClient();
  const result = await client.getContest(id, page, PER_PAGE);
  if (!result) throw data({ message: 'Contest not found' }, { status: 404 });

  return { data: result, page };
}

function ScoreCell({
  record,
  fullScore,
  colorScheme,
}: {
  record: DbRecord;
  fullScore: number;
  colorScheme: 'light' | 'dark';
}) {
  if (record.score == null) return <span>-</span>;
  const color = getProgressColor(record.score, fullScore, colorScheme);
  return (
    <>
      <span style={{ color }}>{record.score}</span>{' '}
      <span className={styles.recordTotal}>/ {fullScore}</span>
    </>
  );
}

export default function ContestDetailPage({ loaderData }: Route.ComponentProps) {
  const { data: result, page } = loaderData;
  const { contest, records, schools_map, oiers_map } = result;
  const { colorScheme } = useMantineColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';

  const schoolYear = contest.fall_semester ? contest.year : contest.year - 1;
  const levelEntries = Object.entries(contest.level_counts).sort(
    ([a], [b]) => Number(a) - Number(b),
  );

  return (
    <Container size="md" className={styles.container}>
      <h1 className={styles.name}>{fixChineseSpace(fixContestName(contest.name))}</h1>
      <p className={styles.meta}>
        举办于 {contest.year} 年（{schoolYear}–{schoolYear + 1} 学年），共 {contest.capacity ?? '-'}{' '}
        人参赛、{contest.length} 人获奖。
      </p>

      {levelEntries.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeading}>获奖概况</div>
          <Table.ScrollContainer minWidth={200}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>奖项</Table.Th>
                  <Table.Th>人数</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {levelEntries.map(([level, count]) => (
                  <Table.Tr key={level}>
                    <Table.Td>
                      <AwardEmoji level={level} />
                      {level}
                    </Table.Td>
                    <Table.Td>{count}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeading}>选手列表</div>
        <Table.ScrollContainer minWidth={600}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>名次</Table.Th>
                <Table.Th>姓名</Table.Th>
                <Table.Th>年级</Table.Th>
                <Table.Th>成绩</Table.Th>
                <Table.Th>奖项</Table.Th>
                <Table.Th>就读学校</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {records.map((record) => {
                const oier = oiers_map[record.uid];
                const school = schools_map[record.school_id];
                const enrollMiddle = record.enroll_middle?.value ?? oier?.enroll_middle ?? 0;
                return (
                  <Table.Tr key={`${record.uid}-${record.contest_id}`}>
                    <Table.Td>{record.rank}</Table.Td>
                    <Table.Td>
                      {oier ? <Link to={`/oier/${oier.uid}`}>{oier.name}</Link> : '-'}
                    </Table.Td>
                    <Table.Td>{getGrade(enrollMiddle, contest.year)}</Table.Td>
                    <Table.Td>
                      <ScoreCell
                        record={record}
                        fullScore={contest.full_score}
                        colorScheme={scheme}
                      />
                    </Table.Td>
                    <Table.Td>
                      <AwardEmoji level={record.level} />
                      {record.level}
                    </Table.Td>
                    <Table.Td>
                      {school ? <Link to={`/school/${school.id}`}>{school.name}</Link> : '-'}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        <PaginationControl page={page} total={result.totalPages} />
      </div>
    </Container>
  );
}

import { Table, Tooltip, useMantineColorScheme } from '@mantine/core';
import { Link } from 'react-router';

import type { DbContest, DbRecord, DbSchool } from '@oierdb/core';

import { getProgressColor } from '~/utils/color';
import { fixChineseSpace, fixContestName } from '~/utils/format';
import { getGrade } from '~/utils/grade';

import { AwardEmoji } from './award-emoji';
import * as styles from './oier-records.css';

interface OIerRecordsProps {
  records: DbRecord[];
  schoolsMap: Record<number, DbSchool>;
  contestsMap: Record<number, DbContest>;
  enrollMiddle: number;
}

/**
 * OIer records component
 * Displays a table of awards with contest, level, score, rank, province, school, and grade
 */
export const OIerRecords: React.FC<OIerRecordsProps> = ({
  records,
  schoolsMap,
  contestsMap,
  enrollMiddle,
}) => {
  const { colorScheme } = useMantineColorScheme();

  // Render grade cell with special handling for inconsistent grades
  const renderGradeCell = (record: DbRecord) => {
    const contest = contestsMap[record.contest_id];
    const normalGrade = getGrade(enrollMiddle, contest.year);

    if (record.enroll_middle) {
      const actualGrade = getGrade(record.enroll_middle.value, contest.year);

      if (record.enroll_middle.is_stay_down) {
        // Stay down (留级) - red color
        return (
          <Tooltip
            label="此记录为非正常年级，可能为该选手后期出现了留级等情况而导致的。"
            position="top"
          >
            <span className={styles.gradeInconsistent} style={{ color: 'red' }}>
              {actualGrade}
            </span>
          </Tooltip>
        );
      }

      // Inconsistent grade - fuchsia color
      return (
        <Tooltip
          label={`此记录的年级与原始数据不一致，原始数据为「${actualGrade}」。`}
          position="top"
        >
          <span className={styles.gradeInconsistent} style={{ color: 'fuchsia' }}>
            {normalGrade}
          </span>
        </Tooltip>
      );
    }

    return <span>{normalGrade}</span>;
  };

  // Render score cell with color coding
  const renderScoreCell = (record: DbRecord) => {
    const contest = contestsMap[record.contest_id];

    if (record.score == null) {
      return <span>-</span>;
    }

    const color = getProgressColor(
      record.score,
      contest.full_score,
      colorScheme === 'dark' ? 'dark' : 'light',
    );

    return (
      <>
        <span style={{ color }}>{record.score}</span>{' '}
        <span className={styles.recordTotal}>/ {contest.full_score}</span>
      </>
    );
  };

  // Render rank cell with color coding
  const renderRankCell = (record: DbRecord) => {
    const contest = contestsMap[record.contest_id];
    const nContestants = contest.capacity ?? contest.contestant_ids.length;
    const color = getProgressColor(
      nContestants - record.rank,
      nContestants - 1,
      colorScheme === 'dark' ? 'dark' : 'light',
    );

    return (
      <>
        <span style={{ color }}>{record.rank}</span>{' '}
        <span className={styles.recordTotal}>/ {nContestants}</span>
      </>
    );
  };

  // Reverse the records array to show newest first
  const reversedRecords = [...records].reverse();

  return (
    <div className={styles.container}>
      <h4 className={styles.heading}>获奖信息</h4>
      <Table.ScrollContainer minWidth={800}>
        <Table verticalSpacing="sm" striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>奖项</Table.Th>
              <Table.Th>分数</Table.Th>
              <Table.Th>选手排名</Table.Th>
              <Table.Th>省份</Table.Th>
              <Table.Th>就读学校</Table.Th>
              <Table.Th>年级</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {reversedRecords.map((record) => {
              const contest = contestsMap[record.contest_id];
              const school = schoolsMap[record.school_id];

              return (
                <Table.Tr key={record.contest_id}>
                  <Table.Td>
                    <Link to={`/contest/${contest.id}`} className={styles.contestName}>
                      {fixChineseSpace(fixContestName(contest.name))}
                    </Link>{' '}
                    <span className={styles.contestLevel}>
                      <AwardEmoji level={record.level} />
                      {fixChineseSpace(record.level)}
                    </span>
                  </Table.Td>
                  <Table.Td>{renderScoreCell(record)}</Table.Td>
                  <Table.Td>{renderRankCell(record)}</Table.Td>
                  <Table.Td>{record.province}</Table.Td>
                  <Table.Td>
                    <Link to={`/school/${school.id}`}>{school.name}</Link>
                  </Table.Td>
                  <Table.Td>{renderGradeCell(record)}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </div>
  );
};

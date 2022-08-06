import React, { lazy, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Table } from 'semantic-ui-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import AwardEmoji from '@/components/AwardEmoji';
import PersonCard from '@/components/PersonCard';
import fixChineseSpace from '@/utils/fixChineseSpace';
import getGrade from '@/utils/getGrade';
import getProgress from '@/utils/getProgress';
import fixContestName from '@/utils/fixContestName';
import Pagination from '@/components/Pagination';
import styles from './Contest.module.less';
import { awardColors, awardLevels } from '@/libs/OIerDb';

const NotFound = lazy(() => import('@/pages/404'));

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const Contest: React.FC = () => {
  const params = useParams();
  const [searchParams] = useSearchParams();

  const id = Number(params.id) ?? -1;
  const contest = useMemo(
    () => OIerDb.contests.find((contest) => contest.id === id),
    [id]
  );

  const page = Number(searchParams.get('page')) || 1;
  const perPage = 30;

  if (!contest) return <NotFound />;

  const awards = awardLevels.filter((awardLevel) =>
    contest.level_counts.has(awardLevel)
  );

  return (
    <>
      <h1>{fixChineseSpace(fixContestName(contest.name))}</h1>
      <p>
        举办于 {contest.year} 年（{contest.school_year()}-
        {contest.school_year() + 1} 学年），共 {contest.contestants.length}{' '}
        人获奖。
      </p>
      <h4>获奖情况</h4>
      <div style={{ height: 200 }}>
        <Bar
          options={{
            maintainAspectRatio: false,
            responsive: true,
            indexAxis: 'y' as const,
            plugins: {
              legend: {
                display: false,
              },
            },
          }}
          data={{
            labels: awards,
            datasets: [
              {
                label: '数量',
                barThickness: 30,
                data: awards.map((award) => contest.level_counts.get(award)),
                backgroundColor: awards.map((award) => awardColors[award]),
              },
            ],
          }}
        />
      </div>
      <h4>选手列表</h4>
      <Table basic="very" unstackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={1}>#</Table.HeaderCell>
            <Table.HeaderCell>姓名</Table.HeaderCell>
            <Table.HeaderCell width={2}>年级</Table.HeaderCell>
            <Table.HeaderCell>成绩</Table.HeaderCell>
            <Table.HeaderCell>奖项</Table.HeaderCell>
            <Table.HeaderCell>就读学校</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {contest.contestants
            .slice((page - 1) * perPage, page * perPage)
            .map((contestant) => (
              <PersonCard
                key={contestant.oier.uid}
                oier={contestant.oier}
                trigger={
                  <>
                    <Table.Cell>{contestant.rank}</Table.Cell>
                    <Table.Cell>{contestant.oier.name}</Table.Cell>
                    <Table.Cell>
                      {getGrade(
                        contestant.oier.enroll_middle,
                        contest.school_year()
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {contestant.score == null ? (
                        '-'
                      ) : (
                        <>
                          <span
                            className={
                              styles[
                                `progress-${getProgress(
                                  contestant.score,
                                  contestant.contest.full_score
                                )}`
                              ]
                            }
                          >
                            {contestant.score}
                          </span>{' '}
                          <span className={styles.recordTotal}>
                            / {contestant.contest.full_score}
                          </span>
                        </>
                      )}
                    </Table.Cell>
                    <Table.Cell className={styles.contestLevel}>
                      <AwardEmoji level={contestant.level} />
                      {fixChineseSpace(contestant.level)}
                    </Table.Cell>
                    <Table.Cell>{contestant.school.name}</Table.Cell>
                  </>
                }
              />
            ))}
        </Table.Body>
      </Table>
      <Pagination total={contest.contestants.length} perPage={perPage} />
    </>
  );
};

export default Contest;

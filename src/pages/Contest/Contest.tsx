import React, { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Table, Icon, Pagination } from 'semantic-ui-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import NotFound from '@/pages/404';
import AwardEmoji from '@/components/AwardEmoji';
import { PersonCard } from '@/components/Person/Card';
import fixChineseSpace from '@/utils/fixChineseSpace';
import getGrade from '@/utils/getGrade';
import getProgress from '@/utils/getProgress';
import styles from './Contest.module.less';
import { useScreenWidthWithin } from '@/utils/useScreenWidthWithin';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const colors = {
  一等奖: '#ee961b',
  二等奖: '#939291',
  三等奖: '#9c593b',
  一等: '#ee961b',
  二等: '#939291',
  三等: '#9c593b',
  金牌: '#ee961b',
  银牌: '#939291',
  铜牌: '#9c593b',
};

const Contest: React.FC = () => {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const id = Number(params.id) ?? -1;
  const contest = useMemo(
    () => OIerDb.contests.find((contest) => contest.id === id),
    [id]
  );

  if (!contest) return <NotFound />;

  const page = Number(searchParams.get('page')) || 1;
  const setPage = (page: string) => setSearchParams({ page });
  const totalPages = Math.ceil(contest.contestants.length / 30);

  const screenWidthLessThan376 = useScreenWidthWithin(0, 376);
  const screenWidthLessThan450 = useScreenWidthWithin(0, 450);
  const screenWidthLessThan680 = useScreenWidthWithin(0, 680);
  const screenWidthLessThan768 = useScreenWidthWithin(0, 768);
  const screenWidthLessThan1024 = useScreenWidthWithin(0, 1024);

  let siblingRange: number, size: string;
  if (screenWidthLessThan376) {
    siblingRange = 0;
    size = 'small';
  } else if (screenWidthLessThan450) {
    siblingRange = 0;
  } else if (screenWidthLessThan680) {
    siblingRange = 1;
  } else if (screenWidthLessThan768) {
    siblingRange = 2;
  } else if (screenWidthLessThan1024) {
    siblingRange = 3;
  } else {
    siblingRange = 4;
  }

  return (
    <>
      <h1>{fixChineseSpace(contest.name)}</h1>
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
            labels: Object.keys(contest.level_counts.dict),
            datasets: [
              {
                label: '数量',
                barThickness: 30,
                data: Object.keys(contest.level_counts.dict).map(
                  (award) => contest.level_counts.dict[award]
                ),
                backgroundColor: Object.keys(contest.level_counts.dict).map(
                  (award) => colors[award] || null
                ),
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
            .slice(page * 30 - 30, page * 30)
            .map((contestant) => (
              <PersonCard
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
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Pagination
          firstItem={null}
          lastItem={null}
          size={size}
          siblingRange={siblingRange}
          ellipsisItem={{
            content: '...',
            disabled: true,
            icon: true,
          }}
          prevItem={{
            content: <Icon name="angle left" />,
            icon: true,
            disabled: page === 1,
          }}
          nextItem={{
            content: <Icon name="angle right" />,
            icon: true,
            disabled: page === totalPages,
          }}
          activePage={page}
          totalPages={totalPages}
          onPageChange={(_, data) => setPage(data.activePage as string)}
        />
      </div>
    </>
  );
};

export default Contest;

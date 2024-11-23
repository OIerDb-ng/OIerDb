import React, { lazy, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Form, Table } from 'semantic-ui-react';
import { Helmet } from 'react-helmet';
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
import usePartialSearchParams from '@/utils/usePartialSearchParams';
import fixChineseSpace from '@/utils/fixChineseSpace';
import getGrade from '@/utils/getGrade';
import getProgress from '@/utils/getProgress';
import fixContestName from '@/utils/fixContestName';
import Pagination from '@/components/Pagination';
import styles from './[id].module.less';
import { awardColors, awardLevels } from '@/libs/OIerDb';
import compareGrades from '@/utils/compareGrades';

const NotFound = lazy(() => import('@/pages/404'));

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const Contest: React.FC = () => {
  const params = useParams();
  const [searchParams, setSearchParams] = usePartialSearchParams();

  const id = Number(params.id) ?? -1;
  const contest = useMemo(
    () => OIerDb.contests.find((contest) => contest.id === id),
    [id]
  );

  const page = Number(searchParams.get('page')) || 1;
  const perPage = 30;

  if (!contest) return <NotFound />;

  const province = searchParams.get('province') || '';
  const setProvince = (province: string) => {
    setSearchParams({ province, page: '1' });
  };

  const grade = Number(searchParams.get('grade') || '0');
  const setGrade = (grade: number) => {
    setSearchParams({ grade: String(grade), page: '1' });
  };

  const provinces = useMemo(
    () => [
      ...new Set(contest.contestants.map((contestant) => contestant.province)),
    ],
    [id]
  );

  const grades = useMemo(
    () => [
      ...new Set(
        contest.contestants.map(
          (contestant) =>
            contestant.enroll_middle?.value || contestant.oier.enroll_middle
        )
      ),
    ],
    [id]
  );

  const data = useMemo(
    () =>
      contest.contestants
        .filter((contestant) =>
          province ? contestant.province === province : true
        )
        .filter((contestant) =>
          grade
            ? (contestant.enroll_middle?.value ||
                contestant.oier.enroll_middle) === grade
            : true
        ),
    [contest, province, grade]
  );

  const awards = awardLevels.filter((awardLevel) =>
    contest.level_counts.has(awardLevel)
  );

  const contestName = fixChineseSpace(fixContestName(contest.name));

  return (
    <>
      <Helmet>
        <title>比赛：{contestName}</title>
      </Helmet>

      <h1>{contestName}</h1>
      <p>
        举办于 {contest.year} 年（{contest.school_year()}-
        {contest.school_year() + 1} 学年），共{' '}
        {contest.capacity ? `${contest.capacity} 人参赛、` : ''}
        {contest.contestants.length} 人获奖。
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
            scales: {
              x: {
                ticks: {
                  precision: 0,
                },
              },
              y: {
                ticks: {
                  precision: 0,
                },
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
      <Form onSubmit={() => false} style={{ margin: '20px 0' }}>
        <Form.Group widths="four">
          <Form.Field style={{ display: 'flex', alignItems: 'center' }}>
            <h4>选手列表</h4>
          </Form.Field>
          <Form.Field />
          <Form.Dropdown
            fluid
            search
            selection
            clearable
            placeholder="年级"
            value={grade || null}
            options={grades
              .map((grade) => ({
                key: grade,
                value: grade,
                text: getGrade(grade, contest.school_year()),
              }))
              .sort(compareGrades)}
            onChange={(_, { value }) => setGrade(Number(value))}
          />
          <Form.Dropdown
            fluid
            search
            selection
            clearable
            placeholder="省份"
            value={province}
            options={provinces.map((province) => ({
              key: province,
              value: province,
              text: province,
            }))}
            onChange={(_, { value }) => setProvince(value as string)}
          />
        </Form.Group>
      </Form>
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
          {data
            .slice((page - 1) * perPage, page * perPage)
            .map((contestant) => (
              <PersonCard
                key={`CONTEST${contest.id}-${contestant.oier.uid}`}
                oier={contestant.oier}
                trigger={
                  <>
                    <Table.Cell>{contestant.rank}</Table.Cell>
                    <Table.Cell>{contestant.oier.name}</Table.Cell>
                    <Table.Cell>
                      {getGrade(
                        contestant.enroll_middle?.value ||
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
      <Pagination total={data.length} perPage={perPage} />
    </>
  );
};

export default Contest;

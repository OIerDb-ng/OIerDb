import React, { memo } from 'react';
import { Link } from 'react-router-dom';

// Components
import { Table, Popup } from 'semantic-ui-react';

import styles from './index.module.less';

// Utils
import getGrade from '@/utils/getGrade';
import fixChineseSpace from '@/utils/fixChineseSpace';
import { EmojiRenderer } from '../EmojiRenderer';

// Libs
import type { OIer, Record } from '@/libs/OIerDb';

interface AwardEmojiProps {
  level: string;
}

const AwardEmoji: React.FC<AwardEmojiProps> = (props) => {
  const keywordsOfType = [['金'], ['银'], ['铜']];
  const emojis = ['🥇', '🥈', '🥉'];

  const type = keywordsOfType.findIndex((keywords) =>
    keywords.some((keyword) => props.level.includes(keyword))
  );
  const emoji = emojis[type];

  return emoji ? <EmojiRenderer>{emoji}</EmojiRenderer> : null;
};

interface PersonProps {
  oier: OIer;
}

export const Person: React.FC<PersonProps> = memo((props) => {
  const { oier } = props;

  // "NOI2017D类" -> "NOI2017 D类"
  function fixContestName(contestName: string) {
    return contestName.replace(/(\d+)([a-z]+)/gi, '$1 $2');
  }

  const getProgress = (score: number, fullScore: number) => {
    if (score >= fullScore) return 10;
    if (score < 0) return 0;
    return Math.floor((10 * score) / fullScore);
  };

  const handleInconsistentGrade = (record: Record) => {
    if (record.enroll_middle.is_stay_down) {
      return (
        <Popup
          position="top center"
          content="此记录为非正常年级，可能为该选手后期出现了留级等情况而导致的。"
          trigger={
            <span style={{ color: 'red' }}>{getGrade(record, true)}</span>
          }
        />
      );
    } else {
      return (
        <Popup
          position="top center"
          content={`此记录的年级与原始数据不一致，原始数据为 “${getGrade(
            record,
            true
          )}”。`}
          trigger={<span style={{ color: 'fuchsia' }}>{getGrade(record)}</span>}
        />
      );
    }
  };

  return (
    <>
      <h4>选手信息</h4>
      <p>现在{getGrade(oier)}。</p>
      <p>
        OIerDb 排名：
        <Link to={'/oier?page=' + Math.ceil((oier.rank + 1) / 30)}>
          {oier.rank + 1}
        </Link>
        （{oier.oierdb_score} 分）。
      </p>
      <p>CCF 程序设计能力等级：{oier.ccf_level} 级（仅供参考）。</p>
      <h4>获奖信息</h4>
      <Table basic="very" unstackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>奖项</Table.HeaderCell>
            <Table.HeaderCell>分数</Table.HeaderCell>
            <Table.HeaderCell>选手排名</Table.HeaderCell>
            <Table.HeaderCell>省份</Table.HeaderCell>
            <Table.HeaderCell>就读学校</Table.HeaderCell>
            <Table.HeaderCell>年级</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {oier.records
            .map((data) => (
              <Table.Row key={data.contest.id}>
                <Table.Cell>
                  <span className={styles.contestName}>
                    {fixChineseSpace(fixContestName(data.contest.name))}
                  </span>{' '}
                  <span className={styles.contestLevel}>
                    <AwardEmoji level={data.level} />
                    {fixChineseSpace(data.level)}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  {data.score == null ? (
                    '-'
                  ) : (
                    <>
                      <span
                        className={
                          styles[
                            `progress-${getProgress(
                              data.score,
                              data.contest.full_score
                            )}`
                          ]
                        }
                      >
                        {data.score}
                      </span>{' '}
                      <span className={styles.recordTotal}>
                        / {data.contest.full_score}
                      </span>
                    </>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <span
                    className={
                      styles[
                        `progress-${getProgress(
                          data.contest.n_contestants() - data.rank,
                          data.contest.n_contestants() - 1
                        )}`
                      ]
                    }
                  >
                    {data.rank}
                  </span>{' '}
                  <span className={styles.recordTotal}>
                    / {data.contest.n_contestants()}
                  </span>
                </Table.Cell>
                <Table.Cell>{data.province}</Table.Cell>
                <Table.Cell>
                  <Link to={`/school/${data.school.id}`}>
                    {data.school.name}
                  </Link>
                </Table.Cell>
                <Table.Cell>
                  {data.enroll_middle
                    ? handleInconsistentGrade(data)
                    : getGrade(data)}
                </Table.Cell>
              </Table.Row>
            ))
            .reverse()}
        </Table.Body>
      </Table>
    </>
  );
});

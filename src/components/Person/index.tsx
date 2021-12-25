// Components
import { Table } from 'semantic-ui-react';

import styles from './index.module.less';

// Utils
import getGrade from '@/utils/getGrade';
import fixChineseSpace from '@/utils/fixChineseSpace';
import { getEmoji } from '@/utils/getEmoji';

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

    return emoji ? (
        <span dangerouslySetInnerHTML={{ __html: getEmoji(emoji) }} />
    ) : null;
};

interface PersonProps {
    oier: OIer;
}

export const Person: React.FC<PersonProps> = (props) => {
    const { oier } = props;

    // "NOI2017D类" -> "NOI2017 D类"
    function fixContestName(contestName: string) {
        return contestName.replace(/(\d+)([a-z]+)/gi, '$1 $2');
    }

    return (
        <>
            <h4>选手信息</h4>
            <p>现在{getGrade(oier.enroll_middle)}。</p>
            <p>
                OIerDb 排名：{oier.rank + 1}（{oier.oierdb_score} 分）。
            </p>
            <p>CCF 程序设计能力等级：{oier.ccf_level} 级（仅供参考）。</p>
            <h4>获奖信息</h4>
            <Table basic="very" unstackable>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>奖项</Table.HeaderCell>
                        <Table.HeaderCell>分数</Table.HeaderCell>
                        <Table.HeaderCell>选手排名</Table.HeaderCell>
                        <Table.HeaderCell>就读学校</Table.HeaderCell>
                        <Table.HeaderCell>年级</Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {oier.records.map((data) => (
                        <Table.Row key={data.contest.id}>
                            <Table.Cell>
                                <span className={styles.contestName}>
                                    {fixChineseSpace(
                                        fixContestName(data.contest.name)
                                    )}
                                </span>{' '}
                                <span className={styles.contestLevel}>
                                    <AwardEmoji level={data.level} />
                                    {fixChineseSpace(data.level)}
                                </span>
                            </Table.Cell>
                            <Table.Cell>{data.score}</Table.Cell>
                            <Table.Cell>{data.rank}</Table.Cell>
                            <Table.Cell>{data.school.name}</Table.Cell>
                            <Table.Cell>
                                {getGrade(
                                    oier.enroll_middle,
                                    data.contest.school_year()
                                )}
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
        </>
    );
};

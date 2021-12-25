import { Link } from 'react-router-dom';

// Components
import { Table } from 'semantic-ui-react';

// Utils
import getGrade from '@/utils/getGrade';

interface PersonProps {
    oier: OIer;
}

export const Person: React.FC<PersonProps> = (props) => {
    const { oier } = props;

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
                                {data.contest.name}
                                {data.level}
                            </Table.Cell>
                            <Table.Cell>{data.score}</Table.Cell>
                            <Table.Cell>{data.rank}</Table.Cell>
                            <Table.Cell>
                                <Link
                                    to={`/school/${data.school.id}`}
                                    style={{ color: 'inherit' }}
                                >
                                    {data.school.name}
                                </Link>
                            </Table.Cell>
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

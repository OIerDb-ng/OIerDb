// Components
import { Table } from 'semantic-ui-react';
import { PersonCard } from '@/components/Person/Card';

// Utils
import getGrade from '@/utils/getGrade';

interface SchoolProps {
    school: School;
}

export const School: React.FC<SchoolProps> = (props) => {
    const { school } = props;

    return (
        <>
            <h4>学校信息</h4>
            <p>
                位于{school.province}
                {school.city}。
            </p>
            <p>
                OIerDb 排名：{school.rank + 1}（{school.score} 分）
            </p>
            <h4>选手列表</h4>
            {/* TODO: 年获奖数量变化图 */}
            <Table basic="very" unstackable>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>#</Table.HeaderCell>
                        <Table.HeaderCell>姓名</Table.HeaderCell>
                        <Table.HeaderCell>年级</Table.HeaderCell>
                        <Table.HeaderCell>全国排名</Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {/* TODO: 分页 */}
                    {school.members.map((oier, index) => (
                        <PersonCard
                            key={oier.uid}
                            oier={oier}
                            trigger={
                                <>
                                    <Table.Cell>{index + 1}</Table.Cell>
                                    <Table.Cell>{oier.name}</Table.Cell>
                                    <Table.Cell>
                                        {getGrade(oier.enroll_middle)}
                                    </Table.Cell>
                                    <Table.Cell>{oier.rank + 1}</Table.Cell>
                                </>
                            }
                        />
                    ))}
                </Table.Body>
            </Table>
        </>
    );
};

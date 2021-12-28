import { useState } from 'react';

// Components
import { Pagination, Table, Icon } from 'semantic-ui-react';
import { PersonCard } from '@/components/Person/Card';

// Utils
import getGrade from '@/utils/getGrade';
import { useScreenWidthWithin } from '@/utils/useScreenWidthWithin';

interface SchoolProps {
    school: School;
}

export const School: React.FC<SchoolProps> = (props) => {
    const { school } = props;
    const [page, setPage] = useState(1);

    const totalPages = Math.ceil(school.members.length / 30);

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
                    {school.members
                        .slice(page * 30 - 30, page * 30)
                        .map((oier, index) => (
                            <PersonCard
                                key={oier.uid}
                                oier={oier}
                                trigger={
                                    <>
                                        <Table.Cell>
                                            {page * 30 - 30 + index + 1}
                                        </Table.Cell>
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
                    totalPages={totalPages}
                    onPageChange={(_, data) =>
                        setPage(data.activePage as number)
                    }
                />
            </div>
        </>
    );
};

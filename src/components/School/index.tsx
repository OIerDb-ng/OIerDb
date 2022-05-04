import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { ChartData } from 'chart.js';

// Components
import { Pagination, Table, Icon, Tab } from 'semantic-ui-react';
import { PersonCard } from '@/components/Person/Card';

// Utils
import getGrade from '@/utils/getGrade';
import { useScreenWidthWithin } from '@/utils/useScreenWidthWithin';

// Styles
import styles from './index.module.less';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface SchoolProps {
    school: School;
}

export const School: React.FC<SchoolProps> = (props) => {
    const [searchParams, setSearchParams] = useSearchParams();

    const { school } = props;

    const page = Number(searchParams.get('page')) || 1;
    const setPage = (page: string) => setSearchParams({ page });
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

    const panes = Object.keys(school.award_counts)
        .map((key) => {
            // 奖项名称列表
            const awards: string[] = [];
            const years = Object.keys(school.award_counts[key]);
            years.forEach((year) => {
                Object.keys(school.award_counts[key][year].dict).forEach(
                    (award) => {
                        if (!awards.includes(award)) awards.push(award);
                    }
                );
            });

            let isEmpty = true;
            years.forEach((year) => {
                if (Object.keys(school.award_counts[key][year].dict).length)
                    isEmpty = false;
            });
            if (isEmpty) return null;

            const data: ChartData<'line'> = {
                labels: years,
                datasets: awards.map((award) => {
                    return {
                        label: award,
                        data: years.map(
                            (year) =>
                                school.award_counts[key][year].dict[award] || 0
                        ),
                        backgroundColor: colors[award] || null,
                        borderColor: colors[award] || null,
                    };
                }),
            };

            const LEGEND_TOP_MARGIN = -24;
            const LEGEND_BOTTOM_MARGIN = 10;

            const FONT_SIZE = 14;
            const LABELS_SPACING = 36;
            const TOOLTIP_ICON_MARGIN = 5;
            const TOOLTIP_PADDING = 12;
            const AXIS_MARGIN_TOP = 14;

            return {
                menuItem: key,
                render: () => (
                    <Tab.Pane attached={false}>
                        <Line
                            style={{
                                marginTop: LEGEND_TOP_MARGIN,
                                minHeight: 400,
                            }}
                            plugins={[
                                {
                                    id: null, // Make typing happy
                                    beforeInit: (chart: any) => {
                                        const originalFit = chart.legend
                                            .fit as Function;

                                        chart.legend.fit = function fit() {
                                            originalFit.call(chart.legend);
                                            this.height += LEGEND_BOTTOM_MARGIN;
                                        };
                                    },
                                },
                            ]}
                            options={{
                                maintainAspectRatio: false,
                                responsive: true,
                                plugins: {
                                    legend: {
                                        position: 'top' as const,
                                        labels: {
                                            font: {
                                                size: FONT_SIZE,
                                            },
                                            padding: LABELS_SPACING,
                                        },
                                        title: {
                                            font: {
                                                size: FONT_SIZE,
                                            },
                                        },
                                    },
                                    tooltip: {
                                        titleFont: {
                                            size: FONT_SIZE,
                                        },
                                        bodyFont: {
                                            size: FONT_SIZE,
                                        },
                                        boxPadding: TOOLTIP_ICON_MARGIN,
                                        padding: TOOLTIP_PADDING,
                                    },
                                },
                                scales: {
                                    x: {
                                        ticks: {
                                            font: {
                                                size: FONT_SIZE,
                                            },
                                            padding: AXIS_MARGIN_TOP,
                                        },
                                    },
                                    y: {
                                        ticks: {
                                            font: {
                                                size: FONT_SIZE,
                                            },
                                            padding: AXIS_MARGIN_TOP,
                                        },
                                    },
                                },
                            }}
                            data={data}
                        />
                    </Tab.Pane>
                ),
            };
        })
        .filter((pane) => pane);

    return (
        <>
            <h4>学校信息</h4>
            <p>
                位于{school.province}
                {school.city}。
            </p>
            <p>
                OIerDb 排名：
                <Link to={'/school?page=' + Math.ceil((school.rank + 1) / 30)}>
                    {school.rank + 1}
                </Link>
                （{school.score} 分）
            </p>
            <h4>获奖信息</h4>
            <Tab
                menu={{ secondary: true }}
                panes={panes}
                id={styles.schoolTab}
            />
            <h4>选手列表</h4>
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
                    activePage={page}
                    totalPages={totalPages}
                    onPageChange={(_, data) =>
                        setPage(data.activePage as string)
                    }
                />
            </div>
        </>
    );
};

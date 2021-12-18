import { Component } from 'react';

// Components
import { Header, Input, Segment, Table } from 'semantic-ui-react';

// Styles
import styles from './index.module.less';

const getGrade = (enroll_middle) => {
    const nowYear = new Date().getFullYear();
    const years1 = ['初一', '初二', '初三', '高一', '高二', '高三'];
    const years2 = ['六年级', '五年级', '四年级', '三年级', '二年级', '一年级'];

    let grade = null;
    const year = nowYear - enroll_middle;

    if (year < 0) {
        grade = years2[-(year + 1)];
    } else if (year >= 6) {
        grade = '高中毕业 ' + (year - 5) + ' 年';
    } else {
        grade = years1[year];
    }

    if (!grade) grade = '(未知)';
    return grade;
};

class Search extends Component {
    constructor(props) {
        super(props);
        this.state = {
            searched: false,
            searching: false,
            result: null,
        };
    }

    doSearch(event, data) {
        this.setState({
            searching: true,
            result: null,
        });
        const result = OIerDb.oiers.filter(
            (oier) => oier.name === data.value || oier.initials === data.value
        );
        this.setState({
            searched: true,
            searching: false,
            result,
        });
    }

    render() {
        return (
            <>
                <Header
                    className={styles.header}
                    block
                    as="h4"
                    content="搜索"
                    attached="top"
                    icon="search"
                />
                <Segment attached="bottom">
                    <Input
                        fluid
                        placeholder="键入学生姓名或其拼音首字母..."
                        loading={this.state.searching}
                        onChange={this.doSearch.bind(this)}
                    />
                    {this.state.result && this.state.result.length ? (
                        <>
                            <Table basic="very">
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell>
                                            姓名
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            省份
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            年级
                                        </Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                {this.state.result.map((oier) => (
                                    <Table.Body>
                                        <Table.Row key={oier.uid}>
                                            <Table.Cell>{oier.name}</Table.Cell>
                                            <Table.Cell>
                                                {oier.provinces.join('/')}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {getGrade(oier.enroll_middle)}
                                            </Table.Cell>
                                        </Table.Row>
                                    </Table.Body>
                                ))}
                            </Table>
                        </>
                    ) : (
                        <></>
                    )}
                </Segment>
            </>
        );
    }
}

export default Search;

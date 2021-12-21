import { Component } from 'react';

// Components
import { Header, Input, Segment, Table, Modal } from 'semantic-ui-react';
import Person from '../Person';

// Styles
import styles from './index.module.less';
import './index.css';

// Utils
import getGrade from '../../utils/getGrade';

class PersonCard extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const trigger = (
            <Table.Row style={{ cursor: 'pointer' }}>
                <Table.Cell>{this.props.oier.name}</Table.Cell>
                <Table.Cell>{this.props.oier.provinces.join('/')}</Table.Cell>
                <Table.Cell>
                    {getGrade(this.props.oier.enroll_middle)}
                </Table.Cell>
            </Table.Row>
        );

        return (
            <>
                <Modal
                    closeOnEscape
                    closeOnDimmerClick
                    closeIcon
                    trigger={trigger}
                    dimmer={{ inverted: true }}
                >
                    <Modal.Header>{this.props.oier.name}</Modal.Header>
                    <Modal.Content>
                        <Person oier={this.props.oier} />
                    </Modal.Content>
                </Modal>
            </>
        );
    }
}

class Search extends Component {
    constructor(props) {
        super(props);
        this.state = {
            searching: false,
            input: '',
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
            input: data.value,
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
                        spellCheck="false"
                    />
                    {this.state.result && this.state.result.length ? (
                        <>
                            <Table basic="very" unstackable>
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
                                <Table.Body>
                                    {this.state.result.map((oier) => (
                                        <PersonCard
                                            key={oier.uid}
                                            oier={oier}
                                        />
                                    ))}
                                </Table.Body>
                            </Table>
                        </>
                    ) : (
                        <>
                            {this.state.input.length ? (
                                <div style={{ paddingTop: '1rem' }}>
                                    未找到结果
                                </div>
                            ) : (
                                <></>
                            )}
                        </>
                    )}
                </Segment>
            </>
        );
    }
}

export default Search;

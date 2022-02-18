import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// Components
import { Header, Input, Segment, Table } from 'semantic-ui-react';
import { PersonCard } from '@/components/Person/Card';

// Styles
import styles from './index.module.less';
import './index.css';

export const Search: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const input = searchParams.get('query') || '';
    const setInput = (query: string) => setSearchParams({ query });

    const [searching, setSearching] = useState(false);
    const [result, setResult] = useState(null);

    function onSearchInputChange(value: string) {
        setSearching(true);
        setResult(null);
        setInput(value);

        const result = OIerDb.oiers.filter(
            (oier) => oier.name === value || oier.initials === value
        );

        setSearching(false);
        setResult(result);
    }

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
                    loading={searching}
                    onChange={(_, { value }) => onSearchInputChange(value)}
                    spellCheck="false"
                />
                {result?.length ? (
                    <>
                        <Table basic="very" unstackable>
                            <Table.Header>
                                <Table.Row>
                                    <Table.HeaderCell>姓名</Table.HeaderCell>
                                    <Table.HeaderCell>省份</Table.HeaderCell>
                                    <Table.HeaderCell>年级</Table.HeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {result.map((oier) => (
                                    <PersonCard key={oier.uid} oier={oier} />
                                ))}
                            </Table.Body>
                        </Table>
                    </>
                ) : (
                    <>
                        {input.length ? (
                            <div style={{ paddingTop: '1rem' }}>未找到结果</div>
                        ) : (
                            <></>
                        )}
                    </>
                )}
            </Segment>
        </>
    );
};

export default Search;

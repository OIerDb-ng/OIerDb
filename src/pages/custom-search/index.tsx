import React, { useState, useEffect } from 'react';
import { Table, Button } from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import { Header, Segment } from 'semantic-ui-react';
import Pagination from '@/components/Pagination';
import { Contest, OIer, School } from '@/libs/OIerDb';
import usePartialSearchParams from '@/utils/usePartialSearchParams';
import styles from './index.module.less';
import fixContestName from '@/utils/fixContestName';
import fixChineseSpace from '@/utils/fixChineseSpace';
import jsExtraLib from './OIerDb.js?raw';
import JSEditor from '@/components/JSEditor';

const CustomSearch: React.FC = () => {
  const [searchParams] = usePartialSearchParams();

  const page = Number(searchParams.get('page') || 1);
  const perPage = 30;

  const STORAGE_KEY = 'monaco-editor-content';

  const DEFAULT_EDITOR_CONTENT =
    `
/** @param {OIerDb} db */
export default (db) => {
  return db.oiers.filter((oier) => {
    return oier.ccf_level === 10;
  });
}
      `.trim() + '\n';

  const [filterCode, setFilterCode] = useState<string>(
    localStorage.getItem(STORAGE_KEY) || DEFAULT_EDITOR_CONTENT
  );
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>(filterCode);

  const [filteredData, setFilteredData] = useState<{
    type: string;
    result: Array<OIer | Contest | School>;
  }>({ type: 'OIer', result: [] });

  useEffect(() => {
    const loadAsESModule = async (code: string) => {
      const blob = new Blob([code], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const module = await import(/* @vite-ignore */ url);
      URL.revokeObjectURL(url);
      return module.default;
    };

    const loadData = async () => {
      setRuntimeError(null);

      if (!activeFilter.trim()) {
        return setFilteredData({ type: 'OIer', result: OIerDb.oiers });
      }

      try {
        type LoadModuleFunction = (OIerDbData) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

        const filter = await loadAsESModule(activeFilter);
        const result = await (filter as LoadModuleFunction)(OIerDb);

        for (const type of [OIer, Contest, School]) {
          if (result instanceof type) {
            return setFilteredData({ type: type.name, result: [result] });
          } else if (
            Array.isArray(result) &&
            result.every((item) => item instanceof type)
          ) {
            return setFilteredData({ type: type.name, result: result });
          }
        }

        throw new Error('Unexpected type of return value');
      } catch (err) {
        setRuntimeError(err.message);
        return setFilteredData({ type: 'OIer', result: OIerDb.oiers });
      }
    };

    loadData();
  }, [activeFilter]);

  return (
    <>
      <Header
        className={styles.header}
        block
        as="h4"
        content="自定义搜索"
        attached="top"
        icon="code"
      />
      <Segment attached="bottom">
        <JSEditor
          storageKey={STORAGE_KEY}
          defaultValue={DEFAULT_EDITOR_CONTENT}
          jsExtraLib={jsExtraLib}
          onChange={(value) => setFilterCode(value || '')}
        />

        <Button
          onClick={() => setActiveFilter(filterCode)}
          style={{ marginTop: '10px', width: '100%' }}
        >
          运行
        </Button>

        {runtimeError && (
          <div style={{ color: 'red', marginTop: '5px' }}>
            运行时错误：{runtimeError}
          </div>
        )}
      </Segment>

      {/* OIer List */}
      {filteredData.type === 'OIer' && (
        <Table celled unstackable>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={1} textAlign="center">
                #
              </Table.HeaderCell>
              <Table.HeaderCell width={2} textAlign="center">
                全国排名
              </Table.HeaderCell>
              <Table.HeaderCell>姓名</Table.HeaderCell>
              <Table.HeaderCell width={3}>省份</Table.HeaderCell>
              <Table.HeaderCell width={2}>评分</Table.HeaderCell>
              <Table.HeaderCell width={2}>CCF 评级</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(filteredData.result as OIer[])
              .slice(perPage * (page - 1), perPage * page)
              .map((oier, index) => (
                <Table.Row key={oier.uid}>
                  <Table.Cell textAlign="center">
                    {(page - 1) * perPage + index + 1}
                  </Table.Cell>
                  <Table.Cell textAlign="center">{oier.rank + 1}</Table.Cell>
                  <Table.Cell>
                    <Link to={`/oier/${oier.uid}`}>{oier.name}</Link>
                  </Table.Cell>
                  <Table.Cell>{oier.provinces.join('、')}</Table.Cell>
                  <Table.Cell>{oier.oierdb_score}</Table.Cell>
                  <Table.Cell>{oier.ccf_level}</Table.Cell>
                </Table.Row>
              ))}
          </Table.Body>
        </Table>
      )}

      {/* Contest List */}
      {filteredData.type == 'Contest' && (
        <Table celled unstackable>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={1} textAlign="center">
                #
              </Table.HeaderCell>
              <Table.HeaderCell width={2} textAlign="center">
                比赛编号
              </Table.HeaderCell>
              <Table.HeaderCell>名称</Table.HeaderCell>
              <Table.HeaderCell width={2}>参赛人数</Table.HeaderCell>
              <Table.HeaderCell width={2}>获奖人数</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(filteredData.result as Contest[])
              .slice(perPage * (page - 1), perPage * page)
              .map((contest, index) => (
                <Table.Row key={contest.id}>
                  <Table.Cell textAlign="center">
                    {(page - 1) * perPage + index + 1}
                  </Table.Cell>
                  <Table.Cell textAlign="center">{contest.id + 1}</Table.Cell>
                  <Table.Cell>
                    <Link to={`/contest/${contest.id}`}>
                      {fixChineseSpace(fixContestName(contest.name))}
                    </Link>
                  </Table.Cell>
                  <Table.Cell>{contest.capacity ?? '-'}</Table.Cell>
                  <Table.Cell>{contest.contestants.length}</Table.Cell>
                </Table.Row>
              ))}
          </Table.Body>
        </Table>
      )}

      {/* School List */}
      {filteredData.type == 'School' && (
        <Table celled unstackable>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={1} textAlign="center">
                #
              </Table.HeaderCell>
              <Table.HeaderCell width={2} textAlign="center">
                全国排名
              </Table.HeaderCell>
              <Table.HeaderCell>学校</Table.HeaderCell>
              <Table.HeaderCell width={2}>省份</Table.HeaderCell>
              <Table.HeaderCell width={2}>评分</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(filteredData.result as School[])
              .slice(perPage * (page - 1), perPage * page)
              .map((school, index) => (
                <Table.Row key={school.id}>
                  <Table.Cell textAlign="center">
                    {(page - 1) * perPage + index + 1}
                  </Table.Cell>
                  <Table.Cell textAlign="center">{school.rank + 1}</Table.Cell>
                  <Table.Cell>
                    <Link to={`/school/${school.id}`}>{school.name}</Link>
                  </Table.Cell>
                  <Table.Cell>{school.province}</Table.Cell>
                  <Table.Cell>{school.score}</Table.Cell>
                </Table.Row>
              ))}
          </Table.Body>
        </Table>
      )}

      <Pagination total={filteredData.result.length} perPage={perPage} />
    </>
  );
};

export default CustomSearch;

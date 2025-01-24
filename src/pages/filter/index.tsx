import React, { useState, useMemo } from 'react';
import { Table, Button } from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import { Header, Segment } from 'semantic-ui-react';
import MonacoEditor, { Monaco } from '@monaco-editor/react';
import Pagination from '@/components/Pagination';
import { Contest, OIer, School } from '@/libs/OIerDb';
import usePartialSearchParams from '@/utils/usePartialSearchParams';
import styles from './index.module.less';
import fixContestName from '@/utils/fixContestName';
import fixChineseSpace from '@/utils/fixChineseSpace';
import jsDoc from './OIerDb.js?raw';

const FilterWithIDE: React.FC = () => {
  const [searchParams] = usePartialSearchParams();

  const page = Number(searchParams.get('page') || 1);
  const perPage = 30;

  const handleEditorBeforeMount = (monaco: Monaco) => {
    monaco.languages.typescript.javascriptDefaults.addExtraLib(jsDoc);
  };

  const STORAGE_KEY = 'monaco-editor-content';

  const [filterCode, setFilterCode] = useState(
    localStorage.getItem(STORAGE_KEY) ||
      `
/**
 * @param {OIer[]} oiers
 * @param {School[]} schools
 * @param {Contest[]} contests
 */
function filter(oiers, schools, contests) {
  return oiers.filter((oier) => {
    return oier.ccf_level === 10;
  });
}

module.exports = filter;      
      `.trim() + '\n'
  );

  let saveTimeout: NodeJS.Timeout;
  const handleEditorChange = (value: string | undefined) => {
    setFilterCode(value);
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (value != null) {
        localStorage.setItem(STORAGE_KEY, value);
      }
    }, 300);
  };

  const [filterError, setFilterError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>(filterCode);

  function loadAsModule(code: string) {
    const module = { exports: {} };
    const func = new Function('module', code);
    func(module);
    return module.exports;
  }

  const filteredData = useMemo(() => {
    setFilterError(null);

    if (!activeFilter.trim()) {
      return { type: 'OIer', result: OIerDb.oiers };
    }

    try {
      const { oiers, schools, contests } = OIerDb;

      type LoadModuleFunction = (
        oiers: OIer[],
        schools: School[],
        contests: Contest[]
      ) => any; // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = (loadAsModule(activeFilter) as LoadModuleFunction)(
        oiers,
        schools,
        [...contests].reverse()
      );

      for (const type of [OIer, Contest, School]) {
        if (result instanceof type) {
          return { type: type.name, result: [result] };
        } else if (
          Array.isArray(result) &&
          result.every((item) => item instanceof type)
        ) {
          return { type: type.name, result: result };
        }
      }

      throw new Error('Unexpected type of return value');
    } catch (err) {
      setFilterError(err.message);
      return { type: 'OIer', result: OIerDb.oiers };
    }
  }, [activeFilter]);

  return (
    <>
      <Header
        className={styles.header}
        block
        as="h4"
        content="筛选器"
        attached="top"
        icon="code"
      />
      <Segment attached="bottom">
        <div className={styles.filterEditor}>
          <MonacoEditor
            height="200px"
            language="javascript"
            value={filterCode}
            onChange={handleEditorChange}
            beforeMount={handleEditorBeforeMount}
            options={{
              minimap: { enabled: false },
              tabSize: 2,
              fontSize: 14,
              lineNumbers: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
          />
        </div>

        <Button
          onClick={() => setActiveFilter(filterCode)}
          color="blue"
          style={{ marginTop: '10px' }}
        >
          筛选
        </Button>

        {filterError && (
          <div style={{ color: 'red', marginTop: '5px' }}>
            过滤器错误：{filterError}
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
                    <Link to={'/oier/' + oier.uid}>{oier.name}</Link>
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
              <Table.HeaderCell width={1}>#</Table.HeaderCell>
              <Table.HeaderCell>名称</Table.HeaderCell>
              <Table.HeaderCell width={2}>参赛人数</Table.HeaderCell>
              <Table.HeaderCell width={2}>获奖人数</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(filteredData.result as Contest[])
              .slice(perPage * (page - 1), perPage * page)
              .map((contest) => (
                <Table.Row key={contest.id}>
                  <Table.Cell>{contest.id + 1}</Table.Cell>
                  <Table.Cell>
                    <Link to={'/contest/' + contest.id}>
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
                    <Link to={'/school/' + school.id}>{school.name}</Link>
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

export default FilterWithIDE;

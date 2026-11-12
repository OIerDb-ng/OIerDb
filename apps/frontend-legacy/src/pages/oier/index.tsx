import React, { useMemo } from 'react';
import { Checkbox, Dropdown, Table } from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Pagination from '@/components/Pagination';
import { provinces } from '@/libs/OIerDb';
import usePartialSearchParams from '@/utils/usePartialSearchParams';
import styles from './index.module.less';

const OIerList: React.FC = () => {
  const [searchParams, setSearchParams] = usePartialSearchParams();

  const page = Number(searchParams.get('page') || 1);
  const perPage = 30;
  const ranking = searchParams.get('ranking') === 'female' ? 'female' : 'all';
  const isFemaleRanking = ranking === 'female';
  const showFemaleRank = searchParams.get('showFemaleRank') === '1';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const province = provinces.includes(searchParams.get('province') as any)
    ? searchParams.get('province')
    : '全国';
  const isWholeCountry = province === '全国';

  const femaleOiers = useMemo(
    () =>
      OIerDb.oiers.filter(oier =>
        oier.gender === -1
        || oier.records.some(record => record.contest.type === 'NGOI')
      ),
    []
  );
  const rankingOiers = isFemaleRanking ? femaleOiers : OIerDb.oiers;
  const data = useMemo(
    () =>
      isWholeCountry
        ? rankingOiers
        : rankingOiers.filter(oier => oier.provinces.includes(province)),
    [isWholeCountry, rankingOiers, province]
  );
  const femaleRank = useMemo(
    () => new Map(femaleOiers.map((oier, index) => [oier.uid, index + 1])),
    [femaleOiers]
  );
  const title = `${isFemaleRanking ? '女生' : ''}${province}信息学奥林匹克竞赛选手排名`;

  return (
    <>
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <h2 className={styles.header}>
        <Dropdown
          floating
          selection
          compact
          value={ranking}
          options={[
            { key: 'all', value: 'all', text: '全部选手' },
            { key: 'female', value: 'female', text: '女生榜' },
          ]}
          onChange={(_, { value }) =>
            setSearchParams({ ranking: value as string, page: '1' })}
          className={styles.dropdown}
        />
        <Dropdown
          floating
          selection
          scrolling
          search
          compact
          value={province}
          options={['全国', ...provinces].map(province => ({
            key: province,
            value: province,
            text: province,
          }))}
          onChange={(_, { value }) => setSearchParams({ province: value as string, page: '1' })}
          className={styles.dropdown}
        />
        <div>
          {title}
          <Checkbox
            checked={showFemaleRank}
            label="显示女生 LexRank"
            onChange={(_, { checked }) =>
              setSearchParams({ showFemaleRank: checked ? '1' : '0' })}
          />
        </div>
      </h2>

      {isFemaleRanking && (
        <p style={{ color: '#6b7280', fontSize: 13, margin: '-4px 0 14px' }}>
          女生榜按记录判定：有 NGOI 记录，或 NOI 获奖公示中的性别为女。
          选择省份后，表格中的“全国女生排名”仍按全国女生榜计算。
        </p>
      )}

      {import.meta.env.VITE_LOCAL_DATA && (
        <p style={{ color: '#6b7280', fontSize: 13, margin: '-4px 0 14px' }}>
          本站静态数据 · 分层优先排名：先比最高赛事层级，再比该层级上的最高奖项，最后看其余成绩。
          「评分」列为该排序的合成分（层级 × 1000 + 奖项 × 100 + 其余成绩）。
          <br />
          NGOI 的处理按年份区分：NGOI2022、NGOI2023 作为独立赛事计入；与 NOIP 同卷之后，
          有对应 NOIP 的记录不重复计分；没有对应 NOIP 的记录按同省份同原始分对应的 NOIP
          奖项等级获得相当于 NOIP 的加分。
          <br />
          排名机制由 Yanhao Xiang 二次开发，依原项目 AGPL-3.0 许可发布。
        </p>
      )}

      <Table celled unstackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={1} textAlign="center">
              #
            </Table.HeaderCell>
            {!isWholeCountry && (
              <Table.HeaderCell width={2} textAlign="center">
                {isFemaleRanking ? '全国女生排名' : '全国排名'}
              </Table.HeaderCell>
            )}
            {showFemaleRank && (
              <Table.HeaderCell width={2} textAlign="center">
                女生 LexRank
              </Table.HeaderCell>
            )}
            <Table.HeaderCell>姓名</Table.HeaderCell>
            <Table.HeaderCell width={3}>省份</Table.HeaderCell>
            <Table.HeaderCell width={2}>评分</Table.HeaderCell>
            <Table.HeaderCell width={2}>CCF 评级</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data
            .slice(perPage * (page - 1), perPage * page)
            .map((oier, index) => (
              <Table.Row key={oier.uid}>
                <Table.Cell textAlign="center">
                  {isWholeCountry
                    ? isFemaleRanking
                      ? femaleRank.get(oier.uid)
                      : oier.rank + 1
                    : (page - 1) * perPage + index + 1}
                </Table.Cell>
                {!isWholeCountry && (
                  <Table.Cell textAlign="center">
                    {isFemaleRanking ? femaleRank.get(oier.uid) : oier.rank + 1}
                  </Table.Cell>
                )}
                {showFemaleRank && (
                  <Table.Cell textAlign="center">
                    {femaleRank.get(oier.uid) ?? '—'}
                  </Table.Cell>
                )}
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

      <Pagination total={data.length} perPage={perPage} />
    </>
  );
};

export default OIerList;

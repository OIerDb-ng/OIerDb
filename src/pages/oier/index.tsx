import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Dropdown, Table } from 'semantic-ui-react';
import Pagination from '@/components/Pagination';
import { provinces } from '@/libs/OIerDb';
import usePartialSearchParams from '@/utils/usePartialSearchParams';
import styles from './index.module.less';

const OIerList: React.FC = () => {
  const [searchParams, setSearchParams] = usePartialSearchParams();

  const page = Number(searchParams.get('page') || 1);
  const perPage = 30;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const province = provinces.includes(searchParams.get('province') as any)
    ? searchParams.get('province')
    : '全国';
  const isWholeCountry = province === '全国';

  const data = useMemo(
    () =>
      isWholeCountry
        ? OIerDb.oiers
        : OIerDb.oiers.filter((oier) => oier.provinces.includes(province)),
    [province]
  );

  return (
    <>
      <h2 className={styles.header}>
        <Dropdown
          floating
          selection
          scrolling
          search
          compact
          value={province}
          options={['全国', ...provinces].map((province) => ({
            key: province,
            value: province,
            text: province,
          }))}
          onChange={(_, { value }) =>
            setSearchParams({ province: value as string, page: '1' })
          }
          className={styles.dropdown}
        />
        <div>信息学奥林匹克竞赛选手排名</div>
      </h2>

      <Table celled unstackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={1} textAlign="center">
              #
            </Table.HeaderCell>
            {!isWholeCountry && (
              <Table.HeaderCell width={2} textAlign="center">
                全国排名
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
                    ? oier.rank + 1
                    : (page - 1) * perPage + index + 1}
                </Table.Cell>
                {!isWholeCountry && (
                  <Table.Cell textAlign="center">{oier.rank + 1}</Table.Cell>
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

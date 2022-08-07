import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Dropdown, Table } from 'semantic-ui-react';
import { provinces } from '@/libs/OIerDb';
import Pagination from '@/components/Pagination';
import usePartialSearchParams from '@/utils/usePartialSearchParams';
import styles from './index.module.less';

const SchoolList: React.FC = () => {
  const [searchParams, setSearchParams] = usePartialSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const perPage = 30;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const province = provinces.includes(searchParams.get('province') as any)
    ? searchParams.get('province')
    : '全国';
  const isWholeCountry = province === '全国';

  const data = useMemo(
    () =>
      isWholeCountry
        ? OIerDb.schools
        : OIerDb.schools.filter((school) => school.province === province),
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
        <div>信息学奥林匹克竞赛学校排名</div>
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
            <Table.HeaderCell>学校</Table.HeaderCell>
            <Table.HeaderCell width={2}>省份</Table.HeaderCell>
            <Table.HeaderCell width={2}>评分</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data
            .slice(perPage * (page - 1), perPage * page)
            .map((school, index) => (
              <Table.Row key={school.id}>
                <Table.Cell textAlign="center">
                  {isWholeCountry
                    ? school.rank + 1
                    : (page - 1) * perPage + index + 1}
                </Table.Cell>
                {!isWholeCountry && (
                  <Table.Cell textAlign="center">{school.rank + 1}</Table.Cell>
                )}
                <Table.Cell>
                  <Link to={'/school/' + school.id}>{school.name}</Link>
                </Table.Cell>
                <Table.Cell>{school.province}</Table.Cell>
                <Table.Cell>{school.score}</Table.Cell>
              </Table.Row>
            ))}
        </Table.Body>
      </Table>

      <Pagination total={data.length} perPage={perPage} />
    </>
  );
};

export default SchoolList;

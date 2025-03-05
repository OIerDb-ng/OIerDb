import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Dropdown, Table } from 'semantic-ui-react';
import { Helmet } from 'react-helmet';
import { provinces } from '@/libs/OIerDb';
import Pagination from '@/components/Pagination';
import usePartialSearchParams from '@/utils/usePartialSearchParams';
import styles from './index.module.less';

const CityList: React.FC = () => {
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
        ? OIerDb.cities
        : OIerDb.cities.filter((city) => city.province === province),
    [province]
  );

  return (
    <>
      <Helmet>
        <title>信息学奥林匹克竞赛城市排名</title>
      </Helmet>

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
        <div>信息学奥林匹克竞赛城市排名</div>
      </h2>

      <Table celled unstackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={1} textAlign="center">
              #
            </Table.HeaderCell>
            {isWholeCountry ? (
              <Table.HeaderCell width={2} textAlign="center">
                下辖于
              </Table.HeaderCell>
            ) : (
              <Table.HeaderCell width={1} textAlign="center">
                全国排名
              </Table.HeaderCell>
            )}
            <Table.HeaderCell>名称</Table.HeaderCell>
            <Table.HeaderCell width={2}>评分</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data
            .slice(perPage * (page - 1), perPage * page)
            .map((city, index) => (
              <Table.Row key={city.province + city.name}>
                <Table.Cell textAlign="center">
                  {isWholeCountry
                    ? city.rank + 1
                    : (page - 1) * perPage + index + 1}
                </Table.Cell>
                {isWholeCountry ? (
                  <Table.Cell textAlign="center">
                    <Link to={`/cities?province=${city.province}`}>
                      {city.province}
                    </Link>
                  </Table.Cell>
                ) : (
                  <Table.Cell textAlign="center">
                    <Link
                      to={`/cities?page=${Math.floor(city.rank / perPage) + 1}`}
                    >
                      {city.rank + 1}
                    </Link>
                  </Table.Cell>
                )}
                <Table.Cell>
                  {city.name === '未分区' ? '(未分区)' : city.name}
                </Table.Cell>
                <Table.Cell>{city.score.toFixed(2)}</Table.Cell>
              </Table.Row>
            ))}
        </Table.Body>
      </Table>

      <Pagination total={data.length} perPage={perPage} />
    </>
  );
};

export default CityList;

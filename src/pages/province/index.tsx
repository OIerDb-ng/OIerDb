import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Table } from 'semantic-ui-react';
import { Helmet } from 'react-helmet';

const ProvinceList: React.FC = () => {
  const [searchParams] = useSearchParams();

  const data = useMemo(() => Array.from(OIerDb.provinces), []);

  return (
    <>
      <Helmet>
        <title>信息学奥林匹克竞赛省级行政区排名</title>
      </Helmet>

      <h2>信息学奥林匹克竞赛省级行政区排名</h2>
      <Table celled unstackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={1} textAlign="center">
              #
            </Table.HeaderCell>
            <Table.HeaderCell>名称</Table.HeaderCell>
            <Table.HeaderCell width={2}>评分</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data.map((province) => (
            <Table.Row key={province.name}>
              <Table.Cell>{province.rank + 1}</Table.Cell>
              <Table.Cell>
                <Link to={'/schools?province=' + province.name}>
                  {province.name} ({province.code})
                </Link>
              </Table.Cell>
              <Table.Cell>{province.score.toFixed(2)}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </>
  );
};

export default ProvinceList;

/* eslint-disable react/prop-types */

import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useLocalStorage } from 'usehooks-ts';
import { Table } from 'semantic-ui-react';

import PersonCard from '@/components/PersonCard';
import type { OIer } from '@/libs/OIerDb';
import useScreenWidthWithin from '@/utils/useScreenWidthWithin';

interface SearchResultProps {
  result: OIer[];
}

const SearchResult: React.FC<SearchResultProps> = ({ result }) => {
  const [displayGender] = useLocalStorage('display_gender', false);
  const isMobile = useScreenWidthWithin(0, 768);

  const virtualizer = useWindowVirtualizer({
    estimateSize: () => 43,
    count: result.length || 0,
    overscan: 10,
  });

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize() + 43}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <Table basic="very" unstackable>
          <Table.Header>
            <Table.Row>
              {!isMobile && <Table.HeaderCell width={1}>#</Table.HeaderCell>}
              <Table.HeaderCell>姓名</Table.HeaderCell>
              {displayGender && <Table.HeaderCell>性别</Table.HeaderCell>}
              <Table.HeaderCell>省份</Table.HeaderCell>
              <Table.HeaderCell>年级</Table.HeaderCell>
              {!isMobile && <Table.HeaderCell width={2}>评分</Table.HeaderCell>}
              <Table.HeaderCell width={2}>CCF 评级</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {virtualizer.getVirtualItems().map((item, index) => (
              <PersonCard
                key={item.key as string}
                oier={result[item.index]}
                style={{
                  height: `${item.size}px`,
                  transform: `translateY(${item.start - index * item.size}px)`,
                }}
              />
            ))}
          </Table.Body>
        </Table>
      </div>
    </div>
  );
};

export default SearchResult;

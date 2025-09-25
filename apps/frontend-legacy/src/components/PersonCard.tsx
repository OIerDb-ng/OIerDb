import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Table, Modal, Icon } from 'semantic-ui-react';
import PersonInfo from '@/components/PersonInfo';
import getGrade from '@/utils/getGrade';
import { genders, type OIer } from '@/libs/OIerDb';
import { trackMultiDomainPageview } from '@/libs/plausible';
import styles from './PersonCard.module.less';
import { useLocalStorage } from 'usehooks-ts';
import useScreenWidthWithin from '@/utils/useScreenWidthWithin';

interface PersonCardProps {
  oier: OIer;
  trigger?: JSX.Element;
}

const PersonCard: React.FC<
  PersonCardProps & React.HTMLAttributes<HTMLTableRowElement>
> = ({ oier, trigger: origTrigger, ...props }) => {
  const [displayGender] = useLocalStorage('display_gender', false);
  const isMobile = useScreenWidthWithin(0, 768);

  const trigger = (
    <Table.Row className={styles.row} {...props}>
      {origTrigger || (
        <>
          {!isMobile && <Table.Cell>{oier.rank + 1}</Table.Cell>}
          <Table.Cell>{oier.name}</Table.Cell>
          {displayGender && <Table.Cell>{genders[oier.gender]}</Table.Cell>}
          <Table.Cell>{oier.provinces.join('/')}</Table.Cell>
          <Table.Cell>{getGrade(oier)}</Table.Cell>
          {!isMobile && <Table.Cell>{oier.oierdb_score.toFixed(2)}</Table.Cell>}
          <Table.Cell>{oier.ccf_level}</Table.Cell>
        </>
      )}
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
        onOpen={() =>
          trackMultiDomainPageview({
            url: new URL(
              `/oier/${oier.uid}`,
              window.location.origin
            ).toString(),
          })
        }
        size="large"
      >
        <Modal.Header>
          {oier.name}
          <Link className={styles.link} to={'/oier/' + oier.uid}>
            <Icon name="linkify" />
          </Link>
        </Modal.Header>
        <Modal.Content>
          <PersonInfo oier={oier} />
        </Modal.Content>
      </Modal>
    </>
  );
};

export default memo(PersonCard);

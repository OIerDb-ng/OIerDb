import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Table, Modal, Icon } from 'semantic-ui-react';
import PersonInfo from '@/components/PersonInfo';
import getGrade from '@/utils/getGrade';
import type { OIer } from '@/libs/OIerDb';
import { trackMultiDomainPageview } from '@/libs/plausible';
import styles from './PersonCard.module.less';

interface PersonCardProps {
  oier: OIer;
  trigger?: JSX.Element;
}

const PersonCard: React.FC<PersonCardProps> = (props) => {
  const { oier } = props;

  const trigger = (
    <Table.Row className={styles.row}>
      {props.trigger || (
        <>
          <Table.Cell>{oier.rank + 1}</Table.Cell>
          <Table.Cell>{oier.name}</Table.Cell>
          <Table.Cell>{oier.provinces.join('/')}</Table.Cell>
          <Table.Cell>{getGrade(oier)}</Table.Cell>
          <Table.Cell>{oier.oierdb_score.toFixed(2)}</Table.Cell>
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

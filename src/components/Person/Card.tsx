import { Link } from 'react-router-dom';

// Components
import { Table, Modal, Icon } from 'semantic-ui-react';
import { Person } from '@/components/Person';

// Styles
import styles from './Card.module.less';

// Libs
import type { OIer } from '@/libs/OIerDb';

// Utils
import getGrade from '@/utils/getGrade';

interface PersonCardProps {
  oier: OIer;
  trigger?: JSX.Element;
}

export const PersonCard: React.FC<PersonCardProps> = (props) => {
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
        size="large"
      >
        <Modal.Header>
          {oier.name}
          <Link className={styles.link} to={'/oier/' + oier.uid}>
            <Icon name="linkify" />
          </Link>
        </Modal.Header>
        <Modal.Content>
          <Person oier={oier} />
        </Modal.Content>
      </Modal>
    </>
  );
};

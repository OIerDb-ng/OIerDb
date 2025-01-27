import { Icon, Popup } from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import styles from './FilterIcon.module.less';

const FilterIcon = () => {
  return (
    <Popup
      content="自定义搜索"
      trigger={
        <Link to="/filter" className={styles.link}>
          <Icon name="code" link style={{ cursor: 'pointer' }} />
        </Link>
      }
      position="top center"
    />
  );
};

export default FilterIcon;

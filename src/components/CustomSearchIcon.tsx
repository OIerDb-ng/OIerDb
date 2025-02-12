import { Icon, Popup } from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import styles from './CustomSearchIcon.module.less';

const CustomSearchIcon = () => {
  return (
    <Popup
      content="自定义搜索"
      trigger={
        <Link to="/custom-search" className={styles.link}>
          <Icon name="code" link style={{ cursor: 'pointer' }} />
        </Link>
      }
      position="top center"
    />
  );
};

export default CustomSearchIcon;

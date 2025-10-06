import React, { memo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Icon, Message } from 'semantic-ui-react';

const NotFound: React.FC = () => (
  <Message icon error>
    <Helmet>
      <title>404</title>
    </Helmet>

    <Icon name="remove" />
    <Message.Content>
      <Message.Header>404</Message.Header>
      未找到请求的页面。
      <Link to="/">返回首页</Link>
    </Message.Content>
  </Message>
);

export default memo(NotFound);

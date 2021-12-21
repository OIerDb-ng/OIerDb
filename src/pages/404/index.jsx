// Components
import { Message, Icon } from 'semantic-ui-react';

export default () => (
    <>
        <Message icon error>
            <Icon name="remove" />
            <Message.Content>
                <Message.Header>404</Message.Header>
                未找到请求的页面。
            </Message.Content>
        </Message>
    </>
);

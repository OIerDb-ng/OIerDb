import React from 'react';
import { Header, Message, Icon } from 'semantic-ui-react';

export const ErrorWhenLoadingOIerDb: React.FC = () => {
  return (
    <Message
      error
      icon="remove"
      header="初始化 OIerDb 时出现了错误，请打开控制台以获取详细信息。"
      content={
        <a
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
          href="#"
          style={{ display: 'inline-block', marginTop: 4 }}
        >
          刷新本地缓存
        </a>
      }
    />
  );
};

export const NotSupportIndexedDB: React.FC = () => {
  return (
    <>
      <Header as="h3" dividing>
        请更新浏览器
      </Header>
      <div>
        <Message error>
          <Icon name="remove" />
          您的浏览器不支持 <code>indexedDB</code>。
        </Message>
        <p>
          推荐使用最新版的{' '}
          <a
            href="https://www.google.cn/chrome/"
            target="_blank"
            rel="noreferrer"
          >
            Google Chrome 浏览器
          </a>{' '}
          访问 OIerDb NG。
        </p>
      </div>
    </>
  );
};

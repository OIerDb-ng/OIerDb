import React, { memo } from 'react';
import { Header, Segment } from 'semantic-ui-react';
import styles from './FAQ.module.less';

const FAQ: React.FC = () => {
  return (
    <>
      <Header
        className={styles.header}
        block
        as="h4"
        content="常见问题"
        attached="top"
        icon="info"
      />
      <Segment attached="bottom">
        <h5>这是什么网站？</h5>
        <p>
          这是 <b>OIerDb LexRank</b>——一个 <b>本地构建的二次开发版本</b>，用来查看「分层优先排名」的效果。
          数据来自开源项目 OIerDb，排名算法经过改写，因此这里的名次与
          <a href="https://oier.baoshuo.dev" target="_blank" rel="noreferrer noopener">
            官方站点
          </a>
          并不一致。
        </p>
        <p>
          本站不是官方站点，也不代表上游作者的观点或背书。配色经过调整，便于与官方站点区分。
        </p>

        <h5>排名是怎么算的？</h5>
        <p>排序键是严格的字典序：</p>
        <ol>
          <li>
            <b>先看参加过的最高赛事层级</b>：IOI（9）＞ NOI / CTSC / APIO（8）＞ WC（7）＞
            NOI 夏令营（6）＞ 女生赛 / 春季测试 / AI（5）＞ NOIP（2020 年起，3）＞
            NOIP 提高组（2020 年前）/ CSP-S（2）＞ NOIP 普及组 / CSP-J（1）。
          </li>
          <li>
            <b>层级相同，再看该层级上取得的最高奖项</b>：金牌 ＞ 银牌 ＞ 铜牌 ＞
            一等奖 ＞ 二等奖 ＞ 三等奖。
          </li>
          <li>
            <b>两者都相同，才比较其余成绩</b>：每个赛种每年只取最好一条，按场内百分位加权后
            以 1、1/2、1/4…… 递减累加，取值区间 [0,1)，因此永远压不过前两项。
          </li>
        </ol>
        <p>
          与官方站点的「累加评分」不同：这里不会因为多参加几场低级别比赛而无限加分，
          也不按年份做复利折现（官方模型是 <code>1.25^(年份-2000)</code>）。
          这是两种不同的取向——官方模型更像「历史累积贡献」，本站更像「最高成就」。
        </p>

        <h5>为什么 IOI 排在 NOI 前面？</h5>
        <p>
          因为 IOI 是 NOI 的严格上位：要先在 NOI 中进入国家集训队、再经 CTSC 选拔进入国家队，
          才有资格参加 IOI。因此只要进过 IOI，其最高赛事层级一定不低于任何 NOI 选手。
        </p>

        <h5>数据从哪里来？</h5>
        <p>
          原始获奖数据、学校表与解析器均来自上游开源项目 OIerDb（作者 Baoshuo，AGPL-3.0）。
          本站只是重新生成并改写了排名部分，数据本身未做修改。
        </p>
        <p>
          一个特殊处理：NGOI 的处理按年份区分。NGOI2022、NGOI2023 作为独立赛事计入；
          从与 NOIP 同卷开始，同一人有对应 NOIP 记录时不重复计分，没有对应 NOIP 记录时只
          给一个极小补分，避免把派生排名当成完整的独立赛事成绩。
        </p>

        <h5>我能够做什么？</h5>
        <p>
          可以按姓名、姓名首字母缩写、省份、年级和学校查询选手的获奖记录；
          在「选手」页可以按层级筛选、翻页查看完整榜单，点进个人页能看到全部记录。
        </p>

        <h5>许可与署名</h5>
        <p>
          本项目基于 OIerDb（作者 Baoshuo）二次开发，依
          {' '}
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noreferrer noopener"
          >
            GNU AGPL-3.0
          </a>
          {' '}
          许可发布；修改后的完整源代码在{' '}
          <a
            href="https://github.com/xiangyanhao/OIerDb-LexRank"
            target="_blank"
            rel="noopener noreferrer"
          >
            xiangyanhao/OIerDb-LexRank
          </a>
          。排名机制由 Yanhao Xiang 于 2026-11-10 二次开发。
        </p>
        <p>
          上游项目地址：
          {' '}
          <a
            href="https://github.com/OIerDb-ng/OIerDb"
            target="_blank"
            rel="noopener noreferrer"
          >
            OIerDb-ng/OIerDb
          </a>
          。如需查看未修改的排名与完整社区信息，请访问官方站点。
        </p>
      </Segment>
    </>
  );
};

export default memo(FAQ);

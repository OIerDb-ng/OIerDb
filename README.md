<h1 align="center">OIerDb <span style="color:#0f766e">LexRank</span></h1>

> OIerDb 的分层优先排名（LexRank）二次开发版本。

原项目 OIerDb 可以通过 [oier.baoshuo.dev](https://oier.baoshuo.dev) 在线使用。

> **问题反馈范围**
>
> 本仓库只负责 LexRank 排名以及 fork 自身的代码和页面展示。选手、学校和比赛数据的
> 错误（包括选手信息合并、拆分、学校归并等）由上游 OIerDb 负责处理，请前往
> [上游仓库](https://github.com/OIerDb-ng/OIerDb) 提交 Issue；请勿在本 fork 提交此类问题。

## 本仓库：OIerDb LexRank

本仓库在 OIerDb 的基础上，把「累加评分」改成**分层优先排名**：先比最高赛事层级，
再比该层级上的最高奖项，两者都相同才比较其余成绩。

- **数据与合并流程完全沿用上游**：`data/raw.txt`、`data/school.txt`、选手/学校合并逻辑
  均未改动。重新抓取数据有两个入口：
  - `python scripts/sync-upstream-data.py`：把 `data/` 对齐到上游最新版本（带回滚备份）；
  - `.agents/skills/add-contest`：按官方公示手动追加一场新比赛。
- 排名机制说明：[`generator/RANKING.md`](./generator/RANKING.md)；规则表：`data/ranking.json`。
- 本地一键预览：`start-local.cmd`（`--regen` 重新生成，`--refresh` 先同步上游数据）。

### GitHub Pages 部署

仓库的 `deploy` workflow 会在 `master` 推送时生成 LexRank 数据并发布静态站点。
首次使用时，请在仓库 Settings → Pages → Build and deployment 中将 Source 设为
**GitHub Actions**。项目站点地址通常为：
`https://xiangyanhao.github.io/OIerDb-LexRank/`。

如需不经过本地环境、只从上游同步选手和比赛数据，请在 Actions 中手动运行
`Sync upstream data` workflow。它只更新 `data/` 中的上游数据文件，发现变化后会
自动提交并重新触发 Pages 部署，不会修改 `data/ranking.json` 或 LexRank 代码。

本项目依原项目的 AGPL-3.0 发布，作者信息与修改署名见 `generator/RANKING.md`。

## 开源许可

本项目基于 [AGPL-3.0](./LICENSE) 许可协议开源。

根据许可协议，您在自行部署本项目时，需要保留代码和页面中的作者信息。如果对本项目做出了修改，您需要以相同的许可证公开自部署版本的源代码。此外，您不得在自部署版本中使用本项目的名称、商标或徽标。

## Author

**OIerDb** © [Baoshuo](https://github.com/renbaoshuo), Released under the [AGPL-3.0](./LICENSE) License.<br>
Authored and maintained by Baoshuo with help from [contributors](https://github.com/renbaoshuo/OIerDb/contributors).

> [Personal Website](https://baoshuo.ren) · [Blog](https://blog.baoshuo.ren) · GitHub [@renbaoshuo](https://github.com/renbaoshuo) · Twitter [@renbaoshuo](https://twitter.com/renbaoshuo)

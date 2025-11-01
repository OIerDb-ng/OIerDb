<p align="center"><img src="apps/frontend-legacy/public/logo.png"></p>

<h1 align="center">OIerDb</h1>

> OIerDb 是中国信息学竞赛选手的一个数据库。<br /><small>OIerDb is a database for Chinese OI participants.</small>

[🚧 **正在进行中**] 此仓库是 OIerDb 的新一代 Monorepo 仓库，包含前端、后端和数据生成器等多个子项目。

## 项目结构

- `apps` - 包含前端和后端应用
  - `frontend-legacy` - 旧版前端（正在迁移中）
  - `frontend` - 新版前端（正在开发中）
  - `backend` - 后端 API 服务
- `packages` - 共享的工具库和类型定义
- `scripts` - 各种脚本和工具
- `data` - 数据文件
- `generator` - 数据生成器

## 数据生成

需要计算机上已经安装 Python 3.13 和 Node.js 以及 Yarn。

```bash
yarn install:generator # 初始化 Python Virtual Environment; 安装依赖
yarn generate # 生成数据，结果保存在 `generator/dist` 目录下
```

## 开源许可

本项目基于 [AGPL-3.0](./LICENSE) 许可协议开源。

根据许可协议，您在自行部署本项目时，需要保留代码和页面中的作者信息。如果对本项目做出了修改，您需要以相同的许可证公开自部署版本的源代码。

## Author

**OIerDb** © [Baoshuo](https://github.com/renbaoshuo), Released under the [AGPL-3.0](./LICENSE) License.<br>
Authored and maintained by Baoshuo with help from [contributors](https://github.com/renbaoshuo/OIerDb/contributors).

> [Personal Website](https://baoshuo.ren) · [Blog](https://blog.baoshuo.ren) · GitHub [@renbaoshuo](https://github.com/renbaoshuo)

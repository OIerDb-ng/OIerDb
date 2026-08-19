# 合并 CI 为单一 workflow，按正确顺序部署

## 背景

- 现状：`data.yml`（generator 数据）与 `frontend-legacy.yml`（前端）是两个互不感知的 workflow，各自 `build` 后立即部署，且 `data.yml` 内部的服务器部署与第三方源（GitHub Pages / cdn-sb CDN）部署是并行的。
- 前端运行时从 `oier.api.baoshuo.dev`（服务器）和 CDN 拉取数据（`apps/frontend-legacy/src/libs/OIerDb.ts:96-103`），因此必须：先完成两个构建 → 再完成第三方源部署 → 最后部署服务器。

## 变更

**删除** `.github/workflows/data.yml` 和 `.github/workflows/frontend-legacy.yml`，**新建** `.github/workflows/deploy.yml`：

### 触发条件
- `push` / `pull_request` 到 `master`，paths 为原两个 workflow 的并集（`generator/**`、`data/**`、`package.json`、`yarn.lock`、`apps/frontend-legacy/**`、`.github/workflows/deploy.yml`）
- `workflow_dispatch`
- 新增 `concurrency`（group 按分支、`cancel-in-progress: true`），避免连续 push 时两次部署交叉执行破坏顺序

### Job 依赖图

```
build-data ──┬── deploy-pages（第三方：GitHub Pages）──┐
             └── sync-cdn（第三方：cdn-sb 仓库）──────┼── deploy-server
build-frontend ──────────────────────────────────────┘
```

### 各 Job（内容基本沿用现有步骤，仅重组结构）

1. **build-data**：原 `data.yml` 的 build（Python 生成数据、按 sha512 重命名文件、上传 artifact `data-dist`）
2. **build-frontend**：原 `frontend-legacy.yml` 的 build（yarn install、`yarn workspace frontend-legacy build`、上传 artifact `frontend-legacy-dist`），与 build-data 并行
3. **deploy-pages**：`needs: build-data`，GitHub Pages 部署（peaceiris/actions-gh-pages@v4.1.0）
4. **sync-cdn**：`needs: build-data`，同步到 `renbaoshuo/cdn-sb`（步骤原样保留）
5. **deploy-server**：`needs: [build-data, build-frontend, deploy-pages, sync-cdn]` —— 等待两个构建和两个第三方源部署全部成功后：
   - 下载 `data-dist` 和 `frontend-legacy-dist` 两个 artifact
   - 先 rsync 数据到 `REMOTE_PATH_2`，再 rsync 前端到 `REMOTE_PATH`（数据先于前端上线）

### 门控条件统一
所有部署类 job（deploy-pages / sync-cdn / deploy-server）统一为 `if: (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.repository == 'OIerDb-ng/OIerDb'`（PR 只构建不部署，行为不变；原来 data.yml 的服务器部署不支持 workflow_dispatch，统一后支持手动全量重部署）。

## 验证
- 用 `actionlint`（如已安装）或 Python `yaml.safe_load` 校验新 YAML 语法
- 人工核对 job `needs` 图与 secrets 引用（`REMOTE_HOST`、`REMOTE_USER`、`SSH_PRIVATE_KEY`、`REMOTE_PATH`、`REMOTE_PATH_2`、`GH_TOKEN_CDN_SB`）与原文件一致

## 说明
- 合并后，只要任一侧路径变更触发，两个 build 都会执行（deploy-server 需要 deploy-server 需要 deploy-server 需要 deploy-server 需要两个 artifact 都存在）；这正好符合「generator 和 frontend-legacy 都执行完」的要求
- 不修改任何构建/生成逻辑本身，只重组 CI 结构
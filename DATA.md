# 数据与重新抓取（OIerDb LexRank）

本仓库的定位是：**原始数据、学校/选手合并流程完全沿用上游 OIerDb，只改写排名**。
所以数据更新有两条路——同步上游，或按官方公示手动追加一场比赛。

> **数据问题请提交到上游**
>
> 本仓库不负责处理选手或学校信息问题，包括选手信息的错误合并、错误拆分、姓名、
> 年级、学校、地区等错误。请在 [OIerDb-ng/OIerDb](https://github.com/OIerDb-ng/OIerDb)
> 提交 Issue；本 fork 不会独立维护这些数据纠错。

## 一、数据从哪来

| 文件 | 内容 | 来源 |
|---|---|---|
| `data/raw.txt` | 全部获奖记录（每行 9 字段） | 上游仓库 |
| `data/school.txt` | 学校与别名（`省份,城市,正式名,别名...`） | 上游仓库 |
| `data/contests.json` | 每场比赛的元信息（名称/类型/年份/容量） | 上游仓库 |
| `data/grades.json`、`surnames.json`、`name_exceptions.json` | 年级、姓氏、拼音例外 | 上游仓库 |
| `data/scoring.json` | 旧累加模型的赛种系数 | 上游仓库 |
| `data/ranking.json` | **本仓库新增**：分层优先排名的层级表与权重 | 本地维护，不参与同步 |

合并逻辑（`generator/record.py` 的 `distance()`、`generator/main.py` 的 `attempt_merge()`）
与学校解析（`generator/school.py`）均未改动。

## 二、入口一：同步上游数据（推荐）

```bash
python scripts/sync-upstream-data.py --check   # 只看差异
python scripts/sync-upstream-data.py           # 备份并覆盖
```

- 从 `https://raw.githubusercontent.com/OIerDb-ng/OIerDb/master/data/` 拉取上表前 7 个文件。
- 只覆盖有差异的文件，旧文件备份到 `data/.backup/<时间戳>/`，可随时回滚。
- 结束后校验：`raw.txt` 有效记录数、9 字段格式、`contests.json` 可解析、`school.txt` 行数。
- `data/ranking.json` 在同步范围内**不存在**，不会被覆盖。

## 三、入口二：手动追加一场比赛

官方每年公布新的获奖名单，流程见 `.agents/skills/add-contest/SKILL.md`。命令行起步：

```bat
scripts\add-contest.cmd "C:\path\to\官方公示.html" [out.csv]
```

这一步只负责把「Excel 发布为网页」的 HTML 转成 CSV。后续步骤（脚本无法替你判断）：

1. 按奖项等级把 CSV 切开（`grep -n` 找边界，`sed -n 'a,bp'` 抽取）；
2. 按 `比赛名,奖项,姓名,年级,学校,分数,省份,性别,标识符` 追加到 `data/raw.txt` **末尾**；
3. 在 `data/contests.json` **末尾**追加该场比赛的条目；
4. 跑 `python generator/main.py --export-unknown-schools`，把
   `generator/dist/unknown-schools.txt` 里的学校逐个并入 `data/school.txt`（别名或新建），
   直到该文件为空；
5. 重新生成。

## 四、入口三：重新生成

```bash
cd generator
python main.py --lex-rank          # 分层优先排名
python main.py                     # 原版累加评分（对照用）
```

或直接：

```bat
start-local.cmd --regen      :: 用现有 data/ 重新生成并启动预览
start-local.cmd --refresh    :: 先同步上游 data/，再生成并启动预览
```

> 如果移动或重命名了仓库目录，直接再跑一次 `start-local.cmd` 即可：脚本会检测到
> `node_modules\@oierdb\*` 的 workspace 链接失效并自动重建（仅在那时才需要重装依赖）。

## 五、更新后的自检

| 检查项 | 期望 |
|---|---|
| `generator/dist/result.txt` 行数 | 与 `data/raw.txt` 的有效记录去重后的人数一致（当前 125,964） |
| `generator/dist/unknown-schools.txt` | 为空 |
| `python generator/rank_check.py` | 四条排序不变量全部 OK |
| `generator/dist/rank_preview.md` 的「派生赛事判定」 | NGOI 与上一年 NOIP 分数一致的场次被标为「排除」 |
| 前端 `/oiers` 首行 | 与 `result.txt` 第一行一致 |

## 六、已知的数据边界

- `raw.txt` 里存在报名渠道串（`个人报名`、培训机构等），它们被当作学校对象参与合并；
  这部分属于上游数据问题，本仓库**未修改**，只在排名侧不做特殊处理。
- NGOI 是「当年 NOIP 成绩在女选手中的排名」；与 NOIP 同卷后，有对应 NOIP 的记录不重复计分，
  没有对应 NOIP 的记录只获得极小补分（规则见 `generator/RANKING.md`）。

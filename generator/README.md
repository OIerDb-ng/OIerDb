# OIerDb Data Generator

本目录中的代码迁移自 [OIerDb-ng/OIerDb-data-generator](https://github.com/OIerDb-ng/OIerDb-data-generator) 仓库。

## 使用

请先安装 Python3，然后安装依赖：

```bash
pip install -r requirements.txt
```

生成数据（在 `generator` 目录下执行，或在仓库根目录运行 `npm run generate`）：

```bash
python main.py
```

生成好的数据会存储在 `dist` 目录下。

## 姓名异体合并

同一个人在不同数据源里可能被写成繁体、简体或异体字，例如「徐維昆」与「徐维昆」。按姓名
合并之后，`main.py` 会把简体形式相同的姓名放到一起，用同一套 `Record.distance()` 规则再合并
一次，并要求两个记录组在同一省份出现过——港澳名单用繁体，跨省份的繁简同名多为不同的人。
合并后的姓名取最后一次获奖记录里的写法。

繁简对照表在 `generator/t2s.json`（来自 [OpenCC](https://github.com/BYVoid/OpenCC)，Apache-2.0），
可用 `python tools/gen_t2s.py <TSCharacters.txt>` 重新生成。它只供生成器使用，所以没放在
`data/`：那里的 `*.json` 会被 `update_static.py` 打包进下发给前端的 `dist/static.json`。

`python main.py --show-name-merges` 打印每个候选写法的判定距离，`python tools/test_name_merge.py`
是该功能的回归测试。若两种写法确实是同一个人而距离规则没有合并（例如三易学校导致距离过大），
给两处记录填相同的标识符即可强制合并，见 [.agents/skills/merge-oier](../.agents/skills/merge-oier/SKILL.md)。

## Author

**OIerDb Data Generator** © [Baoshuo](https://github.com/renbaoshuo), Released under the [AGPL-3.0](./LICENSE) License.<br>
Authored and maintained by Baoshuo with help from [OIerDb-ng/OIer](https://github.com/OIerDb-ng/OIer) and [contributors](https://github.com/OIerDb-ng/OIerDb/contributors).

> [Personal Website](https://baoshuo.ren) · [Blog](https://blog.baoshuo.ren) · GitHub [@renbaoshuo](https://github.com/renbaoshuo) · Twitter [@renbaoshuo](https://twitter.com/renbaoshuo)

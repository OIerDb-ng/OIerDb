---
name: add-contest
description: Append a newly-published competition's award list into this repo
---

# Add Contest Data

This repo's entire dataset is derived from `data/raw.txt` (one record per line), `data/contests.json`,
and the school directory `data/school.txt`. Adding a contest means turning an official award-list
export into correctly-formatted lines added to these files. The individual commands are simple;
what makes this error-prone is a couple of hard constraints that are easy to violate silently:

- **All three files are append-only, for the same underlying reason.** `data/raw.txt`'s header
  says so explicitly (inserting or reordering lines scrambles every downstream OIer ID), and
  `generator/contest.py`/`generator/school.py` show why `data/contests.json` and `data/school.txt` are no different:
  `Contest` and `School` each assign `self.id` from their position at parse time (`idx =
  Contest.count_all()` / `School.count_all()`). Splice a new contest into the middle of the
  `contests.json` array, or a new *line* into the middle of `data/school.txt`, and every entry
  after it silently gets a different ID than it had before. So: new contest objects always go at
  the very end of the `contests.json` array (never re-sorted into "proper" chronological position
  among existing entries), and brand-new schools always go as a new line at the very end of
  `data/school.txt` — never inserted, moved, or deleted.
  - The one thing this does *not* forbid: editing the *contents* of an existing `school.txt` line
    in place (appending an alias, fixing a typo, correcting its city) wherever that line happens to
    be in the file. That changes what's on the line, not how many lines come before it, so no ID
    shifts — this is exactly what Step 9 below does when it merges an unknown name into an existing
    school as an alias.
- **Score must be monotonically non-increasing within a contest**, matching the order contestants
  were added. `generator/contest.py` compares each new record's score against the previous one *in the order
  you append them* and prints a warning (not an error — it won't stop you) the moment it goes up.
  So a contest's block in `raw.txt` must be sorted by score, descending, before you append it.

Everything below exists to get a correctly-shaped, correctly-sorted block of lines ready, then
append it once and validate it.

**Precondition:** activate the project's virtualenv before running any `python3` command —
`source generator/.venv/bin/activate`.

## Step 1 — Convert the HTML export to CSV

```bash
python3 generator/tools/excel_html_to_csv.py "<输入文件.html>" "<workfile>.csv"
```

Put the output somewhere scratch (e.g. `generator/dist/` or your scratchpad dir), not directly
into `data/`. Give it a name you'll recognize later — you'll be creating several intermediate files
before anything reaches `raw.txt`.

Immediately after conversion, strip carriage returns — the CSV module this tool uses writes `\r\n`
line endings, while every file in this repo (`data/raw.txt`, `data/school.txt`) uses plain `\n`.
Mixed line endings will make `sed` line-ranges and `$`-anchored regexes behave unpredictably later,
and would leave stray `\r` bytes committed into `raw.txt` if not caught now:

```bash
tr -d '\r' < "<workfile>.csv" > "<workfile>.lf.csv"
```

**Check for wrapped cells before trusting line numbers.** Excel's `发布为网页` export sometimes puts
a `<br>` inside a long cell (typically a school name), which this tool turns into a literal
newline — so one logical record can span two physical lines in the CSV, e.g.:

```
CCF-NOIP2025-1378,YN-0009,云南,田昀可,女,136,"红河哈尼族彝族
 自治州第一中学",高一,范春节
```

This has actually happened before in this exact repo. Award-list tables usually state a count per
tier right in the source (e.g. a banner row reading "金牌54名" before the gold-medal block) — use
that as a checksum: if the line range you're about to extract for a tier doesn't have exactly that
many rows, look for a wrapped cell splitting one record into two lines and rejoin it (delete the
embedded newline) before proceeding.

## Step 2 — Split by award level, using `sed` only

Read (or `grep -n`) the CSV to find the exact line ranges for each award tier (banner/header rows,
if any, tell you where each tier starts and end). Extract each tier with `sed -n`, piping straight
into its own file — do not use a general-purpose script or editor for this, since the goal is an
auditable, exact line-range cut you can double check against the source's stated counts:

```bash
sed -n '4,57p'   "<workfile>.lf.csv" > "<workdir>/gold.csv"
sed -n '60,205p' "<workfile>.lf.csv" > "<workdir>/silver.csv"
sed -n '208,290p' "<workfile>.lf.csv" > "<workdir>/bronze.csv"
```

Each resulting file must contain **only award-record rows** — no header row, no banner row, no
trailing blank line. If a header row repeats mid-range (some exports re-print the column header
after a page break), pipe through a second `sed` to drop it, e.g. `sed -n '...' file | sed '/^证书编号,/d'`.

## Step 3 — Register the contest in `data/contests.json`

Find the most similar past contest (same short name prefix — `NOIP`, `CSP提高`, `NOI`, `NOI...夏令营`,
`APIO`, `WC`, etc.) and use it as a template. The fields are:

- `name` — the contest's unique identifier as it will appear in `raw.txt`'s first column, e.g.
  `NOIP2025`, `CSP2025提高`, `NOI2026`, `NOI2026夏令营`. Follow the exact naming pattern of same-series
  past entries (year placement, whether 提高/入门/夏令营 is appended, etc.).
- `type` — the scoring category. This is **not** always the same as the year-specific `name` — e.g.
  `CSP2025提高`'s type is `CSP提高`, and any `*夏令营` contest's type is `NOID类`. Every `type` value
  must already exist in `data/scoring.json` (it defines that type's scoring coefficient); if the
  contest is a genuinely new series with no matching type there, flag this to the user explicitly —
  registering the contest here is not enough, `scoring.json` needs a new entry too and that's outside
  this skill's scope.
- `year` — the contest's year (int).
- `full_score` — the maximum possible score. Cross-check against the actual score column you're
  about to extract in Step 4, not just last year's value (full scores do change between years).
- `fall_semester` — whether this contest is held in the fall semester (`true` for CSP/NOIP-style
  contests held in autumn; `false` for NOI/IOI/APIO/WC/CTSC-style contests held in summer). Check
  a same-series past entry.
- `capacity` (optional) — some contest types include it (IOI's team size, CSP/NOIP's total
  registered count), others never do (WC, APIO, CTSC, NOI itself omit it). Only include it if
  same-series past entries do, and only if you actually know the value (don't guess).

Before writing the entry, use `AskUserQuestion` to show the exact object you're about to add and
let the user confirm or correct it — these fields are hard to fix later since `raw.txt`'s first
column must match `name` exactly. Add the new object at the very end of the array — never insert it
earlier to keep things in neat chronological order (see the append-only note above for why: an
entry's position is its ID, so anything after an inserted entry would silently be renumbered).

## Step 4 — Normalize each split CSV into the target format

Target format (9 comma-separated columns, `标识符` left blank but the trailing comma must stay so
the column count is exactly 9 — `generator/main.py` requires exactly 9 fields per line and will reject the
whole line otherwise):

```
比赛名称,奖项,姓名,年级,学校,分数,省份,性别,标识符
```

Example:
```
CSP2022提高,一等奖,任宝硕,高二,石家庄二中实验学校,215,河北,男,
```

Before you can write the regex, you need the **source column order**, which you saw in the header
row before splitting (Step 2 discards that header row, so note the order down first). Source
exports are rarely already in this order or column count — e.g. a real NOI export's columns were
`证书编号,姓名,省份,性别,学校(全称),年级,实际总分,加5分,总分,集训队,指导教师` (11 columns, and note there
were *two* score-like columns — always double check which one is the final/official score that
matches the `full_score` you set in Step 3, not a pre-bonus subtotal).

Use `([^,]),` to capture one plain cell (this assumes no cell in this split file contains an
embedded comma — if the source tool had to quote a field because it contained a comma, that row's
quotes will still be visible in the file; handle those rows by hand rather than forcing the regex
over them). Build a capture-group substitution matching the source's column count, and re-emit only
the columns you need, in target order, with the tier's award-level and the contest name filled in
literally (they're constant for the whole file — that's exactly why Step 2 split by tier first):

```bash
sed -E 's/^([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*)$/NOI2026,金牌,\2,\6,\5,\9,\3,\4,/' \
  "<workdir>/gold.csv" > "<workdir>/gold.normalized.csv"
```

(here `\2`=姓名, `\6`=年级, `\5`=学校, `\9`=总分, `\3`=省份, `\4`=性别 — matched to that specific source's
column order; work out your own mapping from whatever header you actually saw).

While normalizing, also check:
- **省份** must exactly match one of the strings in `generator/util.py`'s `provinces` list (no `省`/`市`/`自治区`
  suffix — e.g. `河北`, not `河北省`; `内蒙古`, not `内蒙古自治区`).
- **性别** should end up as a bare `男`/`女` (or blank if unknown/not provided).
- **奖项** must be one of `generator/util.py`'s `award_levels` (`金牌`/`银牌`/`铜牌`/`一等奖`/`二等奖`/`三等奖`/
  `国际金牌`/`国际银牌`/`国际铜牌`/`前5%`/`前15%`/`前25%`).

## Step 5 — Merge the normalized files

```bash
cat "<workdir>/gold.normalized.csv" "<workdir>/silver.normalized.csv" "<workdir>/bronze.normalized.csv" \
  > "<workdir>/merged.csv"
```

## Step 6 — Sort by score, descending

This is what satisfies `generator/contest.py`'s monotonicity check from the intro. Field 6 is 分数:

```bash
sort -t',' -k6,6 -rn -s -o "<workdir>/merged.sorted.csv" "<workdir>/merged.csv"
```

(`-s` keeps the sort stable so ties don't get needlessly shuffled; `-k6,6` limits the sort key to
exactly that field, since without the second `,6` sort would sort by field 6 *through end of line*).

## Step 7 — Append to `data/raw.txt`

Sanity-check row count first — the merged/sorted file's line count should equal the sum of the
per-tier counts from Step 2/1 (and thus the contest's total contestant count from the source):

```bash
wc -l "<workdir>/merged.sorted.csv"
```

Confirm `data/raw.txt` currently ends with a newline (so the first appended line doesn't get glued
onto the last existing line) — `tail -c1 data/raw.txt | xxd` should show `0a`. Then append:

```bash
cat "<workdir>/merged.sorted.csv" >> data/raw.txt
```

Repeat Steps 1–7 for each additional contest file the user gave you (e.g. a main contest plus a
companion 夏令营/入门 list are two separate contests, each with its own `contests.json` entry and its
own pipeline) before moving on — do the school-validation pass below once, across everything you
just appended.

## Step 8 — Find schools this data references that aren't in the database yet

`main.py` resolves its own relative paths (`../data/...`, `dist/...`) against its own directory, so
it must actually be run from inside `generator/`:

```bash
(cd generator && python3 main.py --export-unknown-schools) > /tmp/main-run.log 2>&1
```

This does a full parse/validate/analyze pass over the *entire* `raw.txt` (hundreds of thousands of
lines) and is slow with a lot of progress-bar output — always redirect to a log file rather than
letting it stream into context, and read the log only if something looks wrong (e.g. via `grep -i
warning`or `grep -i error` on the log). The actual deliverable is `generator/dist/unknown-schools.txt`, one
`省份,学校名` pair per line for every school referenced in `raw.txt` that couldn't be matched (by exact
name within its province, then by exact name globally) against `data/school.txt`.

## Step 9 — Resolve each unknown school

For every line in `generator/dist/unknown-schools.txt`, you're deciding one of two things: this is an existing
school in `data/school.txt` under a different name/alias (merge), or it's genuinely not in the
database yet (create).

Spawn subagents to research these in parallel — reading `data/school.txt` for candidates, applying
the `merge-school` skill's matching approach, and searching the web to confirm identity/location
when the name alone is ambiguous (school names are frequently abbreviated, reordered, or missing
their city prefix). Have each subagent *report back a recommendation* rather than edit
`data/school.txt` directly — several agents editing the same file concurrently risks one
overwriting another's change. Batch a handful of schools per subagent rather than one-per-agent if
the list is long, to keep the number of parallel agents reasonable.

Then apply the recommendations yourself, one at a time:

- **Match found** — append the unknown name as a new alias on that existing line (same technique as
  `merge-school`'s Step 4a: append `,<new alias>` to the end of the matched line). Don't invalidate
  anything — there's no duplicate entry to merge away here, just a name variant to record.
- **No confident match** — append a brand-new line at the end of `data/school.txt`:
  `省份,城市,学校名` (e.g. `河北,石家庄市,石家庄市第二中学`). For the four municipalities (北京/上海/
  天津/重庆), the second field is the district/county, not the city name again (e.g.
  `上海,虹口区,上海外国语大学附属外国语学校东校`). Province must match `generator/util.py`'s `provinces` list
  exactly. Look up the correct city/district on the web — never guess or fabricate one; if it truly
  can't be found, use `未分区` as a placeholder. The school name must be copied verbatim from
  `generator/dist/unknown-schools.txt`, including full-width vs half-width punctuation — a mismatched
  parenthesis or comma character is enough for the next validation pass to still call it unknown.

## Step 10 — Re-validate

```bash
(cd generator && python3 main.py --export-unknown-schools) > /tmp/main-run.log 2>&1
```

Check `generator/dist/unknown-schools.txt` again. Empty means done. If it's not empty, check first whether
it's shrunk (partial progress, keep resolving) or is unchanged (a Step 9 edit likely didn't
actually match — re-check exact spelling/punctuation, and confirm you edited the right line if
`data/school.txt` has multiple similarly-named schools).

## Step 11 — Summary

Report back to the user: final contest name(s)/type/year added, how many award records were
appended for each, the paths of the intermediate files you created (in case they want to inspect
them), and how many schools were merged as aliases vs. newly created.

## Optional: commit

If the user wants the changes committed, follow the same convention as the `merge-school` skill:
propose a message like `add: {contest name}`, and confirm with the user before committing.

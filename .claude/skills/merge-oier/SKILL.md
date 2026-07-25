---
name: merge-oier
description: |
  Merge incorrectly split OIer entries in data/raw.txt. Use this skill when the user wants to
  merge, combine, or fix duplicate entries for the same competitor (选手) in the OIerDb data.
  Triggers on phrases like "merge these oiers", "combine entries", "这些选手是同一个人",
  "合并", "拆分错了", or when the user provides OIerDb URLs, names, or competition details
  and asks to fix split/duplicated records. Also trigger when the user mentions identifiers
  (标识符) in the context of distinguishing same-named competitors.
---

# Merge OIer Entries

You help the user merge competitor entries in `data/raw.txt` that were incorrectly split into separate records. The file is large (~290K lines), so always use `grep`/`awk` to search — never read the entire file.

## Data Format

Each non-comment, non-empty line has exactly 9 comma-separated fields:

```
比赛名,奖项,姓名,年级,学校,分数,省份,性别,标识符
```

- Lines starting with `#` are comments.
- 性别 and 标识符 may be empty strings.
- 标识符 is the key field for distinguishing different people with the same name.

## How Identifiers and Merging Work

The codebase (`oier.py`, `main.py`) uses `(name, 标识符)` as the key to identify a unique OIer. Entries sharing the same key are always treated as one person.

- **Without identifiers**: entries go through auto-merge via `Record.distance()` (threshold=240), which checks school, province, grade, gender, and competition timeline consistency.
- **With an identifier**: the OIer is locked — auto-merge will never split or merge it with others. All entries with the same `(name, identifier)` are one person.

This means: to force-merge incorrectly split entries, assign them the **same identifier**. To prevent merging, assign **different identifiers**. The absence of identifiers does not necessarily mean entries are split — auto-merge may have handled them correctly. But if the user is requesting a merge, auto-merge has failed for this case.

## URL → Name Lookup

If the user provides a URL like `https://oier.baoshuo.dev/oier/124550`, the number is the **effective line number** (1-based, counting only non-comment, non-empty lines). To find the name:

```bash
awk 'BEGIN{n=0} /^[^#]/{n++; if(n==TARGET_ID){print NR": "$0; exit}}' data/raw.txt
```

Extract the 3rd field (姓名) from that line. **Always output the name first** so the user can confirm before any changes.

## Pre-step: Fetch issue context (if applicable)

If the user provides a GitHub issue number (e.g., "merge #123" or mentions an issue), fetch it first:

```bash
gh issue view <number>
```

Extract relevant details from the issue body: names, URLs, provinces, schools, and any merge instructions. Use these as supplementary input alongside whatever the user provides directly. Proceed to Step 1 with all collected information.

## Workflow

### Step 1: Identify the person

From the user's input, extract names, URLs, competition names, provinces, schools, grades, or any other identifying info. Use these to locate candidate entries.

If a URL is given, resolve the name using the lookup above. If only a name is given, search directly:

```bash
grep -n '姓名' data/raw.txt
```

For precise matching on the 姓名 column (avoiding false matches from school names etc.):

```bash
awk -F',' '!/^#/ && $3=="姓名" {print NR": "$0}' data/raw.txt
```

### Step 2: Find all entries and assess

Review all matching lines. Group them by person using the context the user provided (province, school, competition timeline). Determine:
- Which entries belong to the person the user wants to merge.
- Whether other entries exist for the same name but belong to different people.
- Which entries already have identifiers.

### Step 3: Analyze and propose a merge plan

**Scenario A — No other entries for this name (all entries belong to the same person):**
- Assign a unique identifier (conventionally `A`) to all entries.
- This is the simplest case.

**Scenario B — Other entries exist (multiple people share the same name):**
- List all entries, grouped by person.
- Identify which entries should be merged together.
- For entries that already have identifiers, keep them.
- For entries without identifiers, assign new ones following the existing naming pattern or using letters A, B, C, D, etc. in order.
- Present the full plan clearly, showing each person and their assigned identifier.

### Step 4: Present findings and confirm with the user

Before asking for confirmation, output a detailed summary of the found entries **grouped by person**. For each group, show:

1. **All entries** in chronological order (by contest year), with each line's contest, level, grade, school, province, score, and existing identifier.
2. **Grade progression**: the sequence of grades across entries, using `→` as separator. Example: `年级：小学/无 → 五年级 → 六年级 → 初一 → 初二 → 初三 → 高一 → 高二`
3. **School progression**: the sequence of schools, deduplicated where consecutive entries share the same school. Example: `学校：燕山小学 → 长沙市燕山小学 → 长沙市湘郡培粹实验中学 → 长沙市长郡中学`

After presenting the summary, use `AskUserQuestion` to propose the merge plan and get confirmation:
- Which person's entries are being merged.
- What identifiers will be assigned (and to which lines).
- Any ambiguous cases.

If anything is unclear, ask. Never proceed without explicit user approval.

### Step 5: Execute the merge

**Important**: The `Edit` tool requires that the file has been read with `Read` at least once in the conversation before editing. Since `raw.txt` is too large to read entirely, use `Read` with `offset` and `limit` to read just the lines around each target line (e.g., `offset=line_number-1, limit=3`). This satisfies the prerequisite without loading the whole file.

Then use the `Edit` tool to update the 标识符 field in each affected line. The 标识符 is the 9th and **last** field — do not add a trailing comma after it. Typical replacements:

- Empty gender + empty identifier (line ends `,,`): replace with `,标识符` (no trailing comma).
- Non-empty gender + empty identifier (line ends `男,`): replace with `男,标识符`.
- Existing identifier to change: replace the old identifier with the new one directly.

Remember:
- Do **not** change the relative order of lines — only modify fields within a line.
- Preserve all other fields exactly as they are.
- The edit `old_string` must be unique in the file; include enough surrounding context to ensure uniqueness (e.g., the full line content, or a long enough substring combining name + school + contest).
- If editing multiple lines, you can `Read` a small range that covers all of them in one call, then edit each line individually.

### Step 6: Commit

After completing all edits, use `AskUserQuestion` to ask the user whether to commit. Provide a default commit title following this format:

```
fix: {姓名} ({省份列表，用半角逗号分隔})
```

For example, if merging entries for 王泽宇 across 江苏 and 上海, the default title would be `fix: 王泽宇 (江苏,上海)`.

If an issue number was provided in the pre-step, append the following line to the commit message body:

```
Resolves #{issue_number}.
```

Then create the commit with the approved title and message.

## Important Rules

- Never read raw.txt without grep/awk filters — it's too large.
- Always confirm the person's name before making changes.
- Always get user approval before executing a merge.
- When searching, prefer `awk -F',' '$3=="姓名"'` for precise name matching to avoid false positives from school names or other fields containing the name.
- If the user provides conflicting information, ask for clarification rather than guessing.
- 标识符 can be any string, not just single letters — check existing identifiers for the same name to follow the established pattern.

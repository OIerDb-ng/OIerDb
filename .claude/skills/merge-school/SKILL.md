---
name: merge-school
description: |
  Merge incorrectly split school entries in data/school.txt. Use this skill when the user wants to
  merge, combine, or deduplicate school entries in the OIerDb school data. Always trigger on phrases
  like "merge these schools", "combine school entries", "这两个学校是同一个", "合并学校", "学校重复了",
  "学校拆分错了", or when the user provides school names, line numbers, or OIerDb school references
  and asks to merge/combine them. Also trigger when the user mentions duplicate schools, school aliases
  that should be consolidated, or asks to fix incorrectly split school records.
---

# Merge School Entries

You help the user merge school entries in `data/school.txt` that were incorrectly split into separate records. Always merge into the **earlier-appearing entry** (lower line number), adding unique aliases from the later entry, then marking the later entry as invalid with `,,`.

## Data Format

Each non-comment, non-empty line has comma-separated fields:

```
省份,城市,正式名称,别名1,别名2,...
```

- Lines starting with `#` are comments.
- The first three fields are required: province, city, official name.
- All subsequent fields are aliases (can be empty or numerous).
- A line containing only `,,` is an **invalid/deprecated entry** — the parser skips it.

**Example:**
```
湖南,长沙市,长沙市雅礼中学,湖南省长沙市雅礼中学,湖南省长沙雅礼中学,长沙雅礼中学,雅礼中学
```

## How Merging Works

When two lines represent the same school:
1. **Keep the earlier entry** (lower line number) — it becomes the primary.
2. **Collect unique aliases** from the later entry: its official name (if different from the primary's) plus all its aliases not already present in the primary.
3. **Append unique aliases** to the end of the primary line, comma-separated.
4. **Mark the later entry as invalid** by replacing the entire line content with `,,`.

The primary's province, city, and official name are never changed. If the two entries have different cities, flag this to the user — it may mean they are genuinely different schools.

## Pre-step: Fetch issue context (if applicable)

If the user provides a GitHub issue number (e.g., "merge school #123"), fetch it first:

```bash
gh issue view <number>
```

Extract school names, line numbers, provinces, and any merge instructions. Proceed to Step 1 with all collected information.

## Workflow

### Step 1: Locate the schools

From the user's input, extract school names or hints. Use `grep` with line numbers to find candidates — never read the entire file:

```bash
grep -n '学校名' data/school.txt
```

For more precise matching on the official name (3rd field):

```bash
awk -F',' '!/^#/ && $3=="正式名称" {print NR": "$0}' data/school.txt
```

To search across all fields (name or alias):

```bash
grep -n '关键词' data/school.txt
```

### Step 2: Identify and assess

Review all matching lines. Determine:
- Which lines represent the same school (duplicates/incorrectly split).
- Which is the **earlier entry** (lower line number) — this will be the merge target.
- Whether province and city match. If cities differ, surface this to the user before proceeding.
- What aliases the later entry has that the earlier entry lacks.

### Step 3: Propose the merge plan

Present a clear summary showing both entries in full, then propose:
- **Primary** (keep): earlier entry (line N) — show full content.
- **Secondary** (invalidate): later entry (line M) — show full content.
- **Aliases to add**: list the names from the secondary not already in the primary.
- **Result**: show what the merged primary line will look like after the change.

If the two entries have conflicting province/city, or if it's unclear they are the same school, ask the user for clarification.

Use `AskUserQuestion` to confirm the plan before making any changes. Never proceed without explicit user approval.

### Step 4: Execute the merge

**Important**: The `Edit` tool requires that the file has been read with `Read` at least once before editing. Since `school.txt` is large, use `Read` with `offset` and `limit` to read just the lines around each target (e.g., `offset=line_number-1, limit=3`). This satisfies the prerequisite without loading the whole file.

**Step 4a — Update the primary line:**

Append the unique aliases from the secondary to the end of the primary line:

```
<original primary line>,<new alias 1>,<new alias 2>,...
```

Use `Edit` with the full original primary line as `old_string` and the appended version as `new_string`. The `old_string` must be unique in the file; include enough surrounding context if needed.

**Step 4b — Invalidate the secondary line:**

Replace the entire secondary line content with `,,` to mark it as deprecated:

Use `Edit` with the full original secondary line as `old_string` and `,,` as `new_string`. Do not delete the line — the `,,` placeholder keeps the file's line structure intact and signals to future readers that the entry has been merged away.

### Step 5: Commit

After all edits, use `AskUserQuestion` to ask whether to commit. Provide a default commit title following this format:

```
fix: {正式名称} ({省份})
```

For example, merging entries for 长沙市雅礼中学 in 湖南:

```
fix: 长沙市雅礼中学 (湖南)
```

If an issue number was provided in the pre-step, append the following line to the commit message body:

```
Resolves #{issue_number}.
```

Then create the commit with the approved title and message.

## Important Rules

- Always merge **into the earlier entry** (lower line number). Never flip primary and secondary.
- Never read school.txt without grep/awk filters — it's large (~13,000 lines).
- Always show both entries in full before asking for confirmation.
- If province and city differ between the two entries, flag this prominently — it may indicate genuinely distinct schools.
- Only add aliases from the secondary that are not already present in the primary (check against all existing aliases, not just the official name).
- Never change the official name, province, or city of the primary entry.
- Replace the secondary line with `,,` — do not delete it.

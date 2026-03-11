---
name: fix-sonar
description: >
  Fix SonarCloud code quality issues that are synced to GitHub Issues. Use this skill whenever
  the user says /fix-sonar, mentions SonarQube or SonarCloud issues, wants to fix code smells,
  or asks about code quality issues from their issue tracker. Also trigger when the user mentions
  fixing GitHub issues labeled "sonarcloud" or wants to clean up code quality findings.
user_invocable: true
---

# Fix SonarCloud Issues

This skill fetches SonarCloud issues synced to GitHub Issues, applies fixes to the source code,
verifies the fixes pass tests, and closes the resolved issues.

## How it works

A GitHub Actions pipeline syncs SonarCloud findings into GitHub Issues with the `sonarcloud` label.
Each issue contains structured metadata identifying the file, severity, and description of the problem.
This skill parses that metadata, reads the affected code, applies the fix, and verifies it with tests.

## Arguments

- No args: fetch all open sonarcloud issues, display them sorted by severity, fix them one by one
- Issue number (e.g., `350`): fix that specific GitHub issue
- `--severity CRITICAL|MAJOR|MINOR`: only fix issues at or above this severity level

## Workflow

### Step 0: Create a descriptive branch

Before making any changes, create a branch with a meaningful name that reflects the fix:

```bash
git checkout -b fix/sonar-<short-description>
```

**Branch naming rules:**
- Single issue: `fix/sonar-<issue-number>-<short-slug>` (e.g., `fix/sonar-288-reduce-complexity`)
- Multiple issues: `fix/sonar-batch-<short-description>` (e.g., `fix/sonar-batch-code-smells`)
- Derive the slug from the SonarCloud description: simplify it to 2-4 lowercase hyphenated words

### Step 1: Fetch and parse issues

Fetch open issues labeled `sonarcloud`:

```bash
gh issue list --label sonarcloud --state open --json number,title,body,labels --limit 100
```

Parse each issue body to extract structured fields. The body follows this format:

```
**SonarCloud Issue:** <sonarcloud-issue-id>
**Type:** CODE_SMELL | BUG | VULNERABILITY
**Severity:** CRITICAL | MAJOR | MINOR
**Component:** Gorton218_puppetfile-depgraph:<relative-file-path>

**Description:**
<what needs to be fixed>

**SonarCloud Link:** <url>
**Tags:** <comma-separated> (optional line, may be absent)
```

Extract:
- **File path**: from `Component`, strip everything up to and including the first colon (the project prefix `Gorton218_puppetfile-depgraph:`)
- **Severity**: from the `Severity` field
- **Type**: from the `Type` field
- **Description**: from the `Description` field — this is the core instruction for what to fix

### Step 2: Display and prioritize

Show the user a summary table of issues sorted by severity (CRITICAL first, then MAJOR, then MINOR):

```
#    | Severity | File                                    | Issue
---- | -------- | --------------------------------------- | -----
288  | CRITICAL | src/services/upgradePlannerService.ts    | Reduce Cognitive Complexity from 23 to 15
341  | MAJOR    | src/services/conflictAnalyzer.ts         | Remove useless assignment to "parsed"
350  | MAJOR    | src/utils/versionParser.ts               | Prefer optional chain expression
...
```

If a specific issue number was provided as an argument, skip the table and go straight to fixing that issue.
If `--severity` was provided, filter the table to only show issues at or above that severity.

### Step 3: Fix each issue

For each issue (or the single specified issue):

1. **Read the file** identified in the Component field
2. **Understand the problem** from the Description — SonarCloud descriptions are concise and usually self-explanatory
3. **Apply the fix** using the Edit tool. Common patterns:

   | SonarCloud Description | How to Fix |
   |------------------------|-----------|
   | Prefer optional chain expression | Replace `obj && obj.prop` with `obj?.prop` |
   | Remove useless assignment to variable "X" | Delete the line assigning to X if the value is never read afterward |
   | Unexpected negated condition | Flip the `if/else`: change `if (!cond) { A } else { B }` to `if (cond) { B } else { A }` |
   | `String.raw` should be used to avoid escaping `\` | Wrap the regex/string literal with `String.raw\`...\`` |
   | Prefer `String#replaceAll()` over `String#replace()` | Change `.replace(pattern, replacement)` to `.replaceAll(pattern, replacement)`. If the pattern was a regex with the `g` flag, convert it to a string literal instead |
   | Remove unused import of 'X' | Delete the import line for X |
   | Reduce Cognitive Complexity from N to 15 | Refactor: extract helper functions, use early returns, simplify nested conditionals, collapse redundant branches |
   | Do not call `Array#push()` multiple times | Consolidate sequential `.push()` calls into a single `.push()` with multiple arguments/spreads, or use `map`/`flatMap` to build arrays declaratively |

   For patterns not in this table, read the code carefully, understand what SonarCloud is flagging, and apply the idiomatic TypeScript fix.

4. **Follow project conventions**: LF line endings, TypeScript strict mode, existing code patterns. Read CLAUDE.md if unsure about conventions.

### Step 4: Verify

After each fix, run the test suite:

```bash
npm test
```

This runs linting and all unit tests. The fix is only considered successful if tests pass.

- **Tests pass** → proceed to close the issue
- **Tests fail** → report the failure to the user, do NOT close the issue, and ask if they want to attempt a different fix or skip this issue

### Step 5: Close the issue and commit

If tests pass:

1. Close the GitHub issue with a comment describing what was fixed:
   ```bash
   gh issue close <number> --comment "Fixed: <brief description of what changed>"
   ```

2. Stage the changed files and commit with a message that references the issue:
   ```bash
   git commit -m "fix: <lowercase description> (closes #<number>)"
   ```

When fixing multiple issues, commit each fix individually so the git history stays clean and each commit references its issue.

### Step 6: Summary

After all issues are processed, show a summary:

```
Fixed: 5 issues
Failed: 1 issue (#288 - tests failed after refactoring)
Skipped: 0 issues
```

## Important guardrails

- Never close an issue if tests fail — the fix isn't verified
- Never modify test files to make tests pass — fix the source code correctly
- For complex refactors (like reducing cognitive complexity), read the surrounding code to understand the full context before changing anything
- If an issue seems risky or ambiguous, ask the user before applying the fix
- Each fix should be minimal — only change what's needed to resolve the SonarCloud finding

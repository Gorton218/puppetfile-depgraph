---
name: fix-sonar
description: Fix a SonarCloud issue synced to GitHub Issues. Pass the GitHub issue number as an argument.
command: fix-sonar
arguments: issue_number
---

# Fix SonarCloud Issue

You are fixing a SonarCloud code quality issue that has been synced to a GitHub issue.

## Step 1: Fetch the Issue

Run: `gh issue view $ARGUMENTS --json number,title,body,labels`

Parse the issue body to extract:
- **Type**: CODE_SMELL, BUG, or VULNERABILITY
- **Severity**: MINOR, MAJOR, CRITICAL, BLOCKER
- **Component**: The file path (after the colon in `Gorton218_puppetfile-depgraph:`)
- **Description**: What needs to be fixed
- **SonarCloud Link**: Link for reference

## Step 2: Read the Affected File

Read the file identified in the Component field. Understand the surrounding code context.

## Step 3: Apply the Fix

Fix the issue following these principles:
- **CODE_SMELL**: Improve code quality (optional chaining, remove dead code, simplify logic, etc.)
- **BUG**: Fix the actual bug while preserving behavior
- **VULNERABILITY**: Address the security concern

Rules:
- Make the **minimal change** needed to resolve the issue
- Do NOT refactor unrelated code
- Preserve existing code style (LF line endings, existing indentation)
- Follow patterns already used in the codebase

## Step 4: Run Tests

Run: `npm test`

All tests must pass. If tests fail:
1. Analyze the failure
2. Adjust your fix
3. Re-run tests until they pass

Also run: `npm run compile` to ensure no TypeScript errors.

## Step 5: Commit and Close

1. Stage only the changed file(s): `git add <file>`
2. Commit with message:
```
fix: <short description of the fix>

Resolves SonarCloud <type> (<severity>): <issue description>
Fixes #<issue_number>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```
3. Push: `git push`
4. The `Fixes #<issue_number>` in the commit message will auto-close the GitHub issue.

## Important Notes

- Never skip running tests
- If the fix is ambiguous, prefer the simplest correct approach
- If the SonarCloud description is unclear, check the SonarCloud link for more context
- Do not modify CHANGELOG.md

# PR Rebase Guide

This guide provides step-by-step instructions for bulk rebasing multiple pull requests and updating their merge targets.

## Overview

When you need to rebase multiple PRs to a different branch (e.g., from `main` to `release/security_fixes`), this guide helps automate the process while handling conflicts gracefully.

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- Git command-line tools
- Write access to the repository

## Step-by-Step Process

### 1. Update Local Branches

First, ensure your local branches are up to date:

```bash
# Update main branch
git checkout main
git pull origin main

# Update target branch (e.g., release/security_fixes)
git checkout release/security_fixes
git pull origin release/security_fixes
```

### 2. List All Open PRs

Get a list of all open PRs with their details:

```bash
gh pr list --state open --json number,title,headRefName,baseRefName
```

### 3. Update PR Base Branches

Change the merge target for all PRs to the new branch:

```bash
# List of PR numbers
pr_numbers="141 140 139 138 137 131 130 128 127 126 125 124 123 122 121 120 119 118 117 116 115 114 113 111 112 110"

# Update base branch for each PR
for pr in $pr_numbers; do
    echo "Updating PR #$pr base branch..."
    gh pr edit $pr --base release/security_fixes
done
```

### 4. Rebase PRs

Rebase each PR branch onto the new target branch:

```bash
# Function to rebase a single PR
rebase_pr() {
    local pr=$1
    echo "=== Processing PR #$pr ==="
    
    # Get branch name
    branch=$(gh pr view $pr --json headRefName -q .headRefName)
    echo "Branch: $branch"
    
    # Fetch and checkout the branch
    git fetch origin $branch:$branch
    git checkout $branch
    
    # Rebase onto target branch
    if git rebase origin/release/security_fixes; then
        echo "Rebase successful, force pushing..."
        git push --force-with-lease origin $branch
        echo "PR #$pr rebased successfully"
        return 0
    else
        echo "Rebase failed for PR #$pr, aborting..."
        git rebase --abort
        return 1
    fi
}

# Process all PRs
successful=0
failed=0
failed_prs=""

for pr in $pr_numbers; do
    if rebase_pr $pr; then
        ((successful++))
    else
        ((failed++))
        failed_prs="$failed_prs $pr"
    fi
    echo ""
done

echo "Summary: $successful successful, $failed failed"
[ -n "$failed_prs" ] && echo "Failed PRs:$failed_prs"
```

## Automated Script

Save this as `rebase-prs.sh` for future use:

```bash
#!/bin/bash

# Configuration
TARGET_BRANCH="${1:-release/security_fixes}"
PR_NUMBERS="${2:-}"

# If no PR numbers provided, get all open PRs
if [ -z "$PR_NUMBERS" ]; then
    PR_NUMBERS=$(gh pr list --state open --json number -q '.[].number' | tr '\n' ' ')
fi

echo "Rebasing PRs to $TARGET_BRANCH"
echo "PRs to process: $PR_NUMBERS"
echo ""

# Update local branches
git checkout main && git pull origin main
git checkout $TARGET_BRANCH && git pull origin $TARGET_BRANCH

# Update base branches
for pr in $PR_NUMBERS; do
    echo "Updating PR #$pr base branch to $TARGET_BRANCH..."
    gh pr edit $pr --base $TARGET_BRANCH
done

echo ""
echo "Starting rebase process..."

# Rebase each PR
successful=0
failed=0
failed_prs=""

for pr in $PR_NUMBERS; do
    echo "=== Processing PR #$pr ==="
    branch=$(gh pr view $pr --json headRefName -q .headRefName)
    echo "Branch: $branch"
    
    git fetch origin $branch:$branch
    git checkout $branch
    
    if git rebase origin/$TARGET_BRANCH; then
        echo "Rebase successful, force pushing..."
        git push --force-with-lease origin $branch
        echo "PR #$pr rebased successfully"
        ((successful++))
    else
        echo "Rebase failed for PR #$pr, aborting..."
        git rebase --abort
        ((failed++))
        failed_prs="$failed_prs $pr"
    fi
    echo ""
done

# Return to main branch
git checkout main

# Summary
echo "========================================="
echo "Rebase Summary:"
echo "Successful: $successful"
echo "Failed: $failed"
[ -n "$failed_prs" ] && echo "Failed PRs:$failed_prs"
```

Usage:
```bash
# Rebase all open PRs to release/security_fixes (default)
./rebase-prs.sh

# Rebase all open PRs to a specific branch
./rebase-prs.sh feature/new-branch

# Rebase specific PRs to a branch
./rebase-prs.sh release/v2.0 "123 124 125"
```

## Handling Conflicts

### Common Conflict Scenarios

1. **Code Changes**: When the same code has been modified in both branches
2. **File Deletions**: When a file was deleted in one branch but modified in another
3. **Dependency Updates**: When package.json or similar files have conflicting changes

### Resolving Conflicts Manually

For PRs that fail to rebase automatically:

1. **Checkout the PR branch**:
   ```bash
   git checkout -b pr-branch origin/pr-branch
   ```

2. **Start the rebase**:
   ```bash
   git rebase origin/release/security_fixes
   ```

3. **Resolve conflicts**:
   - Edit conflicted files
   - Remove conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
   - Stage resolved files: `git add <file>`
   - Continue rebase: `git rebase --continue`

4. **Force push**:
   ```bash
   git push --force-with-lease origin pr-branch
   ```

## Best Practices

1. **Always use `--force-with-lease`** instead of `--force` to prevent accidental overwrites
2. **Create a backup branch** before rebasing critical PRs
3. **Communicate with PR authors** before rebasing their branches
4. **Check CI status** after rebasing to ensure tests still pass
5. **Group similar PRs** together (e.g., all dependabot PRs) for easier conflict resolution

## Troubleshooting

### PR won't update base branch
- Ensure you have write permissions
- Check if the PR is locked or has branch protection rules

### Rebase keeps failing
- The PR might have fundamental conflicts with the target branch
- Consider creating a new PR with the changes manually applied

### Can't push after rebase
- Ensure you're using `--force-with-lease` not just `--force`
- Check if branch protection rules prevent force pushes
- Verify you have push permissions to the branch

## Example from Recent Session

In a recent session, we successfully rebased 26 PRs from `main` to `release/security_fixes`:

- **Total PRs**: 26
- **Successful**: 21
- **Failed** (due to conflicts): 5
  - PR #131 (copilot/fix-100): Conflict in dependencyTreeService.ts
  - PR #127 (copilot/fix-109): Conflict in puppetfileParser.ts
  - PR #114 (copilot/fix-87): Conflict in dependencyTreeService.ts
  - PR #112 (copilot/fix-86): Conflict in dependencyTreeService.ts
  - PR #110 (copilot/fix-88): Multiple conflicts

These conflicts typically occur when the PR modifies code that has been significantly changed in the target branch.
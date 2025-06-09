# Release Process

This document describes the automated release process for the Puppetfile Dependency Manager VS Code extension.

## Overview

The release process is automated using GitHub Actions and includes:
- Automated testing and linting
- VSIX package creation
- GitHub Release creation with artifacts
- Semantic versioning

## Release Methods

### Method 1: Automated Script (Recommended)

Use the automated release script for consistent releases:

```bash
# Patch release (0.0.1 -> 0.0.2)
node scripts/release.js patch

# Minor release (0.0.1 -> 0.1.0)
node scripts/release.js minor

# Major release (0.0.1 -> 1.0.0)
node scripts/release.js major
```

The script will:
1. Validate git status is clean
2. Update version in package.json
3. Run tests and linting
4. Compile TypeScript and create VSIX package
5. Commit version bump
6. Create and push git tag
7. Trigger GitHub Actions workflow

### Method 2: Manual Release

For manual releases or hotfixes:

```bash
# 1. Update version manually
npm version patch  # or minor/major

# 2. Run tests
npm test

# 3. Create package
npm run package

# 4. Commit and tag
git add package.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
git tag v$(node -p "require('./package.json').version")

# 5. Push
git push origin main
git push origin --tags
```

### Method 3: GitHub UI Release

Create a release directly from GitHub:

1. Go to the repository's "Releases" page
2. Click "Create a new release"
3. Create a new tag (e.g., `v0.1.0`)
4. The workflow will trigger automatically

## GitHub Actions Workflow

The workflow (`.github/workflows/release.yml`) runs on:
- Git tags matching `v*` pattern
- Manual workflow dispatch

### Workflow Steps

1. **Setup**: Checkout code, setup Node.js, install dependencies
2. **Quality**: Run tests and linting
3. **Package**: Install VSCE and create VSIX package
4. **Release**: Create GitHub Release with:
   - Release notes from CHANGELOG.md
   - Installation instructions
   - Package metadata
5. **Upload**: Attach VSIX file to the release
6. **Artifacts**: Upload build artifacts for 30 days

## Package Configuration

### Required Files

- `package.json` - Extension metadata and build scripts
- `.vscodeignore` - Files to exclude from VSIX package
- `CHANGELOG.md` - Release notes and version history

### Key package.json Fields

```json
{
  "name": "puppetfile-depgraph",
  "displayName": "Puppetfile Dependency Manager", 
  "version": "0.0.2",
  "publisher": "puppetfile-depgraph",
  "engines": { "vscode": "^1.100.0" },
  "main": "./out/extension.js"
}
```

## Installation

Users can install the extension from the GitHub Release:

1. Download the `.vsix` file from the release
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Type "Extensions: Install from VSIX"
5. Select the downloaded file

## Development Scripts

- `npm run compile` - Compile TypeScript
- `npm run watch` - Watch mode for development
- `npm test` - Run tests and linting
- `npm run package` - Create VSIX package
- `npm run release` - Test and package (no version bump)

## Troubleshooting

### Common Issues

1. **"Git working directory not clean"**
   - Commit or stash all changes before releasing

2. **"VSCE not found"**
   - Install globally: `npm install -g @vscode/vsce`

3. **Tests failing**
   - Fix all test failures before releasing
   - Check ESLint issues: `npm run lint`

4. **GitHub token issues**
   - Ensure repository has proper permissions
   - Check GitHub Actions secrets

### Verification

After release, verify:
- [ ] GitHub Release was created
- [ ] VSIX file is attached to release
- [ ] Version matches package.json
- [ ] Installation instructions are included
- [ ] Git tag was created and pushed

## Version Strategy

Follow semantic versioning (semver):
- **PATCH** (0.0.1 -> 0.0.2): Bug fixes, minor improvements
- **MINOR** (0.0.1 -> 0.1.0): New features, backwards compatible
- **MAJOR** (0.0.1 -> 1.0.0): Breaking changes

## Next Steps

Consider setting up:
- VS Code Marketplace publishing
- Automated security scanning
- Release notes automation
- Performance benchmarking
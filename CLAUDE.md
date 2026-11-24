# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Puppetfile Dependency Manager is a VS Code extension written in TypeScript. It parses Puppetfiles, shows hover info and CodeLens upgrade buttons from the Puppet Forge, builds dependency trees, detects conflicts, and offers an interactive upgrade planner (a diff view with Apply/Skip). User-facing feature docs are in `README.md` and `docs/`.

## Working Model: Delegate Coding to the `coder` Subagent

- **Main session:** explores the codebase, plans, talks to the user, and reviews results.
- **`coder` subagent** (`.claude/agents/coder.md`, runs on Sonnet): makes **every code change** in `src/` and `test/`. That includes features, bug fixes, refactors, test writing, and SonarCloud fixes from the `fix-sonar` skill.
  - For `fix-sonar`, the skill's "apply the fix" step goes to `coder`. The main session still owns the skill's branch, test-verification and commit steps, because `coder` does not commit unless the brief says so.
  - Brief it with the goal, the relevant files, the constraints, and what "done" means.
  - Independent changes can go to parallel `coder` agents.
- After `coder` reports back, review the diff with `git diff` and check the test results before telling the user it is done.
- Non-code edits (docs, CLAUDE.md, config) can be made directly.

## Commands

Node >= 24 (`.nvmrc`). Build output goes to `out/` via `tsconfig.build.json`.

- `npm run compile` / `npm run watch`: build the extension.
- `npm run lint`: run ESLint on `src/`.
- `npm test`: runs compile and lint (through `pretest`), then **unit tests only** (Jest).
- `npx jest test/unit/<file>.test.ts -t "<test name>"`: runs a single unit test file or test. It skips the compile/lint `pretest` step.
- `npm run test:coverage`: unit tests with coverage.
- `npm run test:vscode`: VS Code integration tests (Mocha, `test/vscode-test/`).
- `npm run test:e2e`: E2E tests (Mocha, `test/e2e/`).
- Performance tests in `test/e2e/performance/` are Mocha suites and run as part of `test:e2e`.
- `npm run test:api-integration`: **real** Puppet Forge calls (`test/api/`). Not part of `test:all`.
- `npm run test:all`: coverage, then vscode, then e2e. This is what CI runs (`.github/workflows/test.yml`, which also runs a SonarCloud scan).
- `npm run package`: build a `.vsix` with vsce.

### Test infrastructure quirks
- Jest (`jest.config.js`):
  - roots is `test/unit` only
  - runs serially (`maxWorkers: 1`) with `forceExit` and a 15 s timeout
  - `ts-jest` uses `tsconfig.test.json`
  - `jest.setup.js` mocks the `vscode` module globally
- The vscode-test and e2e suites compile with their own `tsconfig.json` files and run in a real VS Code instance through `scripts/runTests.js`. On Linux CI that wraps the run in `xvfb-run`.
- Compiled `.js`/`.js.map` files sit beside the `.ts` sources in `src/` and `test/`. They are gitignored build output: never edit them, and ignore them when searching.

## Architecture

- **Entry point:** `src/extension.ts` registers the commands, the hover provider (`puppetfileHoverProvider.ts`), the CodeLens provider (`puppetfileCodeLensProvider.ts`), and a second CodeLens provider for the upgrade diff view (`services/upgradeDiffCodeLensProvider.ts`).
- **Command registration:** commands live in both `package.json` (`contributes.commands`) and `extension.ts`.
  - `applySingleUpgradeFromDiff` and `skipSingleUpgradeFromDiff` are registered only in code; they are internal, invoked from the diff-view CodeLens.
  - `clearCache` is also registered only in code. It is a hidden command that clears both the Forge and Git metadata caches; the user-facing `clearForgeCache` clears only the Forge cache.
  - A new user-facing command needs both entries.
- **Services:** the services in `src/services/` are **static classes**, not instances, and keep static in-memory caches. Tests must reset them, for example with `PuppetForgeService.clearCache()`.
- **Network boundary:** only `PuppetForgeService` (Forge API v3, axios, optional `https-proxy-agent` from VS Code proxy settings) and `GitMetadataService` (fetches `metadata.json` from Git hosts) make HTTP calls. Everything else consumes them.
- **Parser:** `PuppetfileParser.parseContent()` / `parseActiveEditor()` return `PuppetModule`s with line numbers. Every editor feature (hover, CodeLens, line-targeted updates) depends on those line numbers.
- **Module names:** names appear as `owner/name` or `owner-name`. `ModuleNameUtils` (`src/utils/moduleNameUtils.ts`) normalizes them so cache keys and comparisons match. Always go through it, or the caches split.
- **Caching:**
  - `ForgeModule` and `PuppetForgeService` cache API results.
  - `CacheService.cacheAllModules()` / `cacheUncachedModules*()` pre-fetch with progress and cancellation.
  - The hover provider uses `hasModuleCached()` to find uncached modules and fetches only those.
  - The CodeLens provider calls `PuppetForgeService.checkForUpdate()` per module, which reads from the same caches.
- **Upgrade planner flow:**
  1. `UpgradePlannerService.createUpgradePlan()` pre-caches modules.
  2. `VersionCompatibilityService` / `ConflictAnalyzer` check each candidate version against the dependency constraints of all other modules.
  3. `UpgradeDiffProvider.showUpgradeDiff()` opens a virtual-document diff.
  4. `UpgradeDiffCodeLensProvider` adds Apply/Skip lenses.
  5. `PuppetfileUpdateService` (`applyUpdates`, `updateModuleVersionAtLine`) edits the real Puppetfile.
- **Dependency tree:** `DependencyTreeService.buildDependencyTree()` resolves transitive Forge/Git dependencies, then renders them as tree or list text and reports conflicts and cycles.
- More detail: `docs/architecture.md`.

## Testing Rules

- **Real external API calls are allowed only in `test/api/`.** Unit, vscode-test, e2e and performance tests must mock `PuppetForgeService` and `GitMetadataService`.
  - Unit: `jest.mock('../../src/services/puppetForgeService')`, or the hardcoded data in `test/unit/mocks/puppetForgeServiceMock.ts`.
  - vscode-test and e2e: sinon sandboxes, with `test/vscode-test/testSetup.ts`, `testHelper.ts`, `mockPuppetForgeService.ts`, and JSON fixtures in `test/vscode-test/fixtures/api-responses/` and the Puppetfile fixtures (`*-puppetfile.txt`) directly in `test/vscode-test/fixtures/`.
- **Don't mock pure functions:** `PuppetForgeService.compareVersions`, `isSafeVersion`, `PuppetfileParser.parseContent`.
- Mock data should look realistic: real-looking versions and dependencies, and both stable and pre-release versions.
- Time budgets: unit tests under 5 s, integration under 2 min, e2e under 5 min.

## Conventions

- Use LF line endings in every file.
- Put temporary scripts and scratch files in `claude-temp/` (gitignored), with the prefixes `test-*`, `mock-*`, `debug-*`, `scratch-*`, `stub-*`.
- Don't update `CHANGELOG.md` unless explicitly asked.
- Don't analyze the `.private/` folder unless a file in it is explicitly mentioned.
- Code-quality priority order: maintainability, then reliability, then coverage, then duplication. Duplication in tests is fine when it keeps them clear.

### SonarCloud-aware patterns
SonarCloud findings are synced to GitHub Issues with the `sonarcloud` label. The `fix-sonar` skill (`.claude/skills/fix-sonar/`) works through them.
- Build arrays declaratively (`map`, `flatMap`, spread). Use a single `push(...a, ...b)` instead of several `push()` calls.
- Keep cognitive complexity under 15 per function. Extract helpers for distinct sections.
- Use `obj?.prop`, not `obj && obj.prop`.
- Use `replaceAll()`, not `replace()` with a global regex.

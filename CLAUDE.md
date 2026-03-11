# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Puppetfile Dependency Manager is a VS Code extension for managing Puppet module dependencies. It provides Puppetfile parsing, dependency tree visualization, version management, and Puppet Forge integration.

## Commands

### Development
- `npm run compile` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode for development
- `npm test` - Run linting and all tests
- `npm run lint` - Run ESLint
- `npm run vscode:prepublish` - Prepare for publication

### Testing
The project uses a multi-layered testing approach with different strategies for different types of tests:

- **Unit Tests**: Jest framework in `test/unit/` using `describe()` and `test()` functions
  - Run with: `npm test` or `npm run test:unit`
  - Coverage: `npm run test:coverage`
  - **Always use mocks** for external services (PuppetForgeService, GitMetadataService)
- **Integration Tests**: VS Code test runner with Mocha in `test/vscode-test/` using `suite()` and `test()` functions  
  - Run with: `npm run test:vscode`
  - **Always use mocks** for external API calls (Puppet Forge, Git repositories)
- **E2E Tests**: End-to-end workflow tests in `test/e2e/` using Mocha
  - Run with: `npm run test:e2e`
  - **Always use mocks** for external services to ensure reliability
- **Performance Tests**: Performance benchmarks in `test/e2e/performance/`
  - Run with: `npm run test:performance`
  - Tests caching efficiency and large file handling
- **API Integration Tests**: Real API tests in `test/api/`
  - Run with: `npm run test:api-integration`
  - **Only place where real API calls are allowed**
- **All Tests**: `npm run test:all` (runs unit, integration, and e2e tests, but NOT api-integration)

## Project Structure

### Directory Organization
```
src/                            # Application source code only
├── services/                   # All service layer implementations
│   ├── puppetForgeService.ts   # Puppet Forge API client with caching
│   ├── gitMetadataService.ts   # Git repository metadata fetching
│   ├── dependencyTreeService.ts # Dependency tree building and analysis
│   ├── puppetfileUpdateService.ts # Module version updates
│   ├── cacheService.ts         # Caching infrastructure
│   ├── versionCompatibilityService.ts # Version compatibility checking
│   ├── conflictAnalyzer.ts     # Version conflict detection and resolution
│   ├── upgradePlannerService.ts # Comprehensive upgrade planning
│   ├── upgradeDiffProvider.ts  # Interactive diff view for upgrades
│   └── upgradeDiffCodeLensProvider.ts # Apply/Skip buttons in diff view
├── types/                      # TypeScript type definitions
├── utils/                      # Utility functions
│   └── moduleNameUtils.ts      # Module name format normalization
└── [source files]              # Extension entry point and core files

test/                           # ALL tests organized in one place
├── unit/                       # Unit tests (Jest framework)
│   ├── mocks/                  # Mock implementations for unit tests
│   │   └── puppetForgeServiceMock.ts # Comprehensive mock data
│   └── [test files]            # All unit test files
├── vscode-test/                # VS Code integration tests (Mocha)
│   ├── fixtures/               # Test data and mock fixtures
│   │   ├── api-responses/      # Mock API responses (JSON files)
│   │   └── puppetfiles/        # Test Puppetfile examples
│   ├── mockPuppetForgeService.ts # Mock service for integration tests
│   ├── testHelper.ts           # VS Code testing utilities
│   └── testSetup.ts            # Mock setup helpers
├── e2e/                        # End-to-end workflow tests
│   ├── commands/               # Command workflow tests
│   └── performance/            # Performance testing for large files
└── api/                        # Real API tests (separate from main tests)
    ├── puppetForgeApi.test.ts  # Tests against real Puppet Forge
    └── README.md               # API integration test documentation

claude-temp/                    # Temporary development files (Git ignored)
```

### Service Layer Architecture
- **All services are in `src/services/`** - Centralized service organization
- **Services are singleton instances** exported from their modules
- **External API calls are isolated** to service layer only
- **Services support proxy configuration** via VS Code settings
- **Parser returns structured data** with line numbers for editor integration
- **Caching layer reduces API calls** to external services
- **Module name normalization** ensures consistent caching across slash/dash formats
- **Conflict detection** identifies version incompatibilities and circular dependencies
- **Upgrade planning** provides safe upgrade paths with interactive controls

### Key Architectural Patterns
1. **Service Isolation**: Only services make external API calls
2. **Comprehensive Mocking**: All tests except API integration use mocks
3. **Layered Testing**: Different test types serve different purposes
4. **Fixture-Based Testing**: Real-like data for consistent test behavior

### API Integration Points
- **Puppet Forge API**: `https://forgeapi.puppet.com/v3/` for module information
- **Git Repositories**: Fetch metadata.json from Git repositories
- **HTTP Proxies**: Support via `https-proxy-agent`

## Extension Activation
- Activates on files with language ID "puppetfile"
- Registers commands:
  - `puppetfile-depgraph.updateModule`: Update specific module
  - `puppetfile-depgraph.showDependencyTree`: Show dependency tree
  - `puppetfile-depgraph.clearCache`: Clear Forge API cache
  - `puppetfile-depgraph.showUpgradePlanner`: Interactive upgrade planning with Apply/Skip buttons
  - `puppetfile-depgraph.applySingleUpgradeFromDiff`: Apply individual upgrade from diff view
  - `puppetfile-depgraph.skipSingleUpgradeFromDiff`: Skip individual upgrade from diff view

## Feature Implementation Status

### Implemented Features
- ✅ Puppetfile parsing (Forge and Git modules)
- ✅ Puppet Forge API integration with caching
- ✅ Hover tooltips showing latest and safe versions
- ✅ Version update commands (safe/latest)
- ✅ Basic dependency tree visualization
- ✅ Clickable version links in hover tooltips
- ✅ Module name normalization (slash/dash format handling)
- ✅ Conflict detection and circular dependency analysis
- ✅ Interactive upgrade planner with Apply/Skip functionality
- ✅ Diff view with inline upgrade controls

### Planned Features (from PRD)
- ❌ Dependency analysis engine (deep dependency resolution)
- ❌ Changelog generation across multiple modules
- ❌ Advanced UI panels for dependency trees
- ❌ Puppetfile.lock support

## Current Development Focus
The project is actively being enhanced with comprehensive upgrade planning features. Recent work includes:
- Module name normalization utility for consistent caching
- Conflict analyzer for detecting version conflicts and circular dependencies
- Interactive upgrade planner with detailed analysis of safe upgrades
- Diff view provider with inline Apply/Skip buttons for individual upgrades
- Performance improvements for large Puppetfile handling

## Testing Guidelines

### 🔥 CRITICAL: Mock vs Real API Usage

**WHEN TO USE MOCKS (99% of tests):**
- ✅ **Unit Tests** (`test/unit/`) - ALWAYS use mocks
- ✅ **Integration Tests** (`test/vscode-test/`) - ALWAYS use mocks
- ✅ **E2E Tests** (`test/e2e/`) - ALWAYS use mocks
- ✅ **Performance Tests** - ALWAYS use mocks for speed
- ✅ **CI/CD Pipeline** - ALWAYS use mocks for reliability

**WHEN TO USE REAL APIs (1% of tests):**
- ✅ **API Integration Tests** (`test/api/`) - ONLY place for real calls
- ✅ **External-facing services only** (puppetForgeService, gitMetadataService)
- ✅ **API contract validation** - ensure external APIs return expected data formats
- ✅ **Manual validation** before releases
- ✅ **Debugging API contract changes**

### Mock Implementation Strategy

#### For Unit Tests (`test/unit/`)
```typescript
// Use the comprehensive mock with hardcoded data
import { MockPuppetForgeService } from '../test/mocks/puppetForgeServiceMock';

// Mock the service completely
jest.mock('../services/puppetForgeService', () => ({
  PuppetForgeService: MockPuppetForgeService
}));
```

#### For Integration Tests (`test/vscode-test/`)
```typescript
// Use sinon to stub individual methods
sandbox.stub(PuppetForgeService, 'getModule').callsFake(async (moduleName) => {
  const mockData = await MockPuppetForgeService.getModuleInfo(moduleName);
  return convertToForgeModuleFormat(mockData);
});
```

#### For E2E Tests (`test/e2e/`)
```typescript
// Use TestSetup helper for comprehensive mocking
import { TestSetup } from '../integration/testSetup';

suiteSetup(() => {
  TestSetup.setupAll(); // Mocks all external services
});
```

### Mock Data Sources

1. **Unit Tests**: `test/unit/mocks/puppetForgeServiceMock.ts`
   - Hardcoded, predictable test data
   - Fast, deterministic responses
   - Covers common test scenarios

2. **Integration Tests**: `test/vscode-test/fixtures/api-responses/`
   - JSON files with realistic API responses
   - Loaded dynamically by `MockPuppetForgeService`
   - Matches real Puppet Forge API structure

3. **API Integration Tests**: Real external APIs
   - Validates API contracts haven't changed
   - Tests actual network conditions
   - Separate from main test suite

### Service Mocking Rules

#### 🌐 External-Facing Services (puppetForgeService, gitMetadataService)
Services responsible for external communication have **different rules** for unit vs integration tests:

**Unit Tests (`test/unit/`):**
```typescript
// ✅ ALWAYS use mocks for external-facing services
jest.mock('../services/puppetForgeService', () => ({
  PuppetForgeService: MockPuppetForgeService
}));

// Test the service logic without real API calls
describe('PuppetForgeService', () => {
  test('should parse version correctly', () => {
    // Test pure functions with real implementation
    expect(PuppetForgeService.compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
  });
});
```

**Integration Tests (`test/api/`):**
```typescript
// ✅ ONLY place where external-facing services use real calls
describe('PuppetForgeService API Integration', () => {
  test('should fetch real module data', async () => {
    // Real API call to validate contract
    const module = await PuppetForgeService.getModule('puppetlabs/stdlib');
    expect(module).not.toBeNull();
    expect(module.current_release.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

#### 🏗️ Internal Services (dependencyTreeService, versionCompatibilityService, conflictAnalyzer, upgradePlanner, etc.)
Services that depend on external-facing services **ALWAYS use mocks** in both unit and integration tests:

**Unit Tests:**
```typescript
// ✅ Mock external-facing service dependencies
jest.mock('../services/puppetForgeService', () => ({
  PuppetForgeService: MockPuppetForgeService
}));

describe('DependencyTreeService', () => {
  test('should build dependency tree', async () => {
    // Uses mocked PuppetForgeService responses
    const tree = await DependencyTreeService.buildTree(modules);
    expect(tree.nodes.length).toBeGreaterThan(0);
  });
});
```

**Integration Tests (`test/vscode-test/`):**
```typescript
// ✅ Mock external-facing services, test VS Code integration
sandbox.stub(PuppetForgeService, 'getModule').callsFake(async (moduleName) => {
  return MockPuppetForgeService.getModuleInfo(moduleName);
});

test('Dependency tree command works', async () => {
  // Tests VS Code command with mocked external services
  await vscode.commands.executeCommand('puppetfile-depgraph.showDependencyTree');
});
```

#### ✅ DO: Mock External Services
```typescript
// Mock services that make HTTP requests
PuppetForgeService.getModule()
PuppetForgeService.getLatestVersion()
GitMetadataService.getModuleMetadata()

// Mock caching to avoid complex setup
PuppetForgeService.hasModuleCached() // Return true
CacheService.isCachingInProgress() // Return false
```

#### ❌ DON'T: Mock Pure Functions
```typescript
// Don't mock pure utility functions
PuppetForgeService.compareVersions() // Use real implementation
PuppetForgeService.isSafeVersion()   // Use real implementation
PuppetfileParser.parseContent()     // Use real implementation
```

#### ❌ DON'T: Make Real API Calls in Regular Tests
```typescript
// NEVER do this in unit/integration/e2e tests:
const module = await axios.get('https://forgeapi.puppet.com/...');
const gitData = await axios.get('https://github.com/...');
```

### Test Performance Requirements

- **Unit Tests**: < 5 seconds total
- **Integration Tests**: < 2 minutes total  
- **E2E Tests**: < 5 minutes total
- **API Integration Tests**: No time limit (separate execution)

### Debugging Failed Tests

1. **Check mock setup**: Ensure all required methods are stubbed
2. **Verify data format**: Mock data must match expected interfaces
3. **Check test isolation**: Each test should clean up after itself
4. **Review fixture data**: Ensure test data matches test expectations

### Adding New Tests

#### For New Features
1. **Start with unit tests** using mocks
2. **Add integration tests** for VS Code interactions
3. **Add E2E tests** for complete workflows
4. **Optionally add API tests** for new external integrations

#### For Bug Fixes
1. **Reproduce with mocked test** first
2. **Fix the issue**
3. **Verify fix with existing test suite**
4. **Add regression test** if coverage gap exists

### Mock Data Management

#### Adding New Mock Modules
When tests need data for modules not yet in the mock fixtures:

1. **For Unit Tests**: Add to `puppetForgeServiceMock.ts` hardcoded data
```typescript
['new/module', {
  latestVersion: '2.0.0',
  latestSafeVersion: '1.9.0',
  releases: [/* version history */]
}]
```

2. **For Integration Tests**: Add JSON file to `fixtures/api-responses/`
```bash
# Create new-module.json with realistic API response structure
cp puppetlabs-stdlib.json new-module.json
# Edit versions, dependencies, etc.
```

#### Mock Data Consistency Rules
- **Use realistic version numbers** (not 1.0.0 everywhere)
- **Include dependencies** that match real modules
- **Maintain version history** with reasonable timestamps
- **Follow semantic versioning** patterns
- **Include both stable and pre-release** versions for comprehensive testing

### Common Testing Patterns

#### Test Setup Pattern
```typescript
suite('My Feature Tests', () => {
  let sandbox: sinon.SinonSandbox;

  setup(async () => {
    sandbox = sinon.createSandbox();
    TestHelper.setupMockForgeService();
    
    // Stub all required service methods
    sandbox.stub(PuppetForgeService, 'getModule').callsFake(/* mock */);
    // ... other stubs
    
    await TestHelper.closeAllEditors();
  });

  teardown(async () => {
    sandbox.restore();
    await TestHelper.closeAllEditors();
  });
});
```

#### VS Code Document Testing Pattern
```typescript
test('Feature works with Puppetfile', async () => {
  const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
  await TestHelper.showDocument(doc);
  
  // Test your feature
  const result = await yourFeature(doc);
  
  assert.ok(result, 'Feature should work');
});
```

#### Hover Provider Testing Pattern
```typescript
test('Hover shows expected information', async () => {
  const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
  const line = TestHelper.findLineContaining(doc, 'module-name');
  const hovers = await TestHelper.getHoverAtPosition(doc, line, 10);
  
  const content = hovers[0].contents.map(c => 
    typeof c === 'string' ? c : c.value
  ).join('\n');
  
  assert.ok(content.includes('expected text'));
});
```

### Development Guidelines

### Temporary Files and Testing
- Use the `claude-temp/` folder for all temporary development files, stubs, and mocks
- This folder is ignored by Git and provides a clean workspace for development artifacts
- File naming conventions:
  - `test-*.js` - Temporary test files
  - `mock-*.js` - Mock data or service files  
  - `debug-*.js` - Debug scripts and utilities
  - `scratch-*.js` - Experimental code snippets
  - `stub-*.js` - Stub implementations for testing

### Code Quality
- Always run `npm test` before committing changes
- Use TypeScript strict mode and maintain type safety
- Follow existing code patterns and conventions
- Add tests for new functionality
- Do not update the `CHANGELOG.md` file unless explicitly instructed
- Always use LF (Line Feed) line endings for all files

### SonarCloud-Aware Patterns
When writing or refactoring code, follow these patterns to avoid common SonarCloud findings:
- **Array building**: Prefer declarative array construction (`map`, `flatMap`, spread in array literals) over sequential `push()` calls. Use a single `push()` with multiple spread arguments instead of multiple `push()` calls.
- **Cognitive complexity**: Keep functions under 15 cognitive complexity. Extract helper methods for distinct logical sections (especially in functions that build output from multiple categories).
- **Optional chaining**: Use `obj?.prop` instead of `obj && obj.prop`.
- **String methods**: Use `replaceAll()` instead of `replace()` with global regex.

### Code Quality Priorities
When evaluating code improvements, prioritize in this order:
1. **Maintainability** - Code should be easy to understand and modify
2. **Reliability** - Code should work correctly and consistently
3. **Code Coverage** - Tests should cover important functionality
4. **Code Duplication** - Some duplication is acceptable if it improves clarity

Note: Test code duplication is often beneficial for test clarity and independence. Each test should be self-contained and easy to understand without excessive abstraction.

### Misc
- Do not analyze `.private` folder unless the file from there explicitly mentioned in the conversation
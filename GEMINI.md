# GEMINI.md

This file provides guidance to Gemini when working with code in this repository.

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

gemini-temp/                    # Temporary development files (Git ignored)
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

## Gemini Workflow

As an AI assistant, I follow a structured workflow to ensure I handle tasks efficiently and safely.

### 1. Understand

-   **Analyze the Request:** I'll start by breaking down your request to understand the core requirements.
-   **Explore the Codebase:** I will use tools like `read_file`, `glob`, and `search_file_content` to explore the relevant parts of the codebase. This helps me understand the existing patterns, conventions, and implementation details.

### 2. Plan

-   **Formulate a Plan:** Based on my understanding, I'll create a step-by-step plan to address your request.
-   **Share the Plan:** I'll share the plan with you before making any changes. This gives you a chance to review my approach and provide feedback.

### 3. Implement

-   **Modify Code:** I'll use the `write_file` and `replace` tools to modify the code according to the plan. I will always follow the existing coding style and conventions.
-   **Run Commands:** I'll use the `run_shell_command` tool to execute commands for building, testing, and linting the code.

### 4. Verify

-   **Run Tests:** After making changes, I'll run the appropriate tests (e.g., `npm test`) to ensure that my changes haven't introduced any regressions.
-   **Linting and Building:** I'll also run the linter (`npm run lint`) and build the project (`npm run compile`) to ensure the code is clean and compiles without errors.

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





### Misc
- Do not analyze `.private` folder unless the file from there explicitly mentioned in the conversation
# Architecture Overview

This document describes the technical architecture of the Puppetfile Dependency Manager extension.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code Extension                         │
├─────────────────────────────────────────────────────────────────┤
│  Presentation Layer                                              │
│  ├─ CodeLens Provider (inline buttons)                          │
│  ├─ Hover Provider (tooltip information)                        │
│  └─ Diff Provider (upgrade comparison views)                    │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer                                                   │
│  ├─ PuppetfileParser (syntax parsing)                          │
│  ├─ PuppetForgeService (API client)                            │
│  ├─ UpgradePlannerService (version analysis)                   │
│  ├─ DependencyTreeService (dependency resolution)              │
│  └─ PuppetfileUpdateService (file modifications)               │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                            │
│  ├─ CacheService (API response caching)                        │
│  ├─ GitMetadataService (Git module support)                    │
│  └─ VersionCompatibilityService (conflict detection)           │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### Extension Entry Point (`extension.ts`)
- Registers all VS Code commands
- Initializes providers (Hover, CodeLens)
- Manages extension lifecycle
- Handles command execution

### Presentation Layer

#### PuppetfileCodeLensProvider
- **Purpose**: Shows inline upgrade buttons on module lines
- **Location**: `src/puppetfileCodeLensProvider.ts`
- **Key Methods**:
  - `provideCodeLenses()`: Detects upgradeable modules
  - `applySingleUpgrade()`: Handles individual module updates
- **Features**:
  - Real-time upgrade detection
  - Safe vs. latest version distinction
  - Progress feedback during updates

#### PuppetfileHoverProvider
- **Purpose**: Shows module information on hover
- **Location**: `src/puppetfileHoverProvider.ts`
- **Features**:
  - Version information (current, latest, safe)
  - Module description from Forge
  - Clickable version links
  - Git module support

#### UpgradeDiffProvider
- **Purpose**: Creates diff views for upgrade comparison
- **Location**: `src/services/upgradeDiffProvider.ts`
- **Key Methods**:
  - `showUpgradeDiff()`: Creates diff view
  - `applyAllUpgrades()`: Batch apply functionality
  - `applySelectedUpgrades()`: Selective apply
- **Features**:
  - Virtual document generation
  - Apply action notifications
  - Progress tracking

### Service Layer

#### PuppetfileParser
- **Purpose**: Parses Puppetfile syntax
- **Location**: `src/puppetfileParser.ts`
- **Capabilities**:
  - Forge module parsing (with versions)
  - Git module parsing (URL, branch, tag, ref)
  - Multi-line module definitions
  - Inline comment handling
  - Error reporting with line numbers

#### PuppetForgeService
- **Purpose**: Communicates with Puppet Forge API
- **Location**: `src/puppetForgeService.ts`
- **Features**:
  - Module metadata fetching
  - Version list retrieval
  - Dependency information
  - Built-in caching
  - Proxy support

#### UpgradePlannerService
- **Purpose**: Analyzes upgrade opportunities
- **Location**: `src/services/upgradePlannerService.ts`
- **Key Concepts**:
  - Safe version calculation
  - Conflict detection
  - Upgrade plan generation
  - Unversioned module handling

#### DependencyTreeService
- **Purpose**: Builds dependency trees
- **Location**: `src/dependencyTreeService.ts`
- **Features**:
  - Recursive dependency resolution
  - Circular dependency detection
  - Tree and list view generation
  - Conflict identification

### Infrastructure Layer

#### CacheService
- **Purpose**: Manages API response caching
- **Location**: `src/cacheService.ts`
- **Features**:
  - In-memory caching
  - TTL-based expiration (default: 1 hour)
  - Batch caching operations
  - Clear cache functionality

#### VersionCompatibilityService
- **Purpose**: Checks version compatibility
- **Location**: `src/versionCompatibilityService.ts`
- **Features**:
  - Semantic version parsing
  - Version range evaluation
  - Conflict detection
  - Safe version determination

## Data Flow

### Upgrade Detection Flow
```
1. User opens Puppetfile
2. CodeLensProvider.provideCodeLenses() triggered
3. PuppetfileParser.parseContent() parses modules
4. For each module:
   - PuppetForgeService.checkForUpdate() queries API
   - CacheService checks/stores response
   - CodeLens created if update available
5. User sees inline buttons
```

### Apply Upgrade Flow
```
1. User clicks upgrade button
2. Command 'applySingleUpgrade' executed
3. PuppetfileUpdateService.updateModuleVersionAtLine() called
4. File updated via VS Code TextEditor API
5. CodeLensProvider.refresh() triggered
6. Success notification shown
```

### Upgrade Planner Flow
```
1. User runs "Show upgrade planner"
2. UpgradePlannerService.createUpgradePlan() analyzes all modules
3. CacheService.cacheUncachedModules() pre-fetches data
4. VersionCompatibilityService checks conflicts
5. UpgradeDiffProvider shows comparison
6. User chooses apply action
7. PuppetfileUpdateService.applyUpdates() batch updates
```

## Design Patterns

### Singleton Pattern
- Used for services that maintain state
- Examples: CacheService, CodeLensProvider instance management

### Factory Pattern
- Module creation in PuppetfileParser
- Command registration in extension.ts

### Observer Pattern
- CodeLens refresh on file changes
- Progress reporting during operations

### Strategy Pattern
- Different parsing strategies for Forge vs Git modules
- Safe vs latest version determination

## Performance Considerations

### Caching Strategy
- All Forge API responses cached for 1 hour
- Batch operations to minimize API calls
- Lazy loading of module details

### Throttling
- CodeLens updates debounced
- Batch API requests when possible
- Progress indicators for long operations

### Memory Management
- Cache size limits
- Proper disposal of VS Code resources
- Event listener cleanup

## Testing Architecture

### Unit Tests
- Jest framework
- Extensive mocking of VS Code APIs
- Service isolation with dependency injection
- Located in `src/test/`

### Test Coverage
- Target: >80% code coverage
- Critical paths: Parser, Update Service, Version Logic
- Edge cases: Network failures, parsing errors

## Security Considerations

### API Communication
- HTTPS only for Forge API
- Proxy support for corporate environments
- No credential storage

### File Operations
- Atomic updates via VS Code API
- Validation before file writes
- Backup consideration for large updates

## Extension Points

### Adding New Commands
1. Define command in `package.json`
2. Register handler in `extension.ts`
3. Add to command subscriptions

### Adding New Providers
1. Implement VS Code provider interface
2. Register in `activate()` function
3. Add to disposables

### Adding New Module Sources
1. Extend PuppetfileParser
2. Add source type to PuppetModule
3. Update relevant services

## Future Architecture Considerations

### Planned Enhancements
- WebSocket support for real-time updates
- Background update checking
- Puppetfile.lock support
- Multi-workspace support

### Scalability
- Consider external caching service
- Parallel processing for large Puppetfiles
- Incremental parsing for performance
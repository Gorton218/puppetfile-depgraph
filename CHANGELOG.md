# Change Log

All notable changes to the "puppetfile-depgraph" extension will be documented in this file.

## [0.0.1] - 2025-06-07

### Added
- **Puppetfile Parser**: Comprehensive parsing of Puppetfile syntax
  - Support for Puppet Forge modules with version constraints
  - Support for Git-based modules with tags, refs, and branches
  - Handle various syntax formats and edge cases
  - Real-time error detection and reporting

- **Smart Dependency Updates**:
  - Update all dependencies to safe versions (excludes pre-releases)
  - Update all dependencies to latest versions (includes pre-releases)
  - Bulk update operations with detailed progress reporting
  - Version conflict detection and resolution suggestions

- **Dependency Tree Visualization**:
  - Tree view: Hierarchical display of all dependencies
  - List view: Flat list of direct and transitive dependencies
  - Dependency conflict detection and highlighting
  - Support for both Forge and Git-based modules

- **Rich Hover Tooltips**:
  - Module information from Puppet Forge
  - Version comparison (current vs. latest available)
  - Dependency information
  - Direct links to Puppet Forge pages
  - Git repository information for Git-based modules

- **Language Support**:
  - Syntax highlighting for Puppetfile
  - Language configuration for proper editing experience
  - Context menu integration

- **API Integration**:
  - Puppet Forge API v3 integration
  - Proper error handling and timeouts
  - Network failure graceful fallbacks

- **Testing**:
  - Comprehensive unit tests (33 tests covering all major functionality)
  - Parser tests for various syntax formats
  - API integration tests
  - Dependency tree tests

### Technical Details
- TypeScript-based VS Code extension
- Uses axios for HTTP requests to Puppet Forge API
- Implements proper VS Code extension patterns
- Follows VS Code extension guidelines and best practices

### Files Added
- `src/puppetfileParser.ts` - Core parsing logic
- `src/puppetForgeService.ts` - Puppet Forge API integration
- `src/dependencyTreeService.ts` - Dependency tree building and visualization
- `src/puppetfileUpdateService.ts` - Module update functionality
- `src/puppetfileHoverProvider.ts` - Hover tooltip implementation
- `src/test/` - Comprehensive test suite
- `language-configuration.json` - Language support configuration

### Configuration
- Activation events for Puppetfile files
- Command palette integration
- Context menu integration
- Hover provider registration
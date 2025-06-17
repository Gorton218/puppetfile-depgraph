# Change Log

All notable changes to the "puppetfile-depgraph" extension will be documented in this file.

## [Unreleased]

## [0.1.0] - 2025-06-17
### Added
- **Three-Phase Progress System**: Enhanced dependency tree building with intelligent progress indicators
  - Phase 1 (0-30%): Direct module caching with real-time incremental progress
  - Phase 2 (30-70%): Transitive dependency resolution with smooth animated progress
  - Phase 3 (70-100%): Conflict analysis with incremental progress tracking
  - Animated "breathing" progress bar during Phase 2 to show active work
  - Smart progress coordination ensures smooth transitions between phases
  - Proper incremental progress updates using VS Code's progress API correctly
  - Enhanced user experience with clear phase identification and progress visibility
- **Cancellation Support**: Full cancellation capability for dependency tree operations
  - Cancel button available during all phases of dependency tree building
  - Graceful cleanup of animations, network requests, and partial operations
  - Immediate response to user cancellation requests with proper state cleanup
  - Prevents hanging operations and memory leaks during cancellation
- **Upgrade Planner**: New comprehensive upgrade planning and visualization system
  - New command "Show Upgrade Planner" available in command palette and Puppetfile context menu
  - Analyzes all modules to identify safe upgrade opportunities
  - Detects dependency conflicts preventing upgrades
  - Interactive diff view showing current vs. proposed Puppetfile changes
  - Summary view with upgrade statistics (upgradeable, blocked, unchanged modules)
  - Detailed conflict analysis showing why specific modules cannot be upgraded
  - Progress indication during analysis with cancellation support
  - Supports both Forge and Git modules (Git modules shown as informational)
  - Integrates with existing version compatibility and caching services
- **Interactive Upgrade Actions**: Enhanced Upgrade Planner with direct action capabilities
  - Clickable "Apply" and "Skip" buttons directly within the upgrade diff view
  - Selective module upgrade application without leaving the diff interface
  - Inline action comments showing upgrade options in context with proposed changes
  - New VS Code commands for granular upgrade control (apply/skip individual modules)
  - Real-time feedback with auto-closing success notifications
- **Cache All Modules**: New context menu command "Cache info for all modules"
  - Pre-caches information for all Puppet Forge modules in the Puppetfile
  - Progress bar with cancellation support
  - Processes modules in batches to respect API rate limits
  - Significantly improves hover performance after caching
  - Graceful error handling for individual module failures
- **Advanced Dependency Conflict Detection**: Implemented comprehensive version conflict analysis
  - Real version constraint parsing supporting all Puppet version formats (>=, <, ~>, wildcards)
  - Accurate conflict detection that eliminates false positives
  - Dependency graph tracking with transitive dependency analysis
  - Suggested fixes for version conflicts with actionable recommendations
  - Visual conflict indicators (❌) in dependency tree view
- **Git Module Metadata Support**: Added comprehensive Git repository metadata fetching
  - Fetches metadata.json from Git repositories respecting ref/tag/branch
  - Supports GitHub, GitLab, Bitbucket, and generic Git hosting
  - Rich hover tooltips for Git modules with version, author, license, dependencies
  - Dependency tree analysis for Git modules using their metadata.json
  - Automatic fallback between main/master branches and error handling
  - Caching for improved performance with network requests

### Improved
- **Upgrade Planner User Experience**: Enhanced interface responsiveness and interaction flow
  - Improved progress indicator messaging during upgrade analysis
  - Better modal behavior with proper pop-up window timing and sequence
  - Enhanced visual feedback with contextual apply/skip actions
  - Streamlined workflow allowing users to make granular upgrade decisions
- **CacheService Architecture**: Refactored caching system to eliminate code duplication
  - Consolidated multiple caching methods into a single core implementation
  - Added dual progress modes: internal VS Code dialogs and external progress callbacks
  - Maintained backward compatibility while enabling new three-phase progress system
  - Improved maintainability with single source of truth for caching logic
  - Enhanced flexibility for future progress mechanism additions
- **Dependency Tree Performance**: Optimized dependency tree building with proactive caching
  - Added automatic detection and caching of uncached modules before tree building
  - Progressive updates show exact caching progress for better user feedback
  - Reduced API calls during tree building through intelligent pre-caching
  - Enhanced progress reporting with detailed module-by-module updates
- **Test Coverage**: Enhanced branch coverage for dependency tree service
  - Added comprehensive tests for version sorting algorithms and edge cases
  - Improved error handling test coverage for constraint validation
  - Added tests for transitive dependency resolution scenarios
  - Enhanced coverage for Git modules without ref/tag specifications
  - Branch coverage increased from 79.71% to 81.15% for dependencyTreeService
  - Overall project branch coverage improved from 84.91% to 86.00%

### Fixed
- **Line Number Bug**: Fixed issue where clicking version links always updated line 1
  - Hover provider now correctly preserves the actual line number from cursor position
  - Version update commands now target the correct module line
- **Extra Newline Bug**: Fixed issue where updating module versions added unwanted newlines
  - Now uses VS Code's document API for proper line boundary handling
  - Eliminates formatting issues during version updates
- **Clickable Version Links**: Fixed non-functional version links in hover menu
  - Updated command URI format to work with VS Code's markdown rendering
  - Added proper command argument handling and user feedback
  - Enhanced error handling with informative success/failure messages
- **Dependency Tree Version Resolution**: Fixed incorrect constraint display in dependency tree
  - Tree now uses specific version metadata instead of latest version
  - Correctly resolves transitive dependency versions based on parent constraints
  - Displays accurate version requirements for all dependency levels
  - Module name normalization handles both slash and hyphen formats
- **Inline Comment Support**: Fixed parsing and version updates for lines with comments
  - Parser now correctly strips inline comments before parsing module definitions
  - Version update commands now work correctly on lines with trailing comments
  - Preserves comment text and formatting when updating versions
  - Supports both Forge and Git modules with inline comments
- **Multi-line Git Module Parsing**: Fixed hover tooltips for multi-line Git module definitions
  - Hover provider now correctly parses multi-line Git module syntax
  - Properly extracts Git URL, ref, and tag from modules spanning multiple lines
- **Git Module Comment Parsing**: Fixed Git modules with inline comments being treated as Forge modules
  - Parser now properly detects multi-line modules by checking for trailing commas
  - Hover provider strips comments from each line before parsing module definitions
  - Git modules with comments (e.g., `mod 'name', # comment`) are now correctly identified
  - Shows correct Git metadata dependencies instead of falling back to Forge data
  - Handles various Git module formatting styles (indented parameters)
- **Git Module Name Mismatch**: Fixed critical issue where Git modules break hover functionality
  - Resolved bug where module name in Puppetfile differs from metadata.json name
  - Enhanced error isolation to prevent single problematic module from affecting others
  - Added comprehensive error handling throughout hover provider chain
  - Improved name display showing both Puppetfile name and repository name when different
  - Added graceful fallbacks for all Git module processing stages
- **Upgrade Planner Support for Unversioned Modules**: Fixed missing analysis for modules without versions
  - Upgrade planner now includes Forge modules without version constraints (e.g., `mod 'puppetlabs-nginx'`)
  - Shows version suggestions for unversioned modules similar to Librarian-puppet behavior
  - Fixed extension filter that was excluding unversioned modules from upgrade analysis
  - Properly generates version additions in diff view for unversioned modules
- **Empty Diff Window**: Fixed upgrade planner showing blank comparison window
  - Corrected URI parsing in content provider (checking authority instead of path)
  - Diff view now properly displays current vs proposed Puppetfile content
  - Fixed content provider to handle puppetfile-diff:// URI scheme correctly
- **Apply Button Functionality**: Fixed non-functional apply buttons in upgrade diff view
  - Resolved multiple technical issues with apply button behavior in diff interface
  - Fixed CodeLens provider registration and command execution
  - Improved button responsiveness and user feedback during upgrade operations
  - Enhanced error handling for failed upgrade applications

### Enhanced
- **Improved Hover Menu**: Better version display and interaction
  - Versions now displayed in rows of up to 5 for better readability
  - Only shows newer versions when a specific version is pinned
  - Removed bullet separators between versions for cleaner appearance
  - Added descriptive tooltips for version links
- **Enhanced Caching System**: Restructured and expanded caching for better performance
  - Puppet Forge cache: MODULE_NAME -> MODULE_VERSION -> VERSION_DATA
  - Git metadata cache: URL:REF -> METADATA with smart fallback handling
  - Uses Puppet Forge releases API for comprehensive version information
  - Clear cache command now clears both Forge and Git metadata caches
  - More efficient cache utilization and lookup
- **Enhanced Command Registration**: Improved command handling and validation
  - Better argument parsing for command URIs
  - Comprehensive error handling with user-friendly messages
  - Added logging for debugging command execution
- **Consistent Dependency Formatting**: Standardized dependency display across module types
  - Git modules now use same formatting as Forge modules (hyphen bullets, module names in backticks)
  - Each dependency displayed on separate line for better readability
  - Consistent spacing and formatting throughout hover tooltips

### Technical Improvements
- **New Architecture Components**: Added specialized services for enhanced upgrade management
  - `UpgradeDiffCodeLensProvider`: New service for handling interactive actions in diff views
  - Enhanced `UpgradeDiffProvider` with inline action support and state management
  - Global state management for maintaining upgrade context across diff views
  - New VS Code commands for granular upgrade control
- **Testing**: Expanded test suite with comprehensive caching and concurrency coverage
  - Enhanced CacheService tests with concurrency prevention, progress reporting, and cancellation scenarios
  - Added comprehensive error handling tests for various edge cases and special characters
  - Added tests for large arrays, empty inputs, and operation timeout scenarios
  - Added comprehensive tests for inline comment handling
  - Added tests for version update functionality with comments
  - Added comprehensive Git metadata service tests
  - Enhanced dependency conflict detection test coverage
  - Added integration tests for real-world scenarios
  - Added tests for line number preservation
  - Enhanced hover provider test coverage
  - Added Git module name mismatch test coverage
  - Command registration validation
- **Code Quality**: Improved error handling and user experience
  - Better progress reporting and cancellation support
  - More robust API integration with proper timeout handling
  - Enhanced documentation and code comments
  - Added code quality priorities documentation to CLAUDE.md
- **Reduced Code Duplication**: Strategic refactoring to improve maintainability
  - Reduced parser duplication by extracting common comment stripping logic
  - Refactored test files with helper functions and utilities:
    - dependencyTreeConflicts.test.ts: Added helper functions for module creation and test setup
    - puppetfileUpdateService.test.ts: Extracted common test patterns and mock data
    - versionParser.test.ts: Consolidated test cases using data-driven approach
  - Preserved beneficial test duplication for clarity and independence
  - Documented code quality priorities emphasizing maintainability over duplication metrics
  - Added SonarQube configuration to exclude test files from duplication checks
- **GitHub Workflow Enhancement**: Improved CI pipeline to run comprehensive test coverage
  - Updated GitHub Actions workflow to run both unit and integration tests via `npm run test:all`
  - Ensures complete test coverage validation in CI/CD pipeline
  - Maintains code quality by running all test suites on pull requests and pushes
  - Extended workflow to run on `release/*` branches in addition to `main`

## [0.0.2] - 2025-06-08
### Added
- Hover window now lists all newer versions with clickable links to update the Puppetfile.
### Fixed
- Dependency information and Forge links in the hover window now reference the current module version.

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
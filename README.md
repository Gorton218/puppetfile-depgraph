# Puppetfile Dependency Manager

A comprehensive VS Code extension for managing Puppet module dependencies with visual dependency analysis, safe update recommendations, and intelligent hover tooltips.

## Features

### 🔍 **Intelligent Puppetfile Parsing**
- Parse Puppet Forge modules with version constraints
- Support for Git-based modules with tags, refs, and branches
- Handle various syntax formats and edge cases
- Real-time error detection and reporting

### 🔄 **Smart Dependency Updates**
- **Update to Safe Versions**: Update all modules to the latest stable versions (excludes pre-releases)
- **Update to Latest Versions**: Update all modules to the absolute latest versions (includes pre-releases)
- Bulk update operations with detailed progress reporting
- Version conflict detection and resolution suggestions

### 📋 **Upgrade Planner**
- **Interactive Upgrade Planning**: Comprehensive analysis of all upgrade opportunities
- **Selective Upgrades**: Apply or skip individual module upgrades directly from the diff view
- **Conflict Detection**: Identifies dependency conflicts that prevent upgrades
- **Visual Diff Interface**: Side-by-side comparison of current vs. proposed Puppetfile changes
- **Progress Tracking**: Real-time progress indication with cancellation support
- **One-Click Actions**: Apply and Skip buttons integrated directly into the upgrade diff
- **Upgrade Statistics**: Summary view showing upgradeable, blocked, and unchanged modules
- **Smart Module Name Handling**: Automatically normalizes module names between slash and dash formats
- **Circular Dependency Detection**: Identifies and reports circular dependency chains
- **Safe Upgrade Path**: Prioritizes stable versions over pre-releases by default
- **Blocked Module Explanations**: Clear explanations of why certain modules cannot be upgraded

### 🌳 **Dependency Tree Visualization**
- **Tree View**: Hierarchical display of all dependencies and their relationships
- **List View**: Flat list of direct and transitive dependencies
- Dependency conflict detection and highlighting
- Support for both Forge and Git-based modules

### 💡 **Rich Hover Tooltips**
- Module information from Puppet Forge
- Version comparison (current vs. latest available)
- Dependency information
- Direct links to Puppet Forge pages
- Clickable list of newer versions for quick updates
- Git repository information for Git-based modules

### 🎯 **Context Menu Integration**
- Right-click on Puppetfile to access extension commands
- Quick access to dependency tree visualization
- Seamless integration with VS Code workflow

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Puppetfile Dependency Manager"
4. Install the extension

## Usage

### Basic Operations

1. **Open a Puppetfile** in VS Code
2. The extension automatically activates and provides language support

### Commands

Access these commands via:
- **Command Palette** (Ctrl+Shift+P): Search for "Puppetfile"
- **Context Menu**: Right-click in a Puppetfile
- **VS Code Menu**: View → Command Palette

#### Available Commands:

- **`Puppetfile: Update all dependencies to safe versions`**
  - Updates all Forge modules to their latest stable versions
  - Excludes pre-release versions (alpha, beta, rc, dev, etc.)
  - Shows detailed update summary

- **`Puppetfile: Update all dependencies to latest versions`**
  - Updates all Forge modules to their absolute latest versions
  - Includes pre-release versions
  - Shows confirmation dialog before proceeding

- **`Puppetfile: Show dependency tree`**
  - Choose between Tree View or List View
  - Displays comprehensive dependency information
  - Highlights potential version conflicts

- **`Puppetfile: Show Upgrade Planner`**
  - Analyzes all modules for upgrade opportunities
  - Shows interactive diff with current vs. proposed changes
  - Provides Apply/Skip buttons for selective upgrades
  - Detects and explains dependency conflicts
  - Displays upgrade statistics and recommendations
  - **Interactive Controls**: Click "Apply" to immediately upgrade a specific module, or "Skip" to exclude it from the upgrade
  - **Automatic Refresh**: The diff view automatically updates after each applied upgrade
  - **Conflict Resolution**: Clearly shows which dependencies are blocking upgrades and why

- **`Puppetfile: Cache info for all modules`**
  - Pre-caches information for all Puppet Forge modules in the Puppetfile
  - Significantly improves hover tooltip performance
  - Progress bar with cancellation support
  - Processes modules in batches to respect API rate limits

### Hover Information

Simply hover over any module name in your Puppetfile to see:
- Current and latest version information
- Direct dependencies
- Links to Puppet Forge or Git repositories

### Interactive Upgrade Diff View

When using the Upgrade Planner, the extension provides an interactive diff view:

1. **Side-by-side Comparison**: See your current Puppetfile on the left and the proposed changes on the right
2. **Inline Controls**: Each upgradeable module has "Apply" and "Skip" buttons directly in the diff view
3. **Real-time Updates**: After clicking "Apply", the diff automatically refreshes to show remaining upgrades
4. **Clear Visual Indicators**: 
   - Green highlights for modules that can be safely upgraded
   - Red highlights for modules with conflicts
   - Gray text for modules that are already up-to-date
5. **Detailed Information**: Each module shows:
   - Current version → Proposed version
   - Reason for upgrade (new features, bug fixes, etc.)
   - Any blocking dependencies or conflicts

## Supported Puppetfile Syntax

The extension supports various Puppetfile module declaration formats:

### Forge Modules
```ruby
# Simple module without version (uses latest)
mod 'puppetlabs/stdlib'

# Module with specific version
mod 'puppetlabs/stdlib', '8.5.0'

# Mixed quote styles
mod "puppetlabs/firewall", '3.4.0'
```

### Git Modules
```ruby
# Git module with tag
mod 'custom/module',
  :git => 'https://github.com/user/module.git',
  :tag => 'v1.0.0'

# Git module with ref/branch
mod 'custom/module',
  :git => 'https://github.com/user/module.git',
  :ref => 'main'

# Git module without specific ref (uses default branch)
mod 'custom/module',
  :git => 'https://github.com/user/module.git'
```

## Configuration

The extension works out of the box with no configuration required. It automatically:
- Detects Puppetfile files by name
- Provides syntax highlighting and language support
- Integrates with the Puppet Forge API
- Handles network timeouts and errors gracefully

## Development

### Building from Source

1. Clone the repository
2. Install dependencies: `npm install`
3. Compile: `npm run compile`
4. Run tests: `npm test`
5. Package: `npm run package`

### Testing

The extension includes comprehensive test coverage:
- **Unit Tests**: Fast, isolated tests using Jest framework
- **VS Code Integration Tests**: Tests for extension functionality with mocked services
- **End-to-End Tests**: Complete workflow tests including upgrade planning
- **Performance Tests**: Benchmarks for caching and large file handling
- **API Integration Tests**: Separate tests for real Puppet Forge API validation

Run tests with:
- `npm test` - Run all tests (unit + integration + e2e)
- `npm run test:unit` - Unit tests only
- `npm run test:vscode` - VS Code integration tests
- `npm run test:e2e` - End-to-end workflow tests
- `npm run test:performance` - Performance benchmarks
- `npm run test:api-integration` - Real API tests (requires internet)

## API Integration

### Puppet Forge API
- Uses the official Puppet Forge API v3
- Respects rate limits and implements proper error handling
 - Caches responses for improved performance
 - Cache can be cleared via the **Clear Puppet Forge cache** command (also available from the Puppetfile context menu)
- Falls back gracefully when API is unavailable

### Network Requirements
- Requires internet access for Forge API calls
- All API calls have configurable timeouts
- Works offline for basic parsing functionality

## Troubleshooting

### Common Issues

**Extension not activating:**
- Ensure the file is named exactly `Puppetfile` (case-sensitive)
- Check that VS Code recognizes the file type

**Hover tooltips not showing:**
- Hover directly over module names
- Check internet connectivity for Forge API access
- Wait a moment for API responses

**Update commands not working:**
- Ensure Puppetfile syntax is valid
- Check for parsing errors in the output
- Verify internet connectivity

**Tests failing:**
- Network-dependent tests may fail without internet access
- API rate limits may cause intermittent failures
- Run tests with: `npm test -- --timeout 30000` for longer timeouts

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass
5. Submit a pull request

### Development Setup

```bash
# Clone and setup
git clone <repository-url>
cd puppetfile-depgraph
npm install

# Development workflow
npm run watch    # Watch mode for development
npm run compile  # One-time compilation
npm run lint     # Linting
npm test         # Run tests
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

## Support

For issues, feature requests, or questions:
- Create an issue on GitHub
- Check existing issues for solutions
- Refer to VS Code extension development documentation

---

**Enjoy managing your Puppet dependencies with ease! 🎭**

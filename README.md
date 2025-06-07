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

### Hover Information

Simply hover over any module name in your Puppetfile to see:
- Current and latest version information
- Direct dependencies
- Links to Puppet Forge or Git repositories

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
5. Package: `vsce package`

### Testing

The extension includes comprehensive unit tests covering:
- Puppetfile parsing for various syntax formats
- Puppet Forge API integration
- Dependency tree building and visualization
- Version comparison and update logic

Run tests with: `npm test`

## API Integration

### Puppet Forge API
- Uses the official Puppet Forge API v3
- Respects rate limits and implements proper error handling
- Caches responses for improved performance
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

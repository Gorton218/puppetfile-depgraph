# Getting Started with Puppetfile Dependency Manager

This guide will help you get started with the Puppetfile Dependency Manager extension for VS Code.

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "Puppetfile Dependency Manager"
4. Click Install

### From VSIX File
1. Download the `.vsix` file from the releases page
2. In VS Code, go to Extensions view
3. Click the "..." menu and select "Install from VSIX..."
4. Select the downloaded file

## Basic Usage

### Opening a Puppetfile
The extension automatically activates when you open a file named `Puppetfile` or any file with the Puppetfile language mode.

### Viewing Module Information
Hover over any module declaration to see:
- Current version
- Latest available version
- Safe upgrade version
- Module description

### Checking for Updates
1. Open your Puppetfile
2. Look for inline upgrade buttons on modules with available updates
3. Or use Command Palette (`Ctrl+Shift+P`) and run "Puppetfile: Show upgrade planner"

## Key Features

### 1. Inline Upgrade Buttons
```puppet
mod 'puppetlabs/stdlib', '4.25.0'  [↑ Update to 5.2.0]
```
Click the button to instantly upgrade the module.

### 2. Hover Information
Hover over any module to see detailed version information:
```
Current: 4.25.0
Latest: 5.2.0
Safe: 5.2.0
Description: Standard library of resources for Puppet modules
```

### 3. Dependency Tree
View all module dependencies:
1. Right-click on Puppetfile
2. Select "Show dependency tree"
3. Choose tree or list view

### 4. Batch Updates
Update all modules at once:
- Command: "Puppetfile: Update all dependencies to safe versions"
- Command: "Puppetfile: Update all dependencies to latest versions"

## Configuration

### Extension Settings
Access settings via File → Preferences → Settings → Extensions → Puppetfile Dependency Manager

Available settings:
- `puppetfile-depgraph.forgeApiUrl`: Custom Puppet Forge API URL
- `puppetfile-depgraph.httpProxy`: HTTP proxy configuration
- `puppetfile-depgraph.cacheEnabled`: Enable/disable API response caching

### Proxy Configuration
If you're behind a corporate proxy:
```json
{
  "puppetfile-depgraph.httpProxy": "http://proxy.company.com:8080"
}
```

## Common Workflows

### Updating a Single Module
1. Find the module in your Puppetfile
2. Click the inline upgrade button
3. Confirm the update

### Reviewing All Available Updates
1. Run "Show upgrade planner"
2. Select "Show All Safe Upgrades"
3. Review the diff
4. Click "Apply All" or "Select Modules..."

### Checking for Conflicts
1. Run "Show upgrade planner"
2. Select "Show Blocked Modules"
3. Review which dependencies are preventing upgrades

## Tips and Tricks

### Keyboard Shortcuts
- Quick Command: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
- Toggle CodeLens: `Ctrl+Shift+.` to show/hide inline buttons

### Performance Tips
- Clear cache regularly: "Puppetfile: Clear Puppet Forge cache"
- Pre-cache all modules: "Puppetfile: Cache info for all modules"

### Best Practices
1. Always review changes before applying
2. Test your Puppet code after updates
3. Commit your Puppetfile after successful updates
4. Use safe versions for production environments

## Next Steps

- Read about [Advanced Upgrade Features](./upgrade-features.md)
- Learn about [Extension Architecture](./architecture.md)
- Configure [Extension Settings](./configuration.md)

## Getting Help

If you encounter issues:
1. Check the [Troubleshooting Guide](./upgrade-features.md#troubleshooting)
2. View extension output: View → Output → Select "Puppetfile Dependency Manager"
3. Report issues on [GitHub](https://github.com/example-org/puppetfile-depgraph/issues)
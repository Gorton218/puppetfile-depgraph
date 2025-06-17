# Puppetfile Upgrade Features

This document describes the upgrade management features available in the Puppetfile Dependency Manager extension.

## Table of Contents
- [Overview](#overview)
- [Upgrade Planner](#upgrade-planner)
- [Inline Upgrade Buttons (CodeLens)](#inline-upgrade-buttons-codelens)
- [Diff View with Apply Actions](#diff-view-with-apply-actions)
- [Command Reference](#command-reference)
- [Technical Details](#technical-details)

## Overview

The Puppetfile Dependency Manager provides multiple ways to manage and apply module version upgrades:

1. **Inline Upgrade Buttons**: See and apply upgrades directly on module lines
2. **Upgrade Planner**: Analyze all available upgrades with safe version detection
3. **Diff View**: Compare current vs proposed changes with batch apply options

## Inline Upgrade Buttons (CodeLens)

### Description
When you open a Puppetfile, the extension automatically displays inline upgrade buttons directly on module lines that have available updates.

### How It Works
1. Open any Puppetfile in VS Code
2. For each module with an available upgrade, you'll see buttons like:
   - `↑ Update to 2.0.0` - Safe upgrade to a stable version
   - `📦 Update to 2.1.0-beta (latest)` - Latest version (may include pre-releases)

### Features
- **Real-time Detection**: Buttons appear automatically when viewing Puppetfile
- **Safe vs Latest**: Shows both safe and latest versions when they differ
- **One-Click Updates**: Click any button to immediately apply that specific upgrade
- **Progress Feedback**: Shows progress notification during update
- **Auto-Refresh**: Buttons disappear after successful update

### Example
```puppet
mod 'puppetlabs/stdlib', '4.25.0'  [↑ Update to 5.2.0]
mod 'puppetlabs/apache', '3.0.0'   [↑ Update to 3.5.0] [📦 Update to 4.0.0-rc1 (latest)]
```

## Upgrade Planner

### Description
The Upgrade Planner provides a comprehensive analysis of all available module upgrades in your Puppetfile.

### How to Use
1. Open a Puppetfile
2. Run command: `Puppetfile: Show upgrade planner`
3. Choose from the options:
   - **Show All Safe Upgrades**: View diff with all safe upgrades
   - **Show Upgrade Summary**: Detailed analysis of all modules
   - **Show Blocked Modules**: See modules that can't be upgraded due to conflicts

### Safe Version Detection
The planner automatically determines "safe" versions by:
- Avoiding pre-release versions (alpha, beta, rc)
- Respecting semantic versioning for minor/patch updates
- Detecting dependency conflicts between modules

## Diff View with Apply Actions

### Description
When viewing proposed upgrades in the diff view, you can apply changes directly from the interface.

### Workflow
1. Run the upgrade planner and select "Show All Safe Upgrades"
2. Review the diff showing current vs proposed changes
3. When ready, you'll see a notification with options:
   - **Apply All**: Apply all safe upgrades at once
   - **Select Modules...**: Choose specific modules to upgrade
   - **Dismiss**: Close without applying changes

### Apply All Upgrades
- Applies all safe upgrades in a single operation
- Shows progress for each module being updated
- Displays summary of all applied changes

### Apply Selected Upgrades
- Opens a multi-select list of available upgrades
- Shows current → new version for each module
- Indicates when safe version differs from latest
- Apply only the modules you select

### Example Summary
```
Successfully applied 3 module upgrades:
• puppetlabs/stdlib: 4.25.0 → 5.2.0
• puppetlabs/apache: 3.0.0 → 3.5.0
• puppetlabs/concat: 4.0.0 → 4.2.0
```

## Command Reference

### Available Commands

| Command | Description | Access |
|---------|-------------|---------|
| `puppetfile-depgraph.showUpgradePlanner` | Open the upgrade planner | Command Palette, Context Menu |
| `puppetfile-depgraph.applyAllUpgrades` | Apply all safe upgrades from diff view | Notification button |
| `puppetfile-depgraph.applySelectedUpgrades` | Select specific upgrades to apply | Notification button |
| `puppetfile-depgraph.applySingleUpgrade` | Apply a single module upgrade | CodeLens button |
| `puppetfile-depgraph.updateAllToSafe` | Update all modules to safe versions | Command Palette |
| `puppetfile-depgraph.updateAllToLatest` | Update all modules to latest versions | Command Palette |

### Command Palette
Access commands via:
- Windows/Linux: `Ctrl+Shift+P`
- macOS: `Cmd+Shift+P`
- Type "Puppetfile" to see all available commands

### Context Menu
Right-click on a Puppetfile to access:
- Show upgrade planner
- Show dependency tree
- Cache info for all modules

## Technical Details

### Architecture

#### CodeLens Provider
- Located in `src/puppetfileCodeLensProvider.ts`
- Implements `vscode.CodeLensProvider` interface
- Checks each Forge module for available updates
- Creates clickable CodeLens items with upgrade commands

#### Upgrade Diff Provider
- Located in `src/services/upgradeDiffProvider.ts`
- Creates virtual diff documents for comparison
- Manages upgrade plan state for apply operations
- Handles batch update operations

#### Upgrade Planner Service
- Located in `src/services/upgradePlannerService.ts`
- Analyzes all modules for upgrade opportunities
- Determines safe vs latest versions
- Detects version conflicts and blocked upgrades

### Performance Considerations
- CodeLens updates are throttled to prevent excessive API calls
- Puppet Forge API responses are cached to improve performance
- Batch operations minimize file writes

### Error Handling
- Network failures show user-friendly error messages
- Parsing errors are reported with line numbers
- Failed updates don't affect other modules in batch operations

### Testing
- Comprehensive unit tests for all upgrade features
- Mock implementations for VS Code APIs
- Test coverage for error scenarios

## Best Practices

1. **Review Before Applying**: Always review proposed upgrades in the diff view
2. **Test After Upgrades**: Run your Puppet tests after applying upgrades
3. **Use Safe Versions**: Prefer safe versions unless you specifically need latest features
4. **Check Conflicts**: Review blocked modules to understand dependency constraints
5. **Incremental Updates**: Consider updating a few modules at a time for large Puppetfiles

## Troubleshooting

### Buttons Not Appearing
- Ensure the file is recognized as a Puppetfile (check language mode)
- Try running "Clear Puppet Forge cache" command
- Check VS Code's Output panel for extension errors

### Updates Failing
- Verify you have write permissions to the Puppetfile
- Check for syntax errors in the Puppetfile
- Ensure network connectivity to Puppet Forge

### Performance Issues
- Clear the cache if responses seem outdated
- Disable CodeLens in VS Code settings if needed
- Report issues with specific modules on GitHub
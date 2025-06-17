# Feature Examples

Visual examples and use cases for the Puppetfile Dependency Manager features.

## Inline Upgrade Buttons (CodeLens)

### Basic Example
When you open a Puppetfile, you'll see upgrade buttons directly on outdated modules:

```puppet
# Modules with available updates show inline buttons
mod 'puppetlabs/stdlib', '4.25.0'     [↑ Update to 5.2.0]
mod 'puppetlabs/apache', '3.0.0'      [↑ Update to 3.5.0] [📦 Update to 4.0.0-rc1 (latest)]
mod 'puppetlabs/concat', '4.2.0'      # No button = already up to date
mod 'puppetlabs/firewall', '1.12.0'   [↑ Update to 2.0.0]
```

### What the Buttons Mean
- `[↑ Update to X.X.X]` - Safe, stable version upgrade
- `[📦 Update to X.X.X (latest)]` - Latest version, may include pre-releases

## Hover Information

### Forge Module with Updates
Hovering over `mod 'puppetlabs/stdlib', '4.25.0'` shows:
```
puppetlabs/stdlib
Current Version: 4.25.0
Latest Version: 5.2.0 ✓ (safe)
Description: Standard library of resources for Puppet modules
View on Forge | Latest | 5.2.0
```

### Git Module
Hovering over a Git module shows:
```
example/mymodule (git)
Git URL: https://github.com/example/puppet-mymodule.git
Branch: master
Latest Tag: v2.1.0
View Repository
```

### Unversioned Module
Hovering over `mod 'puppetlabs/ntp'` shows:
```
puppetlabs/ntp
⚠️ No version specified
Latest Version: 8.5.0
Recommended: Add version '8.5.0'
View on Forge | Latest
```

## Upgrade Planner Views

### Main Menu
Running "Show upgrade planner" displays:
```
Puppetfile Upgrade Planner
Choose an action:

→ Show All Safe Upgrades (12)
  Show diff with all modules that can be safely upgraded

→ Show Upgrade Summary
  View detailed analysis (45 Forge, 3 Git)

→ Show Blocked Modules (3)
  View modules that cannot be upgraded and why
```

### Diff View Example
The diff view shows current vs proposed changes:
```diff
  mod 'puppetlabs/stdlib', '4.25.0'     |  mod 'puppetlabs/stdlib', '5.2.0'
  mod 'puppetlabs/apache', '3.0.0'      |  mod 'puppetlabs/apache', '3.5.0'
- mod 'puppetlabs/mysql', '5.0.0'       |  mod 'puppetlabs/mysql', '10.0.0'
+ mod 'puppetlabs/postgresql', '6.0.0'  |  mod 'puppetlabs/postgresql', '6.5.0'
  mod 'puppetlabs/firewall', '1.12.0'   |  mod 'puppetlabs/firewall', '2.0.0'
```

### Apply Actions Notification
After viewing the diff:
```
Found 12 modules with safe upgrades available
[Apply All] [Select Modules...] [Dismiss]
```

## Select Modules Dialog

When choosing "Select Modules...", you see:
```
Select Modules to Upgrade
Choose which modules to upgrade (Space to toggle, Enter to confirm)

☑ 📦 puppetlabs/stdlib          4.25.0 → 5.2.0
☑ 📦 puppetlabs/apache          3.0.0 → 3.5.0
                                Latest: 4.0.0-rc1 (using safe version)
☑ 📦 puppetlabs/concat          4.0.0 → 4.2.0
☐ 📦 puppetlabs/mysql           5.0.0 → 10.0.0
☑ 📦 puppetlabs/firewall        1.12.0 → 2.0.0

[OK] [Cancel]
```

## Upgrade Summary View

The upgrade summary provides detailed analysis:
```markdown
# Upgrade Plan Summary
Total modules: 48
Upgradeable: 12
Blocked: 3
Generated: 2024-01-15T10:30:00Z

## Upgradeable Modules

### puppetlabs/stdlib
- Current: 4.25.0
- Safe Upgrade: 5.2.0
- Latest: 5.2.0
- Breaking Changes: No

### puppetlabs/apache
- Current: 3.0.0
- Safe Upgrade: 3.5.0
- Latest: 4.0.0-rc1
- Note: Latest is pre-release, using safe version

## Git Modules (3)
- example/app_module (branch: production)
- example/profile (tag: v1.2.0)
- example/role (branch: master)
```

## Blocked Modules View

Shows why certain modules can't be upgraded:
```markdown
# Blocked Modules Analysis

Found 3 modules that cannot be upgraded due to dependency conflicts:

## puppetlabs/mysql
**Current Version:** 5.0.0
**Latest Available:** 10.0.0
**Blocked By:** puppetlabs/apache

**Conflicts:**
- puppetlabs/apache (3.0.0) requires puppetlabs/mysql >= 3.0.0 < 6.0.0

**Possible Solutions:**
- Update puppetlabs/apache to version 5.0.0 or higher first
- Wait for newer versions of the blocking modules
- Consider alternative modules without conflicts
```

## Progress Notifications

### Single Module Update
```
Updating puppetlabs/stdlib
4.25.0 → 5.2.0
[████████████████████] 100% Complete!
✓ Successfully updated puppetlabs/stdlib to version 5.2.0
```

### Batch Update
```
Applying upgrades
Preparing 12 upgrades...
[████████░░░░░░░░░░░░] 40% Applying changes to Puppetfile...
[████████████████████] 100% Complete!

Successfully applied 12 module upgrades:
• puppetlabs/stdlib: 4.25.0 → 5.2.0
• puppetlabs/apache: 3.0.0 → 3.5.0
• puppetlabs/concat: 4.0.0 → 4.2.0
... and 9 more
```

## Command Palette Examples

Typing "puppet" in the command palette shows:
```
> puppet
Puppetfile: Show upgrade planner
Puppetfile: Update all dependencies to safe versions
Puppetfile: Update all dependencies to latest versions
Puppetfile: Show dependency tree
Puppetfile: Clear Puppet Forge cache
Puppetfile: Cache info for all modules
Puppetfile: About Puppetfile Dependency Manager
```

## Real-World Scenarios

### Scenario 1: Production Update
You want to update only stable versions:
1. Run "Show upgrade planner"
2. Select "Show All Safe Upgrades"
3. Review the diff
4. Click "Apply All"
5. Test your Puppet code
6. Commit the updated Puppetfile

### Scenario 2: Selective Testing
You want to test specific module updates:
1. Look for CodeLens buttons on specific modules
2. Click individual update buttons
3. Or use "Select Modules..." for multiple updates
4. Test the specific changes
5. Roll back if needed by reverting the file

### Scenario 3: Investigating Blocks
A module won't update:
1. Run "Show upgrade planner"
2. Select "Show Blocked Modules"
3. Identify the blocking dependencies
4. Update blockers first
5. Retry the original update
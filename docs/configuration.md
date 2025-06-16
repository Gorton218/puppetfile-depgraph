# Configuration Guide

This guide covers all configuration options available for the Puppetfile Dependency Manager extension.

## Extension Settings

Access settings through:
- **UI**: File → Preferences → Settings → Extensions → Puppetfile Dependency Manager
- **JSON**: File → Preferences → Settings → Open Settings (JSON)
- **Command**: "Preferences: Open Settings" from Command Palette

### Available Settings

#### `puppetfile-depgraph.forgeApiUrl`
- **Type**: `string`
- **Default**: `"https://forgeapi.puppet.com/v3/"`
- **Description**: The Puppet Forge API endpoint URL
- **Example**:
  ```json
  {
    "puppetfile-depgraph.forgeApiUrl": "https://forge.internal.company.com/v3/"
  }
  ```

#### `puppetfile-depgraph.httpProxy`
- **Type**: `string`
- **Default**: `""`
- **Description**: HTTP proxy URL for Forge API requests
- **Format**: `http://[username:password@]proxy.host:port`
- **Examples**:
  ```json
  {
    "puppetfile-depgraph.httpProxy": "http://proxy.company.com:8080"
  }
  ```
  ```json
  {
    "puppetfile-depgraph.httpProxy": "http://user:pass@proxy.company.com:8080"
  }
  ```

#### `puppetfile-depgraph.cacheEnabled`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable caching of Puppet Forge API responses
- **Example**:
  ```json
  {
    "puppetfile-depgraph.cacheEnabled": false
  }
  ```

#### `puppetfile-depgraph.cacheTTL`
- **Type**: `number`
- **Default**: `3600000` (1 hour in milliseconds)
- **Description**: Cache time-to-live for API responses
- **Example** (30 minutes):
  ```json
  {
    "puppetfile-depgraph.cacheTTL": 1800000
  }
  ```

#### `puppetfile-depgraph.enableCodeLens`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable inline upgrade buttons (CodeLens)
- **Example**:
  ```json
  {
    "puppetfile-depgraph.enableCodeLens": false
  }
  ```

#### `puppetfile-depgraph.enableHover`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable hover tooltips for modules
- **Example**:
  ```json
  {
    "puppetfile-depgraph.enableHover": false
  }
  ```

## Workspace Settings

Settings can be configured at different levels:
1. **User Settings**: Apply globally to all projects
2. **Workspace Settings**: Apply only to the current workspace
3. **Folder Settings**: Apply to specific folders in multi-root workspaces

### Example Workspace Configuration
`.vscode/settings.json`:
```json
{
  "puppetfile-depgraph.forgeApiUrl": "https://forge.internal.company.com/v3/",
  "puppetfile-depgraph.httpProxy": "http://corporate-proxy:8080",
  "puppetfile-depgraph.cacheTTL": 7200000
}
```

## Language Configuration

### File Associations
Ensure Puppetfile is recognized:
```json
{
  "files.associations": {
    "Puppetfile": "puppetfile",
    "*.puppetfile": "puppetfile"
  }
}
```

### Editor Settings for Puppetfile
Recommended editor settings:
```json
{
  "[puppetfile]": {
    "editor.tabSize": 2,
    "editor.insertSpaces": true,
    "editor.formatOnSave": false,
    "editor.trimAutoWhitespace": true
  }
}
```

## CodeLens Configuration

### Disable CodeLens Globally
```json
{
  "editor.codeLens": false
}
```

### Disable CodeLens for Puppetfile Only
```json
{
  "[puppetfile]": {
    "editor.codeLens": false
  }
}
```

### Customize CodeLens Appearance
```json
{
  "workbench.colorCustomizations": {
    "editorCodeLens.foreground": "#999999"
  }
}
```

## Performance Tuning

### For Large Puppetfiles
```json
{
  "puppetfile-depgraph.enableCodeLens": false,
  "puppetfile-depgraph.cacheTTL": 7200000,
  "editor.hover.delay": 1000
}
```

### For Slow Networks
```json
{
  "puppetfile-depgraph.cacheTTL": 86400000,
  "puppetfile-depgraph.httpProxy": "http://local-cache-proxy:3128"
}
```

## Proxy Configuration Details

### Environment Variables
The extension respects system proxy settings:
- `HTTP_PROXY`
- `HTTPS_PROXY`
- `NO_PROXY`

### Priority Order
1. Extension setting (`puppetfile-depgraph.httpProxy`)
2. VS Code proxy settings (`http.proxy`)
3. Environment variables

### Proxy Authentication
For authenticated proxies:
```json
{
  "puppetfile-depgraph.httpProxy": "http://username:password@proxy:8080"
}
```

**Security Note**: Consider using environment variables for credentials:
```bash
export HTTP_PROXY="http://${PROXY_USER}:${PROXY_PASS}@proxy:8080"
```

## Troubleshooting Configuration

### Debug Logging
Enable detailed logging:
1. View → Output
2. Select "Puppetfile Dependency Manager" from dropdown
3. Check for configuration-related messages

### Common Issues

#### Proxy Connection Failed
```json
{
  "puppetfile-depgraph.httpProxy": "http://proxy.company.com:8080",
  "http.proxyStrictSSL": false
}
```

#### Cache Not Working
1. Check if caching is enabled
2. Clear existing cache: "Puppetfile: Clear Puppet Forge cache"
3. Verify write permissions to VS Code's global storage

#### CodeLens Not Appearing
1. Ensure CodeLens is enabled globally
2. Check language mode is "puppetfile"
3. Try "Developer: Reload Window"

## Environment-Specific Configurations

### Development Environment
```json
{
  "puppetfile-depgraph.cacheEnabled": false,
  "puppetfile-depgraph.enableCodeLens": true,
  "editor.codeLens": true
}
```

### Production Environment
```json
{
  "puppetfile-depgraph.cacheTTL": 86400000,
  "puppetfile-depgraph.httpProxy": "http://prod-proxy:8080",
  "puppetfile-depgraph.enableCodeLens": true
}
```

### CI/CD Environment
```json
{
  "puppetfile-depgraph.cacheEnabled": true,
  "puppetfile-depgraph.cacheTTL": 604800000,
  "puppetfile-depgraph.enableCodeLens": false,
  "puppetfile-depgraph.enableHover": false
}
```

## Migration Guide

### From Earlier Versions
If upgrading from an earlier version:
1. Old cache will be automatically cleared
2. Review new settings options
3. Update workspace settings if needed

### Settings Reset
To reset all settings to defaults:
1. Open Settings (JSON)
2. Remove all `puppetfile-depgraph.*` entries
3. Reload VS Code window
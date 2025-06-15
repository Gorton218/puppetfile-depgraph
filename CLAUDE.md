# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
Tests use Mocha framework with the VS Code test runner. Test files are in `src/test/` and use `suite()` and `test()` functions.

## Architecture

### Service Layer Architecture
- **puppetfileParser.ts**: Parses Puppetfile syntax (Forge and Git modules)
- **puppetForgeService.ts**: Puppet Forge API client with caching
- **dependencyTreeService.ts**: Builds and manages dependency trees
- **puppetfileUpdateService.ts**: Handles module version updates
- **puppetfileHoverProvider.ts**: Provides hover tooltips with version info

### Key Patterns
1. Services are singleton instances exported from their modules
2. All services support proxy configuration via VS Code settings
3. Parser returns structured data with line numbers for editor integration
4. Caching layer reduces API calls to Puppet Forge

### API Integration
- Uses axios for HTTP requests
- Puppet Forge API endpoint: `https://forgeapi.puppet.com/v3/`
- Supports HTTP/HTTPS proxies via `https-proxy-agent`

## Extension Activation
- Activates on files with language ID "puppetfile"
- Registers commands:
  - `puppetfile-depgraph.updateModule`: Update specific module
  - `puppetfile-depgraph.showDependencyTree`: Show dependency tree
  - `puppetfile-depgraph.clearCache`: Clear Forge API cache

## Feature Implementation Status

### Implemented Features
- ✅ Puppetfile parsing (Forge and Git modules)
- ✅ Puppet Forge API integration with caching
- ✅ Hover tooltips showing latest and safe versions
- ✅ Version update commands (safe/latest)
- ✅ Basic dependency tree visualization
- ✅ Clickable version links in hover tooltips

### Planned Features (from PRD)
- ❌ Dependency analysis engine (deep dependency resolution)
- ❌ Changelog generation across multiple modules
- ❌ Advanced UI panels for dependency trees
- ❌ Puppetfile.lock support

## Current Development Focus
The project is actively being enhanced with improvements to hover tooltips, caching functionality, and Puppet Forge integration. Recent work includes implementing batch caching, fixing version-specific links, and improving the dependency display for modules.

## Development Guidelines

### Temporary Files and Testing
- Use the `claude-temp/` folder for all temporary development files, stubs, and mocks
- This folder is ignored by Git and provides a clean workspace for development artifacts
- File naming conventions:
  - `test-*.js` - Temporary test files
  - `mock-*.js` - Mock data or service files  
  - `debug-*.js` - Debug scripts and utilities
  - `scratch-*.js` - Experimental code snippets
  - `stub-*.js` - Stub implementations for testing

### Code Quality
- Always run `npm test` before committing changes
- Use TypeScript strict mode and maintain type safety
- Follow existing code patterns and conventions
- Add tests for new functionality
- Do not update the `CHANGELOG.md` file unless explicitly instructed
- Always use LF (Line Feed) line endings for all files

### Code Quality Priorities
When evaluating code improvements, prioritize in this order:
1. **Maintainability** - Code should be easy to understand and modify
2. **Reliability** - Code should work correctly and consistently
3. **Code Coverage** - Tests should cover important functionality
4. **Code Duplication** - Some duplication is acceptable if it improves clarity

Note: Test code duplication is often beneficial for test clarity and independence. Each test should be self-contained and easy to understand without excessive abstraction.

### Misc
- Do not analyze `.private` folder unless the file from there explicitly mentioned in the conversation
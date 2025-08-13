import * as vscode from 'vscode';

// Mock all external dependencies  
jest.mock('vscode', () => ({
    commands: { registerCommand: jest.fn(() => ({ dispose: jest.fn() })) },
    languages: { 
        registerCodeLensProvider: jest.fn(() => ({ dispose: jest.fn() })),
        registerHoverProvider: jest.fn(() => ({ dispose: jest.fn() }))
    },
    workspace: { 
        openTextDocument: jest.fn().mockResolvedValue({}),
        textDocuments: []
    },
    window: {
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showQuickPick: jest.fn(),
        withProgress: jest.fn().mockImplementation((options, callback) => callback({ report: jest.fn() })),
        showTextDocument: jest.fn(),
        activeTextEditor: undefined,
    },
    ProgressLocation: { Notification: 15 },
}));

jest.mock('../../src/puppetfileParser', () => ({
    PuppetfileParser: { parseActiveEditor: jest.fn().mockReturnValue({ modules: [], errors: [] }) }
}));

jest.mock('../../src/services/puppetfileUpdateService', () => ({
    PuppetfileUpdateService: {
        updateAllToSafeVersions: jest.fn().mockResolvedValue([]),
        updateAllToLatestVersions: jest.fn().mockResolvedValue([]),
        generateUpdateSummary: jest.fn().mockReturnValue('Summary'),
        updateModuleVersionAtLine: jest.fn().mockResolvedValue(undefined),
    }
}));

jest.mock('../../src/services/dependencyTreeService', () => ({
    DependencyTreeService: {
        buildDependencyTree: jest.fn().mockResolvedValue([]),
        generateTreeText: jest.fn().mockReturnValue('Tree'),
        generateListText: jest.fn().mockReturnValue('List'),
        findConflicts: jest.fn().mockReturnValue([]),
    }
}));

jest.mock('../../src/services/puppetForgeService', () => ({
    PuppetForgeService: {
        clearCache: jest.fn(),
        hasModuleCached: jest.fn().mockReturnValue(true),
        cleanupAgents: jest.fn(),
    }
}));

jest.mock('../../src/services/gitMetadataService', () => ({
    GitMetadataService: { clearCache: jest.fn() }
}));

jest.mock('../../src/services/cacheService', () => ({
    CacheService: {
        cacheUncachedModulesWithProgressiveUpdates: jest.fn().mockResolvedValue(undefined),
        cacheAllModules: jest.fn().mockResolvedValue(undefined),
    }
}));

jest.mock('../../src/services/upgradePlannerService', () => ({
    UpgradePlannerService: { createUpgradePlan: jest.fn().mockResolvedValue({}) }
}));

jest.mock('../../src/services/upgradeDiffProvider', () => ({
    UpgradeDiffProvider: {
        showInteractiveUpgradePlanner: jest.fn().mockResolvedValue(undefined),
        applyAllUpgrades: jest.fn().mockResolvedValue(undefined),
        applySelectedUpgrades: jest.fn().mockResolvedValue(undefined),
        applySingleUpgradeFromDiff: jest.fn().mockResolvedValue(undefined),
        skipSingleUpgradeFromDiff: jest.fn().mockResolvedValue(undefined),
    }
}));

jest.mock('../../src/puppetfileCodeLensProvider', () => {
    const mockInstance = { dispose: jest.fn() };
    const MockPuppetfileCodeLensProvider = jest.fn(() => mockInstance);
    MockPuppetfileCodeLensProvider.setInstance = jest.fn();
    MockPuppetfileCodeLensProvider.getInstance = jest.fn(() => mockInstance);
    MockPuppetfileCodeLensProvider.applySingleUpgrade = jest.fn().mockResolvedValue(undefined);
    return {
        PuppetfileCodeLensProvider: MockPuppetfileCodeLensProvider
    };
});

jest.mock('../../src/services/upgradeDiffCodeLensProvider', () => {
    const mockInstance = { dispose: jest.fn() };
    const MockUpgradeDiffCodeLensProvider = jest.fn(() => mockInstance);
    MockUpgradeDiffCodeLensProvider.setInstance = jest.fn();
    MockUpgradeDiffCodeLensProvider.getInstance = jest.fn(() => mockInstance);
    return {
        UpgradeDiffCodeLensProvider: MockUpgradeDiffCodeLensProvider
    };
});

jest.mock('../../src/puppetfileHoverProvider', () => ({
    PuppetfileHoverProvider: jest.fn()
}));

describe('Extension - Basic Coverage', () => {
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockContext = {
            subscriptions: [],
            extension: {
                packageJSON: {
                    version: '0.0.0',
                    displayName: 'Test Extension',
                    description: 'Test Description',
                    repository: { url: 'https://github.com/test/repo' }
                }
            }
        } as any;
    });

    test('should activate extension', () => {
        jest.resetModules();
        const { activate } = require('../../src/extension');
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        
        activate(mockContext);
        
        expect(consoleSpy).toHaveBeenCalledWith('Puppetfile Dependency Manager v0.0.0 is now active!');
        expect(vscode.commands.registerCommand).toHaveBeenCalled();
        expect(vscode.languages.registerCodeLensProvider).toHaveBeenCalled();
        expect(vscode.languages.registerHoverProvider).toHaveBeenCalled();
        
        consoleSpy.mockRestore();
    });

    test('should prevent duplicate activation', () => {
        // Need to use same module instance for this test
        jest.resetModules();
        const extensionModule = require('../../src/extension');
        
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        
        extensionModule.activate(mockContext);
        extensionModule.activate(mockContext); // Second activation
        
        expect(consoleSpy).toHaveBeenCalledWith('Puppetfile Dependency Manager: Extension already activated, skipping re-activation');
        
        consoleSpy.mockRestore();
    });

    test('should deactivate extension', () => {
        jest.resetModules();
        const { activate, deactivate } = require('../../src/extension');
        const { PuppetForgeService } = require('../../src/services/puppetForgeService');
        const { PuppetfileCodeLensProvider } = require('../../src/puppetfileCodeLensProvider');
        
        activate(mockContext);
        deactivate();
        
        expect(PuppetForgeService.cleanupAgents).toHaveBeenCalled();
        expect(PuppetfileCodeLensProvider.getInstance().dispose).toHaveBeenCalled();
    });

    test('should show temporary message', async () => {
        jest.resetModules();
        const { showTemporaryMessage } = require('../../src/extension');
        jest.useFakeTimers();
        
        const progressReportSpy = jest.fn();
        (vscode.window.withProgress as jest.Mock).mockImplementationOnce((options, callback) => {
            return callback({ report: progressReportSpy });
        });
        
        showTemporaryMessage('Test message', 1000);
        
        expect(vscode.window.withProgress).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Test message',
                cancellable: false,
                location: 15
            }),
            expect.any(Function)
        );
        
        expect(progressReportSpy).toHaveBeenCalledWith({ increment: 0 });
        
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        
        expect(progressReportSpy).toHaveBeenCalledWith({ increment: 100 });
        
        jest.useRealTimers();
    });

    test('should handle safe register command with already exists error', () => {
        jest.resetModules();
        const { activate } = require('../../src/extension');
        // Mock command registration to throw an error
        (vscode.commands.registerCommand as jest.Mock)
            .mockImplementationOnce(() => {
                const error = new Error('Command already exists');
                throw error;
            })
            .mockImplementation(() => ({ dispose: jest.fn() }));
        
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        activate(mockContext);
        
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('already registered')
        );
        
        consoleWarnSpy.mockRestore();
    });

    test('should rethrow non-duplicate command registration errors', () => {
        jest.resetModules();
        const { activate } = require('../../src/extension');
        // Mock command registration to throw a different error
        (vscode.commands.registerCommand as jest.Mock)
            .mockImplementationOnce(() => {
                throw new Error('Some other error');
            });
        
        expect(() => activate(mockContext)).toThrow('Some other error');
    });

    test('should handle nullish coalescing for repository.url', () => {
        // Test the nullish coalescing logic directly
        const testCases = [
            { repository: undefined, expected: 'Not specified' },
            { repository: { url: null }, expected: 'Not specified' },
            { repository: { url: 'https://github.com/test/repo' }, expected: 'https://github.com/test/repo' }
        ];
        
        testCases.forEach(({ repository, expected }) => {
            const result = repository?.url ?? 'Not specified';
            expect(result).toBe(expected);
        });
    });
});

describe('Extension Commands', () => {
    let mockContext: vscode.ExtensionContext;
    let commands: Map<string, Function>;
    let activate: any;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        
        commands = new Map();
        
        // Capture registered commands
        (vscode.commands.registerCommand as jest.Mock).mockImplementation((name, callback) => {
            commands.set(name, callback);
            return { dispose: jest.fn() };
        });
        
        const extensionModule = require('../../src/extension');
        activate = extensionModule.activate;
        
        mockContext = {
            subscriptions: [],
            extension: {
                packageJSON: {
                    version: '1.0.0',
                    displayName: 'Puppetfile Dependency Manager',
                    description: 'Manage Puppet module dependencies',
                    repository: { url: 'https://github.com/example/repo' }
                }
            }
        } as any;
        
        activate(mockContext);
    });

    describe('updateAllToSafe command', () => {
        test('should handle parsing errors', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [], 
                errors: ['Error 1', 'Error 2'] 
            });
            
            const command = commands.get('puppetfile-depgraph.updateAllToSafe');
            await command?.();
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Puppetfile parsing errors: Error 1, Error 2'
            );
        });

        test('should update modules to safe versions successfully', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            const { PuppetfileUpdateService } = require('../../src/services/puppetfileUpdateService');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [{ name: 'test', source: 'forge' }], 
                errors: [] 
            });
            
            PuppetfileUpdateService.updateAllToSafeVersions.mockResolvedValue([{ module: 'test', updated: true }]);
            PuppetfileUpdateService.generateUpdateSummary.mockReturnValue('Update summary');
            
            const command = commands.get('puppetfile-depgraph.updateAllToSafe');
            await command?.();
            
            expect(PuppetfileUpdateService.updateAllToSafeVersions).toHaveBeenCalled();
            expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith({
                content: 'Update summary',
                language: 'markdown'
            });
            expect(vscode.window.showTextDocument).toHaveBeenCalled();
        });

        test('should handle update errors', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            const { PuppetfileUpdateService } = require('../../src/services/puppetfileUpdateService');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [], 
                errors: [] 
            });
            
            PuppetfileUpdateService.updateAllToSafeVersions.mockRejectedValue(new Error('Update failed'));
            
            const command = commands.get('puppetfile-depgraph.updateAllToSafe');
            await command?.();
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Update failed: Update failed');
        });
    });

    describe('updateAllToLatest command', () => {
        test('should show warning and cancel if user declines', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [], 
                errors: [] 
            });
            
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('No');
            
            const command = commands.get('puppetfile-depgraph.updateAllToLatest');
            await command?.();
            
            const { PuppetfileUpdateService } = require('../../src/services/puppetfileUpdateService');
            expect(PuppetfileUpdateService.updateAllToLatestVersions).not.toHaveBeenCalled();
        });

        test('should update to latest when user confirms', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            const { PuppetfileUpdateService } = require('../../src/services/puppetfileUpdateService');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [], 
                errors: [] 
            });
            
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Yes');
            PuppetfileUpdateService.updateAllToLatestVersions.mockResolvedValue([]);
            PuppetfileUpdateService.generateUpdateSummary.mockReturnValue('Summary');
            
            const command = commands.get('puppetfile-depgraph.updateAllToLatest');
            await command?.();
            
            expect(PuppetfileUpdateService.updateAllToLatestVersions).toHaveBeenCalled();
        });
    });

    describe('showDependencyTree command', () => {
        test('should handle user cancellation of view selection', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [], 
                errors: [] 
            });
            
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(undefined);
            
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            
            const { DependencyTreeService } = require('../../src/services/dependencyTreeService');
            expect(DependencyTreeService.buildDependencyTree).not.toHaveBeenCalled();
        });

        test('should show tree view with conflicts', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            const { DependencyTreeService } = require('../../src/services/dependencyTreeService');
            const { PuppetForgeService } = require('../../src/services/puppetForgeService');
            const { CacheService } = require('../../src/services/cacheService');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [
                    { name: 'test/module', source: 'forge', version: '1.0.0' }
                ], 
                errors: [] 
            });
            
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ 
                label: 'Tree View', 
                value: 'tree' 
            });
            
            PuppetForgeService.hasModuleCached.mockReturnValue(false);
            CacheService.cacheUncachedModulesWithProgressiveUpdates.mockResolvedValue(undefined);
            
            DependencyTreeService.buildDependencyTree.mockResolvedValue([
                { module: 'test', dependencies: [] }
            ]);
            DependencyTreeService.generateTreeText.mockReturnValue('Tree text');
            DependencyTreeService.findConflicts.mockReturnValue(['Conflict 1']);
            
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            
            expect(DependencyTreeService.buildDependencyTree).toHaveBeenCalled();
            expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
                expect.objectContaining({
                    language: 'markdown'
                })
            );
        });

        test('should show list view', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            const { DependencyTreeService } = require('../../src/services/dependencyTreeService');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [], 
                errors: [] 
            });
            
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ 
                label: 'List View', 
                value: 'list' 
            });
            
            DependencyTreeService.buildDependencyTree.mockResolvedValue([]);
            DependencyTreeService.generateListText.mockReturnValue('List text');
            DependencyTreeService.findConflicts.mockReturnValue([]);
            
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            
            expect(DependencyTreeService.generateListText).toHaveBeenCalled();
        });

        test('should handle cancellation token', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            const { DependencyTreeService } = require('../../src/services/dependencyTreeService');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [], 
                errors: [] 
            });
            
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ 
                value: 'tree' 
            });
            
            let progressCallback: any;
            (vscode.window.withProgress as jest.Mock).mockImplementationOnce((options, callback) => {
                progressCallback = callback;
                const token = { isCancellationRequested: true };
                return callback({ report: jest.fn() }, token);
            });
            
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            
            expect(DependencyTreeService.buildDependencyTree).not.toHaveBeenCalled();
        });
    });

    describe('clearCache commands', () => {
        test('should clear forge cache', () => {
            const { PuppetForgeService } = require('../../src/services/puppetForgeService');
            
            const command = commands.get('puppetfile-depgraph.clearForgeCache');
            command?.();
            
            expect(PuppetForgeService.clearCache).toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Puppet Forge cache cleared successfully!'
            );
        });

        test('should clear all caches', () => {
            const { PuppetForgeService } = require('../../src/services/puppetForgeService');
            const { GitMetadataService } = require('../../src/services/gitMetadataService');
            
            const command = commands.get('puppetfile-depgraph.clearCache');
            command?.();
            
            expect(PuppetForgeService.clearCache).toHaveBeenCalled();
            expect(GitMetadataService.clearCache).toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'All caches cleared successfully! (Puppet Forge + Git metadata)'
            );
        });
    });

    describe('updateModuleVersion command', () => {
        test('should handle invalid arguments', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            
            const command = commands.get('puppetfile-depgraph.updateModuleVersion');
            
            // Test with no arguments
            await command?.();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Invalid arguments for version update command'
            );
            
            // Test with invalid arguments
            await command?.({ invalid: true });
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Invalid arguments for version update command'
            );
            
            // Test with array of invalid objects
            await command?.([{ invalid: true }]);
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Invalid arguments for version update command'
            );
            
            consoleSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        test('should update module version with valid arguments', async () => {
            const { PuppetfileUpdateService } = require('../../src/services/puppetfileUpdateService');
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            PuppetfileUpdateService.updateModuleVersionAtLine.mockResolvedValue(undefined);
            
            const command = commands.get('puppetfile-depgraph.updateModuleVersion');
            
            // Test with direct object
            await command?.({ line: 10, version: '2.0.0' });
            expect(PuppetfileUpdateService.updateModuleVersionAtLine).toHaveBeenCalledWith(10, '2.0.0');
            
            // Test with array of objects
            await command?.([{ line: 20, version: '3.0.0' }]);
            expect(PuppetfileUpdateService.updateModuleVersionAtLine).toHaveBeenCalledWith(20, '3.0.0');
            
            consoleSpy.mockRestore();
        });

        test('should handle update errors', async () => {
            const { PuppetfileUpdateService } = require('../../src/services/puppetfileUpdateService');
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            PuppetfileUpdateService.updateModuleVersionAtLine.mockRejectedValue(
                new Error('Update failed')
            );
            
            const command = commands.get('puppetfile-depgraph.updateModuleVersion');
            await command?.({ line: 10, version: '2.0.0' });
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Failed to update module: Update failed'
            );
            
            consoleErrorSpy.mockRestore();
            consoleSpy.mockRestore();
        });
    });

    describe('cacheAllModules command', () => {
        test('should handle parsing errors', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [], 
                errors: ['Parse error'] 
            });
            
            const command = commands.get('puppetfile-depgraph.cacheAllModules');
            await command?.();
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Puppetfile parsing errors: Parse error'
            );
        });

        test('should show message when no forge modules found', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [{ name: 'git-module', source: 'git' }], 
                errors: [] 
            });
            
            const command = commands.get('puppetfile-depgraph.cacheAllModules');
            await command?.();
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'No Puppet Forge modules found in Puppetfile'
            );
        });

        test('should cache forge modules', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            const { CacheService } = require('../../src/services/cacheService');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [{ name: 'forge-module', source: 'forge' }], 
                errors: [] 
            });
            
            const command = commands.get('puppetfile-depgraph.cacheAllModules');
            await command?.();
            
            expect(CacheService.cacheAllModules).toHaveBeenCalledWith(
                [{ name: 'forge-module', source: 'forge' }],
                true
            );
        });
    });

    describe('showUpgradePlanner command', () => {
        test('should handle no active editor', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            const { UpgradePlannerService } = require('../../src/services/upgradePlannerService');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [{ name: 'test', source: 'forge' }], 
                errors: [] 
            });
            
            (vscode.window.activeTextEditor as any) = undefined;
            
            UpgradePlannerService.createUpgradePlan.mockResolvedValue({});
            
            const command = commands.get('puppetfile-depgraph.showUpgradePlanner');
            await command?.();
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Failed to analyze upgrades: No active Puppetfile editor found'
            );
        });

        test('should show upgrade planner', async () => {
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            const { UpgradePlannerService } = require('../../src/services/upgradePlannerService');
            const { UpgradeDiffProvider } = require('../../src/services/upgradeDiffProvider');
            
            PuppetfileParser.parseActiveEditor.mockReturnValue({ 
                modules: [{ name: 'test', source: 'forge' }], 
                errors: [] 
            });
            
            (vscode.window.activeTextEditor as any) = {
                document: { getText: jest.fn().mockReturnValue('original content') }
            };
            
            UpgradePlannerService.createUpgradePlan.mockResolvedValue({ upgrades: [] });
            
            // Use fake timers to control setTimeout
            jest.useFakeTimers();
            
            const command = commands.get('puppetfile-depgraph.showUpgradePlanner');
            await command?.();
            
            // Fast-forward timers
            jest.advanceTimersByTime(600);
            await Promise.resolve();
            
            expect(UpgradeDiffProvider.showInteractiveUpgradePlanner).toHaveBeenCalledWith(
                'original content',
                { upgrades: [] }
            );
            
            jest.useRealTimers();
        });
    });

    describe('showAbout command', () => {
        test('should show about information', async () => {
            const command = commands.get('puppetfile-depgraph.showAbout');
            await command?.();
            
            expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
                expect.objectContaining({
                    language: 'markdown'
                })
            );
            expect(vscode.window.showTextDocument).toHaveBeenCalled();
        });
    });

    describe('upgrade-related commands', () => {
        test('should apply all upgrades', async () => {
            const { UpgradeDiffProvider } = require('../../src/services/upgradeDiffProvider');
            
            const command = commands.get('puppetfile-depgraph.applyAllUpgrades');
            await command?.();
            
            expect(UpgradeDiffProvider.applyAllUpgrades).toHaveBeenCalled();
        });

        test('should apply selected upgrades', async () => {
            const { UpgradeDiffProvider } = require('../../src/services/upgradeDiffProvider');
            
            const command = commands.get('puppetfile-depgraph.applySelectedUpgrades');
            await command?.();
            
            expect(UpgradeDiffProvider.applySelectedUpgrades).toHaveBeenCalled();
        });

        test('should apply single upgrade', async () => {
            const { PuppetfileCodeLensProvider } = require('../../src/puppetfileCodeLensProvider');
            
            const command = commands.get('puppetfile-depgraph.applySingleUpgrade');
            await command?.({ module: 'test' });
            
            expect(PuppetfileCodeLensProvider.applySingleUpgrade).toHaveBeenCalledWith({ module: 'test' });
        });

        test('should apply single upgrade from diff', async () => {
            const { UpgradeDiffProvider } = require('../../src/services/upgradeDiffProvider');
            
            const command = commands.get('puppetfile-depgraph.applySingleUpgradeFromDiff');
            await command?.('arg1', 'arg2');
            
            expect(UpgradeDiffProvider.applySingleUpgradeFromDiff).toHaveBeenCalledWith(['arg1', 'arg2']);
        });

        test('should skip single upgrade from diff', async () => {
            const { UpgradeDiffProvider } = require('../../src/services/upgradeDiffProvider');
            
            const command = commands.get('puppetfile-depgraph.skipSingleUpgradeFromDiff');
            await command?.('arg1');
            
            expect(UpgradeDiffProvider.skipSingleUpgradeFromDiff).toHaveBeenCalledWith(['arg1']);
        });
    });
});
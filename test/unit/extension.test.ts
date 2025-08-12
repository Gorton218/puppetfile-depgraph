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
        const { activate } = require('../../src/extension');
        
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        
        activate(mockContext);
        
        expect(consoleSpy).toHaveBeenCalledWith('Puppetfile Dependency Manager v0.0.0 is now active!');
        expect(vscode.commands.registerCommand).toHaveBeenCalled();
        expect(vscode.languages.registerCodeLensProvider).toHaveBeenCalled();
        expect(vscode.languages.registerHoverProvider).toHaveBeenCalled();
        
        consoleSpy.mockRestore();
    });

    test('should deactivate extension', () => {
        const { activate, deactivate } = require('../../src/extension');
        const { PuppetForgeService } = require('../../src/services/puppetForgeService');
        
        activate(mockContext);
        deactivate();
        
        expect(PuppetForgeService.cleanupAgents).toHaveBeenCalled();
    });

    test('should show temporary message', () => {
        const { showTemporaryMessage } = require('../../src/extension');
        
        jest.useFakeTimers();
        
        showTemporaryMessage('Test message', 1000);
        
        expect(vscode.window.withProgress).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Test message',
                cancellable: false,
                location: 15
            }),
            expect.any(Function)
        );
        
        jest.useRealTimers();
    });

    test('should handle safe register command', () => {
        const { activate } = require('../../src/extension');
        
        // Mock command registration to throw an error
        (vscode.commands.registerCommand as jest.Mock)
            .mockImplementationOnce(() => {
                throw new Error('Command already exists');
            })
            .mockImplementationOnce(() => ({ dispose: jest.fn() }));
        
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        activate(mockContext);
        
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('already registered')
        );
        
        consoleWarnSpy.mockRestore();
    });
});
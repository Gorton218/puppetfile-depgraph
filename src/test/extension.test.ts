// Unit tests for extension.ts - Uses Jest syntax
import * as vscode from 'vscode';
import { activate, deactivate, showTemporaryMessage } from '../extension';
import { PuppetfileParser } from '../puppetfileParser';
import { PuppetfileUpdateService } from '../puppetfileUpdateService';
import { DependencyTreeService } from '../dependencyTreeService';
import { PuppetfileHoverProvider } from '../puppetfileHoverProvider';
import { PuppetForgeService } from '../puppetForgeService';
import { GitMetadataService } from '../gitMetadataService';
import { CacheService } from '../cacheService';
import { UpgradePlannerService } from '../services/upgradePlannerService';
import { UpgradeDiffProvider } from '../services/upgradeDiffProvider';

// Mock all dependencies
jest.mock('vscode', () => ({
    commands: {
        registerCommand: jest.fn()
    },
    languages: {
        registerHoverProvider: jest.fn(),
        registerCodeLensProvider: jest.fn()
    },
    window: {
        showErrorMessage: jest.fn(),
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showQuickPick: jest.fn(),
        withProgress: jest.fn(),
        showTextDocument: jest.fn(),
        activeTextEditor: undefined
    },
    workspace: {
        openTextDocument: jest.fn()
    },
    ProgressLocation: {
        Notification: 'notification'
    },
    EventEmitter: jest.fn().mockImplementation(() => ({
        fire: jest.fn(),
        event: jest.fn()
    }))
}));

jest.mock('../puppetfileParser');
jest.mock('../puppetfileUpdateService');
jest.mock('../dependencyTreeService');
jest.mock('../puppetfileHoverProvider');
jest.mock('../puppetForgeService');
jest.mock('../gitMetadataService');
jest.mock('../cacheService');
jest.mock('../services/upgradePlannerService');
jest.mock('../services/upgradeDiffProvider');
jest.mock('../puppetfileCodeLensProvider', () => ({
    PuppetfileCodeLensProvider: jest.fn().mockImplementation(() => ({
        provideCodeLenses: jest.fn()
    })),
    setInstance: jest.fn()
}));
jest.mock('../services/upgradeDiffCodeLensProvider', () => ({
    UpgradeDiffCodeLensProvider: jest.fn().mockImplementation(() => ({
        provideCodeLenses: jest.fn()
    })),
    setInstance: jest.fn()
}));

const mockedVSCode = vscode as jest.Mocked<typeof vscode>;

describe('Extension', () => {
    let mockContext: vscode.ExtensionContext;
    let registeredCommands: Map<string, (...args: any[]) => any>;
    let mockActiveEditor: vscode.TextEditor;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        registeredCommands = new Map();

        // Mock console - suppress all console output during tests
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();

        // Mock VS Code extension context
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

        // Mock active editor
        mockActiveEditor = {
            document: {
                getText: jest.fn().mockReturnValue('mod "puppetlabs/stdlib", "4.25.0"'),
                fileName: '/path/to/Puppetfile',
                languageId: 'puppetfile'
            }
        } as any;

        // Set up VS Code mocks
        (mockedVSCode.commands.registerCommand as jest.Mock).mockImplementation((commandId: string, callback: (...args: any[]) => any) => {
            registeredCommands.set(commandId, callback);
            return { dispose: jest.fn() } as any;
        });

        (mockedVSCode.languages.registerHoverProvider as jest.Mock).mockReturnValue({ dispose: jest.fn() } as any);
        (mockedVSCode.languages.registerCodeLensProvider as jest.Mock).mockReturnValue({ dispose: jest.fn() } as any);
        (mockedVSCode.window as any).activeTextEditor = mockActiveEditor;
        (mockedVSCode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
            const progress = { report: jest.fn() };
            return await task(progress as any, {} as any);
        });
        (mockedVSCode.workspace.openTextDocument as jest.Mock).mockResolvedValue({ uri: 'mock-doc-uri' } as any);
        (mockedVSCode.window.showTextDocument as jest.Mock).mockResolvedValue({} as any);

        // Mock PuppetfileParser
        (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({
            modules: [
                { name: 'puppetlabs/stdlib', version: '4.25.0', source: 'forge', line: 1 },
                { name: 'puppetlabs/apache', version: '3.0.0', source: 'forge', line: 2 }
            ],
            errors: []
        });

        // Mock PuppetForgeService
        (PuppetForgeService.hasModuleCached as jest.Mock).mockReturnValue(true);
        (PuppetForgeService.clearCache as jest.Mock).mockImplementation(() => {});
        (PuppetForgeService.cleanupAgents as jest.Mock).mockImplementation(() => {});

        // Mock other services
        (GitMetadataService.clearCache as jest.Mock).mockImplementation(() => {});
        (CacheService.cacheAllModules as jest.Mock).mockResolvedValue(undefined);
        (CacheService.cacheUncachedModulesWithProgressiveUpdates as jest.Mock).mockResolvedValue(undefined);
        (UpgradePlannerService.createUpgradePlan as jest.Mock).mockResolvedValue({ modules: [], summary: {} });
        (UpgradeDiffProvider.showInteractiveUpgradePlanner as jest.Mock).mockResolvedValue(undefined);
        (UpgradeDiffProvider.applyAllUpgrades as jest.Mock).mockResolvedValue(undefined);
        (UpgradeDiffProvider.applySelectedUpgrades as jest.Mock).mockResolvedValue(undefined);
        (UpgradeDiffProvider.applySingleUpgradeFromDiff as jest.Mock).mockResolvedValue(undefined);
        (UpgradeDiffProvider.skipSingleUpgradeFromDiff as jest.Mock).mockResolvedValue(undefined);
        
        // Mock PuppetfileCodeLensProvider static method
        const mockCodeLensProvider = require('../puppetfileCodeLensProvider');
        mockCodeLensProvider.PuppetfileCodeLensProvider.setInstance = jest.fn();
        mockCodeLensProvider.PuppetfileCodeLensProvider.applySingleUpgrade = jest.fn().mockResolvedValue(undefined);
        
        // Mock UpgradeDiffCodeLensProvider static method
        const mockDiffCodeLensProvider = require('../services/upgradeDiffCodeLensProvider');
        mockDiffCodeLensProvider.UpgradeDiffCodeLensProvider.setInstance = jest.fn();

        // Mock PuppetfileUpdateService
        (PuppetfileUpdateService.updateModuleVersionAtLine as jest.Mock).mockResolvedValue(undefined);
        (PuppetfileUpdateService.updateAllToSafeVersions as jest.Mock).mockResolvedValue([]);
        (PuppetfileUpdateService.updateAllToLatestVersions as jest.Mock).mockResolvedValue([]);
        (PuppetfileUpdateService.generateUpdateSummary as jest.Mock).mockReturnValue('Mock summary');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('activate', () => {
        test('should log activation message with version', () => {
            // Act
            activate(mockContext);

            // Assert
            expect(consoleLogSpy).toHaveBeenCalledWith('Puppetfile Dependency Manager v1.0.0 is now active!');
        });

        test('should register all commands', () => {
            // Act
            activate(mockContext);

            // Assert
            expect(mockedVSCode.commands.registerCommand as jest.Mock).toHaveBeenCalledTimes(14);
            expect(registeredCommands.has('puppetfile-depgraph.updateAllToSafe')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.updateAllToLatest')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.showDependencyTree')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.clearForgeCache')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.clearCache')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.updateModuleVersion')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.cacheAllModules')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.showUpgradePlanner')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.showAbout')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.applyAllUpgrades')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.applySelectedUpgrades')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.applySingleUpgrade')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.applySingleUpgradeFromDiff')).toBe(true);
            expect(registeredCommands.has('puppetfile-depgraph.skipSingleUpgradeFromDiff')).toBe(true);
        });

        test('should register hover provider', () => {
            // Act
            activate(mockContext);

            // Assert
            expect(mockedVSCode.languages.registerHoverProvider as jest.Mock).toHaveBeenCalledWith(
                { pattern: '**/Puppetfile' },
                expect.any(PuppetfileHoverProvider)
            );
        });

        test('should add all disposables to subscriptions', () => {
            // Act
            activate(mockContext);

            // Assert
            expect(mockContext.subscriptions.length).toBe(17); // 14 commands + 1 hover provider + 2 codelens providers
        });
    });

    describe('updateAllToSafe command', () => {
        test('should handle successful update', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateAllToSafe');
            const mockResults = [
                { module: 'puppetlabs/stdlib', updated: true, oldVersion: '4.25.0', newVersion: '5.0.0' }
            ];
            (PuppetfileUpdateService.updateAllToSafeVersions as jest.Mock).mockResolvedValue(mockResults);
            (PuppetfileUpdateService.generateUpdateSummary as jest.Mock).mockReturnValue('Update summary');

            // Act
            await command!();

            // Assert
            expect(PuppetfileUpdateService.updateAllToSafeVersions).toHaveBeenCalled();
            expect(mockedVSCode.workspace.openTextDocument as jest.Mock).toHaveBeenCalledWith({
                content: 'Update summary',
                language: 'markdown'
            });
            expect(mockedVSCode.window.showTextDocument as jest.Mock).toHaveBeenCalled();
        });

        test('should show error when parsing fails', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateAllToSafe');
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({
                modules: [],
                errors: ['Parse error 1', 'Parse error 2']
            });

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Puppetfile parsing errors: Parse error 1, Parse error 2');
            expect(PuppetfileUpdateService.updateAllToSafeVersions).not.toHaveBeenCalled();
        });

        test('should handle update service errors', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateAllToSafe');
            const error = new Error('Update failed');
            (PuppetfileUpdateService.updateAllToSafeVersions as jest.Mock).mockRejectedValue(error);

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Update failed: Update failed');
        });
    });

    describe('updateAllToLatest command', () => {
        test('should show warning and proceed when confirmed', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateAllToLatest');
            (mockedVSCode.window.showWarningMessage as jest.Mock).mockResolvedValue('Yes' as any);
            const mockResults = [
                { module: 'puppetlabs/stdlib', updated: true, oldVersion: '4.25.0', newVersion: '6.0.0' }
            ];
            (PuppetfileUpdateService.updateAllToLatestVersions as jest.Mock).mockResolvedValue(mockResults);
            (PuppetfileUpdateService.generateUpdateSummary as jest.Mock).mockReturnValue('Update summary');

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showWarningMessage as jest.Mock).toHaveBeenCalledWith(
                'This will update to the latest versions including pre-releases. Continue?',
                'Yes', 'No'
            );
            expect(PuppetfileUpdateService.updateAllToLatestVersions).toHaveBeenCalled();
        });

        test('should cancel when user declines warning', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateAllToLatest');
            (mockedVSCode.window.showWarningMessage as jest.Mock).mockResolvedValue('No' as any);

            // Act
            await command!();

            // Assert
            expect(PuppetfileUpdateService.updateAllToLatestVersions).not.toHaveBeenCalled();
        });

        test('should handle parsing errors', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateAllToLatest');
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({
                modules: [],
                errors: ['Parse error']
            });

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Puppetfile parsing errors: Parse error');
            expect(mockedVSCode.window.showWarningMessage as jest.Mock).not.toHaveBeenCalled();
        });
    });

    describe('showDependencyTree command', () => {
        test('should display tree view when selected', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            const mockTree = [{ module: 'puppetlabs/stdlib', dependencies: [] }];
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockResolvedValue(mockTree);
            (DependencyTreeService.generateTreeText as jest.Mock).mockReturnValue('Tree text');
            (DependencyTreeService.findConflicts as jest.Mock).mockReturnValue([]);

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showQuickPick as jest.Mock).toHaveBeenCalled();
            expect(DependencyTreeService.buildDependencyTree).toHaveBeenCalled();
            expect(DependencyTreeService.generateTreeText).toHaveBeenCalledWith(mockTree);
            expect(mockedVSCode.workspace.openTextDocument as jest.Mock).toHaveBeenCalledWith({
                content: expect.stringContaining('# Dependency Tree'),
                language: 'markdown'
            });
        });

        test('should display list view when selected', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'list' } as any);
            const mockTree = [{ module: 'puppetlabs/stdlib', dependencies: [] }];
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockResolvedValue(mockTree);
            (DependencyTreeService.generateListText as jest.Mock).mockReturnValue('List text');
            (DependencyTreeService.findConflicts as jest.Mock).mockReturnValue([]);

            // Act
            await command!();

            // Assert
            expect(DependencyTreeService.generateListText).toHaveBeenCalledWith(mockTree);
            expect(mockedVSCode.workspace.openTextDocument as jest.Mock).toHaveBeenCalledWith({
                content: expect.stringContaining('# Dependency List'),
                language: 'markdown'
            });
        });

        test('should display conflicts when found', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            const mockTree = [{ module: 'puppetlabs/stdlib', dependencies: [] }];
            const mockConflicts = ['Conflict 1', 'Conflict 2'];
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockResolvedValue(mockTree);
            (DependencyTreeService.generateTreeText as jest.Mock).mockReturnValue('Tree text');
            (DependencyTreeService.findConflicts as jest.Mock).mockReturnValue(mockConflicts);

            // Act
            await command!();

            // Assert
            const documentCall = (mockedVSCode.workspace.openTextDocument as jest.Mock).mock.calls[0][0];
            expect(documentCall.content).toContain('⚠️ Potential Conflicts');
            expect(documentCall.content).toContain('- Conflict 1');
            expect(documentCall.content).toContain('- Conflict 2');
        });

        test('should handle empty dependency tree', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockResolvedValue([]);
            (DependencyTreeService.findConflicts as jest.Mock).mockReturnValue([]);

            // Act
            await command!();

            // Assert
            const documentCall = (mockedVSCode.workspace.openTextDocument as jest.Mock).mock.calls[0][0];
            expect(documentCall.content).toContain('No dependencies found.');
        });

        test('should handle user cancellation', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue(undefined);

            // Act
            await command!();

            // Assert
            expect(DependencyTreeService.buildDependencyTree).not.toHaveBeenCalled();
        });

        test('should handle dependency tree errors', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            const error = new Error('Tree build failed');
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockRejectedValue(error);

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Failed to build dependency tree: Tree build failed');
        });
    });

    describe('clearForgeCache command', () => {
        test('should clear cache and show success message', () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.clearForgeCache');

            // Act
            command!();

            // Assert
            expect(PuppetForgeService.clearCache).toHaveBeenCalled();
            expect(mockedVSCode.window.showInformationMessage as jest.Mock).toHaveBeenCalledWith('Puppet Forge cache cleared successfully!');
        });
    });

    describe('clearCache command', () => {
        test('should clear all caches and show success message', () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.clearCache');

            // Act
            command!();

            // Assert
            expect(PuppetForgeService.clearCache).toHaveBeenCalled();
            expect(GitMetadataService.clearCache).toHaveBeenCalled();
            expect(mockedVSCode.window.showInformationMessage as jest.Mock).toHaveBeenCalledWith('All caches cleared successfully! (Puppet Forge + Git metadata)');
        });
    });

    describe('updateModuleVersion command', () => {
        test('should handle direct object arguments', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateModuleVersion');
            const args = { line: 5, version: '1.2.3' };

            // Act
            await command!(args);

            // Assert
            expect(PuppetfileUpdateService.updateModuleVersionAtLine).toHaveBeenCalledWith(5, '1.2.3');
            expect(mockedVSCode.window.withProgress as jest.Mock).toHaveBeenCalledWith(
                expect.objectContaining({
                    location: mockedVSCode.ProgressLocation.Notification,
                    title: 'Updated module to version 1.2.3',
                    cancellable: false
                }),
                expect.any(Function)
            );
        });

        test('should handle array of objects arguments', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateModuleVersion');
            const args = [{ line: 10, version: '2.0.0' }];

            // Act
            await command!(args);

            // Assert
            expect(PuppetfileUpdateService.updateModuleVersionAtLine).toHaveBeenCalledWith(10, '2.0.0');
            expect(mockedVSCode.window.withProgress as jest.Mock).toHaveBeenCalledWith(
                expect.objectContaining({
                    location: mockedVSCode.ProgressLocation.Notification,
                    title: 'Updated module to version 2.0.0',
                    cancellable: false
                }),
                expect.any(Function)
            );
        });

        test('should handle invalid arguments', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateModuleVersion');
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            // Act
            await command!('invalid');

            // Assert
            expect(consoleErrorSpy).toHaveBeenCalledWith('Invalid arguments for updateModuleVersion command:', null);
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Invalid arguments for version update command');
            expect(PuppetfileUpdateService.updateModuleVersionAtLine).not.toHaveBeenCalled();
        });

        test('should handle update errors', async () => {
            // Arrange
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateModuleVersion');
            const error = new Error('Update failed');
            (PuppetfileUpdateService.updateModuleVersionAtLine as jest.Mock).mockRejectedValue(error);

            // Act
            await command!({ line: 5, version: '1.2.3' });

            // Assert
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating module version:', error);
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Failed to update module: Update failed');
        });

        test('should log command execution', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateModuleVersion');
            const args = { line: 5, version: '1.2.3' };

            // Act
            await command!(args);

            // Assert
            expect(consoleLogSpy).toHaveBeenCalledWith('updateModuleVersion command called with args:', [args]);
        });
    });

    describe('cacheAllModules command', () => {
        test('should cache all forge modules', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.cacheAllModules');

            // Act
            await command!();

            // Assert
            expect(CacheService.cacheAllModules).toHaveBeenCalledWith(
                [
                    { name: 'puppetlabs/stdlib', version: '4.25.0', source: 'forge', line: 1 },
                    { name: 'puppetlabs/apache', version: '3.0.0', source: 'forge', line: 2 }
                ],
                true
            );
        });

        test('should show message when no forge modules found', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.cacheAllModules');
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({
                modules: [
                    { name: 'mymodule', source: 'git', url: 'https://github.com/example/mymodule' }
                ],
                errors: []
            });

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showInformationMessage as jest.Mock).toHaveBeenCalledWith('No Puppet Forge modules found in Puppetfile');
            expect(CacheService.cacheAllModules).not.toHaveBeenCalled();
        });

        test('should handle parsing errors', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.cacheAllModules');
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({
                modules: [],
                errors: ['Parse error']
            });

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Puppetfile parsing errors: Parse error');
            expect(CacheService.cacheAllModules).not.toHaveBeenCalled();
        });
    });

    describe('showUpgradePlanner command', () => {
        test('should show upgrade planner for forge modules', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showUpgradePlanner');
            const mockUpgradePlan = { modules: [], summary: {} };
            (UpgradePlannerService.createUpgradePlan as jest.Mock).mockResolvedValue(mockUpgradePlan);

            // Act
            await command!();
            
            // Wait for the setTimeout to complete
            await new Promise(resolve => setTimeout(resolve, 200));

            // Assert
            expect(UpgradePlannerService.createUpgradePlan).toHaveBeenCalledWith([
                { name: 'puppetlabs/stdlib', version: '4.25.0', source: 'forge', line: 1 },
                { name: 'puppetlabs/apache', version: '3.0.0', source: 'forge', line: 2 }
            ]);
            expect(UpgradeDiffProvider.showInteractiveUpgradePlanner).toHaveBeenCalledWith(
                'mod "puppetlabs/stdlib", "4.25.0"',
                mockUpgradePlan
            );
        });

        test('should handle no forge modules', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showUpgradePlanner');
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({
                modules: [
                    { name: 'mymodule', source: 'git', url: 'https://github.com/example/mymodule' }
                ],
                errors: []
            });

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showInformationMessage as jest.Mock).toHaveBeenCalledWith('No Puppet Forge modules found in Puppetfile');
            expect(UpgradePlannerService.createUpgradePlan).not.toHaveBeenCalled();
        });

        test('should handle unversioned forge modules', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showUpgradePlanner');
            const mockUpgradePlan = {
                candidates: [
                    {
                        module: { name: 'puppetlabs/stdlib', source: 'forge' },
                        currentVersion: 'unversioned',
                        maxSafeVersion: '9.0.0',
                        isUpgradeable: true
                    }
                ],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            // Mock the document content for unversioned module
            mockActiveEditor.document.getText = jest.fn().mockReturnValue('mod "puppetlabs/stdlib"');

            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({
                modules: [
                    { name: 'puppetlabs/stdlib', source: 'forge' } // No version
                ],
                errors: []
            });
            (UpgradePlannerService.createUpgradePlan as jest.Mock).mockResolvedValue(mockUpgradePlan);

            // Act
            await command!();
            
            // Wait for the setTimeout to complete
            await new Promise(resolve => setTimeout(resolve, 200));

            // Assert
            expect(UpgradePlannerService.createUpgradePlan).toHaveBeenCalledWith([
                { name: 'puppetlabs/stdlib', source: 'forge' }
            ]);
            expect(UpgradeDiffProvider.showInteractiveUpgradePlanner).toHaveBeenCalledWith(
                'mod "puppetlabs/stdlib"',
                mockUpgradePlan
            );
        });

        test('should handle no active editor', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showUpgradePlanner');
            (mockedVSCode.window as any).activeTextEditor = undefined;

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Failed to analyze upgrades: No active Puppetfile editor found');
        });

        test('should handle upgrade planner errors', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showUpgradePlanner');
            const error = new Error('Analysis failed');
            (UpgradePlannerService.createUpgradePlan as jest.Mock).mockRejectedValue(error);

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Failed to analyze upgrades: Analysis failed');
        });
    });

    describe('error handling edge cases', () => {
        test('should handle non-Error objects in updateAllToSafe', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateAllToSafe');
            (PuppetfileUpdateService.updateAllToSafeVersions as jest.Mock).mockRejectedValue('String error');

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Update failed: Unknown error');
        });

        test('should handle non-Error objects in updateAllToLatest', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateAllToLatest');
            (mockedVSCode.window.showWarningMessage as jest.Mock).mockResolvedValue('Yes' as any);
            (PuppetfileUpdateService.updateAllToLatestVersions as jest.Mock).mockRejectedValue(null);

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Update failed: Unknown error');
        });

        test('should handle non-Error objects in showDependencyTree', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockRejectedValue('String error');

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Failed to build dependency tree: Unknown error');
        });

        test('should handle non-Error objects in updateModuleVersion', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateModuleVersion');
            (PuppetfileUpdateService.updateModuleVersionAtLine as jest.Mock).mockRejectedValue(123);

            // Act
            await command!({ line: 5, version: '1.2.3' });

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Failed to update module: Unknown error');
        });

        test('should handle non-Error objects in showUpgradePlanner', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showUpgradePlanner');
            (UpgradePlannerService.createUpgradePlan as jest.Mock).mockRejectedValue({ message: 'Custom error' });

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Failed to analyze upgrades: Unknown error');
        });
    });

    describe('updateAllToLatest warning scenarios', () => {
        test('should handle undefined warning response', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateAllToLatest');
            (mockedVSCode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);

            // Act
            await command!();

            // Assert
            expect(PuppetfileUpdateService.updateAllToLatestVersions).not.toHaveBeenCalled();
        });

        test('should handle empty string warning response', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.updateAllToLatest');
            (mockedVSCode.window.showWarningMessage as jest.Mock).mockResolvedValue('');

            // Act
            await command!();

            // Assert
            expect(PuppetfileUpdateService.updateAllToLatestVersions).not.toHaveBeenCalled();
        });
    });

    describe('complex progress scenarios', () => {
        test('should handle phase2 animation cleanup on error', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            (PuppetForgeService.hasModuleCached as jest.Mock).mockReturnValue(false);
            
            // Mock CacheService to complete successfully
            (CacheService.cacheUncachedModulesWithProgressiveUpdates as jest.Mock).mockImplementation(async (modules, token, callback) => {
                callback(2, 2); // Complete caching
            });
            
            // Mock DependencyTreeService to throw an error
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockRejectedValue(new Error('Tree build error'));

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Failed to build dependency tree: Tree build error');
        });

        test('should handle final cancellation check before showing results', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            
            const mockTree = [{ module: 'puppetlabs/stdlib', dependencies: [] }];
            let cancelToken: any;
            (mockedVSCode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                cancelToken = { isCancellationRequested: false };
                const progress = { report: jest.fn() };
                return await task(progress as any, cancelToken);
            });
            
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockImplementation(async (modules, progressCallback, token) => {
                // Simulate successful tree building but then cancel before showing results
                token.isCancellationRequested = true;
                return mockTree;
            });
            (DependencyTreeService.generateTreeText as jest.Mock).mockReturnValue('Tree text');
            (DependencyTreeService.findConflicts as jest.Mock).mockReturnValue([]);

            // Act
            await command!();

            // Assert
            expect(DependencyTreeService.buildDependencyTree).toHaveBeenCalled();
            expect(mockedVSCode.workspace.openTextDocument as jest.Mock).not.toHaveBeenCalled();
        });

        test('should ensure progress reaches exactly 100% before completion', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            
            const mockTree = [{ module: 'puppetlabs/stdlib', dependencies: [] }];
            let progressReports: any[] = [];
            
            (mockedVSCode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                const progress = { 
                    report: jest.fn().mockImplementation((report) => {
                        progressReports.push(report);
                    })
                };
                const token = { isCancellationRequested: false };
                return await task(progress as any, token);
            });
            
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockImplementation(async (modules, progressCallback, token) => {
                // Simulate Phase 3 progress that doesn't reach 100%
                progressCallback('Checking module 1', 'conflicts', 1, 2);
                progressCallback('Checking module 2', 'conflicts', 2, 2);
                return mockTree;
            });
            (DependencyTreeService.generateTreeText as jest.Mock).mockReturnValue('Tree text');
            (DependencyTreeService.findConflicts as jest.Mock).mockReturnValue([]);

            // Act
            await command!();

            // Assert
            expect(DependencyTreeService.buildDependencyTree).toHaveBeenCalled();
            expect(mockedVSCode.workspace.openTextDocument as jest.Mock).toHaveBeenCalled();
            
            // Check that final progress ensures 100%
            const finalProgressReport = progressReports[progressReports.length - 1];
            expect(finalProgressReport.message).toBe('Complete!');
        });
    });

    describe('showAbout command', () => {
        test('should display about information', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showAbout');

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.workspace.openTextDocument as jest.Mock).toHaveBeenCalled();
            const documentCall = (mockedVSCode.workspace.openTextDocument as jest.Mock).mock.calls[0][0];
            expect(documentCall.content).toContain('# Puppetfile Dependency Manager');
            expect(documentCall.content).toContain('**Version:** 1.0.0');
            expect(documentCall.content).toContain('**Description:** Manage Puppet module dependencies');
            expect(documentCall.content).toContain('https://github.com/example/repo');
            expect(documentCall.language).toBe('markdown');
            expect(mockedVSCode.window.showTextDocument as jest.Mock).toHaveBeenCalled();
        });
    });

    describe('showTemporaryMessage', () => {
        test('should display temporary message with default duration', () => {
            // Act
            showTemporaryMessage('Test message');
            
            // Assert
            expect(mockedVSCode.window.withProgress as jest.Mock).toHaveBeenCalledWith(
                expect.objectContaining({
                    location: mockedVSCode.ProgressLocation.Notification,
                    title: 'Test message',
                    cancellable: false
                }),
                expect.any(Function)
            );
        });
        
        test('should display temporary message with custom duration', () => {
            // Act
            showTemporaryMessage('Custom message', 3000);
            
            // Assert
            expect(mockedVSCode.window.withProgress as jest.Mock).toHaveBeenCalledWith(
                expect.objectContaining({
                    location: mockedVSCode.ProgressLocation.Notification,
                    title: 'Custom message',
                    cancellable: false
                }),
                expect.any(Function)
            );
        });
        
        test('should resolve progress after specified duration', async () => {
            // Arrange
            let progressResolver: any;
            const mockProgress = { report: jest.fn() };
            (mockedVSCode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                return await task(mockProgress, {} as any);
            });
            
            // Mock setTimeout to capture and immediately resolve
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = jest.fn().mockImplementation((callback, delay) => {
                expect(delay).toBe(5000);
                callback(); // Immediately call the callback
                return 123; // Mock timer ID
            }) as any;
            
            // Act
            await showTemporaryMessage('Test message');
            
            // Assert
            expect(mockProgress.report).toHaveBeenCalledWith({ increment: 0 });
            expect(mockProgress.report).toHaveBeenCalledWith({ increment: 100 });
            
            // Restore setTimeout
            global.setTimeout = originalSetTimeout;
        });
    });

    describe('apply upgrade commands', () => {
        test('should call UpgradeDiffProvider.applyAllUpgrades for applyAllUpgrades command', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.applyAllUpgrades');

            // Act
            await command!();

            // Assert
            expect(UpgradeDiffProvider.applyAllUpgrades).toHaveBeenCalled();
        });

        test('should call UpgradeDiffProvider.applySelectedUpgrades for applySelectedUpgrades command', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.applySelectedUpgrades');

            // Act
            await command!();

            // Assert
            expect(UpgradeDiffProvider.applySelectedUpgrades).toHaveBeenCalled();
        });

        test('should call PuppetfileCodeLensProvider.applySingleUpgrade for applySingleUpgrade command', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.applySingleUpgrade');
            const mockArgs = { line: 5, version: '1.0.0' };

            // Act
            await command!(mockArgs);

            // Assert
            expect(require('../puppetfileCodeLensProvider').PuppetfileCodeLensProvider.applySingleUpgrade).toHaveBeenCalledWith(mockArgs);
        });

        test('should call UpgradeDiffProvider.applySingleUpgradeFromDiff for applySingleUpgradeFromDiff command', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.applySingleUpgradeFromDiff');
            const mockArgs = [{ line: 5, version: '1.0.0' }];

            // Act
            await command!(...mockArgs);

            // Assert
            expect(UpgradeDiffProvider.applySingleUpgradeFromDiff).toHaveBeenCalledWith(mockArgs);
        });

        test('should call UpgradeDiffProvider.skipSingleUpgradeFromDiff for skipSingleUpgradeFromDiff command', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.skipSingleUpgradeFromDiff');
            const mockArgs = [{ line: 5, version: '1.0.0' }];

            // Act
            await command!(...mockArgs);

            // Assert
            expect(UpgradeDiffProvider.skipSingleUpgradeFromDiff).toHaveBeenCalledWith(mockArgs);
        });
    });

    describe('showDependencyTree progress handling', () => {
        test('should handle cancellation during Phase 1', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            
            let cancelToken: any;
            (mockedVSCode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                cancelToken = { isCancellationRequested: true };
                const progress = { report: jest.fn() };
                return await task(progress as any, cancelToken);
            });

            // Act
            await command!();

            // Assert
            expect(DependencyTreeService.buildDependencyTree).not.toHaveBeenCalled();
        });

        test('should handle cancellation during Phase 2', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            
            let cancelToken: any;
            (mockedVSCode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                cancelToken = { isCancellationRequested: false };
                const progress = { report: jest.fn() };
                return await task(progress as any, cancelToken);
            });
            
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockImplementation(async (modules, progressCallback, token) => {
                // Simulate cancellation during tree building
                token.isCancellationRequested = true;
                return [];
            });

            // Act
            await command!();

            // Assert
            expect(DependencyTreeService.buildDependencyTree).toHaveBeenCalled();
            expect(mockedVSCode.workspace.openTextDocument as jest.Mock).not.toHaveBeenCalled();
        });

        test('should handle progress reporting with uncached modules', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            (PuppetForgeService.hasModuleCached as jest.Mock).mockReturnValue(false);
            
            const mockTree = [{ module: 'puppetlabs/stdlib', dependencies: [] }];
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockResolvedValue(mockTree);
            (DependencyTreeService.generateTreeText as jest.Mock).mockReturnValue('Tree text');
            (DependencyTreeService.findConflicts as jest.Mock).mockReturnValue([]);
            
            let progressCallback: any;
            (CacheService.cacheUncachedModulesWithProgressiveUpdates as jest.Mock).mockImplementation(async (modules, token, callback) => {
                progressCallback = callback;
                callback(1, 2); // Simulate progress
                callback(2, 2); // Complete
            });

            // Act
            await command!();

            // Assert
            expect(CacheService.cacheUncachedModulesWithProgressiveUpdates).toHaveBeenCalled();
            expect(progressCallback).toBeDefined();
        });

        test('should handle progress reporting with dependency tree callback', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            
            const mockTree = [{ module: 'puppetlabs/stdlib', dependencies: [] }];
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockImplementation(async (modules, progressCallback, token) => {
                // Simulate Phase 2 progress
                progressCallback('Analyzing dependencies', 'tree');
                // Simulate Phase 3 progress
                progressCallback('Checking conflicts', 'conflicts', 1, 2);
                return mockTree;
            });
            (DependencyTreeService.generateTreeText as jest.Mock).mockReturnValue('Tree text');
            (DependencyTreeService.findConflicts as jest.Mock).mockReturnValue([]);

            // Act
            await command!();

            // Assert
            expect(DependencyTreeService.buildDependencyTree).toHaveBeenCalled();
            expect(mockedVSCode.workspace.openTextDocument as jest.Mock).toHaveBeenCalled();
        });

        test('should handle all modules already cached scenario', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (mockedVSCode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' } as any);
            (PuppetForgeService.hasModuleCached as jest.Mock).mockReturnValue(true); // All modules cached
            
            const mockTree = [{ module: 'puppetlabs/stdlib', dependencies: [] }];
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockResolvedValue(mockTree);
            (DependencyTreeService.generateTreeText as jest.Mock).mockReturnValue('Tree text');
            (DependencyTreeService.findConflicts as jest.Mock).mockReturnValue([]);

            // Act
            await command!();

            // Assert
            expect(CacheService.cacheUncachedModulesWithProgressiveUpdates).not.toHaveBeenCalled();
            expect(DependencyTreeService.buildDependencyTree).toHaveBeenCalled();
        });

        test('should handle parsing errors in showDependencyTree', async () => {
            // Arrange
            activate(mockContext);
            const command = registeredCommands.get('puppetfile-depgraph.showDependencyTree');
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({
                modules: [],
                errors: ['Parse error in showDependencyTree']
            });

            // Act
            await command!();

            // Assert
            expect(mockedVSCode.window.showErrorMessage as jest.Mock).toHaveBeenCalledWith('Puppetfile parsing errors: Parse error in showDependencyTree');
            expect(mockedVSCode.window.showQuickPick as jest.Mock).not.toHaveBeenCalled();
        });
    });

    describe('CodeLens provider registration', () => {
        test('should register CodeLens provider for Puppetfile pattern', () => {
            // Act
            activate(mockContext);

            // Assert
            expect(mockedVSCode.languages.registerCodeLensProvider as jest.Mock).toHaveBeenCalledWith(
                { pattern: '**/Puppetfile' },
                expect.any(Object)
            );
        });

        test('should register CodeLens provider for diff views', () => {
            // Act
            activate(mockContext);

            // Assert
            expect(mockedVSCode.languages.registerCodeLensProvider as jest.Mock).toHaveBeenCalledWith(
                { scheme: 'puppetfile-diff' },
                expect.any(Object)
            );
        });

        test('should set static instances for CodeLens providers', () => {
            // Arrange
            const setInstanceSpy = jest.spyOn(require('../puppetfileCodeLensProvider').PuppetfileCodeLensProvider, 'setInstance').mockImplementation(() => {});
            const setDiffInstanceSpy = jest.spyOn(require('../services/upgradeDiffCodeLensProvider').UpgradeDiffCodeLensProvider, 'setInstance').mockImplementation(() => {});

            // Act
            activate(mockContext);

            // Assert
            expect(setInstanceSpy).toHaveBeenCalled();
            expect(setDiffInstanceSpy).toHaveBeenCalled();
        });
    });

    describe('deactivate', () => {
        test('should call PuppetForgeService.cleanupAgents when deactivated', () => {
            // Arrange
            const mockCleanupAgents = jest.spyOn(PuppetForgeService, 'cleanupAgents').mockImplementation(() => {});

            // Act
            deactivate();

            // Assert
            expect(mockCleanupAgents).toHaveBeenCalledTimes(1);
        });

        test('should not throw when PuppetForgeService.cleanupAgents is called', () => {
            // Arrange
            jest.spyOn(PuppetForgeService, 'cleanupAgents').mockImplementation(() => {});

            // Act & Assert
            expect(() => {
                deactivate();
            }).not.toThrow();
        });
    });
});
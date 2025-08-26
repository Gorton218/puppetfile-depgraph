import * as vscode from 'vscode';
import { activate, deactivate, __test_only_reset_extension_activated } from '../../src/extension';

// Mock all external dependencies  
jest.mock('vscode', () => ({
    commands: { registerCommand: jest.fn(() => ({ dispose: jest.fn() })) },
    languages: { 
        registerCodeLensProvider: jest.fn(() => ({ dispose: jest.fn() })),
        registerHoverProvider: jest.fn(() => ({ dispose: jest.fn() }))
    },
    workspace: { 
        openTextDocument: jest.fn().mockResolvedValue({}),
        textDocuments: [],
        onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() }))
    },
    window: {
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showQuickPick: jest.fn(),
        withProgress: jest.fn().mockImplementation((options, callback) => callback({ report: jest.fn() }, { isCancellationRequested: false })),
        showTextDocument: jest.fn(),
        activeTextEditor: undefined,
    },
    ProgressLocation: { Notification: 15 },
    EventEmitter: jest.fn().mockImplementation(() => ({
        fire: jest.fn(),
        event: jest.fn(),
    })),
}));

jest.mock('../../src/puppetfileParser');
jest.mock('../../src/services/puppetfileUpdateService');
jest.mock('../../src/services/dependencyTreeService');
jest.mock('../../src/services/puppetForgeService');
jest.mock('../../src/services/gitMetadataService');
jest.mock('../../src/services/cacheService');
jest.mock('../../src/services/upgradePlannerService');
jest.mock('../../src/services/upgradeDiffProvider');
jest.mock('../../src/puppetfileCodeLensProvider');
jest.mock('../../src/services/upgradeDiffCodeLensProvider');
jest.mock('../../src/puppetfileHoverProvider');

import { PuppetfileParser } from '../../src/puppetfileParser';
import { PuppetfileUpdateService } from '../../src/services/puppetfileUpdateService';
import { DependencyTreeService } from '../../src/services/dependencyTreeService';
import { PuppetForgeService } from '../../src/services/puppetForgeService';
import { GitMetadataService } from '../../src/services/gitMetadataService';
import { CacheService } from '../../src/services/cacheService';
import { UpgradePlannerService } from '../../src/services/upgradePlannerService';
import { UpgradeDiffProvider } from '../../src/services/upgradeDiffProvider';
import { PuppetfileCodeLensProvider } from '../../src/puppetfileCodeLensProvider';

describe('Extension', () => {
    let mockContext: vscode.ExtensionContext;
    let commands: Map<string, Function>;

    beforeEach(() => {
        __test_only_reset_extension_activated();
        jest.clearAllMocks();

        commands = new Map();
        (vscode.commands.registerCommand as jest.Mock).mockImplementation((name, callback) => {
            commands.set(name, callback);
            return { dispose: jest.fn() };
        });

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

        // Default mock implementations
        (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ modules: [], errors: [] });
        (PuppetfileUpdateService.updateAllToSafeVersions as jest.Mock).mockResolvedValue([]);
        (DependencyTreeService.buildDependencyTree as jest.Mock).mockResolvedValue([]);

        activate(mockContext);
    });

    it('should not activate twice', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      activate(mockContext);
      expect(consoleLogSpy).toHaveBeenCalledWith('Puppetfile Dependency Manager: Extension already activated, skipping re-activation');
    });

    describe('activation and deactivation', () => {
        it('should dispose of the code lens provider on deactivation', () => {
            const { PuppetfileCodeLensProvider } = require('../../src/puppetfileCodeLensProvider');
            const disposeMock = jest.fn();
            PuppetfileCodeLensProvider.getInstance = jest.fn().mockReturnValue({
                dispose: disposeMock
            });
            deactivate();
            expect(disposeMock).toHaveBeenCalled();
        });

        it('should deactivate the extension', () => {
            const { PuppetForgeService } = require('../../src/services/puppetForgeService');
            deactivate();
            expect(PuppetForgeService.cleanupAgents).toHaveBeenCalled();
        });
    });

    describe('Commands', () => {
        it('should handle command registration errors', () => {
            (vscode.commands.registerCommand as jest.Mock).mockImplementation(() => {
                throw new Error('already exists');
            });
            const consoleWarnSpy = jest.spyOn(console, 'warn');
            __test_only_reset_extension_activated();
            activate(mockContext);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered, skipping'));
        });

        it('should show progress on updateAllToSafe', async () => {
          const report = jest.fn();
          (vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
            await task({ report }, { isCancellationRequested: false });
          });
          const command = commands.get('puppetfile-depgraph.updateAllToSafe');
          await command?.();
          expect(report).toHaveBeenCalledWith({ increment: 0, message: "Checking for updates..." });
          expect(report).toHaveBeenCalledWith({ increment: 100, message: "Update complete!" });
        });

        it('should not update all to latest when user cancels', async () => {
          (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('No');
          const command = commands.get('puppetfile-depgraph.updateAllToLatest');
          await command?.();
          expect(PuppetfileUpdateService.updateAllToLatestVersions).not.toHaveBeenCalled();
        });

        it('should not show dependency tree when user cancels', async () => {
          (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(undefined);
          const command = commands.get('puppetfile-depgraph.showDependencyTree');
          await command?.();
          expect(DependencyTreeService.buildDependencyTree).not.toHaveBeenCalled();
        });

        it('should show empty dependency tree', async () => {
          (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' });
          (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ modules: [], errors: [] });
          (DependencyTreeService.buildDependencyTree as jest.Mock).mockResolvedValue([]);
          (DependencyTreeService.generateTreeText as jest.Mock).mockReturnValue('No dependencies');
          (DependencyTreeService.findConflicts as jest.Mock).mockReturnValue([]);
          
          (vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
            const result = await task({ report: jest.fn() }, { isCancellationRequested: false });
            return result;
          });
          
          const command = commands.get('puppetfile-depgraph.showDependencyTree');
          await command?.();
          
          expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith({
            content: expect.stringContaining('No dependencies found.'),
            language: 'markdown',
          });
        });

        it('should not cache all modules if there are no forge modules', async () => {
          (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ modules: [], errors: [] });
          const command = commands.get('puppetfile-depgraph.cacheAllModules');
          await command?.();
          expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No Puppet Forge modules found in Puppetfile');
        });

        it('should not show upgrade planner if there are no forge modules', async () => {
          (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ modules: [], errors: [] });
          const command = commands.get('puppetfile-depgraph.showUpgradePlanner');
          await command?.();
          expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No Puppet Forge modules found in Puppetfile');
        });

        it('should show error on cache all modules with parsing errors', async () => {
          (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ modules: [], errors: ['error'] });
          const command = commands.get('puppetfile-depgraph.cacheAllModules');
          await command?.();
          expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Puppetfile parsing errors: error');
        });

        it('should show error on show upgrade planner with parsing errors', async () => {
          (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ modules: [], errors: ['error'] });
          const command = commands.get('puppetfile-depgraph.showUpgradePlanner');
          await command?.();
          expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Puppetfile parsing errors: error');
        });

        it('should handle invalid arguments for update module version', async () => {
          const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
          const command = commands.get('puppetfile-depgraph.updateModuleVersion');
          await command?.({});
          expect(consoleErrorSpy).toHaveBeenCalledWith('Invalid arguments for version update command:', {});
          expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Invalid arguments for version update command');
          consoleErrorSpy.mockRestore();
        });

        it('should throw error on show upgrade planner with no active editor', async () => {
          (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ modules: [{ source: 'forge' }], errors: [] });
          (vscode.window.activeTextEditor as any) = undefined;
          const command = commands.get('puppetfile-depgraph.showUpgradePlanner');
          await command?.();
          expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to analyze upgrades: No active Puppetfile editor found');
        });
        it('should handle parsing errors for updateAllToSafe', async () => {
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ modules: [], errors: ['error'] });
            const command = commands.get('puppetfile-depgraph.updateAllToSafe');
            await command?.();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('parsing errors'));
        });

        it('should handle update failure for updateAllToSafe', async () => {
            (PuppetfileUpdateService.updateAllToSafeVersions as jest.Mock).mockRejectedValue(new Error('test error'));
            const command = commands.get('puppetfile-depgraph.updateAllToSafe');
            await command?.();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Update failed'));
        });

        it('should handle parsing errors for showDependencyTree', async () => {
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ modules: [], errors: ['error'] });
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('parsing errors'));
        });

        it('should handle tree build failure', async () => {
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' });
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockRejectedValue(new Error('test error'));
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Failed to build'));
        });

        it('should show list view for showDependencyTree', async () => {
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'list' });
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockResolvedValue([{}]); // Return a non-empty array
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            expect(DependencyTreeService.generateListText).toHaveBeenCalled();
        });

        it('should update all to latest', async () => {
          (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Yes');
          const command = commands.get('puppetfile-depgraph.updateAllToLatest');
          await command?.();
          expect(PuppetfileUpdateService.updateAllToLatestVersions).toHaveBeenCalled();
        });

        it('should show tree view for showDependencyTree', async () => {
          (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' });
          (DependencyTreeService.buildDependencyTree as jest.Mock).mockResolvedValue([{}]); // Return a non-empty array
          const command = commands.get('puppetfile-depgraph.showDependencyTree');
          await command?.();
          expect(DependencyTreeService.generateTreeText).toHaveBeenCalled();
        });

        it('should clear forge cache', async () => {
          const command = commands.get('puppetfile-depgraph.clearForgeCache');
          await command?.();
          expect(PuppetForgeService.clearCache).toHaveBeenCalled();
          expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Puppet Forge cache cleared successfully!');
        });

        it('should clear all caches', async () => {
          const command = commands.get('puppetfile-depgraph.clearCache');
          await command?.();
          expect(PuppetForgeService.clearCache).toHaveBeenCalled();
          expect(GitMetadataService.clearCache).toHaveBeenCalled();
          expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('All caches cleared successfully! (Puppet Forge + Git metadata)');
        });

        it('should update module version', async () => {
          const command = commands.get('puppetfile-depgraph.updateModuleVersion');
          const args = { line: 1, version: '1.0.0' };
          await command?.(args);
          expect(PuppetfileUpdateService.updateModuleVersionAtLine).toHaveBeenCalledWith(1, '1.0.0');
        });

        it('should cache all modules', async () => {
          (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ modules: [{ source: 'forge' }], errors: [] });
          const command = commands.get('puppetfile-depgraph.cacheAllModules');
          await command?.();
          expect(CacheService.cacheAllModules).toHaveBeenCalled();
        });

        it('should show upgrade planner', async () => {
          const setTimeoutMock = jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
            if (typeof callback === 'function') {
              callback();
            }
            return {} as NodeJS.Timeout;
          });

          (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ modules: [{ source: 'forge' }], errors: [] });
          (vscode.window.activeTextEditor as any) = { document: { getText: () => '' } };
          (vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
            await task({ report: () => {} }, { isCancellationRequested: false });
          });
          const command = commands.get('puppetfile-depgraph.showUpgradePlanner');
          await command?.();
          expect(UpgradePlannerService.createUpgradePlan).toHaveBeenCalled();
          expect(UpgradeDiffProvider.showInteractiveUpgradePlanner).toHaveBeenCalled();

          setTimeoutMock.mockRestore();
        });

        it('should show about information', async () => {
          const command = commands.get('puppetfile-depgraph.showAbout');
          await command?.();
          expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith({
            content: expect.any(String),
            language: 'markdown',
          });
          expect(vscode.window.showTextDocument).toHaveBeenCalled();
        });

        it('should apply all upgrades', async () => {
          const command = commands.get('puppetfile-depgraph.applyAllUpgrades');
          await command?.();
          expect(UpgradeDiffProvider.applyAllUpgrades).toHaveBeenCalled();
        });
    
        it('should apply selected upgrades', async () => {
          const command = commands.get('puppetfile-depgraph.applySelectedUpgrades');
          await command?.();
          expect(UpgradeDiffProvider.applySelectedUpgrades).toHaveBeenCalled();
        });
    
        it('should apply single upgrade', async () => {
          const command = commands.get('puppetfile-depgraph.applySingleUpgrade');
          const args = { line: 1, newVersion: '1.0.0' };
          await command?.(args);
          expect(PuppetfileCodeLensProvider.applySingleUpgrade).toHaveBeenCalledWith(args);
        });
    
        it('should apply single upgrade from diff', async () => {
          const command = commands.get('puppetfile-depgraph.applySingleUpgradeFromDiff');
          const args = { line: 1, newVersion: '1.0.0' };
          await command?.(args);
          expect(UpgradeDiffProvider.applySingleUpgradeFromDiff).toHaveBeenCalledWith([args]);
        });
    
        it('should skip single upgrade from diff', async () => {
          const command = commands.get('puppetfile-depgraph.skipSingleUpgradeFromDiff');
          const args = { line: 1, newVersion: '1.0.0' };
          await command?.(args);
          expect(UpgradeDiffProvider.skipSingleUpgradeFromDiff).toHaveBeenCalledWith([args]);
        });

        it('should handle error during updateAllToLatest', async () => {
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Yes');
            (PuppetfileUpdateService.updateAllToLatestVersions as jest.Mock).mockRejectedValue(new Error('test error'));
            const command = commands.get('puppetfile-depgraph.updateAllToLatest');
            await command?.();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Update failed'));
        });

        it('should handle non-Error type exceptions during updateAllToSafe', async () => {
            (PuppetfileUpdateService.updateAllToSafeVersions as jest.Mock).mockRejectedValue('string error');
            const command = commands.get('puppetfile-depgraph.updateAllToSafe');
            await command?.();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Update failed: Unknown error');
        });

        it('should handle non-Error type exceptions during updateAllToLatest', async () => {
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Yes');
            (PuppetfileUpdateService.updateAllToLatestVersions as jest.Mock).mockRejectedValue('string error');
            const command = commands.get('puppetfile-depgraph.updateAllToLatest');
            await command?.();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Update failed: Unknown error');
        });

        it('should handle cancellation during showDependencyTree with uncached modules', async () => {
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' });
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ 
                modules: [{ source: 'forge', name: 'puppetlabs/stdlib' }], 
                errors: [] 
            });
            (PuppetForgeService.hasModuleCached as jest.Mock).mockReturnValue(false);
            (CacheService.isCachingInProgress as jest.Mock).mockReturnValue(false);
            
            let progressCallback: any;
            (vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                const token = { isCancellationRequested: true };
                await task({ report: jest.fn() }, token);
            });
            
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            
            // Should return early on cancellation
            expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
        });

        it('should handle phase 2 animation during dependency tree building', async () => {
            jest.useFakeTimers();
            
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' });
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ 
                modules: [{ source: 'forge', name: 'puppetlabs/stdlib' }], 
                errors: [] 
            });
            (PuppetForgeService.hasModuleCached as jest.Mock).mockReturnValue(true);
            (CacheService.isCachingInProgress as jest.Mock).mockReturnValue(false);
            
            let progressReport: any;
            let progressCallback: any;
            let token = { isCancellationRequested: false };
            
            (vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                progressReport = jest.fn();
                progressCallback = (message: string, phase?: string, moduleCount?: number, totalModules?: number) => {
                    // Simulate conflict phase callback
                    if (phase === 'conflicts') {
                        progressReport({ increment: 0, message: `Phase 3: ${message}` });
                    }
                };
                
                // Start the task
                const promise = task({ report: progressReport }, token);
                
                // Advance timers to trigger animation
                jest.advanceTimersByTime(600);
                
                return promise;
            });
            
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockImplementation((modules, callback) => {
                // Simulate progress callbacks
                callback('Building tree...', 'tree');
                callback('Analyzing conflicts...', 'conflicts', 5, 10);
                return Promise.resolve([]);
            });
            
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            
            jest.useRealTimers();
        });

        it('should show conflicts in dependency tree output', async () => {
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' });
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ 
                modules: [{ source: 'forge', name: 'puppetlabs/stdlib' }], 
                errors: [] 
            });
            (PuppetForgeService.hasModuleCached as jest.Mock).mockReturnValue(true);
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockResolvedValue([{ name: 'module1' }]);
            (DependencyTreeService.findConflicts as jest.Mock).mockReturnValue(['Conflict 1', 'Conflict 2']);
            
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            
            expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith({
                content: expect.stringContaining('Potential Conflicts'),
                language: 'markdown'
            });
        });

        it('should handle error during updateModuleVersion command', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            (PuppetfileUpdateService.updateModuleVersionAtLine as jest.Mock).mockRejectedValue(new Error('Update failed'));
            
            const command = commands.get('puppetfile-depgraph.updateModuleVersion');
            await command?.({ line: 1, version: '1.0.0' });
            
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating module version:', expect.any(Error));
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to update module: Update failed');
            
            consoleErrorSpy.mockRestore();
        });

        it('should handle non-Error exception during updateModuleVersion', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            (PuppetfileUpdateService.updateModuleVersionAtLine as jest.Mock).mockRejectedValue('string error');
            
            const command = commands.get('puppetfile-depgraph.updateModuleVersion');
            await command?.({ line: 1, version: '1.0.0' });
            
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating module version:', 'string error');
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to update module: Unknown error');
            
            consoleErrorSpy.mockRestore();
        });

        it('should handle progressive caching with uncached modules during showDependencyTree', async () => {
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' });
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ 
                modules: [{ source: 'forge', name: 'puppetlabs/stdlib' }], 
                errors: [] 
            });
            (PuppetForgeService.hasModuleCached as jest.Mock).mockReturnValue(false);
            (CacheService.isCachingInProgress as jest.Mock).mockReturnValue(false);
            
            let progressCallback: any;
            let reportSpy = jest.fn();
            
            (vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                await task({ report: reportSpy }, { isCancellationRequested: false });
            });
            
            (CacheService.cacheUncachedModulesWithProgressiveUpdates as jest.Mock).mockImplementation(
                async (modules, token, callback) => {
                    // Simulate progressive updates
                    callback(1, 3);
                    callback(2, 3);
                    callback(3, 3);
                    return Promise.resolve();
                }
            );
            
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockResolvedValue([]);
            
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            
            // Check that progressive updates were reported
            expect(reportSpy).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Phase 1')
            }));
        });

        it('should handle error during showDependencyTree', async () => {
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' });
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ 
                modules: [{ source: 'forge' }], 
                errors: [] 
            });
            
            (vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                // Simulate error inside the progress callback
                try {
                    await task({ report: jest.fn() }, { isCancellationRequested: false });
                } catch (error) {
                    // Won't reach here in actual implementation
                }
            });
            
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockRejectedValue(new Error('Build error'));
            
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Failed to build'));
        });

        it('should handle non-Error exception during showDependencyTree', async () => {
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'tree' });
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({ 
                modules: [{ source: 'forge' }], 
                errors: [] 
            });
            
            (vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                // Simulate non-Error exception inside the progress callback
                try {
                    await task({ report: jest.fn() }, { isCancellationRequested: false });
                } catch (error) {
                    // Won't reach here in actual implementation
                }
            });
            
            (DependencyTreeService.buildDependencyTree as jest.Mock).mockRejectedValue('string error');
            
            const command = commands.get('puppetfile-depgraph.showDependencyTree');
            await command?.();
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to build dependency tree: Unknown error');
        });

        it('should handle registration errors for specific commands', () => {
            let callCount = 0;
            (vscode.commands.registerCommand as jest.Mock).mockImplementation((name) => {
                callCount++;
                // Only throw for the first command to test error handling
                if (callCount === 1) {
                    throw new Error('Registration failed');
                }
                return { dispose: jest.fn() };
            });
            
            __test_only_reset_extension_activated();
            
            // Should throw because the error doesn't contain 'already exists'
            expect(() => activate(mockContext)).toThrow('Registration failed');
        });
    });
});

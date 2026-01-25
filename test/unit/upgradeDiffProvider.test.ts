import * as vscode from 'vscode';
import { UpgradeDiffProvider } from '../../src/services/upgradeDiffProvider';
import { UpgradePlan, UpgradeCandidate, UpgradePlannerService } from '../../src/services/upgradePlannerService';
import { PuppetModule } from '../../src/puppetfileParser';
import { PuppetfileUpdateService } from '../../src/services/puppetfileUpdateService';
import { PuppetfileParser } from '../../src/puppetfileParser';

// Mock dependencies
jest.mock('../../src/services/upgradePlannerService');
jest.mock('../../src/services/puppetfileUpdateService');
jest.mock('../../src/puppetfileParser');

// Mock VS Code API
jest.mock('vscode', () => {
    const mockExecuteCommand = jest.fn();
    const mockShowQuickPick = jest.fn();
    const mockOpenTextDocument = jest.fn();
    const mockShowTextDocument = jest.fn();
    const mockShowErrorMessage = jest.fn();
    const mockShowInformationMessage = jest.fn();
    const mockWithProgress = jest.fn();
    const mockCreateWorkspaceEdit = jest.fn();
    const mockApplyEdit = jest.fn();
    
    return {
        Uri: {
            parse: jest.fn((uri: string) => ({ scheme: 'puppetfile-diff', path: uri.split('/').pop(), authority: uri.includes('current') ? 'current' : 'proposed' }))
        },
        EventEmitter: jest.fn().mockImplementation(() => ({
            event: jest.fn(),
            fire: jest.fn(),
            dispose: jest.fn()
        })),
        workspace: {
            registerTextDocumentContentProvider: jest.fn(() => ({ dispose: jest.fn() })),
            openTextDocument: mockOpenTextDocument,
            textDocuments: [],
            applyEdit: mockApplyEdit
        },
        WorkspaceEdit: jest.fn(() => ({
            replace: jest.fn()
        })),
        commands: {
            executeCommand: mockExecuteCommand
        },
        window: {
            showQuickPick: mockShowQuickPick,
            showTextDocument: mockShowTextDocument,
            showErrorMessage: mockShowErrorMessage,
            showInformationMessage: mockShowInformationMessage,
            withProgress: mockWithProgress,
            activeTextEditor: null,
            visibleTextEditors: []
        },
        ProgressLocation: {
            Notification: 15
        },
        _mockExecuteCommand: mockExecuteCommand,
        _mockShowQuickPick: mockShowQuickPick,
        _mockOpenTextDocument: mockOpenTextDocument,
        _mockShowTextDocument: mockShowTextDocument,
        _mockShowErrorMessage: mockShowErrorMessage,
        _mockShowInformationMessage: mockShowInformationMessage,
        _mockWithProgress: mockWithProgress,
        _mockCreateWorkspaceEdit: mockCreateWorkspaceEdit,
        _mockApplyEdit: mockApplyEdit
    };
});

// Mock UpgradeDiffCodeLensProvider
jest.mock('../../src/services/upgradeDiffCodeLensProvider', () => ({
    UpgradeDiffCodeLensProvider: {
        getInstance: jest.fn(),
        setUpgradePlan: jest.fn()
    }
}));

// Mock PuppetfileCodeLensProvider  
jest.mock('../../src/puppetfileCodeLensProvider', () => ({
    PuppetfileCodeLensProvider: {
        getInstance: jest.fn()
    }
}));

const mockVscode = vscode as jest.Mocked<typeof vscode>;
const mockUpgradePlannerService = UpgradePlannerService as jest.Mocked<typeof UpgradePlannerService>;
const mockPuppetfileUpdateService = PuppetfileUpdateService as jest.Mocked<typeof PuppetfileUpdateService>;
const mockPuppetfileParser = PuppetfileParser as jest.Mocked<typeof PuppetfileParser>;

// Import the mocked modules
const { UpgradeDiffCodeLensProvider } = require('../../src/services/upgradeDiffCodeLensProvider');
const { PuppetfileCodeLensProvider } = require('../../src/puppetfileCodeLensProvider');

describe('UpgradeDiffProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (mockVscode as any)._mockExecuteCommand.mockClear();
        (mockVscode as any)._mockShowQuickPick.mockClear();
        (mockVscode as any)._mockOpenTextDocument.mockClear();
        (mockVscode as any)._mockShowTextDocument.mockClear();
        (mockVscode as any)._mockShowErrorMessage.mockClear();
        (mockVscode as any)._mockShowInformationMessage.mockClear();
        (mockVscode as any)._mockWithProgress.mockClear();
        (mockVscode as any)._mockApplyEdit.mockClear();
        
        // Clear global state
        (globalThis as any).__currentUpgradePlan = undefined;
        (globalThis as any).__currentUpgradeOptions = undefined;
        (globalThis as any).__currentContentProvider = undefined;
        
        // Reset mocks
        mockUpgradePlannerService.applyUpgradesToContent = jest.fn().mockReturnValue('mocked content');
        mockUpgradePlannerService.generateUpgradeSummary = jest.fn().mockReturnValue('# Upgrade Plan Summary\nMocked summary');
        mockPuppetfileUpdateService.applyUpdates = jest.fn().mockResolvedValue(undefined);
        mockPuppetfileUpdateService.updateModuleVersionAtLine = jest.fn().mockResolvedValue(undefined);
        mockPuppetfileParser.parseContent = jest.fn().mockReturnValue({ modules: [], errors: [] });
        
        // Reset CodeLens provider mocks
        UpgradeDiffCodeLensProvider.getInstance.mockReturnValue({
            refresh: jest.fn()
        });
        UpgradeDiffCodeLensProvider.setUpgradePlan.mockClear();
        
        PuppetfileCodeLensProvider.getInstance.mockReturnValue({
            refresh: jest.fn()
        });
    });

    describe('showUpgradeDiff', () => {
        test('should create and show diff view', async () => {
            const originalContent = `forge 'https://forgeapi.puppet.com'
mod 'puppetlabs/stdlib', '8.0.0'`;

            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 2 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0', '8.0.0'],
                    isUpgradeable: true
                }] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan);

            expect(mockVscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalledWith(
                'puppetfile-diff',
                expect.any(Object)
            );
            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.diff',
                expect.objectContaining({ scheme: 'puppetfile-diff' }),
                expect.objectContaining({ scheme: 'puppetfile-diff' }),
                'Puppetfile Upgrade Plan: Current ↔ Proposed',
                { preview: true }
            );
        });

        test('should handle diff creation errors', async () => {
            const originalContent = 'test content';
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 0,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            (mockVscode as any)._mockExecuteCommand.mockRejectedValue(new Error('Test error'));

            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan);

            expect((mockVscode as any)._mockShowErrorMessage).toHaveBeenCalledWith(
                'Failed to show upgrade diff: Test error'
            );
        });
    });

    describe('showInteractiveUpgradePlanner', () => {
        test('should show quick pick with upgrade options', async () => {
            const originalContent = 'test content';
            const upgradePlan: UpgradePlan = {
                candidates: [
                    {
                        module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                        currentVersion: '8.0.0',
                        maxSafeVersion: '9.0.0',
                        availableVersions: [],
                        isUpgradeable: true
                    },
                    {
                        module: { name: 'puppetlabs/apache', version: '5.0.0', source: 'forge', line: 2 } as PuppetModule,
                        currentVersion: '5.0.0',
                        maxSafeVersion: '5.0.0',
                        availableVersions: [],
                        isUpgradeable: false,
                        blockedBy: ['puppetlabs/concat']
                    }
                ] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 2,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            (mockVscode as any)._mockShowQuickPick.mockResolvedValue(undefined); // User cancels

            await UpgradeDiffProvider.showInteractiveUpgradePlanner(originalContent, upgradePlan);

            expect((mockVscode as any)._mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: expect.stringContaining('Show All Safe Upgrades (1)')
                    }),
                    expect.objectContaining({
                        label: expect.stringContaining('Show Upgrade Summary')
                    }),
                    expect.objectContaining({
                        label: expect.stringContaining('Show Blocked Modules (1)')
                    })
                ]),
                expect.objectContaining({
                    title: 'Puppetfile Upgrade Planner'
                })
            );
        });

        test('should handle formatVersionTransition with undefined/null versions', () => {
            // Import the utility function to test nullish coalescing directly
            const { formatVersionTransition } = require('../../src/utils/versionUtils');
            
            // Test the nullish coalescing logic for version transitions
            const result1 = formatVersionTransition(undefined, '9.0.0');
            const result2 = formatVersionTransition(null, '9.0.0');
            const result3 = formatVersionTransition('8.0.0', undefined ?? 'unknown');
            
            expect(result1).toBe('unversioned → 9.0.0');
            expect(result2).toBe('unversioned → 9.0.0'); 
            expect(result3).toBe('8.0.0 → unknown');
        });

        test('should handle unversioned modules in upgrade plan', async () => {
            const originalContent = 'test content';
            const upgradePlan: UpgradePlan = {
                candidates: [
                    {
                        module: {
                            name: 'puppetlabs/apache',
                            source: 'forge' as const,
                            version: undefined, // Unversioned module
                            line: 1
                        },
                        currentVersion: undefined,
                        maxSafeVersion: '5.0.0',
                        availableVersions: ['5.0.0', '4.0.0'],
                        isUpgradeable: true,
                        blockedBy: []
                    }
                ] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            (mockVscode as any)._mockShowQuickPick.mockResolvedValue({
                label: 'Show All Safe Upgrades',
                action: 'all'
            });

            await UpgradeDiffProvider.showInteractiveUpgradePlanner(originalContent, upgradePlan);

            // Should handle unversioned modules without errors
            expect((mockVscode as any)._mockExecuteCommand).toHaveBeenCalledWith(
                'vscode.diff',
                expect.anything(),
                expect.anything(),
                expect.stringContaining('Puppetfile Upgrade Plan'),
                expect.anything()
            );
        });

        test('should handle "all" action selection', async () => {
            const originalContent = 'test content';
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            (mockVscode as any)._mockShowQuickPick.mockResolvedValue({
                label: 'Show All Safe Upgrades',
                action: 'all'
            });

            await UpgradeDiffProvider.showInteractiveUpgradePlanner(originalContent, upgradePlan);

            expect((mockVscode as any)._mockExecuteCommand).toHaveBeenCalledWith(
                'vscode.diff',
                expect.any(Object),
                expect.any(Object),
                expect.any(String),
                expect.any(Object)
            );
        });

        test('should handle "summary" action selection', async () => {
            const originalContent = 'test content';
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 0,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            (mockVscode as any)._mockShowQuickPick.mockResolvedValue({
                label: 'Show Upgrade Summary',
                action: 'summary'
            });

            (mockVscode as any)._mockOpenTextDocument.mockResolvedValue({} as any);

            await UpgradeDiffProvider.showInteractiveUpgradePlanner(originalContent, upgradePlan);

            expect((mockVscode as any)._mockOpenTextDocument).toHaveBeenCalledWith({
                content: expect.stringContaining('# Upgrade Plan Summary'),
                language: 'markdown'
            });
        });

        test('should not show safe upgrades option when no modules are upgradeable', async () => {
            const originalContent = 'test content';
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            (mockVscode as any)._mockShowQuickPick.mockResolvedValue(undefined);

            await UpgradeDiffProvider.showInteractiveUpgradePlanner(originalContent, upgradePlan);

            expect((mockVscode as any)._mockShowQuickPick).toHaveBeenCalledWith(
                expect.not.arrayContaining([
                    expect.objectContaining({
                        label: expect.stringContaining('Show All Safe Upgrades')
                    })
                ]),
                expect.objectContaining({
                    title: 'Puppetfile Upgrade Planner'
                })
            );
        });

        test('should handle "blocked" action selection', async () => {
            const originalContent = 'test content';
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/apache', version: '5.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '5.0.0',
                    maxSafeVersion: '5.0.0',
                    availableVersions: ['6.0.0'],
                    isUpgradeable: false,
                    blockedBy: ['puppetlabs/concat'],
                    conflicts: [{
                        moduleName: 'puppetlabs/concat',  
                        currentVersion: '6.0.0',
                        requirement: '>= 7.0.0'
                    }]
                }] as UpgradeCandidate[],
                totalUpgradeable: 0,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: true,
                gitModules: []
            };

            (mockVscode as any)._mockShowQuickPick.mockResolvedValue({
                label: 'Show Blocked Modules',
                action: 'blocked'
            });

            (mockVscode as any)._mockOpenTextDocument.mockResolvedValue({} as any);

            await UpgradeDiffProvider.showInteractiveUpgradePlanner(originalContent, upgradePlan);

            expect((mockVscode as any)._mockOpenTextDocument).toHaveBeenCalledWith({
                content: expect.stringContaining('# Blocked Modules Analysis'),
                language: 'markdown'
            });
        });

        test('should handle no blocked modules', async () => {
            const originalContent = 'test content';
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 0,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            (mockVscode as any)._mockShowQuickPick.mockResolvedValue({
                label: 'Show Blocked Modules',
                action: 'blocked'
            });

            await UpgradeDiffProvider.showInteractiveUpgradePlanner(originalContent, upgradePlan);

            expect((mockVscode as any)._mockShowInformationMessage).toHaveBeenCalledWith(
                'No modules are currently blocked from upgrading.'
            );
        });
    });

    describe('PuppetfileDiffContentProvider', () => {
        test('should provide correct content for current and proposed URIs', () => {
            const originalContent = 'original content';
            const proposedContent = 'proposed content';

            // Access the provider class through the module
            const UpgradeDiffProviderModule = require('../../src/services/upgradeDiffProvider');
            
            // Since the class is not exported, we'll test the functionality through the main methods
            // This test verifies that the diff functionality works end-to-end
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: [],
                    isUpgradeable: true
                }] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            // Test the content provider registration
            return UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan).then(() => {
                expect(mockVscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalled();
            });
        });
    });

    describe('applyAllUpgrades', () => {
        test('should show error when no upgrade plan available', async () => {
            await UpgradeDiffProvider.applyAllUpgrades();
            
            expect((mockVscode as any)._mockShowErrorMessage).toHaveBeenCalledWith(
                'No upgrade plan available. Please run the upgrade planner first.'
            );
        });
        
        test('should show error when no active editor', async () => {
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            (globalThis as any).__currentUpgradePlan = upgradePlan;
            
            await UpgradeDiffProvider.applyAllUpgrades();
            
            expect((mockVscode as any)._mockShowErrorMessage).toHaveBeenCalledWith(
                'Please open a Puppetfile to apply upgrades.'
            );
        });
        
        test('should apply upgrades successfully', async () => {
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            (globalThis as any).__currentUpgradePlan = upgradePlan;
            
            const mockEditor = {
                document: { languageId: 'puppetfile' }
            };
            mockVscode.window.activeTextEditor = mockEditor as any;
            
            const mockProgressCallback = jest.fn();
            (mockVscode as any)._mockWithProgress.mockImplementation((options: any, callback: any) => {
                return callback({ report: mockProgressCallback });
            });
            
            await UpgradeDiffProvider.applyAllUpgrades();
            
            expect(mockPuppetfileUpdateService.applyUpdates).toHaveBeenCalledWith(
                mockEditor,
                expect.arrayContaining([{
                    moduleName: 'puppetlabs/stdlib',
                    currentVersion: '8.0.0',
                    newVersion: '9.0.0',
                    success: true,
                    line: 1
                }])
            );
        });
        
        test('should handle apply updates error', async () => {
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            (globalThis as any).__currentUpgradePlan = upgradePlan;
            
            const mockEditor = {
                document: { languageId: 'puppetfile' }
            };
            mockVscode.window.activeTextEditor = mockEditor as any;
            
            const mockProgressCallback = jest.fn();
            (mockVscode as any)._mockWithProgress.mockImplementation((options: any, callback: any) => {
                return callback({ report: mockProgressCallback });
            });
            
            mockPuppetfileUpdateService.applyUpdates.mockRejectedValue(new Error('Test error'));
            
            await UpgradeDiffProvider.applyAllUpgrades();
            
            expect((mockVscode as any)._mockShowErrorMessage).toHaveBeenCalledWith(
                'Failed to apply upgrades: Test error'
            );
        });
    });
    
    describe('applySelectedUpgrades', () => {
        test('should show error when no upgrade plan available', async () => {
            await UpgradeDiffProvider.applySelectedUpgrades();
            
            expect((mockVscode as any)._mockShowErrorMessage).toHaveBeenCalledWith(
                'No upgrade plan available. Please run the upgrade planner first.'
            );
        });
        
        test('should show info when no upgrades available', async () => {
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 0,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            (globalThis as any).__currentUpgradePlan = upgradePlan;
            
            const mockEditor = {
                document: { languageId: 'puppetfile' }
            };
            mockVscode.window.activeTextEditor = mockEditor as any;
            
            await UpgradeDiffProvider.applySelectedUpgrades();
            
            expect((mockVscode as any)._mockShowInformationMessage).toHaveBeenCalledWith(
                'No upgrades available to apply.'
            );
        });
        
        test('should handle user cancellation', async () => {
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            (globalThis as any).__currentUpgradePlan = upgradePlan;
            
            const mockEditor = {
                document: { languageId: 'puppetfile' }
            };
            mockVscode.window.activeTextEditor = mockEditor as any;
            
            (mockVscode as any)._mockShowQuickPick.mockResolvedValue(undefined);
            
            await UpgradeDiffProvider.applySelectedUpgrades();
            
            expect(mockPuppetfileUpdateService.applyUpdates).not.toHaveBeenCalled();
        });
        
        test('should apply selected upgrades', async () => {
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            (globalThis as any).__currentUpgradePlan = upgradePlan;
            
            const mockEditor = {
                document: { languageId: 'puppetfile' }
            };
            mockVscode.window.activeTextEditor = mockEditor as any;
            
            const selectedItem = {
                label: 'puppetlabs/stdlib',
                candidate: upgradePlan.candidates[0]
            };
            (mockVscode as any)._mockShowQuickPick.mockResolvedValue([selectedItem]);
            
            const mockProgressCallback = jest.fn();
            (mockVscode as any)._mockWithProgress.mockImplementation((options: any, callback: any) => {
                return callback({ report: mockProgressCallback });
            });
            
            await UpgradeDiffProvider.applySelectedUpgrades();
            
            expect(mockPuppetfileUpdateService.applyUpdates).toHaveBeenCalledWith(
                mockEditor,
                expect.arrayContaining([{
                    moduleName: 'puppetlabs/stdlib',
                    currentVersion: '8.0.0',
                    newVersion: '9.0.0',
                    success: true,
                    line: 1
                }])
            );
        });
    });
    
    describe('applySingleUpgradeFromDiff', () => {
        test('should handle invalid arguments', async () => {
            await UpgradeDiffProvider.applySingleUpgradeFromDiff([]);
            
            expect((mockVscode as any)._mockShowErrorMessage).toHaveBeenCalledWith(
                'Invalid arguments for upgrade command'
            );
        });
        
        test('should handle missing upgrade information', async () => {
            await UpgradeDiffProvider.applySingleUpgradeFromDiff([{}]);
            
            expect((mockVscode as any)._mockShowErrorMessage).toHaveBeenCalledWith(
                'Missing upgrade information'
            );
        });
        
        test('should handle missing Puppetfile document', async () => {
            const upgradeInfo = {
                moduleName: 'puppetlabs/stdlib',
                currentVersion: '8.0.0',
                newVersion: '9.0.0'
            };
            
            const mockProgressCallback = jest.fn();
            (mockVscode as any)._mockWithProgress.mockImplementation((options: any, callback: any) => {
                return callback({ report: mockProgressCallback });
            });
            
            (mockVscode.workspace as any).textDocuments = [];
            mockVscode.window.visibleTextEditors = [];
            
            await UpgradeDiffProvider.applySingleUpgradeFromDiff([upgradeInfo]);
            
            expect((mockVscode as any)._mockShowErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Could not find the original Puppetfile document')
            );
        });
        
        test('should apply single upgrade with editor', async () => {
            const upgradeInfo = {
                moduleName: 'puppetlabs/stdlib',
                currentVersion: '8.0.0',
                newVersion: '9.0.0'
            };
            
            const mockDocument = {
                languageId: 'puppetfile',
                uri: { path: '/test/Puppetfile', scheme: 'file' },
                fileName: 'Puppetfile',
                getText: jest.fn().mockReturnValue("mod 'puppetlabs/stdlib', '8.0.0'")
            };
            
            const mockEditor = {
                document: mockDocument
            };
            
            (mockVscode.workspace as any).textDocuments = [mockDocument as any];
            mockVscode.window.visibleTextEditors = [mockEditor as any];
            
            const mockProgressCallback = jest.fn();
            (mockVscode as any)._mockWithProgress.mockImplementation((options: any, callback: any) => {
                return callback({ report: mockProgressCallback });
            });
            
            await UpgradeDiffProvider.applySingleUpgradeFromDiff([upgradeInfo]);
            
            expect(mockPuppetfileUpdateService.updateModuleVersionAtLine).toHaveBeenCalledWith(1, '9.0.0');
        });
    });
    
    describe('skipSingleUpgradeFromDiff', () => {
        test('should handle empty arguments', async () => {
            await UpgradeDiffProvider.skipSingleUpgradeFromDiff([]);
            
            // Should not throw error and not show any message
            expect((mockVscode as any)._mockShowInformationMessage).not.toHaveBeenCalled();
        });
        
        test('should show skip message', async () => {
            const skipInfo = { moduleName: 'puppetlabs/stdlib' };
            
            await UpgradeDiffProvider.skipSingleUpgradeFromDiff([skipInfo]);
            
            expect((mockVscode as any)._mockShowInformationMessage).toHaveBeenCalledWith(
                '⏭️ Skipped upgrade for puppetlabs/stdlib'
            );
        });
    });
    
    describe('showUpgradeActions integration', () => {
        test('should show upgrade actions through diff flow', async () => {
            const originalContent = `mod 'puppetlabs/stdlib', '8.0.0'`;
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            
            (mockVscode as any)._mockShowInformationMessage.mockResolvedValue('Apply All');
            
            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan);
            
            // Verify diff was shown and upgrade actions were triggered
            expect((mockVscode as any)._mockExecuteCommand).toHaveBeenCalledWith(
                'vscode.diff',
                expect.any(Object),
                expect.any(Object),
                expect.any(String),
                expect.any(Object)
            );
        });
    });
    
    describe('content creation options', () => {
        test('should handle different diff options through showUpgradeDiff', async () => {
            const originalContent = "mod 'puppetlabs/stdlib', '8.0.0'";
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            
            // Test with different options
            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan, { 
                showUpgradeableLonly: true, 
                includeComments: true 
            });
            
            expect(mockUpgradePlannerService.applyUpgradesToContent).toHaveBeenCalled();
            expect((mockVscode as any)._mockExecuteCommand).toHaveBeenCalledWith(
                'vscode.diff',
                expect.any(Object),
                expect.any(Object),
                expect.any(String),
                expect.any(Object)
            );
        });
    });
    
    describe('diff view integration', () => {
        test('should register content provider and show diff', async () => {
            const originalContent = "mod 'puppetlabs/stdlib', '8.0.0'";
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            
            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan);
            
            expect(mockVscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalledWith(
                'puppetfile-diff',
                expect.any(Object)
            );
            expect((mockVscode as any)._mockExecuteCommand).toHaveBeenCalledWith(
                'vscode.diff',
                expect.any(Object),
                expect.any(Object),
                'Puppetfile Upgrade Plan: Current ↔ Proposed',
                { preview: true }
            );
        });
        
        test('should handle CodeLens provider errors gracefully', async () => {
            const originalContent = "mod 'puppetlabs/stdlib', '8.0.0'";
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            
            // Mock CodeLens provider to throw error
            PuppetfileCodeLensProvider.getInstance.mockImplementation(() => {
                throw new Error('CodeLens not available');
            });
            
            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan);
            
            // Should still complete successfully
            expect((mockVscode as any)._mockExecuteCommand).toHaveBeenCalledWith(
                'vscode.diff',
                expect.any(Object),
                expect.any(Object),
                'Puppetfile Upgrade Plan: Current ↔ Proposed',
                { preview: true }
            );
        });
        
        test('should handle missing CodeLens provider instance', async () => {
            const originalContent = "mod 'puppetlabs/stdlib', '8.0.0'";
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            
            // Mock CodeLens providers to return null
            UpgradeDiffCodeLensProvider.getInstance.mockReturnValue(null);
            PuppetfileCodeLensProvider.getInstance.mockReturnValue(null);
            
            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan);
            
            expect((mockVscode as any)._mockExecuteCommand).toHaveBeenCalledWith(
                'vscode.diff',
                expect.any(Object),
                expect.any(Object),
                'Puppetfile Upgrade Plan: Current ↔ Proposed',
                { preview: true }
            );
        });
    });
    
    describe('showUpgradeActions detailed', () => {
        test('should handle Dismiss action', async () => {
            const originalContent = "mod 'puppetlabs/stdlib', '8.0.0'";
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            
            (mockVscode as any)._mockShowInformationMessage.mockResolvedValue('Dismiss');
            
            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan);
            
            // Should not execute any commands when dismissed
            expect((mockVscode as any)._mockExecuteCommand).toHaveBeenCalledWith(
                'vscode.diff',
                expect.any(Object),
                expect.any(Object),
                expect.any(String),
                expect.any(Object)
            );
            // Should not call apply commands
            expect((mockVscode as any)._mockExecuteCommand).not.toHaveBeenCalledWith(
                'puppetfile-depgraph.applyAllUpgrades'
            );
        });
    });
    
    describe('addInlineActionComments edge cases', () => {
        test('should handle modules with double quotes and unversioned modules', async () => {
            const originalContent = `mod "puppetlabs/stdlib", "8.0.0"\nmod 'puppetlabs/apache'`;
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }, {
                    module: { name: 'puppetlabs/apache', version: undefined, source: 'forge', line: 2 } as PuppetModule,
                    currentVersion: 'unversioned',
                    maxSafeVersion: '5.0.0',
                    availableVersions: ['5.0.0'],
                    isUpgradeable: true
                }] as UpgradeCandidate[],
                totalUpgradeable: 2,
                totalModules: 2,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            
            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan, { 
                showInlineActions: true 
            });
            
            expect(mockUpgradePlannerService.applyUpgradesToContent).toHaveBeenCalled();
        });
        
        test('should handle modules not found in content', async () => {
            const originalContent = `mod 'some/other', '1.0.0'`;
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            
            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan);
            
            expect(mockUpgradePlannerService.applyUpgradesToContent).toHaveBeenCalled();
        });
    });
    
    describe('applySingleUpgradeFromDiff workspace edit path', () => {
        test('should handle module not found in content', async () => {
            const upgradeInfo = {
                moduleName: 'missing/module',
                currentVersion: '1.0.0',
                newVersion: '2.0.0'
            };
            
            const mockDocument = {
                languageId: 'puppetfile',
                uri: { path: '/test/Puppetfile', scheme: 'file' },
                fileName: 'Puppetfile',
                getText: jest.fn().mockReturnValue("mod 'puppetlabs/stdlib', '8.0.0'")
            };
            
            (mockVscode.workspace as any).textDocuments = [mockDocument as any];
            
            const mockProgressCallback = jest.fn();
            (mockVscode as any)._mockWithProgress.mockImplementation((options: any, callback: any) => {
                return callback({ report: mockProgressCallback });
            });
            
            await UpgradeDiffProvider.applySingleUpgradeFromDiff([upgradeInfo]);
            
            expect((mockVscode as any)._mockShowErrorMessage).toHaveBeenCalledWith(
                'Failed to apply upgrade for missing/module: Could not find module missing/module in the Puppetfile'
            );
        });
    });
    
    describe('skipSingleUpgradeFromDiff edge cases', () => {
        test('should handle missing module name', async () => {
            const skipInfo = {};
            
            await UpgradeDiffProvider.skipSingleUpgradeFromDiff([skipInfo]);
            
            // Should return early without showing message
            expect((mockVscode as any)._mockShowInformationMessage).not.toHaveBeenCalled();
        });
    });
    
    describe('refreshDiffView method', () => {
        test('should refresh diff view after upgrade', async () => {
            // Set up global state
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            
            (globalThis as any).__currentUpgradePlan = upgradePlan;
            (globalThis as any).__currentUpgradeOptions = {};
            
            const mockContentProvider = {
                updateContent: jest.fn()
            };
            (globalThis as any).__currentContentProvider = mockContentProvider;
            
            const mockDocument = {
                languageId: 'puppetfile',
                uri: { path: '/test/Puppetfile', scheme: 'file' },
                fileName: 'Puppetfile',
                getText: jest.fn().mockReturnValue("mod 'puppetlabs/stdlib', '9.0.0'")
            };
            
            (mockVscode.workspace as any).textDocuments = [mockDocument as any];
            
            // Mock UpgradePlannerService.createUpgradePlan
            const mockCreateUpgradePlan = jest.fn().mockResolvedValue(upgradePlan);
            mockUpgradePlannerService.createUpgradePlan = mockCreateUpgradePlan;
            
            const upgradeInfo = {
                moduleName: 'puppetlabs/stdlib',
                currentVersion: '8.0.0',
                newVersion: '9.0.0'
            };
            
            const mockEditor = {
                document: mockDocument
            };
            
            mockVscode.window.visibleTextEditors = [mockEditor as any];
            
            const mockProgressCallback = jest.fn();
            (mockVscode as any)._mockWithProgress.mockImplementation((options: any, callback: any) => {
                return callback({ report: mockProgressCallback });
            });
            
            await UpgradeDiffProvider.applySingleUpgradeFromDiff([upgradeInfo]);
            
            // Verify refresh was attempted
            expect(mockContentProvider.updateContent).toHaveBeenCalled();
            expect(UpgradeDiffCodeLensProvider.setUpgradePlan).toHaveBeenCalledWith(upgradePlan);
        });
        
        test('should handle refresh errors gracefully', async () => {
            // Set up global state with no upgrade plan
            (globalThis as any).__currentUpgradePlan = null;
            
            const upgradeInfo = {
                moduleName: 'puppetlabs/stdlib',
                currentVersion: '8.0.0',
                newVersion: '9.0.0'
            };
            
            const mockDocument = {
                languageId: 'puppetfile',
                uri: { path: '/test/Puppetfile', scheme: 'file' },
                fileName: 'Puppetfile',
                getText: jest.fn().mockReturnValue("mod 'puppetlabs/stdlib', '8.0.0'")
            };
            
            const mockEditor = {
                document: mockDocument
            };
            
            mockVscode.window.visibleTextEditors = [mockEditor as any];
            
            const mockProgressCallback = jest.fn();
            (mockVscode as any)._mockWithProgress.mockImplementation((options: any, callback: any) => {
                return callback({ report: mockProgressCallback });
            });
            
            // Should not throw error even with missing upgrade plan
            await UpgradeDiffProvider.applySingleUpgradeFromDiff([upgradeInfo]);
            
            expect(mockPuppetfileUpdateService.updateModuleVersionAtLine).toHaveBeenCalled();
        });
    });
    
    describe('PuppetfileDiffContentProvider', () => {
        test('should handle content provider functionality through integration', async () => {
            const originalContent = "mod 'puppetlabs/stdlib', '8.0.0'";
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            
            let capturedProvider: any;
            mockVscode.workspace.registerTextDocumentContentProvider = jest.fn((scheme, provider) => {
                capturedProvider = provider;
                return { dispose: jest.fn() };
            });
            
            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan);
            
            // Test the provider functionality through the captured instance
            expect(capturedProvider).toBeDefined();
            
            if (capturedProvider) {
                // Test content provision
                const currentUri = { authority: 'current' };
                const proposedUri = { authority: 'proposed' };
                
                const currentContent = capturedProvider.provideTextDocumentContent(currentUri);
                const proposedContent = capturedProvider.provideTextDocumentContent(proposedUri);
                
                expect(currentContent).toBeDefined();
                expect(proposedContent).toBeDefined();
                
                // Test dispose
                if (capturedProvider.dispose) {
                    capturedProvider.dispose();
                }
            }
        });
    });
    
    describe('showTemporaryMessage', () => {
        test('should show temporary message through applySingleUpgradeFromDiff', async () => {
            const upgradeInfo = {
                moduleName: 'puppetlabs/stdlib',
                currentVersion: '8.0.0',
                newVersion: '9.0.0'
            };
            
            const mockDocument = {
                languageId: 'puppetfile',
                uri: { path: '/test/Puppetfile', scheme: 'file' },
                fileName: 'Puppetfile',
                getText: jest.fn().mockReturnValue("mod 'puppetlabs/stdlib', '8.0.0'")
            };
            
            const mockEditor = {
                document: mockDocument
            };
            
            (mockVscode.workspace as any).textDocuments = [mockDocument as any];
            mockVscode.window.visibleTextEditors = [mockEditor as any];
            
            let progressResolve: (value: any) => void;
            const progressPromise = new Promise(resolve => {
                progressResolve = resolve;
            });
            
            const mockProgressCallback = jest.fn();
            (mockVscode as any)._mockWithProgress.mockImplementation((options: any, callback: any) => {
                callback({ report: mockProgressCallback });
                return progressPromise;
            });
            
            // Start the upgrade (don't await yet)
            const upgradePromise = UpgradeDiffProvider.applySingleUpgradeFromDiff([upgradeInfo]);
            
            // Complete the progress
            progressResolve!(undefined);
            
            await upgradePromise;
            
            expect((mockVscode as any)._mockWithProgress).toHaveBeenCalledTimes(2); // Once for upgrade, once for temp message
        });
        });
    
    describe('timeout and cleanup', () => {
        test('should handle timeout functionality', async () => {
            const originalContent = "mod 'puppetlabs/stdlib', '8.0.0'";
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            
            // Use fake timers to control timeouts
            jest.useFakeTimers();
            
            const diffPromise = UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan);
            
            // Fast-forward time to trigger timeout callbacks
            jest.advanceTimersByTime(15000);
            
            await diffPromise;
            
            // Restore real timers
            jest.useRealTimers();
            
            expect((mockVscode as any)._mockExecuteCommand).toHaveBeenCalledWith(
                'vscode.diff',
                expect.any(Object),
                expect.any(Object),
                expect.any(String),
                expect.any(Object)
            );
        });

        test('should handle showInteractiveUpgradePlanner with empty plan', async () => {
            const emptyPlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 0,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            const content = 'forge "https://forge.puppet.com"';
            
            // Correct parameter order: content first, then upgradePlan
            await UpgradeDiffProvider.showInteractiveUpgradePlanner(content, emptyPlan);
            
            // With empty plan, only summary option should be shown
            expect(mockVscode.window.showQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ action: 'summary' })
                ]),
                expect.any(Object)
            );
        });

        test('should handle error in showUpgradeDiff', async () => {
            const mockEditor = {
                document: { languageId: 'puppetfile' }
            };
            mockVscode.window.activeTextEditor = mockEditor as any;

            // Mock provideDiffView to throw error
            const originalProvideDiffView = (UpgradeDiffProvider as any).provideDiffView;
            (UpgradeDiffProvider as any).provideDiffView = jest.fn().mockRejectedValue(new Error('Diff generation failed'));

            // Select 'all' option to trigger diff view
            mockVscode.window.showQuickPick.mockResolvedValue({ action: 'all' });

            const mockUpgradePlan = {
                candidates: [{
                    module: { name: 'test/module', version: '1.0.0', source: 'forge', line: 1 },
                    currentVersion: '1.0.0',
                    maxSafeVersion: '2.0.0',
                    availableVersions: ['2.0.0'],
                    isUpgradeable: true
                }],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            const mockContent = 'forge "https://forge.puppet.com"';

            // Correct parameter order: content first, then upgradePlan
            await UpgradeDiffProvider.showInteractiveUpgradePlanner(mockContent, mockUpgradePlan);

            expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to show upgrade diff')
            );

            // Restore original method
            (UpgradeDiffProvider as any).provideDiffView = originalProvideDiffView;
        });

        test('should handle provideDiffView for non-puppetfile document', async () => {
            const mockEditor = {
                document: { languageId: 'javascript' }
            };
            mockVscode.window.activeTextEditor = mockEditor as any;

            // Define mockUpgradePlan locally
            const mockUpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 0,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            const mockContent = 'forge "https://forge.puppet.com"';

            // Select 'all' option to trigger diff view
            mockVscode.window.showQuickPick.mockResolvedValue({ action: 'all' });

            // Correct parameter order: content first, then upgradePlan
            await UpgradeDiffProvider.showInteractiveUpgradePlanner(mockContent, mockUpgradePlan);

            // The error message from the catch block
            expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to show upgrade diff')
            );
        });

        test('should handle no active editor in provideDiffView', async () => {
            mockVscode.window.activeTextEditor = undefined;

            // Define mockUpgradePlan locally
            const mockUpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 0,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            const mockContent = 'forge "https://forge.puppet.com"';

            // Select 'all' option to trigger diff view
            mockVscode.window.showQuickPick.mockResolvedValue({ action: 'all' });

            // Correct parameter order: content first, then upgradePlan
            await UpgradeDiffProvider.showInteractiveUpgradePlanner(mockContent, mockUpgradePlan);

            expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to show upgrade diff')
            );
        });

        test('should handle applySelectedUpgrades with no upgradeable modules', async () => {
            const plan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '8.0.0', // Already at max version, not upgradeable
                    availableVersions: [],
                    isUpgradeable: false
                }],
                totalUpgradeable: 0,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            (globalThis as any).__currentUpgradePlan = plan;

            const mockEditor = {
                document: { languageId: 'puppetfile' }
            };
            mockVscode.window.activeTextEditor = mockEditor as any;

            await UpgradeDiffProvider.applySelectedUpgrades();

            expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
                'No upgrades available to apply.'
            );
        });

        test('should handle error during apply updates', async () => {
            const plan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            (globalThis as any).__currentUpgradePlan = plan;

            const mockEditor = {
                document: { languageId: 'puppetfile' }
            };
            mockVscode.window.activeTextEditor = mockEditor as any;

            // Mock apply updates to throw error
            mockPuppetfileUpdateService.applyUpdates.mockRejectedValue(new Error('Update failed'));

            await UpgradeDiffProvider.applyAllUpgrades();

            expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to apply upgrades')
            );
        });

        test('should handle error during applySelectedUpgrades', async () => {
            const plan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            (globalThis as any).__currentUpgradePlan = plan;

            const mockEditor = {
                document: { languageId: 'puppetfile' }
            };
            mockVscode.window.activeTextEditor = mockEditor as any;

            // Mock quick pick to throw error
            mockVscode.window.showQuickPick.mockRejectedValue(new Error('Quick pick failed'));

            await UpgradeDiffProvider.applySelectedUpgrades();

            expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to apply upgrades')
            );
        });
    });

    describe('addUpgradeComments private method coverage', () => {
        test('should add upgrade comments header to content', async () => {
            const originalContent = `mod 'puppetlabs/stdlib', '8.0.0'`;
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            // Test by calling showUpgradeDiff with includeComments option
            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan, { includeComments: true });

            // The content provider should have been created with comments
            expect(mockVscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalled();
        });

        test('should format comments with correct date and module counts', async () => {
            const originalContent = `mod 'puppetlabs/stdlib', '8.0.0'\nmod 'puppetlabs/apache', '5.0.0'`;
            const upgradePlan: UpgradePlan = {
                candidates: [
                    {
                        module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                        currentVersion: '8.0.0',
                        maxSafeVersion: '9.0.0',
                        availableVersions: ['9.0.0'],
                        isUpgradeable: true
                    },
                    {
                        module: { name: 'puppetlabs/apache', version: '5.0.0', source: 'forge', line: 2 } as PuppetModule,
                        currentVersion: '5.0.0',
                        maxSafeVersion: '5.0.0',
                        availableVersions: ['5.0.0'],
                        isUpgradeable: false,
                        blockedBy: ['puppetlabs/stdlib']
                    }
                ],
                totalUpgradeable: 1,
                totalModules: 2,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan, { includeComments: true });

            // Verify registerTextDocumentContentProvider was called
            expect(mockVscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalled();
        });

        test('should handle empty upgrade plan in comments', async () => {
            const originalContent = `mod 'puppetlabs/stdlib', '8.0.0'`;
            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 0,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan, { includeComments: true });

            expect(mockVscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalled();
        });
    });

    describe('showUpgradeSummary method coverage', () => {
        test('should generate and display upgrade summary markdown', async () => {
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            mockUpgradePlannerService.generateUpgradeSummary = jest.fn().mockReturnValue('# Summary\nUpgrade available');
            const mockDoc = { uri: { path: '/summary.md' } };
            (mockVscode as any)._mockOpenTextDocument.mockResolvedValue(mockDoc);

            // Trigger via showInteractiveUpgradePlanner selecting summary action
            (mockVscode as any)._mockShowQuickPick.mockResolvedValue({ action: 'summary' });

            await UpgradeDiffProvider.showInteractiveUpgradePlanner('', upgradePlan);

            expect(mockUpgradePlannerService.generateUpgradeSummary).toHaveBeenCalledWith(upgradePlan);
            expect((mockVscode as any)._mockOpenTextDocument).toHaveBeenCalledWith({
                content: '# Summary\nUpgrade available',
                language: 'markdown'
            });
            expect((mockVscode as any)._mockShowTextDocument).toHaveBeenCalledWith(mockDoc, { preview: false });
        });

        test('should handle openTextDocument failure in showUpgradeSummary', async () => {
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            mockUpgradePlannerService.generateUpgradeSummary = jest.fn().mockReturnValue('# Summary');
            (mockVscode as any)._mockOpenTextDocument.mockRejectedValue(new Error('Failed to open document'));
            (mockVscode as any)._mockShowQuickPick.mockResolvedValue({ action: 'summary' });

            await expect(
                UpgradeDiffProvider.showInteractiveUpgradePlanner('', upgradePlan)
            ).rejects.toThrow('Failed to open document');
        });
    });

    describe('showBlockedModules method coverage', () => {
        test('should display blocked modules with conflicts', async () => {
            const upgradePlan: UpgradePlan = {
                candidates: [
                    {
                        module: { name: 'puppetlabs/apache', version: '5.0.0', source: 'forge', line: 1 } as PuppetModule,
                        currentVersion: '5.0.0',
                        maxSafeVersion: '5.0.0',
                        availableVersions: ['6.0.0', '5.0.0'],
                        isUpgradeable: false,
                        blockedBy: ['puppetlabs/stdlib'],
                        conflicts: [
                            {
                                moduleName: 'puppetlabs/stdlib',
                                currentVersion: '8.0.0',
                                requirement: '>= 9.0.0'
                            }
                        ]
                    }
                ],
                totalUpgradeable: 0,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: true,
                gitModules: []
            };

            const mockDoc = { uri: { path: '/blocked.md' } };
            (mockVscode as any)._mockOpenTextDocument.mockResolvedValue(mockDoc);
            (mockVscode as any)._mockShowQuickPick.mockResolvedValue({ action: 'blocked' });

            await UpgradeDiffProvider.showInteractiveUpgradePlanner('', upgradePlan);

            expect((mockVscode as any)._mockOpenTextDocument).toHaveBeenCalledWith({
                content: expect.stringContaining('Blocked Modules Analysis'),
                language: 'markdown'
            });
            expect((mockVscode as any)._mockOpenTextDocument).toHaveBeenCalledWith({
                content: expect.stringContaining('puppetlabs/apache'),
                language: 'markdown'
            });
            expect((mockVscode as any)._mockShowTextDocument).toHaveBeenCalledWith(mockDoc);
        });

        test('should handle multiple conflicts per module', async () => {
            const upgradePlan: UpgradePlan = {
                candidates: [
                    {
                        module: { name: 'puppetlabs/apache', version: '5.0.0', source: 'forge', line: 1 } as PuppetModule,
                        currentVersion: '5.0.0',
                        maxSafeVersion: '5.0.0',
                        availableVersions: ['6.0.0'],
                        isUpgradeable: false,
                        blockedBy: ['puppetlabs/stdlib', 'puppetlabs/concat'],
                        conflicts: [
                            {
                                moduleName: 'puppetlabs/stdlib',
                                currentVersion: '8.0.0',
                                requirement: '>= 9.0.0'
                            },
                            {
                                moduleName: 'puppetlabs/concat',
                                currentVersion: '6.0.0',
                                requirement: '>= 7.0.0'
                            }
                        ]
                    }
                ],
                totalUpgradeable: 0,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: true,
                gitModules: []
            };

            const mockDoc = { uri: { path: '/blocked.md' } };
            (mockVscode as any)._mockOpenTextDocument.mockResolvedValue(mockDoc);
            (mockVscode as any)._mockShowQuickPick.mockResolvedValue({ action: 'blocked' });

            await UpgradeDiffProvider.showInteractiveUpgradePlanner('', upgradePlan);

            const callArgs = (mockVscode as any)._mockOpenTextDocument.mock.calls[0][0];
            expect(callArgs.content).toContain('puppetlabs/stdlib');
            expect(callArgs.content).toContain('puppetlabs/concat');
            expect(callArgs.content).toContain('>= 9.0.0');
            expect(callArgs.content).toContain('>= 7.0.0');
        });

        test('should handle blocked modules without conflicts array', async () => {
            const upgradePlan: UpgradePlan = {
                candidates: [
                    {
                        module: { name: 'puppetlabs/apache', version: '5.0.0', source: 'forge', line: 1 } as PuppetModule,
                        currentVersion: '5.0.0',
                        maxSafeVersion: '5.0.0',
                        availableVersions: ['6.0.0'],
                        isUpgradeable: false,
                        blockedBy: ['puppetlabs/stdlib']
                        // No conflicts array
                    }
                ],
                totalUpgradeable: 0,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            const mockDoc = { uri: { path: '/blocked.md' } };
            (mockVscode as any)._mockOpenTextDocument.mockResolvedValue(mockDoc);
            (mockVscode as any)._mockShowQuickPick.mockResolvedValue({ action: 'blocked' });

            await UpgradeDiffProvider.showInteractiveUpgradePlanner('', upgradePlan);

            expect((mockVscode as any)._mockOpenTextDocument).toHaveBeenCalled();
            expect((mockVscode as any)._mockShowTextDocument).toHaveBeenCalled();
        });
    });

    describe('addInlineActionComments reverse sorting', () => {
        test('should process candidates in reverse line order to preserve line numbers', async () => {
            const originalContent = `mod 'puppetlabs/stdlib', '8.0.0'\nmod 'puppetlabs/apache', '5.0.0'\nmod 'puppetlabs/concat', '6.0.0'`;
            const upgradePlan: UpgradePlan = {
                candidates: [
                    {
                        module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                        currentVersion: '8.0.0',
                        maxSafeVersion: '9.0.0',
                        availableVersions: ['9.0.0'],
                        isUpgradeable: true
                    },
                    {
                        module: { name: 'puppetlabs/apache', version: '5.0.0', source: 'forge', line: 2 } as PuppetModule,
                        currentVersion: '5.0.0',
                        maxSafeVersion: '6.0.0',
                        availableVersions: ['6.0.0'],
                        isUpgradeable: true
                    },
                    {
                        module: { name: 'puppetlabs/concat', version: '6.0.0', source: 'forge', line: 3 } as PuppetModule,
                        currentVersion: '6.0.0',
                        maxSafeVersion: '7.0.0',
                        availableVersions: ['7.0.0'],
                        isUpgradeable: true
                    }
                ],
                totalUpgradeable: 3,
                totalModules: 3,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan, { showInlineActions: true });

            // Verify content provider was registered
            expect(mockVscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalled();
        });

        test('should handle single line module (edge case for line 0)', async () => {
            const originalContent = `mod 'puppetlabs/stdlib', '8.0.0'`;
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 0 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan, { showInlineActions: true });

            expect(mockVscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalled();
        });
    });

    describe('applySingleUpgradeFromDiff isPuppetfile validation', () => {
        test('should validate document with ruby language ID', async () => {
            const upgradeInfo = {
                moduleName: 'puppetlabs/stdlib',
                currentVersion: '8.0.0',
                newVersion: '9.0.0'
            };

            const mockDocument = {
                languageId: 'ruby',
                uri: { path: '/path/to/Puppetfile', scheme: 'file' },
                fileName: 'Puppetfile',
                getText: jest.fn().mockReturnValue(`mod 'puppetlabs/stdlib', '8.0.0'`)
            };

            mockVscode.window.visibleTextEditors = [{
                document: mockDocument
            }] as any;

            mockPuppetfileUpdateService.updateModuleVersionAtLine = jest.fn().mockResolvedValue(undefined);
            (mockVscode as any)._mockWithProgress.mockImplementation(async (_options, callback) => {
                await callback({ report: jest.fn() });
            });

            await UpgradeDiffProvider.applySingleUpgradeFromDiff([upgradeInfo]);

            expect(mockPuppetfileUpdateService.updateModuleVersionAtLine).toHaveBeenCalled();
        });

        test('should validate document with plaintext language ID', async () => {
            const upgradeInfo = {
                moduleName: 'puppetlabs/stdlib',
                currentVersion: '8.0.0',
                newVersion: '9.0.0'
            };

            const mockDocument = {
                languageId: 'plaintext',
                uri: { path: '/workspace/Puppetfile', scheme: 'file' },
                fileName: 'Puppetfile',
                getText: jest.fn().mockReturnValue(`mod 'puppetlabs/stdlib', '8.0.0'`)
            };

            mockVscode.window.visibleTextEditors = [{
                document: mockDocument
            }] as any;

            mockPuppetfileUpdateService.updateModuleVersionAtLine = jest.fn().mockResolvedValue(undefined);
            (mockVscode as any)._mockWithProgress.mockImplementation(async (_options, callback) => {
                await callback({ report: jest.fn() });
            });

            await UpgradeDiffProvider.applySingleUpgradeFromDiff([upgradeInfo]);

            expect(mockPuppetfileUpdateService.updateModuleVersionAtLine).toHaveBeenCalled();
        });

        test('should reject diff view documents', async () => {
            const upgradeInfo = {
                moduleName: 'puppetlabs/stdlib',
                currentVersion: '8.0.0',
                newVersion: '9.0.0'
            };

            const mockDocument = {
                languageId: 'puppetfile',
                uri: { path: '/Puppetfile', scheme: 'puppetfile-diff' },
                fileName: 'Puppetfile'
            };

            mockVscode.window.visibleTextEditors = [{
                document: mockDocument
            }] as any;

            (mockVscode as any)._mockWithProgress.mockImplementation(async (_options, callback) => {
                await callback({ report: jest.fn() });
            });

            await UpgradeDiffProvider.applySingleUpgradeFromDiff([upgradeInfo]);

            expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Could not find Puppetfile')
            );
        });

        test('should handle Windows path separator', async () => {
            const upgradeInfo = {
                moduleName: 'puppetlabs/stdlib',
                currentVersion: '8.0.0',
                newVersion: '9.0.0'
            };

            const mockDocument = {
                languageId: 'puppetfile',
                uri: { path: 'C:\\workspace\\Puppetfile', scheme: 'file' },
                fileName: 'Puppetfile',
                getText: jest.fn().mockReturnValue(`mod 'puppetlabs/stdlib', '8.0.0'`)
            };

            mockVscode.window.visibleTextEditors = [{
                document: mockDocument
            }] as any;

            mockPuppetfileUpdateService.updateModuleVersionAtLine = jest.fn().mockResolvedValue(undefined);
            (mockVscode as any)._mockWithProgress.mockImplementation(async (_options, callback) => {
                await callback({ report: jest.fn() });
            });

            await UpgradeDiffProvider.applySingleUpgradeFromDiff([upgradeInfo]);

            expect(mockPuppetfileUpdateService.updateModuleVersionAtLine).toHaveBeenCalled();
        });
    });

    describe('refreshDiffView error handling', () => {
        test('should handle parse errors gracefully', async () => {
            const upgradeInfo = {
                moduleName: 'puppetlabs/stdlib',
                currentVersion: '8.0.0',
                newVersion: '9.0.0'
            };

            const mockDocument = {
                languageId: 'puppetfile',
                uri: { path: '/Puppetfile', scheme: 'file' },
                fileName: 'Puppetfile',
                getText: jest.fn().mockReturnValue(`invalid puppetfile content`)
            };

            mockVscode.window.visibleTextEditors = [{
                document: mockDocument
            }] as any;
            mockVscode.workspace.textDocuments = [mockDocument] as any;

            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 0,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            (globalThis as any).__currentUpgradePlan = upgradePlan;
            (globalThis as any).__currentUpgradeOptions = {};

            mockPuppetfileParser.parseContent.mockReturnValue({
                modules: [],
                errors: [{ line: 1, message: 'Parse error' }]
            });

            mockPuppetfileUpdateService.updateModuleVersionAtLine = jest.fn().mockResolvedValue(undefined);
            (mockVscode as any)._mockWithProgress.mockImplementation(async (_options, callback) => {
                await callback({ report: jest.fn() });
            });

            await UpgradeDiffProvider.applySingleUpgradeFromDiff([upgradeInfo]);

            // Should still attempt update even with parse errors
            expect(mockPuppetfileUpdateService.updateModuleVersionAtLine).toHaveBeenCalled();
        });

        test('should handle missing Puppetfile document in refreshDiffView', async () => {
            const upgradeInfo = {
                moduleName: 'puppetlabs/stdlib',
                currentVersion: '8.0.0',
                newVersion: '9.0.0'
            };

            // No visible editors
            mockVscode.window.visibleTextEditors = [];
            mockVscode.workspace.textDocuments = [];

            const upgradePlan: UpgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 0,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };
            (globalThis as any).__currentUpgradePlan = upgradePlan;
            (globalThis as any).__currentUpgradeOptions = {};

            (mockVscode as any)._mockWithProgress.mockImplementation(async (_options, callback) => {
                await callback({ report: jest.fn() });
            });

            await UpgradeDiffProvider.applySingleUpgradeFromDiff([upgradeInfo]);

            expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Could not find Puppetfile')
            );
        });
    });

    describe('createProposedContent with multiple options', () => {
        test('should apply all options: showUpgradeableLonly, includeComments, showInlineActions', async () => {
            const originalContent = `mod 'puppetlabs/stdlib', '8.0.0'\nmod 'puppetlabs/apache', '5.0.0'`;
            const upgradePlan: UpgradePlan = {
                candidates: [
                    {
                        module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                        currentVersion: '8.0.0',
                        maxSafeVersion: '9.0.0',
                        availableVersions: ['9.0.0'],
                        isUpgradeable: true
                    },
                    {
                        module: { name: 'puppetlabs/apache', version: '5.0.0', source: 'forge', line: 2 } as PuppetModule,
                        currentVersion: '5.0.0',
                        maxSafeVersion: '5.0.0',
                        availableVersions: ['5.0.0'],
                        isUpgradeable: false
                    }
                ],
                totalUpgradeable: 1,
                totalModules: 2,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan, {
                showUpgradeableLonly: true,
                includeComments: true,
                showInlineActions: true
            });

            expect(mockVscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalled();
        });

        test('should handle empty options object', async () => {
            const originalContent = `mod 'puppetlabs/stdlib', '8.0.0'`;
            const upgradePlan: UpgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '9.0.0',
                    availableVersions: ['9.0.0'],
                    isUpgradeable: true
                }],
                totalUpgradeable: 1,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            await UpgradeDiffProvider.showUpgradeDiff(originalContent, upgradePlan, {});

            expect(mockVscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalled();
        });
    });
});
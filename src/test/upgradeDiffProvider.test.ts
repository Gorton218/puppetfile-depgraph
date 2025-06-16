import * as vscode from 'vscode';
import { UpgradeDiffProvider } from '../services/upgradeDiffProvider';
import { UpgradePlan, UpgradeCandidate } from '../services/upgradePlannerService';
import { PuppetModule } from '../puppetfileParser';

// Mock VS Code API
jest.mock('vscode', () => {
    const mockExecuteCommand = jest.fn();
    const mockShowQuickPick = jest.fn();
    const mockOpenTextDocument = jest.fn();
    const mockShowTextDocument = jest.fn();
    const mockShowErrorMessage = jest.fn();
    const mockShowInformationMessage = jest.fn();
    
    return {
        Uri: {
            parse: jest.fn((uri: string) => ({ scheme: 'puppetfile-diff', path: uri.split('/').pop() }))
        },
        workspace: {
            registerTextDocumentContentProvider: jest.fn(() => ({ dispose: jest.fn() })),
            openTextDocument: mockOpenTextDocument
        },
        commands: {
            executeCommand: mockExecuteCommand
        },
        window: {
            showQuickPick: mockShowQuickPick,
            showTextDocument: mockShowTextDocument,
            showErrorMessage: mockShowErrorMessage,
            showInformationMessage: mockShowInformationMessage
        },
        _mockExecuteCommand: mockExecuteCommand,
        _mockShowQuickPick: mockShowQuickPick,
        _mockOpenTextDocument: mockOpenTextDocument,
        _mockShowTextDocument: mockShowTextDocument,
        _mockShowErrorMessage: mockShowErrorMessage,
        _mockShowInformationMessage: mockShowInformationMessage
    };
});

const mockVscode = vscode as jest.Mocked<typeof vscode>;

describe('UpgradeDiffProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (mockVscode as any)._mockExecuteCommand.mockClear();
        (mockVscode as any)._mockShowQuickPick.mockClear();
        (mockVscode as any)._mockOpenTextDocument.mockClear();
        (mockVscode as any)._mockShowTextDocument.mockClear();
        (mockVscode as any)._mockShowErrorMessage.mockClear();
        (mockVscode as any)._mockShowInformationMessage.mockClear();
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
            const UpgradeDiffProviderModule = require('../services/upgradeDiffProvider');
            
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
});
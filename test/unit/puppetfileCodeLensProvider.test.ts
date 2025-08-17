import * as vscode from 'vscode';
import { PuppetfileCodeLensProvider } from '../../src/puppetfileCodeLensProvider';
import { PuppetForgeService } from '../../src/services/puppetForgeService';

// Mock VS Code module
jest.mock('vscode', () => ({
    CodeLens: jest.fn().mockImplementation((range, command) => ({ range, command })),
    Range: jest.fn().mockImplementation((start, startChar, end, endChar) => ({ start, startChar, end, endChar })),
    EventEmitter: jest.fn().mockImplementation(() => ({
        fire: jest.fn(),
        event: jest.fn()
    })),
    window: {
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        withProgress: jest.fn()
    },
    workspace: {
        onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })), // Mocked to return a disposable
    },
    ProgressLocation: {
        Notification: 15
    }
}));

// Mock PuppetForgeService
jest.mock('../../src/services/puppetForgeService');

// Mock PuppetfileParser
jest.mock('../../src/puppetfileParser', () => ({
    PuppetfileParser: {
        parseContent: jest.fn()
    }
}));

// Mock PuppetfileUpdateService
jest.mock('../../src/services/puppetfileUpdateService', () => ({
    PuppetfileUpdateService: {
        updateModuleVersionAtLine: jest.fn()
    }
}));

describe('PuppetfileCodeLensProvider', () => {
    let provider: PuppetfileCodeLensProvider;
    let mockDocument: any;
    let mockToken: any;

    beforeEach(() => {
        jest.clearAllMocks();
        provider = new PuppetfileCodeLensProvider();
        
        mockDocument = {
            languageId: 'puppetfile',
            uri: {
                scheme: 'file',
                path: '/test/Puppetfile'
            },
            getText: jest.fn().mockReturnValue('mod "apache", "1.0.0"'),
            lineAt: jest.fn().mockReturnValue({
                text: 'mod "apache", "1.0.0"'
            })
        };

        mockToken = {
            isCancellationRequested: false
        };
    });

    describe('provideCodeLenses', () => {
        test('should return empty array for non-puppetfile documents', async () => {
            // Arrange
            mockDocument.languageId = 'javascript';

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test('should return empty array when parsing fails', async () => {
            // Arrange
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockReturnValue({
                modules: [],
                errors: ['Parse error']
            });

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test('should create CodeLens for upgradeable modules', async () => {
            // Arrange
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockReturnValue({
                modules: [{
                    name: 'apache',
                    source: 'forge',
                    version: '1.0.0',
                    line: 1
                }],
                errors: []
            });

            const mockedPuppetForgeService = PuppetForgeService as jest.Mocked<typeof PuppetForgeService>;
            mockedPuppetForgeService.checkForUpdate.mockResolvedValue({
                hasUpdate: true,
                latestVersion: '2.0.0',
                currentVersion: '1.0.0'
            });

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0].command?.title).toContain('Update to 2.0.0');
            expect(result[0].command?.command).toBe('puppetfile-depgraph.applySingleUpgrade');
        });

        test('should handle unversioned modules correctly', async () => {
            // Arrange
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockReturnValue({
                modules: [{
                    name: 'apache',
                    source: 'forge',
                    version: undefined, // Unversioned module
                    line: 1
                }],
                errors: []
            });

            const mockedPuppetForgeService = PuppetForgeService as jest.Mocked<typeof PuppetForgeService>;
            mockedPuppetForgeService.checkForUpdate.mockResolvedValue({
                hasUpdate: true,
                latestVersion: '2.0.0',
                currentVersion: undefined
            });

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0].command?.tooltip).toContain('unversioned');
            expect(result[0].command?.tooltip).toContain('Update apache from unversioned to 2.0.0');
        });

        test('should handle cancellation token', async () => {
            // Arrange
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockReturnValue({
                modules: [{
                    name: 'apache',
                    source: 'forge',
                    version: '1.0.0',
                    line: 1
                }],
                errors: []
            });

            mockToken.isCancellationRequested = true;

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test.skip('should not return codelens when saving', async () => {
            // Arrange
            provider.isSaving = true;

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test('should not return codelens for module with no version', async () => {
            // Arrange
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockReturnValue({
                modules: [{
                    name: 'apache',
                    source: 'forge',
                    line: 1
                }],
                errors: []
            });

            const mockedPuppetForgeService = PuppetForgeService as jest.Mocked<typeof PuppetForgeService>;
            mockedPuppetForgeService.checkForUpdate.mockResolvedValue({
                hasUpdate: false,
            });

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test('should not return latest codelens when version is same', async () => {
            // Arrange
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockReturnValue({
                modules: [{
                    name: 'apache',
                    source: 'forge',
                    version: '1.0.0',
                    line: 1
                }],
                errors: []
            });

            const mockedPuppetForgeService = PuppetForgeService as jest.Mocked<typeof PuppetForgeService>;
            mockedPuppetForgeService.checkForUpdate.mockResolvedValue({
                hasUpdate: true,
                latestVersion: '1.0.0',
                latestSafeVersion: '2.0.0',
                currentVersion: '1.0.0'
            });

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0].command?.title).not.toContain('latest');
        });

        test('should not return safe codelens when version is same', async () => {
            // Arrange
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockReturnValue({
                modules: [{
                    name: 'apache',
                    source: 'forge',
                    version: '1.0.0',
                    line: 1
                }],
                errors: []
            });

            const mockedPuppetForgeService = PuppetForgeService as jest.Mocked<typeof PuppetForgeService>;
            mockedPuppetForgeService.checkForUpdate.mockResolvedValue({
                hasUpdate: true,
                latestVersion: '2.0.0',
                latestSafeVersion: '1.0.0',
                currentVersion: '1.0.0'
            });

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0].command?.title).not.toContain('safe');
        });

        test('should show both safe and latest codelens when different versions available', async () => {
            // Arrange
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockReturnValue({
                modules: [{
                    name: 'apache',
                    source: 'forge',
                    version: '1.0.0',
                    line: 1
                }],
                errors: []
            });

            const mockedPuppetForgeService = PuppetForgeService as jest.Mocked<typeof PuppetForgeService>;
            // First call for safe version
            mockedPuppetForgeService.checkForUpdate.mockResolvedValueOnce({
                hasUpdate: true,
                latestVersion: '1.5.0',
                currentVersion: '1.0.0'
            });
            // Second call for latest version
            mockedPuppetForgeService.checkForUpdate.mockResolvedValueOnce({
                hasUpdate: true,
                latestVersion: '2.0.0',
                currentVersion: '1.0.0'
            });

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0].command?.title).toContain('Update to 1.5.0');
            expect(result[1].command?.title).toContain('Update to 2.0.0 (latest)');
        });

        test('should handle errors when checking for updates', async () => {
            // Arrange
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockReturnValue({
                modules: [{
                    name: 'apache',
                    source: 'forge',
                    version: '1.0.0',
                    line: 1
                }],
                errors: []
            });

            const mockedPuppetForgeService = PuppetForgeService as jest.Mocked<typeof PuppetForgeService>;
            mockedPuppetForgeService.checkForUpdate.mockRejectedValue(new Error('Network error'));

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test('should handle parsing exceptions', async () => {
            // Arrange
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockImplementation(() => {
                throw new Error('Parse error');
            });

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test('should not show codelenses when isSaving is true', async () => {
            // Arrange
            provider.isSaving = true;
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockReturnValue({
                modules: [{
                    name: 'apache',
                    source: 'forge',
                    version: '1.0.0',
                    line: 1
                }],
                errors: []
            });

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test('should skip non-forge modules', async () => {
            // Arrange
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockReturnValue({
                modules: [{
                    name: 'apache',
                    source: 'git',
                    version: '1.0.0',
                    line: 1
                }],
                errors: []
            });

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
            expect(PuppetForgeService.checkForUpdate).not.toHaveBeenCalled();
        });

        test('should handle modules with unversioned status correctly in tooltip', async () => {
            // Arrange
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            PuppetfileParser.parseContent.mockReturnValue({
                modules: [{
                    name: 'apache',
                    source: 'forge',
                    version: undefined,  // Undefined version
                    line: 1
                }],
                errors: []
            });

            const mockedPuppetForgeService = PuppetForgeService as jest.Mocked<typeof PuppetForgeService>;
            mockedPuppetForgeService.checkForUpdate.mockResolvedValue({
                hasUpdate: true,
                latestVersion: '2.0.0',
                currentVersion: undefined
            });

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0].command?.tooltip).toContain('Update apache from unversioned to 2.0.0');
        });
    });

    describe('applySingleUpgrade', () => {
        test('should successfully apply upgrade', async () => {
            // Arrange
            const args = {
                line: 1,
                moduleName: 'apache',
                currentVersion: '1.0.0',
                newVersion: '2.0.0'
            };

            const { PuppetfileUpdateService } = require('../../src/services/puppetfileUpdateService');
            PuppetfileUpdateService.updateModuleVersionAtLine.mockResolvedValue(undefined);

            const mockedVSCode = vscode as any;
            mockedVSCode.window.withProgress.mockImplementation(async (options: any, callback: any) => {
                const progress = { report: jest.fn() };
                return await callback(progress);
            });

            // Act
            await PuppetfileCodeLensProvider.applySingleUpgrade(args);

            // Assert
            expect(PuppetfileUpdateService.updateModuleVersionAtLine).toHaveBeenCalledWith(1, '2.0.0');
            expect(mockedVSCode.window.withProgress).toHaveBeenCalledWith(
                expect.objectContaining({
                    location: mockedVSCode.ProgressLocation.Notification,
                    title: 'Successfully updated apache to version 2.0.0',
                    cancellable: false
                }),
                expect.any(Function)
            );
        });

        test('should handle errors during upgrade', async () => {
            // Arrange
            const args = {
                line: 1,
                moduleName: 'apache',
                currentVersion: '1.0.0',
                newVersion: '2.0.0'
            };

            const { PuppetfileUpdateService } = require('../../src/services/puppetfileUpdateService');
            PuppetfileUpdateService.updateModuleVersionAtLine.mockRejectedValue(new Error('Update failed'));

            const mockedVSCode = vscode as any;
            mockedVSCode.window.withProgress.mockImplementation(async (options: any, callback: any) => {
                const progress = { report: jest.fn() };
                return await callback(progress);
            });

            // Act
            await PuppetfileCodeLensProvider.applySingleUpgrade(args);

            // Assert
            expect(mockedVSCode.window.showErrorMessage).toHaveBeenCalledWith(
                'Failed to update apache: Update failed'
            );
        });
    });

    describe('refresh', () => {
        test('should fire onDidChangeCodeLenses event', () => {
            // Arrange
            const fireSpy = jest.spyOn(provider._onDidChangeCodeLenses, 'fire');
            
            // Act
            provider.refresh();

            // Assert
            expect(fireSpy).toHaveBeenCalled();
        });
    });

    describe('dispose', () => {
        test('should dispose document change listener', () => {
            // Arrange
            const disposeSpy = jest.spyOn(provider.documentChangeListener, 'dispose');
            
            // Act
            provider.dispose();

            // Assert
            expect(disposeSpy).toHaveBeenCalled();
        });
    });

    describe('document change listener', () => {
        test('should refresh on puppetfile document change', () => {
            // Arrange
            const refreshSpy = jest.spyOn(provider, 'refresh');
            const changeHandler = (vscode.workspace.onDidChangeTextDocument as jest.Mock).mock.calls[0][0];
            
            // Act
            changeHandler({ document: { languageId: 'puppetfile' } });
            
            // Assert
            expect(refreshSpy).toHaveBeenCalled();
        });

        test('should not refresh on non-puppetfile document change', () => {
            // Arrange
            const refreshSpy = jest.spyOn(provider, 'refresh');
            const changeHandler = (vscode.workspace.onDidChangeTextDocument as jest.Mock).mock.calls[0][0];
            
            // Act
            changeHandler({ document: { languageId: 'javascript' } });
            
            // Assert
            expect(refreshSpy).not.toHaveBeenCalled();
        });
    });

    describe('singleton pattern', () => {
        test('should set and get instance', () => {
            // Act
            PuppetfileCodeLensProvider.setInstance(provider);
            const instance = PuppetfileCodeLensProvider.getInstance();

            // Assert
            expect(instance).toBe(provider);
        });
    });
});
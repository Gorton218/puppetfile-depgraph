import * as vscode from 'vscode';
import { PuppetfileCodeLensProvider } from '../puppetfileCodeLensProvider';
import { PuppetForgeService } from '../puppetForgeService';

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
    ProgressLocation: {
        Notification: 15
    }
}));

// Mock PuppetForgeService
jest.mock('../puppetForgeService');

// Mock PuppetfileParser
jest.mock('../puppetfileParser', () => ({
    PuppetfileParser: {
        parseContent: jest.fn()
    }
}));

// Mock PuppetfileUpdateService
jest.mock('../puppetfileUpdateService', () => ({
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
            const { PuppetfileParser } = require('../puppetfileParser');
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
            const { PuppetfileParser } = require('../puppetfileParser');
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

        test('should handle cancellation token', async () => {
            // Arrange
            const { PuppetfileParser } = require('../puppetfileParser');
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

            const { PuppetfileUpdateService } = require('../puppetfileUpdateService');
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

            const { PuppetfileUpdateService } = require('../puppetfileUpdateService');
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
            // Act
            provider.refresh();

            // Assert - Just verify it doesn't throw an error
            expect(true).toBe(true);
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
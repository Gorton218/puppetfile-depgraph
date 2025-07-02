import * as vscode from 'vscode';
import { activate, deactivate } from '../../src/extension';

jest.mock('vscode', () => ({
    workspace: {
        onDidChangeConfiguration: jest.fn(),
        onDidOpenTextDocument: jest.fn(),
        onDidCloseTextDocument: jest.fn(),
        textDocuments: [],
    },
    window: {
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn(),
    },
    commands: {
        registerCommand: jest.fn(),
    },
    languages: {
        registerCodeLensProvider: jest.fn(),
        registerHoverProvider: jest.fn(),
    },
    Disposable: jest.fn(),
    Uri: {
        parse: jest.fn(),
    },
}));

jest.mock('../../src/puppetfileCodeLensProvider', () => {
    const mockInstance = {
        provideCodeLenses: jest.fn(),
        dispose: jest.fn(),
        onDidChangeTextDocument: jest.fn(),
    };
    const MockPuppetfileCodeLensProvider = jest.fn(() => mockInstance);
    MockPuppetfileCodeLensProvider.getInstance = jest.fn(() => mockInstance);
    MockPuppetfileCodeLensProvider.setInstance = jest.fn();
    MockPuppetfileCodeLensProvider.applySingleUpgrade = jest.fn();
    return { PuppetfileCodeLensProvider: MockPuppetfileCodeLensProvider };
});

jest.mock('../../src/services/upgradeDiffCodeLensProvider', () => {
    const mockInstance = {
        provideCodeLenses: jest.fn(),
        dispose: jest.fn(),
        onDidChangeTextDocument: jest.fn(),
    };
    const MockUpgradeDiffCodeLensProvider = jest.fn(() => mockInstance);
    MockUpgradeDiffCodeLensProvider.getInstance = jest.fn(() => mockInstance);
    MockUpgradeDiffCodeLensProvider.setInstance = jest.fn();
    return { UpgradeDiffCodeLensProvider: MockUpgradeDiffCodeLensProvider };
});

describe('Extension Activation', () => {
    test('should activate successfully', () => {
        const mockContext: vscode.ExtensionContext = {
            subscriptions: [],
            workspaceState: {} as any,
            globalState: {} as any,
            extensionUri: {} as any,
            environmentVariableCollection: {} as any,
            extensionMode: {} as any,
            extensionRuntime: {} as any,
            globalStorageUri: {} as any,
            logUri: {} as any,
            storageUri: {} as any,
            secrets: {} as any,
            asAbsolutePath: jest.fn(),
            storagePath: undefined,
            globalStoragePath: undefined,
            logPath: undefined,
            extension: {
                packageJSON: {
                    version: '0.0.0'
                }
            } as any,
        };
        activate(mockContext);
        expect(vscode.commands.registerCommand).toHaveBeenCalled();
        expect(vscode.languages.registerCodeLensProvider).toHaveBeenCalled();
        expect(vscode.languages.registerHoverProvider).toHaveBeenCalled();
    });

    test('should deactivate successfully', () => {
        deactivate();
        // Add assertions for dispose calls if applicable
    });
});

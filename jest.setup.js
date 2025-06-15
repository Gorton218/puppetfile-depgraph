// Mock VS Code API
const vscode = {
  Uri: {
    file: jest.fn((path) => ({ fsPath: path, scheme: 'file' })),
    parse: jest.fn()
  },
  Range: jest.fn(),
  Position: jest.fn(),
  WorkspaceEdit: jest.fn(),
  MarkdownString: jest.fn((value) => ({ value })),
  Hover: jest.fn((contents, range) => ({ contents, range })),
  ProgressLocation: {
    Notification: 15,
    Window: 10,
    SourceControl: 1
  },
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    withProgress: jest.fn(),
    activeTextEditor: null
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn()
    })),
    openTextDocument: jest.fn(),
    applyEdit: jest.fn()
  },
  commands: {
    registerCommand: jest.fn()
  },
  languages: {
    registerHoverProvider: jest.fn()
  },
  ExtensionContext: jest.fn()
};

// Mock the vscode module
jest.mock('vscode', () => vscode, { virtual: true });

module.exports = { vscode };
// Mock VS Code API
const vscode = {
  Uri: {
    file: jest.fn((path) => ({ fsPath: path, scheme: 'file', toString: () => `file:///${path}` })),
    parse: jest.fn(),
  },
  Range: jest.fn(),
  Position: jest.fn(),
  WorkspaceEdit: jest.fn(),
  MarkdownString: jest.fn((value) => {
    const markdown = {
      value: value || '',
      isTrusted: false,
      appendMarkdown: jest.fn((text) => {
        markdown.value += text;
        return markdown;
      })
    };
    return markdown;
  }),
  Hover: jest.fn((contents, range) => ({ 
    contents: Array.isArray(contents) ? contents : [contents], 
    range 
  })),
  ProgressLocation: {
    Notification: 15,
    Window: 10,
    SourceControl: 1
  },
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    withProgress: jest.fn(),
    activeTextEditor: {
      document: {
        fileName: 'Puppetfile',
        languageId: 'puppetfile',
        getText: jest.fn(() => 'mock content')
      }
    }
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn()
    })),
    openTextDocument: jest.fn(),
    applyEdit: jest.fn(),
    onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
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
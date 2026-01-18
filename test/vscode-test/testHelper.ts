import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { MockPuppetForgeService } from './mockPuppetForgeService';

export class TestHelper {
  static async createTestDocument(content: string, language = 'puppetfile'): Promise<vscode.TextDocument> {
    const doc = await vscode.workspace.openTextDocument({
      content,
      language
    });
    return doc;
  }

  static async openTestPuppetfile(fixtureName: string): Promise<vscode.TextDocument> {
    // When compiled, __dirname points to out/test/vscode-test
    // We need to find the actual fixtures directory
    let fixturesDir: string;
    
    // Try multiple approaches to find the fixtures
    const possiblePaths = [
      // If we're in the source directory during development
      path.resolve(__dirname, 'fixtures'),
      // If we're in out/test/vscode-test (compiled)
      path.resolve(__dirname, '../../../test/vscode-test/fixtures'),
      // If the project structure is different
      path.resolve(__dirname, '../../../../puppetfile-depgraph/test/vscode-test/fixtures'),
      // Absolute fallback
      '/mnt/d/CodingProjects/puppetfile-depgraph/test/vscode-test/fixtures'
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        fixturesDir = possiblePath;
        break;
      }
    }
    
    if (!fixturesDir!) {
      throw new Error(`Could not find fixtures directory. Tried: ${possiblePaths.join(', ')}`);
    }
    
    const fixturePath = path.join(fixturesDir, fixtureName);
    const content = fs.readFileSync(fixturePath, 'utf8');
    return this.createTestDocument(content);
  }

  static async showDocument(doc: vscode.TextDocument): Promise<vscode.TextEditor> {
    return vscode.window.showTextDocument(doc);
  }

  static async closeAllEditors(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  }

  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async executeCommand(command: string, ...args: any[]): Promise<any> {
    return vscode.commands.executeCommand(command, ...args);
  }

  static setupMockForgeService(): void {
    MockPuppetForgeService.initialize();
  }

  static resetMockForgeService(): void {
    MockPuppetForgeService.reset();
  }

  static async getDocumentText(doc: vscode.TextDocument): Promise<string> {
    return doc.getText();
  }

  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await this.wait(interval);
    }
    throw new Error('Timeout waiting for condition');
  }

  static async getHoverAtPosition(
    doc: vscode.TextDocument,
    line: number,
    character: number
  ): Promise<vscode.Hover[]> {
    const position = new vscode.Position(line, character);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      doc.uri,
      position
    );
    return hovers || [];
  }

  static async getCodeLenses(doc: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const codeLenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      'vscode.executeCodeLensProvider',
      doc.uri
    );
    return codeLenses || [];
  }

  static async getDiagnostics(doc: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
    return vscode.languages.getDiagnostics(doc.uri);
  }

  static findLineContaining(doc: vscode.TextDocument, text: string): number {
    const lines = doc.getText().split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(text)) {
        return i;
      }
    }
    return -1;
  }

  static async selectText(
    editor: vscode.TextEditor,
    startLine: number,
    startChar: number,
    endLine: number,
    endChar: number
  ): Promise<void> {
    const selection = new vscode.Selection(
      new vscode.Position(startLine, startChar),
      new vscode.Position(endLine, endChar)
    );
    editor.selection = selection;
  }

  static async replaceText(
    editor: vscode.TextEditor,
    range: vscode.Range,
    newText: string
  ): Promise<boolean> {
    return editor.edit(editBuilder => {
      editBuilder.replace(range, newText);
    });
  }
}
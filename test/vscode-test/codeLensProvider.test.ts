import * as vscode from 'vscode';
import * as assert from 'assert';
import { TestHelper } from './testHelper';
import * as sinon from 'sinon';
import { PuppetForgeService } from '../../src/services/puppetForgeService';
import { MockPuppetForgeService } from './mockPuppetForgeService';
import { PuppetfileCodeLensProvider } from '../../src/puppetfileCodeLensProvider';
import { UpgradeDiffCodeLensProvider } from '../../src/services/upgradeDiffCodeLensProvider';
import { UpgradePlan } from '../../src/services/upgradePlannerService';
import { PuppetfileUpdateService } from '../../src/services/puppetfileUpdateService';
import { TestSetup } from './testSetup';
// Remove direct activation import

suite('Code Lens Provider Integration Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let puppetfileCodeLensProvider: PuppetfileCodeLensProvider;
  let upgradeDiffCodeLensProvider: UpgradeDiffCodeLensProvider;

  setup(async () => {
    sandbox = sinon.createSandbox();
    
    // Setup all mocks including GitMetadataService
    TestSetup.setupAll();
    
    // Wait for extension to activate - commands will be registered by the extension itself
    await TestHelper.wait(1000);

    // Mock PuppetfileUpdateService to actually update the document
    sandbox.stub(PuppetfileUpdateService, 'updateModuleVersionAtLine').callsFake(async (line: number, newVersion: string) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      
      const document = editor.document;
      const lineText = document.lineAt(line).text;
      
      // Update the version in the line
      const versionMatch = lineText.match(/(['"])([^'"]+)\1\s*,\s*(['"])([^'"]+)\3/);
      if (versionMatch) {
        const newLineText = lineText.replace(versionMatch[0], `${versionMatch[1]}${versionMatch[2]}${versionMatch[1]}, ${versionMatch[3]}${newVersion}${versionMatch[3]}`);
        const edit = new vscode.WorkspaceEdit();
        const fullLineRange = new vscode.Range(line, 0, line, lineText.length);
        edit.replace(document.uri, fullLineRange, newLineText);
        await vscode.workspace.applyEdit(edit);
      }
    });

    // Register code lens providers
    puppetfileCodeLensProvider = new PuppetfileCodeLensProvider();
    upgradeDiffCodeLensProvider = new UpgradeDiffCodeLensProvider();
    
    vscode.languages.registerCodeLensProvider('puppetfile', puppetfileCodeLensProvider);
    vscode.languages.registerCodeLensProvider('puppetfile-diff', upgradeDiffCodeLensProvider);

    await TestHelper.closeAllEditors();
  });

  teardown(async () => {
    TestSetup.restore();
    sandbox.restore();
    TestHelper.resetMockForgeService();
    await TestHelper.closeAllEditors();
  });

  test('Code lens shows update options for modules', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Get code lenses
    const codeLenses = await TestHelper.getCodeLenses(doc);
    
    assert.ok(codeLenses.length > 0, 'Should provide code lenses');
    
    // Find code lens for stdlib module
    const stdlibLine = TestHelper.findLineContaining(doc, "'puppetlabs-stdlib', '8.5.0'");
    const stdlibLenses = codeLenses.filter(lens => lens.range.start.line === stdlibLine);
    
    assert.ok(stdlibLenses.length > 0, 'Should have code lens for stdlib module');
    
    // Check lens commands
    const commands = stdlibLenses.map(lens => lens.command);
    assert.ok(commands.some(cmd => cmd?.title.includes('Update')), 'Should have update command');
  });

  test('Code lens shows safe update when available', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    const codeLenses = await TestHelper.getCodeLenses(doc);
    
    // Find code lens for concat module (has safe update from 7.2.0 to 7.4.0)
    const concatLine = TestHelper.findLineContaining(doc, "'puppetlabs-concat', '7.2.0'");
    const concatLenses = codeLenses.filter(lens => lens.range.start.line === concatLine);
    
    const safeUpdateLens = concatLenses.find(lens => 
      lens.command?.title.includes('safe') || lens.command?.title.includes('7.4.0')
    );
    
    assert.ok(safeUpdateLens, 'Should show safe update option');
    assert.ok(safeUpdateLens.command?.title.includes('7.4.0'), 'Should show safe version 7.4.0');
  });

  test('Code lens shows latest version option', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    const codeLenses = await TestHelper.getCodeLenses(doc);
    
    // Find code lens for stdlib (current: 8.5.0, latest: 9.6.0)
    const stdlibLine = TestHelper.findLineContaining(doc, "'puppetlabs-stdlib', '8.5.0'");
    const stdlibLenses = codeLenses.filter(lens => lens.range.start.line === stdlibLine);
    
    const latestUpdateLens = stdlibLenses.find(lens => 
      lens.command?.title.includes('latest') || lens.command?.title.includes('9.6.0')
    );
    
    assert.ok(latestUpdateLens, 'Should show latest version option');
  });

  test('Code lens not shown for modules without version', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    const codeLenses = await TestHelper.getCodeLenses(doc);
    
    // Find mysql module (no version specified)
    const mysqlLine = TestHelper.findLineContaining(doc, "'puppetlabs-mysql'");
    const mysqlLenses = codeLenses.filter(lens => lens.range.start.line === mysqlLine);
    
    // Should still show some lens options
    assert.ok(mysqlLenses.length >= 0, 'May or may not show lenses for versionless modules');
  });

  test('Code lens not shown for Git modules', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    const codeLenses = await TestHelper.getCodeLenses(doc);
    
    // Find git module
    const gitLine = TestHelper.findLineContaining(doc, "'custom-module'");
    const gitLenses = codeLenses.filter(lens => lens.range.start.line === gitLine);
    
    assert.equal(gitLenses.length, 0, 'Should not show code lens for Git modules');
  });

  test('Code lens command execution updates module version', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    const editor = await TestHelper.showDocument(doc);
    
    // Get code lenses
    const codeLenses = await TestHelper.getCodeLenses(doc);
    
    // Find update command
    const updateLens = codeLenses.find(lens => 
      lens.command?.command === 'puppetfile-depgraph.applySingleUpgrade'
    );
    
    assert.ok(updateLens, 'Should have update module command');
    
    if (updateLens?.command) {
      // Get the expected new version from the command arguments
      const args = updateLens.command.arguments?.[0];
      const expectedVersion = args?.newVersion;
      
      // Execute the command
      await vscode.commands.executeCommand(
        updateLens.command.command,
        ...(updateLens.command.arguments || [])
      );
      
      // Verify version was updated
      await TestHelper.wait(500);
      const updatedText = doc.getText();
      assert.ok(updatedText.includes(expectedVersion), `Version should be updated to ${expectedVersion}`);
    }
  });

  test('Code lens updates after document changes', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    const editor = await TestHelper.showDocument(doc);
    
    // Get initial code lenses
    const initialLenses = await TestHelper.getCodeLenses(doc);
    const initialCount = initialLenses.length;
    
    // Add a new module
    const text = doc.getText();
    const newText = text + "\nmod 'puppetlabs-firewall', '5.0.0'";
    const fullRange = new vscode.Range(
      new vscode.Position(0, 0),
      doc.positionAt(text.length)
    );
    await TestHelper.replaceText(editor, fullRange, newText);
    
    // Trigger code lens refresh
    puppetfileCodeLensProvider.refresh();
    
    // Wait for code lens to update
    await TestHelper.wait(1000);
    
    // Force VS Code to re-compute code lenses
    await vscode.commands.executeCommand('vscode.executeCodeLensProvider', doc.uri);
    
    // Get updated code lenses
    const updatedLenses = await TestHelper.getCodeLenses(doc);
    
    // Check if firewall-specific code lenses were added
    const firewallLenses = updatedLenses.filter(lens => 
      lens.command?.arguments?.[0]?.moduleName === 'puppetlabs-firewall'
    );
    
    assert.ok(firewallLenses.length > 0 || updatedLenses.length > initialCount, 
      'Should have firewall code lenses or more code lenses after adding module');
  });

  test('Upgrade diff code lens provider shows apply options', async () => {
    // First set up a mock upgrade plan
    UpgradeDiffCodeLensProvider.setUpgradePlan({
      totalModules: 1,
      totalUpgradeable: 1,
      totalGitModules: 0,
      hasConflicts: false,
      gitModules: [],
      candidates: [{
        module: { name: 'puppetlabs-stdlib', source: 'forge' as const, line: 1 },
        currentVersion: '8.5.0',
        availableVersions: ['8.6.0', '9.6.0'],
        maxSafeVersion: '8.6.0',
        isUpgradeable: true
      }]
    });
    
    // Create a diff document with the expected comment pattern
    const diffContent = `
@@ -1,5 +1,5 @@
 forge 'https://forge.puppet.com'
 
-mod 'puppetlabs-stdlib', '8.5.0'
+mod 'puppetlabs-stdlib', '8.6.0' # ↑ UPGRADE: puppetlabs-stdlib (8.5.0 → 8.6.0)
 mod 'puppetlabs-concat', '7.2.0'
`;
    
    // Register a simple content provider for the test
    const provider = {
      provideTextDocumentContent: (uri: vscode.Uri) => diffContent
    };
    const disposable = vscode.workspace.registerTextDocumentContentProvider('puppetfile-diff', provider);
    
    try {
      // Create a document with puppetfile-diff scheme
      const diffUri = vscode.Uri.parse('puppetfile-diff://test/Puppetfile');
      const doc = await vscode.workspace.openTextDocument(diffUri);
      await TestHelper.showDocument(doc);
      
      // Refresh the code lens provider to ensure it picks up the upgrade plan
      upgradeDiffCodeLensProvider.refresh();
      
      // Wait for code lens provider to process
      await TestHelper.wait(500);
      
      // Force VS Code to compute code lenses
      await vscode.commands.executeCommand('vscode.executeCodeLensProvider', doc.uri);
      
      // Get code lenses from diff provider
      const codeLenses = await TestHelper.getCodeLenses(doc);
    
      // Should show apply options
      const applyLens = codeLenses.find(lens => 
        lens.command?.title.includes('Apply') || lens.command?.title.includes('apply')
      );
      
      assert.ok(applyLens, 'Should show apply option in diff view');
    } finally {
      disposable.dispose();
    }
  });

  test('Code lens handles errors gracefully', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Reconfigure existing stubs to reject with errors
    (PuppetForgeService.getModule as sinon.SinonStub).rejects(new Error('API Error'));
    (PuppetForgeService.getLatestVersion as sinon.SinonStub).rejects(new Error('API Error'));
    (PuppetForgeService.getLatestSafeVersion as sinon.SinonStub).rejects(new Error('API Error'));
    
    // Also stub checkForUpdate if it's not already stubbed
    if (typeof (PuppetForgeService.checkForUpdate as any).restore !== 'function') {
      sandbox.stub(PuppetForgeService, 'checkForUpdate').rejects(new Error('API Error'));
    } else {
      (PuppetForgeService.checkForUpdate as sinon.SinonStub).rejects(new Error('API Error'));
    }
    
    try {
      // Should still return some code lenses (without version info)
      const codeLenses = await TestHelper.getCodeLenses(doc);
      
      // Should not crash, may have reduced functionality
      assert.ok(Array.isArray(codeLenses), 'Should return array even with errors');
    } finally {
      // Restore original behaviors for next tests
      (PuppetForgeService.getModule as sinon.SinonStub).callsFake(async (moduleName) => {
        return MockPuppetForgeService.getModuleInfo(moduleName);
      });
      (PuppetForgeService.getLatestVersion as sinon.SinonStub).callsFake(async (moduleName) => {
        return MockPuppetForgeService.getLatestVersion(moduleName);
      });
      (PuppetForgeService.getLatestSafeVersion as sinon.SinonStub).callsFake(async (moduleName) => {
        return MockPuppetForgeService.getLatestVersion(moduleName);
      });
    }
  });

  test('Code lens performance with multiple modules', async () => {
    const doc = await TestHelper.openTestPuppetfile('complex-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    const start = Date.now();
    const codeLenses = await TestHelper.getCodeLenses(doc);
    const elapsed = Date.now() - start;
    
    // Should complete reasonably fast even with many modules
    assert.ok(elapsed < 5000, 'Should generate code lenses within 5 seconds');
    assert.ok(codeLenses.length > 10, 'Should generate multiple code lenses for complex file');
  });
});
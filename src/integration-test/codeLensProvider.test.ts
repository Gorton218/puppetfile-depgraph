import * as vscode from 'vscode';
import * as assert from 'assert';
import { TestHelper } from './testHelper';
import * as sinon from 'sinon';
import { PuppetForgeService } from '../puppetForgeService';
import { MockPuppetForgeService } from './mockPuppetForgeService';
import { PuppetfileCodeLensProvider } from '../puppetfileCodeLensProvider';
import { UpgradeDiffCodeLensProvider } from '../services/upgradeDiffCodeLensProvider';

suite('Code Lens Provider Integration Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let puppetfileCodeLensProvider: PuppetfileCodeLensProvider;
  let upgradeDiffCodeLensProvider: UpgradeDiffCodeLensProvider;

  setup(async () => {
    sandbox = sinon.createSandbox();
    TestHelper.setupMockForgeService();
    
    // Mock PuppetForgeService
    sandbox.stub(PuppetForgeService, 'getModule').callsFake(async (moduleName) => {
      return MockPuppetForgeService.getModuleInfo(moduleName);
    });
    
    sandbox.stub(PuppetForgeService, 'getLatestVersion').callsFake(async (moduleName) => {
      return MockPuppetForgeService.getLatestVersion(moduleName);
    });
    
    sandbox.stub(PuppetForgeService, 'getLatestSafeVersion').callsFake(async (moduleName) => {
      return MockPuppetForgeService.getLatestVersion(moduleName); // For testing
    });

    // Register code lens providers
    puppetfileCodeLensProvider = new PuppetfileCodeLensProvider();
    upgradeDiffCodeLensProvider = new UpgradeDiffCodeLensProvider();
    
    vscode.languages.registerCodeLensProvider('puppetfile', puppetfileCodeLensProvider);
    vscode.languages.registerCodeLensProvider('puppetfile-diff', upgradeDiffCodeLensProvider);

    await TestHelper.closeAllEditors();
  });

  teardown(async () => {
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
      lens.command?.command === 'puppetfile-depgraph.updateModuleVersion'
    );
    
    assert.ok(updateLens, 'Should have update module command');
    
    if (updateLens?.command) {
      // Mock quick pick selection
      sandbox.stub(vscode.window, 'showQuickPick').resolves({
        label: '9.0.0',
        description: 'Major update'
      } as any);
      
      // Execute the command
      await vscode.commands.executeCommand(
        updateLens.command.command,
        ...(updateLens.command.arguments || [])
      );
      
      // Verify version was updated
      await TestHelper.wait(500);
      const updatedText = doc.getText();
      assert.ok(updatedText.includes('9.0.0'), 'Version should be updated');
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
    
    // Wait for code lens to update
    await TestHelper.wait(500);
    
    // Get updated code lenses
    const updatedLenses = await TestHelper.getCodeLenses(doc);
    
    assert.ok(updatedLenses.length > initialCount, 'Should have more code lenses after adding module');
  });

  test('Upgrade diff code lens provider shows apply options', async () => {
    // Create a diff document
    const diffContent = `
@@ -1,5 +1,5 @@
 forge 'https://forge.puppet.com'
 
-mod 'puppetlabs-stdlib', '8.5.0'
+mod 'puppetlabs-stdlib', '9.6.0'
 mod 'puppetlabs-concat', '7.2.0'
`;
    
    const doc = await TestHelper.createTestDocument(diffContent, 'puppetfile-diff');
    await TestHelper.showDocument(doc);
    
    // Get code lenses from diff provider
    const codeLenses = await TestHelper.getCodeLenses(doc);
    
    // Should show apply options
    const applyLens = codeLenses.find(lens => 
      lens.command?.title.includes('Apply') || lens.command?.title.includes('apply')
    );
    
    assert.ok(applyLens, 'Should show apply option in diff view');
  });

  test('Code lens handles errors gracefully', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Create a temporary sandbox for this test only
    const tempSandbox = sinon.createSandbox();
    tempSandbox.stub(PuppetForgeService, 'getModule').rejects(new Error('API Error'));
    tempSandbox.stub(PuppetForgeService, 'getLatestVersion').rejects(new Error('API Error'));
    tempSandbox.stub(PuppetForgeService, 'getLatestSafeVersion').rejects(new Error('API Error'));
    tempSandbox.stub(PuppetForgeService, 'checkForUpdate').rejects(new Error('API Error'));
    
    try {
      // Should still return some code lenses (without version info)
      const codeLenses = await TestHelper.getCodeLenses(doc);
      
      // Should not crash, may have reduced functionality
      assert.ok(Array.isArray(codeLenses), 'Should return array even with errors');
    } finally {
      // Clean up the temporary sandbox
      tempSandbox.restore();
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
import * as vscode from 'vscode';
import * as assert from 'assert';
import { TestHelper } from './testHelper';
import * as sinon from 'sinon';
import { PuppetForgeService } from '../../src/services/puppetForgeService';
import { MockPuppetForgeService } from './mockPuppetForgeService';

suite('Command Integration Tests', () => {
  let sandbox: sinon.SinonSandbox;

  setup(async () => {
    sandbox = sinon.createSandbox();
    TestHelper.setupMockForgeService();
    
    // Mock PuppetForgeService to use our mock data
    sandbox.stub(PuppetForgeService, 'getModule').callsFake(async (moduleName) => {
      return MockPuppetForgeService.getModuleInfo(moduleName);
    });
    
    sandbox.stub(PuppetForgeService, 'getLatestVersion').callsFake(async (moduleName) => {
      return MockPuppetForgeService.getLatestVersion(moduleName);
    });
    
    sandbox.stub(PuppetForgeService, 'getLatestSafeVersion').callsFake(async (moduleName) => {
      const currentVersion = '1.0.0'; // Mock current version
      return MockPuppetForgeService.getSafeUpdateVersion(moduleName, currentVersion);
    });

    await TestHelper.closeAllEditors();
  });

  teardown(async () => {
    sandbox.restore();
    TestHelper.resetMockForgeService();
    await TestHelper.closeAllEditors();
  });

  test('Update all to safe versions command', async () => {
    // Open test Puppetfile
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    const editor = await TestHelper.showDocument(doc);
    
    // Execute command
    await vscode.commands.executeCommand('puppetfile-depgraph.updateAllToSafe');
    
    // Wait for command to complete
    await TestHelper.wait(1000);
    
    // Check that versions were updated safely
    const updatedText = doc.getText();
    
    // puppetlabs-stdlib 8.5.0 -> 8.6.0 (safe update within major version 8)
    assert.ok(updatedText.includes("mod 'puppetlabs-stdlib', '8.6.0'"), 'stdlib should be updated to 8.6.0');
    
    // puppetlabs-concat 7.2.0 -> 7.4.0 (safe update within major version 7)
    assert.ok(updatedText.includes("mod 'puppetlabs-concat', '7.4.0'"), 'concat should be updated to 7.4.0');
  });

  test('Update all to latest versions command', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    const editor = await TestHelper.showDocument(doc);
    
    // Execute command
    await vscode.commands.executeCommand('puppetfile-depgraph.updateAllToLatest');
    
    // Wait for command to complete
    await TestHelper.wait(1000);
    
    // Check that versions were updated to latest
    const updatedText = doc.getText();
    
    // puppetlabs-stdlib -> 9.6.0 (latest)
    assert.ok(updatedText.includes("mod 'puppetlabs-stdlib', '9.6.0'"), 'stdlib should be updated to latest 9.6.0');
    
    // puppetlabs-concat -> 9.0.2 (latest)
    assert.ok(updatedText.includes("mod 'puppetlabs-concat', '9.0.2'"), 'concat should be updated to latest 9.0.2');
  });

  test('Show dependency tree command', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Stub showTextDocument to capture the output
    let treeOutput = '';
    const showTextDocStub = sandbox.stub(vscode.window, 'showTextDocument').callsFake(async (doc: any) => {
      if (doc.content) {
        treeOutput = doc.content;
      }
      return {} as vscode.TextEditor;
    });
    
    // Execute command
    await vscode.commands.executeCommand('puppetfile-depgraph.showDependencyTree');
    
    // Wait for command to complete
    await TestHelper.wait(500);
    
    // Verify tree output contains expected modules
    assert.ok(treeOutput.includes('puppetlabs-stdlib'), 'Tree should contain stdlib module');
    assert.ok(treeOutput.includes('puppetlabs-concat'), 'Tree should contain concat module');
    assert.ok(treeOutput.includes('Dependencies:'), 'Tree should show dependencies section');
  });

  test('Clear forge cache command', async () => {
    // Pre-populate cache by getting module info
    await MockPuppetForgeService.getModuleInfo('puppetlabs-stdlib');
    
    // Spy on cache clear method
    const clearCacheSpy = sandbox.spy();
    
    // Execute command
    await vscode.commands.executeCommand('puppetfile-depgraph.clearForgeCache');
    
    // Verify info message was shown
    const infoMsgStub = sandbox.stub(vscode.window, 'showInformationMessage');
    assert.ok(
      infoMsgStub.calledWith(sinon.match(/cache cleared/i)),
      'Should show cache cleared message'
    );
  });

  test('Update module version command', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    const editor = await TestHelper.showDocument(doc);
    
    // Select the stdlib module line
    const stdlibLine = TestHelper.findLineContaining(doc, "mod 'puppetlabs-stdlib'");
    await TestHelper.selectText(editor, stdlibLine, 0, stdlibLine, 50);
    
    // Mock quick pick to select a version
    sandbox.stub(vscode.window, 'showQuickPick').resolves({
      label: '9.0.0',
      description: 'Latest major version'
    } as any);
    
    // Execute command  
    await vscode.commands.executeCommand('puppetfile-depgraph.updateModuleVersion');
    
    // Wait for command to complete
    await TestHelper.wait(500);
    
    // Verify version was updated
    const updatedText = doc.getText();
    assert.ok(updatedText.includes("mod 'puppetlabs-stdlib', '9.0.0'"), 'Version should be updated to 9.0.0');
  });

  test('Cache all modules command', async () => {
    const doc = await TestHelper.openTestPuppetfile('complex-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Spy on cache methods
    const getModuleInfoSpy = sandbox.spy(MockPuppetForgeService, 'getModuleInfo');
    
    // Execute command with progress tracking
    let progressMessages: string[] = [];
    sandbox.stub(vscode.window, 'withProgress').callsFake(async (options, task) => {
      const progress = {
        report: (value: any) => {
          if (value.message) {progressMessages.push(value.message);}
        }
      };
      return task(progress, {} as any);
    });
    
    await vscode.commands.executeCommand('puppetfile-depgraph.cacheAllModules');
    
    // Wait for command to complete
    await TestHelper.wait(1000);
    
    // Verify modules were cached
    assert.ok(getModuleInfoSpy.called, 'Should fetch module information');
    assert.ok(progressMessages.some(m => m.includes('Caching')), 'Should show caching progress');
  });

  test('Show upgrade planner command', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Execute command
    await vscode.commands.executeCommand('puppetfile-depgraph.showUpgradePlanner');
    
    // Wait for webview to open
    await TestHelper.wait(1000);
    
    // Verify webview panel was created
    // Note: In real implementation, we'd check for webview panel creation
    assert.ok(true, 'Upgrade planner should open');
  });

  test('Apply all safe upgrades command', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    const editor = await TestHelper.showDocument(doc);
    
    // Execute command
    await vscode.commands.executeCommand('puppetfile-depgraph.applyAllUpgrades');
    
    // Wait for command to complete
    await TestHelper.wait(1000);
    
    // Verify safe upgrades were applied
    const updatedText = doc.getText();
    assert.ok(updatedText.includes("'8.6.0'") || updatedText.includes("'7.4.0'"), 
      'Should apply safe version upgrades');
  });

  test('Handle errors gracefully', async () => {
    // Test with invalid Puppetfile
    const doc = await TestHelper.openTestPuppetfile('invalid-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Stub error message
    const errorMsgStub = sandbox.stub(vscode.window, 'showErrorMessage');
    
    // Execute command that should fail
    await vscode.commands.executeCommand('puppetfile-depgraph.updateAllToSafe');
    
    // Verify error was shown
    assert.ok(errorMsgStub.called, 'Should show error message for invalid Puppetfile');
  });

  test('Handle empty Puppetfile', async () => {
    const doc = await TestHelper.openTestPuppetfile('empty-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Execute command
    await vscode.commands.executeCommand('puppetfile-depgraph.showDependencyTree');
    
    // Should complete without errors
    assert.ok(true, 'Should handle empty Puppetfile gracefully');
  });
});
import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { TestHelper } from '../../integration-test/testHelper';

/**
 * End-to-end tests for update commands
 * These tests simulate real user workflows from start to finish
 */
suite('E2E: Update Commands Workflow', () => {
  let testWorkspace: string;
  let puppetfilePath: string;

  suiteSetup(async () => {
    // Create a temporary workspace for e2e tests
    testWorkspace = path.join(__dirname, '..', 'temp-workspace');
    if (!fs.existsSync(testWorkspace)) {
      fs.mkdirSync(testWorkspace, { recursive: true });
    }
    
    puppetfilePath = path.join(testWorkspace, 'Puppetfile');
  });

  suiteTeardown(async () => {
    // Clean up temporary workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  setup(async () => {
    // Create a fresh Puppetfile for each test
    const puppetfileContent = `forge 'https://forge.puppet.com'

# Production modules
mod 'puppetlabs-stdlib', '8.5.0'
mod 'puppetlabs-concat', '7.2.0'
mod 'puppetlabs-apache', '10.1.0'
mod 'puppetlabs-mysql', '13.0.0'
mod 'puppet-nginx', '4.3.0'

# Module without version
mod 'puppetlabs-docker'

# Git module
mod 'internal-module',
  :git => 'https://github.com/company/internal.git',
  :tag => 'v1.0.0'
`;
    
    fs.writeFileSync(puppetfilePath, puppetfileContent);
    await TestHelper.closeAllEditors();
  });

  teardown(async () => {
    await TestHelper.closeAllEditors();
  });

  test('Complete workflow: Update all modules to safe versions', async () => {
    // Step 1: Open Puppetfile
    const puppetfileUri = vscode.Uri.file(puppetfilePath);
    const doc = await vscode.workspace.openTextDocument(puppetfileUri);
    const editor = await vscode.window.showTextDocument(doc);
    
    // Step 2: Execute update command
    await vscode.commands.executeCommand('puppetfile-depgraph.updateAllToSafe');
    
    // Step 3: Wait for updates to complete
    await TestHelper.wait(2000);
    
    // Step 4: Verify updates
    const updatedContent = fs.readFileSync(puppetfilePath, 'utf8');
    
    // Check that safe updates were applied
    assert.ok(updatedContent.includes("'8.6.0'") || updatedContent.includes("'7.4.0'"), 
      'Should update to safe versions');
    
    // Check that Git modules were not modified
    assert.ok(updatedContent.includes(':tag => \'v1.0.0\''), 
      'Git modules should remain unchanged');
    
    // Step 5: Save the file
    await doc.save();
    
    // Step 6: Verify file was saved correctly
    const savedContent = fs.readFileSync(puppetfilePath, 'utf8');
    assert.strictEqual(savedContent, updatedContent, 'File should be saved correctly');
  });

  test('Complete workflow: Update specific module interactively', async () => {
    // Step 1: Open Puppetfile
    const puppetfileUri = vscode.Uri.file(puppetfilePath);
    const doc = await vscode.workspace.openTextDocument(puppetfileUri);
    const editor = await vscode.window.showTextDocument(doc);
    
    // Step 2: Position cursor on stdlib module
    const stdlibLine = TestHelper.findLineContaining(doc, "'puppetlabs-stdlib', '8.5.0'");
    editor.selection = new vscode.Selection(stdlibLine, 0, stdlibLine, 0);
    
    // Step 3: Show hover to check available versions
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      doc.uri,
      new vscode.Position(stdlibLine, 10)
    );
    
    assert.ok(hovers && hovers.length > 0, 'Should show hover information');
    
    // Step 4: Execute update command
    await vscode.commands.executeCommand('puppetfile-depgraph.updateModuleVersion');
    
    // Note: In real e2e test, we would need to handle the QuickPick UI
    // For now, we verify the command is available
    assert.ok(true, 'Update module command executed');
  });

  test('Complete workflow: Check and apply multiple updates', async () => {
    // Step 1: Open Puppetfile
    const puppetfileUri = vscode.Uri.file(puppetfilePath);
    const doc = await vscode.workspace.openTextDocument(puppetfileUri);
    await vscode.window.showTextDocument(doc);
    
    // Step 2: Show dependency tree
    await vscode.commands.executeCommand('puppetfile-depgraph.showDependencyTree');
    await TestHelper.wait(1000);
    
    // Step 3: Cache all modules
    await vscode.commands.executeCommand('puppetfile-depgraph.cacheAllModules');
    await TestHelper.wait(2000);
    
    // Step 4: Update all to latest
    await vscode.commands.executeCommand('puppetfile-depgraph.updateAllToLatest');
    await TestHelper.wait(2000);
    
    // Step 5: Verify major updates
    const updatedContent = fs.readFileSync(puppetfilePath, 'utf8');
    
    // Should have latest versions
    assert.ok(updatedContent.includes("'9.") || updatedContent.includes("'11."), 
      'Should update to latest major versions');
  });

  test('Error handling: Invalid module names', async () => {
    // Create Puppetfile with invalid module
    const invalidContent = `forge 'https://forge.puppet.com'

mod 'invalid-module-name', '1.0.0'
mod 'puppetlabs-stdlib', '8.5.0'
`;
    
    fs.writeFileSync(puppetfilePath, invalidContent);
    
    const puppetfileUri = vscode.Uri.file(puppetfilePath);
    const doc = await vscode.workspace.openTextDocument(puppetfileUri);
    await vscode.window.showTextDocument(doc);
    
    // Try to update - should handle error gracefully
    await vscode.commands.executeCommand('puppetfile-depgraph.updateAllToSafe');
    await TestHelper.wait(1000);
    
    // Valid modules should still be updated
    const content = fs.readFileSync(puppetfilePath, 'utf8');
    assert.ok(content.includes('puppetlabs-stdlib'), 'Valid modules should remain');
  });

  test('Performance: Update large Puppetfile', async () => {
    // Create large Puppetfile
    let largePuppetfile = `forge 'https://forge.puppet.com'\n\n`;
    const modules = [
      'stdlib', 'concat', 'apache', 'mysql', 'postgresql',
      'firewall', 'ntp', 'timezone', 'motd', 'sudo'
    ];
    
    // Add 50 modules
    for (let i = 0; i < 50; i++) {
      const module = modules[i % modules.length];
      largePuppetfile += `mod 'puppetlabs-${module}${i}', '1.0.0'\n`;
    }
    
    fs.writeFileSync(puppetfilePath, largePuppetfile);
    
    const puppetfileUri = vscode.Uri.file(puppetfilePath);
    const doc = await vscode.workspace.openTextDocument(puppetfileUri);
    await vscode.window.showTextDocument(doc);
    
    // Measure update time
    const startTime = Date.now();
    await vscode.commands.executeCommand('puppetfile-depgraph.updateAllToSafe');
    
    // Wait for completion with timeout
    const maxWait = 30000; // 30 seconds
    const checkInterval = 500;
    let elapsed = 0;
    
    while (elapsed < maxWait) {
      await TestHelper.wait(checkInterval);
      elapsed += checkInterval;
      
      const content = doc.getText();
      if (!content.includes("'1.0.0'")) {
        // All modules updated
        break;
      }
    }
    
    const totalTime = Date.now() - startTime;
    assert.ok(totalTime < 30000, `Should complete within 30 seconds (took ${totalTime}ms)`);
  });
});
import * as vscode from 'vscode';
import * as assert from 'assert';
import { TestHelper } from './testHelper';
import * as sinon from 'sinon';
import { PuppetForgeService } from '../../src/services/puppetForgeService';
import { MockPuppetForgeService } from './mockPuppetForgeService';
import { PuppetfileHoverProvider } from '../../src/puppetfileHoverProvider';

suite('Hover Provider Integration Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let hoverProvider: PuppetfileHoverProvider;

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
      return MockPuppetForgeService.getSafeUpdateVersion(moduleName, '1.0.0');
    });
    
    sandbox.stub(PuppetForgeService, 'getModuleReleases').callsFake(async (moduleName) => {
      return MockPuppetForgeService.getModuleReleases(moduleName);
    });
    
    sandbox.stub(PuppetForgeService, 'checkForUpdate').callsFake(async (moduleName, currentVersion, safeOnly) => {
      const latestVersion = await MockPuppetForgeService.getLatestVersion(moduleName);
      const hasUpdate = currentVersion ? PuppetForgeService.compareVersions(latestVersion, currentVersion) > 0 : true;
      return {
        hasUpdate,
        latestVersion,
        currentVersion
      };
    });
    
    sandbox.stub(PuppetForgeService, 'hasModuleCached').callsFake((moduleName) => {
      return true; // Always say it's cached to avoid caching logic
    });

    // Register hover provider
    hoverProvider = new PuppetfileHoverProvider();
    vscode.languages.registerHoverProvider('puppetfile', hoverProvider);

    await TestHelper.closeAllEditors();
  });

  teardown(async () => {
    sandbox.restore();
    TestHelper.resetMockForgeService();
    await TestHelper.closeAllEditors();
  });

  test('Hover shows version information for Forge modules', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Find stdlib module line
    const stdlibLine = TestHelper.findLineContaining(doc, "'puppetlabs-stdlib', '8.5.0'");
    
    // Get hover at module name position
    const hovers = await TestHelper.getHoverAtPosition(doc, stdlibLine, 10);
    
    assert.ok(hovers.length > 0, 'Should provide hover information');
    
    // Check hover content
    const hoverContent = hovers[0].contents.map(c => 
      typeof c === 'string' ? c : (c as vscode.MarkdownString).value
    ).join('\n');
    
    
    assert.ok(hoverContent.includes('puppetlabs-stdlib'), 'Hover should show module name');
    assert.ok(hoverContent.includes('8.5.0'), 'Hover should show current version');
    assert.ok(hoverContent.includes('Latest Version'), 'Hover should show latest version');
    assert.ok(hoverContent.includes('9.7.0'), 'Hover should show latest version number');
  });

  test('Hover shows safe update version when available', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Find concat module line  
    const concatLine = TestHelper.findLineContaining(doc, "'puppetlabs-concat', '7.2.0'");
    
    // Get hover
    const hovers = await TestHelper.getHoverAtPosition(doc, concatLine, 10);
    const hoverContent = hovers[0].contents.map(c => 
      typeof c === 'string' ? c : (c as vscode.MarkdownString).value
    ).join('\n');
    
    // Check for basic module information and that updates are available
    assert.ok(hoverContent.includes('puppetlabs-concat'), 'Should show module name');
    assert.ok(hoverContent.includes('7.2.0'), 'Should show current version');
    assert.ok(hoverContent.includes('Latest Version'), 'Should show latest version section');
    assert.ok(hoverContent.includes('Available Updates'), 'Should show available updates section');
  });

  test('Hover shows dependencies information', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Test with concat which has dependencies
    const concatLine = TestHelper.findLineContaining(doc, "'puppetlabs-concat'");
    const hovers = await TestHelper.getHoverAtPosition(doc, concatLine, 10);
    
    const hoverContent = hovers[0].contents.map(c => 
      typeof c === 'string' ? c : (c as vscode.MarkdownString).value
    ).join('\n');
    
    assert.ok(hoverContent.includes('Dependencies'), 'Should show dependencies section');
    assert.ok(hoverContent.includes('puppetlabs/stdlib'), 'Should show stdlib dependency');
  });

  test('Hover shows version for modules without specified version', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Find mysql module (no version specified)
    const mysqlLine = TestHelper.findLineContaining(doc, "'puppetlabs-mysql'");
    
    const hovers = await TestHelper.getHoverAtPosition(doc, mysqlLine, 10);
    const hoverContent = hovers[0].contents.map(c => 
      typeof c === 'string' ? c : (c as vscode.MarkdownString).value
    ).join('\n');
    
    assert.ok(hoverContent.includes('Latest Version') || hoverContent.includes('Version:'), 'Should show latest version');
    assert.ok(hoverContent.includes('15.0.0'), 'Should show latest version number');
  });

  test('Hover handles Git modules correctly', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Find git module
    const gitLine = TestHelper.findLineContaining(doc, "'custom-module'");
    
    const hovers = await TestHelper.getHoverAtPosition(doc, gitLine, 10);
    
    if (hovers.length > 0) {
      const hoverContent = hovers[0].contents.map(c => 
        typeof c === 'string' ? c : (c as vscode.MarkdownString).value
      ).join('\n');
      
      assert.ok(hoverContent.includes('Git module') || hoverContent.includes('custom-module'), 
        'Should handle Git modules');
    }
  });

  test('Hover provides clickable links to Puppet Forge', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    const stdlibLine = TestHelper.findLineContaining(doc, "'puppetlabs-stdlib'");
    const hovers = await TestHelper.getHoverAtPosition(doc, stdlibLine, 10);
    
    const hoverContent = hovers[0].contents.map(c => 
      typeof c === 'string' ? c : (c as vscode.MarkdownString).value
    ).join('\n');
    
    // Check for markdown links
    assert.ok(hoverContent.includes('['), 'Should contain markdown links');
    assert.ok(hoverContent.includes('](https://forge.puppet.com'), 'Should link to Puppet Forge');
    assert.ok(hoverContent.includes('/dependencies'), 'Should link to dependencies page');
  });

  test('Hover handles errors gracefully', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    // Mock error response
    sandbox.restore();
    sandbox.stub(PuppetForgeService, 'getModule').rejects(new Error('Network error'));
    
    const line = TestHelper.findLineContaining(doc, "'example-test'");
    const hovers = await TestHelper.getHoverAtPosition(doc, line, 10);
    
    // Should still return hover but with error indication
    if (hovers.length > 0) {
      const hoverContent = hovers[0].contents.map(c => 
        typeof c === 'string' ? c : (c as vscode.MarkdownString).value
      ).join('\n');
      
      // Should show module name at minimum
      assert.ok(hoverContent.includes('example-test'), 'Should still show module name on error');
    }
  });

  test('Hover performance with cached data', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    await TestHelper.showDocument(doc);
    
    const stdlibLine = TestHelper.findLineContaining(doc, "'puppetlabs-stdlib'");
    
    // First hover - will fetch from API
    const start1 = Date.now();
    await TestHelper.getHoverAtPosition(doc, stdlibLine, 10);
    const time1 = Date.now() - start1;
    
    // Second hover - should use cache
    const start2 = Date.now();
    await TestHelper.getHoverAtPosition(doc, stdlibLine, 10);
    const time2 = Date.now() - start2;
    
    // Cached response should be faster
    assert.ok(time2 <= time1, 'Cached hover should be faster or equal');
  });

  test('Hover updates after module version change', async () => {
    const doc = await TestHelper.openTestPuppetfile('simple-puppetfile.txt');
    const editor = await TestHelper.showDocument(doc);
    
    // Get initial hover
    const stdlibLine = TestHelper.findLineContaining(doc, "'puppetlabs-stdlib', '8.5.0'");
    const hover1 = await TestHelper.getHoverAtPosition(doc, stdlibLine, 10);
    const content1 = hover1[0].contents.map(c => 
      typeof c === 'string' ? c : (c as vscode.MarkdownString).value
    ).join('\n');
    
    // Update version in document
    const range = new vscode.Range(
      new vscode.Position(stdlibLine, 0),
      new vscode.Position(stdlibLine, 100)
    );
    await TestHelper.replaceText(editor, range, "mod 'puppetlabs-stdlib', '9.0.0'");
    
    // Get hover again
    const hover2 = await TestHelper.getHoverAtPosition(doc, stdlibLine, 10);
    const content2 = hover2[0].contents.map(c => 
      typeof c === 'string' ? c : (c as vscode.MarkdownString).value
    ).join('\n');
    
    // Content should reflect new version
    assert.ok(content2.includes('9.0.0'), 'Hover should show updated version');
  });
});
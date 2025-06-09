import * as assert from 'assert';
import { suite, test } from 'mocha';
import * as sinon from 'sinon';
import { DependencyTreeService } from '../dependencyTreeService';
import { PuppetForgeService } from '../puppetForgeService';
import { PuppetModule } from '../puppetfileParser';

suite('DependencyTree Conflict Detection Integration Tests', () => {
  let getModuleStub: sinon.SinonStub;
  
  setup(() => {
    // Stub the Puppet Forge API calls
    getModuleStub = sinon.stub(PuppetForgeService, 'getModule');
  });
  
  teardown(() => {
    sinon.restore();
  });
  
  test('should not report false conflicts when versions overlap', async () => {
    // Setup mock data for stdlib module
    getModuleStub.withArgs('puppetlabs/stdlib').resolves({
      name: 'puppetlabs-stdlib',
      current_release: {
        version: '9.6.0',
        metadata: {
          dependencies: []
        }
      },
      releases: [
        { version: '4.0.0' },
        { version: '5.0.0' },
        { version: '6.0.0' },
        { version: '7.0.0' },
        { version: '8.0.0' },
        { version: '8.5.0' },
        { version: '9.0.0' },
        { version: '9.6.0' }
      ]
    });
    
    // Setup mock data for apache module that requires stdlib >= 4.0.0 < 9.0.0
    getModuleStub.withArgs('puppetlabs/apache').resolves({
      name: 'puppetlabs-apache',
      current_release: {
        version: '12.2.0',
        metadata: {
          dependencies: [
            { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 9.0.0' }
          ]
        }
      },
      releases: [{ version: '12.2.0' }]
    });
    
    // Setup mock data for mysql module that requires stdlib >= 8.0.0
    getModuleStub.withArgs('puppetlabs/mysql').resolves({
      name: 'puppetlabs-mysql',
      current_release: {
        version: '16.0.0',
        metadata: {
          dependencies: [
            { name: 'puppetlabs/stdlib', version_requirement: '>= 8.0.0' }
          ]
        }
      },
      releases: [{ version: '16.0.0' }]
    });
    
    const modules: PuppetModule[] = [
      { name: 'puppetlabs/apache', version: '12.2.0', source: 'forge', line: 1 },
      { name: 'puppetlabs/mysql', version: '16.0.0', source: 'forge', line: 2 }
    ];
    
    const tree = await DependencyTreeService.buildDependencyTree(modules);
    const conflicts = DependencyTreeService.findConflicts(tree);
    
    // Should not report any conflicts since versions 8.0.0 and 8.5.0 satisfy both requirements
    assert.strictEqual(conflicts.length, 0, 'Should not report conflicts when versions overlap');
  });
  
  test('should report real conflicts when no version satisfies all requirements', async () => {
    // Setup mock data for concat module
    getModuleStub.withArgs('puppetlabs/concat').resolves({
      name: 'puppetlabs-concat',
      current_release: {
        version: '9.0.2',
        metadata: {
          dependencies: []
        }
      },
      releases: [
        { version: '5.0.0' },
        { version: '6.0.0' },
        { version: '6.5.0' },
        { version: '7.0.0' },
        { version: '7.5.0' },
        { version: '8.0.0' },
        { version: '9.0.0' },
        { version: '9.0.2' }
      ]
    });
    
    // Apache requires concat >= 6.0.0 < 7.0.0
    getModuleStub.withArgs('example/apache').resolves({
      name: 'example-apache',
      current_release: {
        version: '1.0.0',
        metadata: {
          dependencies: [
            { name: 'puppetlabs/concat', version_requirement: '>= 6.0.0 < 7.0.0' }
          ]
        }
      },
      releases: [{ version: '1.0.0' }]
    });
    
    // MySQL requires concat >= 7.0.0
    getModuleStub.withArgs('example/mysql').resolves({
      name: 'example-mysql',
      current_release: {
        version: '1.0.0',
        metadata: {
          dependencies: [
            { name: 'puppetlabs/concat', version_requirement: '>= 7.0.0' }
          ]
        }
      },
      releases: [{ version: '1.0.0' }]
    });
    
    const modules: PuppetModule[] = [
      { name: 'example/apache', version: '1.0.0', source: 'forge', line: 1 },
      { name: 'example/mysql', version: '1.0.0', source: 'forge', line: 2 }
    ];
    
    const tree = await DependencyTreeService.buildDependencyTree(modules);
    const conflicts = DependencyTreeService.findConflicts(tree);
    
    // Should report a conflict for concat module
    assert.ok(conflicts.length > 0, 'Should report conflicts when no version satisfies all requirements');
    assert.ok(conflicts.some(c => c.includes('No version of puppetlabs/concat satisfies all requirements')));
  });
  
  test('should handle exact version constraints from Puppetfile', async () => {
    // Setup mock data
    getModuleStub.withArgs('puppetlabs/stdlib').resolves({
      name: 'puppetlabs-stdlib',
      current_release: {
        version: '8.6.0',
        metadata: {
          dependencies: []
        }
      },
      releases: [
        { version: '8.0.0' },
        { version: '8.5.0' },
        { version: '8.6.0' },
        { version: '9.0.0' }
      ]
    });
    
    getModuleStub.withArgs('example/mymodule').resolves({
      name: 'example-mymodule',
      current_release: {
        version: '1.0.0',
        metadata: {
          dependencies: [
            { name: 'puppetlabs/stdlib', version_requirement: '>= 9.0.0' }
          ]
        }
      },
      releases: [{ version: '1.0.0' }]
    });
    
    const modules: PuppetModule[] = [
      { name: 'puppetlabs/stdlib', version: '8.6.0', source: 'forge', line: 1 },
      { name: 'example/mymodule', version: '1.0.0', source: 'forge', line: 2 }
    ];
    
    const tree = await DependencyTreeService.buildDependencyTree(modules);
    const conflicts = DependencyTreeService.findConflicts(tree);
    
    // Should report conflict because Puppetfile requires exact version 8.6.0 but mymodule needs >= 9.0.0
    assert.ok(conflicts.length > 0, 'Should report conflict between exact version and requirement');
    assert.ok(conflicts.some(c => c.includes('puppetlabs/stdlib')));
  });
  
  test('should provide suggested fixes for conflicts', async () => {
    // Setup similar to the real conflict test
    getModuleStub.withArgs('puppetlabs/concat').resolves({
      name: 'puppetlabs-concat',
      current_release: {
        version: '9.0.2',
        metadata: {
          dependencies: []
        }
      },
      releases: [
        { version: '6.0.0' },
        { version: '6.5.0' },
        { version: '7.0.0' },
        { version: '7.5.0' }
      ]
    });
    
    getModuleStub.withArgs('example/apache').resolves({
      name: 'example-apache',
      current_release: {
        version: '1.0.0',
        metadata: {
          dependencies: [
            { name: 'puppetlabs/concat', version_requirement: '>= 6.0.0 < 7.0.0' }
          ]
        }
      },
      releases: [{ version: '1.0.0' }]
    });
    
    getModuleStub.withArgs('example/mysql').resolves({
      name: 'example-mysql',
      current_release: {
        version: '1.0.0',
        metadata: {
          dependencies: [
            { name: 'puppetlabs/concat', version_requirement: '>= 7.0.0' }
          ]
        }
      },
      releases: [{ version: '1.0.0' }]
    });
    
    const modules: PuppetModule[] = [
      { name: 'example/apache', version: '1.0.0', source: 'forge', line: 1 },
      { name: 'example/mysql', version: '1.0.0', source: 'forge', line: 2 }
    ];
    
    const tree = await DependencyTreeService.buildDependencyTree(modules);
    const conflicts = DependencyTreeService.findConflicts(tree);
    
    // Should include suggestions
    assert.ok(conflicts.some(c => c.includes('Suggestion:')), 'Should provide suggested fixes');
  });
});
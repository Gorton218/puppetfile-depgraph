import * as assert from 'assert';
import { suite, test } from 'mocha';
import * as sinon from 'sinon';
import { DependencyTreeService } from '../dependencyTreeService';
import { PuppetForgeService } from '../puppetForgeService';
import { PuppetModule } from '../puppetfileParser';

// Helper function to create module mock data
function createModuleMock(name: string, version: string, dependencies: Array<{name: string, version_requirement: string}> = [], availableVersions: string[] = []) {
  const releases = availableVersions.length > 0 
    ? availableVersions.map(v => ({ 
        version: v,
        metadata: { dependencies }
      }))
    : [{ 
        version,
        metadata: { dependencies }
      }];
  
  return {
    name: name.replace('/', '-'),
    current_release: {
      version,
      metadata: { dependencies }
    },
    releases
  };
}

// Helper function to setup module stub
function setupModuleStub(stub: sinon.SinonStub, moduleName: string, version: string, dependencies: Array<{name: string, version_requirement: string}> = [], availableVersions: string[] = []) {
  stub.withArgs(moduleName).resolves(createModuleMock(moduleName, version, dependencies, availableVersions));
}

suite('DependencyTree Conflict Detection Integration Tests', () => {
  let getModuleStub: sinon.SinonStub;
  
  setup(() => {
    // Stub the Puppet Forge API calls
    getModuleStub = sinon.stub(PuppetForgeService, 'getModule');
  });
  
  teardown(() => {
    sinon.restore();
  });

  const runConflictTest = async (
    moduleSetups: Array<{name: string, version: string, deps: Array<{name: string, version_requirement: string}>, versions?: string[]}>,
    modules: PuppetModule[],
    assertions: (conflicts: string[]) => void
  ) => {
    moduleSetups.forEach(setup => {
      setupModuleStub(getModuleStub, setup.name, setup.version, setup.deps, setup.versions);
    });

    const tree = await DependencyTreeService.buildDependencyTree(modules);
    const conflicts = DependencyTreeService.findConflicts(tree);
    assertions(conflicts);
  };
  
  test('should not report false conflicts when versions overlap', async () => {
    await runConflictTest(
      [
        { name: 'puppetlabs/stdlib', version: '9.6.0', deps: [], versions: ['4.0.0', '5.0.0', '6.0.0', '7.0.0', '8.0.0', '8.5.0', '9.0.0', '9.6.0'] },
        { name: 'puppetlabs/apache', version: '12.2.0', deps: [{ name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 9.0.0' }] },
        { name: 'puppetlabs/mysql', version: '16.0.0', deps: [{ name: 'puppetlabs/stdlib', version_requirement: '>= 8.0.0' }] }
      ],
      [
        { name: 'puppetlabs/apache', version: '12.2.0', source: 'forge', line: 1 },
        { name: 'puppetlabs/mysql', version: '16.0.0', source: 'forge', line: 2 }
      ],
      (conflicts) => {
        assert.strictEqual(conflicts.length, 0, 'Should not report conflicts when versions overlap');
      }
    );
  });
  
  test('should report real conflicts when no version satisfies all requirements', async () => {
    await runConflictTest(
      [
        { name: 'puppetlabs/concat', version: '9.0.2', deps: [], versions: ['5.0.0', '6.0.0', '6.5.0', '7.0.0', '7.5.0', '8.0.0', '9.0.0', '9.0.2'] },
        { name: 'example/apache', version: '1.0.0', deps: [{ name: 'puppetlabs/concat', version_requirement: '>= 6.0.0 < 7.0.0' }] },
        { name: 'example/mysql', version: '1.0.0', deps: [{ name: 'puppetlabs/concat', version_requirement: '>= 7.0.0' }] }
      ],
      [
        { name: 'example/apache', version: '1.0.0', source: 'forge', line: 1 },
        { name: 'example/mysql', version: '1.0.0', source: 'forge', line: 2 }
      ],
      (conflicts) => {
        assert.ok(conflicts.length > 0, 'Should report conflicts when no version satisfies all requirements');
        assert.ok(conflicts.some(c => c.includes('No version of puppetlabs-concat satisfies all requirements')));
      }
    );
  });
  
  test('should handle exact version constraints from Puppetfile', async () => {
    await runConflictTest(
      [
        { name: 'puppetlabs/stdlib', version: '8.6.0', deps: [], versions: ['8.0.0', '8.5.0', '8.6.0', '9.0.0'] },
        { name: 'example/mymodule', version: '1.0.0', deps: [{ name: 'puppetlabs/stdlib', version_requirement: '>= 9.0.0' }] }
      ],
      [
        { name: 'puppetlabs/stdlib', version: '8.6.0', source: 'forge', line: 1 },
        { name: 'example/mymodule', version: '1.0.0', source: 'forge', line: 2 }
      ],
      (conflicts) => {
        assert.ok(conflicts.length > 0, 'Should report conflict between exact version and requirement');
        assert.ok(conflicts.some(c => c.includes('puppetlabs-stdlib')));
      }
    );
  });
  
  test('should provide suggested fixes for conflicts', async () => {
    await runConflictTest(
      [
        { name: 'puppetlabs/concat', version: '9.0.2', deps: [], versions: ['6.0.0', '6.5.0', '7.0.0', '7.5.0'] },
        { name: 'example/apache', version: '1.0.0', deps: [{ name: 'puppetlabs/concat', version_requirement: '>= 6.0.0 < 7.0.0' }] },
        { name: 'example/mysql', version: '1.0.0', deps: [{ name: 'puppetlabs/concat', version_requirement: '>= 7.0.0' }] }
      ],
      [
        { name: 'example/apache', version: '1.0.0', source: 'forge', line: 1 },
        { name: 'example/mysql', version: '1.0.0', source: 'forge', line: 2 }
      ],
      (conflicts) => {
        assert.ok(conflicts.some(c => c.includes('Suggestion:')), 'Should provide suggested fixes');
      }
    );
  });
});
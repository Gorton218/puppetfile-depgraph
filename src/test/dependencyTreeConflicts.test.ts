import * as sinon from 'sinon';
import { DependencyTreeService } from '../dependencyTreeService';
import { PuppetForgeService } from '../puppetForgeService';
import { PuppetModule } from '../puppetfileParser';

// Helper types
type Dependency = { name: string; version_requirement: string };
type ModuleSetup = { name: string; version: string; deps: Dependency[]; versions?: string[] };

// Helper function to create module mock data
function createModuleMock(name: string, version: string, dependencies: Dependency[] = [], availableVersions: string[] = []) {
  const createRelease = (v: string) => ({ version: v, metadata: { dependencies } });
  const releases = availableVersions.length > 0 
    ? availableVersions.map(createRelease)
    : [createRelease(version)];
  
  return {
    name: name.replace('/', '-'),
    current_release: createRelease(version),
    releases
  };
}

// Helper function to setup module stub
function setupModuleStub(stub: sinon.SinonStub, setup: ModuleSetup) {
  const { name, version, deps, versions = [] } = setup;
  stub.withArgs(name).resolves(createModuleMock(name, version, deps, versions));
}

// Helper function to create PuppetModule
function createPuppetModule(name: string, version: string, line: number): PuppetModule {
  return { name, version, source: 'forge', line };
}

describe('DependencyTree Conflict Detection Integration Tests', () => {
  let getModuleStub: sinon.SinonStub;
  
  beforeEach(() => {
    // Stub the Puppet Forge API calls
    getModuleStub = sinon.stub(PuppetForgeService, 'getModule');
  });
  
  afterEach(() => {
    sinon.restore();
  });

  const runConflictTest = async (
    moduleSetups: ModuleSetup[],
    modules: PuppetModule[],
    assertions: (conflicts: string[]) => void
  ) => {
    moduleSetups.forEach(setup => setupModuleStub(getModuleStub, setup));

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
        createPuppetModule('puppetlabs/apache', '12.2.0', 1),
        createPuppetModule('puppetlabs/mysql', '16.0.0', 2)
      ],
      (conflicts) => {
        expect(conflicts.length).toBe(0); // Should not report conflicts when versions overlap
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
        createPuppetModule('example/apache', '1.0.0', 1),
        createPuppetModule('example/mysql', '1.0.0', 2)
      ],
      (conflicts) => {
        expect(conflicts.length).toBeGreaterThan(0); // Should report conflicts when no version satisfies all requirements
        expect(conflicts.some(c => c.includes('No version of puppetlabs-concat satisfies all requirements'))).toBe(true);
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
        createPuppetModule('puppetlabs/stdlib', '8.6.0', 1),
        createPuppetModule('example/mymodule', '1.0.0', 2)
      ],
      (conflicts) => {
        expect(conflicts.length).toBeGreaterThan(0); // Should report conflict between exact version and requirement
        expect(conflicts.some(c => c.includes('puppetlabs-stdlib'))).toBe(true);
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
        createPuppetModule('example/apache', '1.0.0', 1),
        createPuppetModule('example/mysql', '1.0.0', 2)
      ],
      (conflicts) => {
        expect(conflicts.some(c => c.includes('Suggestion:'))).toBe(true); // Should provide suggested fixes
      }
    );
  });
});
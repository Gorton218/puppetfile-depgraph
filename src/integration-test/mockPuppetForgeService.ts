import * as fs from 'fs';
import * as path from 'path';

export interface MockModuleInfo {
  name: string;
  currentVersion: string;
  releases: Array<{
    version: string;
    created_at: string;
    supported: boolean;
  }>;
  dependencies?: Array<{
    name: string;
    version_requirement: string;
  }>;
}

export class MockPuppetForgeService {
  private static mockData: Map<string, any> = new Map();
  private static initialized = false;

  static initialize() {
    if (this.initialized) {return;}

    // Load mock data from fixtures
    const fixturesDir = path.join(__dirname, 'fixtures', 'api-responses');
    const files = ['puppetlabs-stdlib.json', 'puppetlabs-concat.json'];

    for (const file of files) {
      try {
        const filePath = path.join(fixturesDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const moduleName = path.basename(file, '.json');
        this.mockData.set(moduleName, data);
      } catch (error) {
        console.warn(`Failed to load mock data for ${file}:`, error);
      }
    }

    // Add some common modules with generated data
    this.addMockModule('puppetlabs-apache', '11.1.0', [
      { version: '11.1.0', supported: true },
      { version: '11.0.0', supported: true },
      { version: '10.1.1', supported: true },
      { version: '10.1.0', supported: true },
      { version: '10.0.0', supported: true },
      { version: '9.1.0', supported: false }
    ]);

    this.addMockModule('puppetlabs-mysql', '15.0.0', [
      { version: '15.0.0', supported: true },
      { version: '14.0.0', supported: true },
      { version: '13.1.0', supported: true },
      { version: '13.0.0', supported: true },
      { version: '12.0.0', supported: true }
    ], [
      { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.1 < 10.0.0' },
      { name: 'puppet/systemd', version_requirement: '>= 1.1.1 < 5.0.0' }
    ]);

    this.addMockModule('puppetlabs-docker', '9.1.0', [
      { version: '9.1.0', supported: true },
      { version: '9.0.0', supported: true },
      { version: '8.0.0', supported: true }
    ]);

    this.addMockModule('puppet-nginx', '5.0.0', [
      { version: '5.0.0', supported: true },
      { version: '4.4.0', supported: true },
      { version: '4.3.0', supported: true },
      { version: '4.2.0', supported: true }
    ]);

    this.addMockModule('example-test', '2.0.0', [
      { version: '2.0.0', supported: true },
      { version: '1.5.0', supported: true },
      { version: '1.0.0', supported: true },
      { version: '0.9.0', supported: false }
    ]);

    this.initialized = true;
  }

  private static addMockModule(
    name: string, 
    currentVersion: string, 
    releases: Array<{ version: string; supported: boolean }>,
    dependencies: Array<{ name: string; version_requirement: string }> = []
  ) {
    const [owner, moduleName] = name.split('-');
    const data = {
      name: name,
      slug: name,
      owner: { username: owner, slug: owner },
      current_release: {
        version: currentVersion,
        metadata: {
          name: name,
          version: currentVersion,
          dependencies: dependencies
        },
        created_at: new Date().toISOString()
      },
      releases: releases.map((r, index) => ({
        version: r.version,
        created_at: new Date(Date.now() - index * 30 * 24 * 60 * 60 * 1000).toISOString(),
        supported: r.supported
      }))
    };
    this.mockData.set(name, data);
  }

  static async getModuleInfo(moduleName: string): Promise<any> {
    this.initialize();
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));

    const data = this.mockData.get(moduleName);
    if (!data) {
      throw new Error(`Module ${moduleName} not found`);
    }

    return data;
  }

  static async getModuleReleases(moduleName: string): Promise<any[]> {
    const moduleInfo = await this.getModuleInfo(moduleName);
    return moduleInfo.releases || [];
  }

  static async getLatestVersion(moduleName: string): Promise<string> {
    const moduleInfo = await this.getModuleInfo(moduleName);
    return moduleInfo.current_release.version;
  }

  static async getSafeUpdateVersion(moduleName: string, currentVersion: string): Promise<string | null> {
    const moduleInfo = await this.getModuleInfo(moduleName);
    const releases = moduleInfo.releases || [];
    
    // Find safe update version (same major version)
    const [currentMajor] = currentVersion.split('.');
    const safeReleases = releases
      .filter((r: any) => r.supported && r.version.startsWith(`${currentMajor}.`))
      .sort((a: any, b: any) => b.version.localeCompare(a.version, undefined, { numeric: true }));

    return safeReleases.length > 0 ? safeReleases[0].version : null;
  }

  static reset() {
    this.mockData.clear();
    this.initialized = false;
  }
}
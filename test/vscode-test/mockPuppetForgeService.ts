import * as fs from 'node:fs';
import * as path from 'node:path';
import { ModuleNameUtils } from '../../src/utils/moduleNameUtils';

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

// Use global storage to prevent issues with multiple instances
declare global {
  var __mockPuppetForgeData: Map<string, any> | undefined;
  var __mockPuppetForgeInitialized: boolean | undefined;
}

export class MockPuppetForgeService {
  private static get mockData(): Map<string, any> {
    if (!global.__mockPuppetForgeData) {
      global.__mockPuppetForgeData = new Map();
    }
    return global.__mockPuppetForgeData;
  }

  private static get initialized(): boolean {
    return global.__mockPuppetForgeInitialized || false;
  }

  private static set initialized(value: boolean) {
    global.__mockPuppetForgeInitialized = value;
  }

  static initialize() {
    if (this.initialized) {return;}

    console.log('MockPuppetForgeService: Initializing...');
    // Load mock data from fixtures
    // When compiled, __dirname points to out/test/vscode-test
    // We need to find the actual project root, not just go up directories
    // Since the 'out' directory might have a package.json, we need a more robust approach
    let fixturesDir: string;
    
    // Try multiple approaches to find the fixtures
    const possiblePaths = [
      // If we're in the source directory during development
      path.resolve(__dirname, 'fixtures/api-responses'),
      // If we're in out/test/vscode-test (compiled)
      path.resolve(__dirname, '../../../test/vscode-test/fixtures/api-responses'),
      // If the project structure is different
      path.resolve(__dirname, '../../../../puppetfile-depgraph/test/vscode-test/fixtures/api-responses'),
      // Absolute fallback
      '/mnt/d/CodingProjects/puppetfile-depgraph/test/vscode-test/fixtures/api-responses'
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        fixturesDir = possiblePath;
        break;
      }
    }
    
    if (!fixturesDir!) {
      console.error('Could not find fixtures directory. Tried:', possiblePaths);
      throw new Error('Fixtures directory not found');
    }
    console.log(`Looking for fixtures in: ${fixturesDir}`);
    const files = [
      'puppetlabs-stdlib.json', 'puppetlabs-concat.json', 'puppetlabs-firewall.json',
      'hardening-os_hardening.json', 'puppet-archive.json', 'puppet-cron.json',
      'puppet-elasticsearch.json', 'puppet-fail2ban.json', 'puppet-grafana.json',
      'puppet-logrotate.json', 'puppet-nodejs.json', 'puppet-prometheus.json',
      'puppet-python.json', 'puppet-rabbitmq.json', 'puppet-redis.json',
      'puppet-selinux.json', 'puppetlabs-ntp.json', 'puppetlabs-postgresql.json',
      'sensu-sensu.json', 'puppet-nginx.json'
    ];

    for (const file of files) {
      try {
        const filePath = path.join(fixturesDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const moduleName = path.basename(file, '.json');
        this.mockData.set(moduleName, data);
        console.log(`Loaded: ${moduleName}`);
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
    // Force re-initialization if no data is loaded
    if (this.mockData.size === 0) {
      this.initialized = false;
    }
    this.initialize();
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));

    let data = this.mockData.get(moduleName);
    
    // If not found, try alternative naming conventions
    if (!data) {
      // Use centralized variant generation
      const variants = ModuleNameUtils.getModuleNameVariants(moduleName);
      for (const variant of variants) {
        data = this.mockData.get(variant);
        if (data) break;
      }
    }
    
    if (!data) {
      console.error(`Module ${moduleName} not found. Map size: ${this.mockData.size}, Available: ${Array.from(this.mockData.keys()).slice(0, 10).join(', ')}...`);
      
      // Fallback: create minimal mock data for any missing module
      console.log(`Creating fallback data for ${moduleName}`);
      data = {
        name: moduleName,
        slug: moduleName,
        owner: { username: 'test', slug: 'test' },
        current_release: {
          version: '1.0.0',
          metadata: {
            name: moduleName,
            version: '1.0.0',
            dependencies: []
          },
          created_at: new Date().toISOString()
        },
        releases: [
          {
            version: '1.0.0',
            created_at: new Date().toISOString(),
            supported: true,
            metadata: { dependencies: [] }
          }
        ]
      };
      this.mockData.set(moduleName, data);
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
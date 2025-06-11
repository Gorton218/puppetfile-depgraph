import * as assert from 'assert';
import { suite, test } from 'mocha';
import { VersionCompatibilityService } from '../versionCompatibilityService';
import { PuppetForgeService } from '../puppetForgeService';
import { PuppetModule } from '../puppetfileParser';

suite('VersionCompatibilityService', () => {
    
    // Mock release data
    const mockReleases: Record<string, Record<string, any>> = {
        'puppetlabs/stdlib': {
            '8.5.0': {
                version: '8.5.0',
                metadata: {
                    dependencies: []
                }
            },
            '9.0.0': {
                version: '9.0.0',
                metadata: {
                    dependencies: []
                }
            },
            '8.0.0': {
                version: '8.0.0',
                metadata: {
                    dependencies: []
                }
            }
        },
        'puppetlabs/concat': {
            '7.0.0': {
                version: '7.0.0',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.1 < 9.0.0' }
                    ]
                }
            }
        }
    };
    
    // Override PuppetForgeService methods for testing
    const originalGetReleaseForVersion = PuppetForgeService.getReleaseForVersion;
    const originalGetModuleReleases = PuppetForgeService.getModuleReleases;
    
    setup(() => {
        // Mock PuppetForgeService methods
        PuppetForgeService.getReleaseForVersion = async (moduleName: string, version: string) => {
            const moduleReleases = mockReleases[moduleName];
            if (moduleReleases && moduleReleases[version]) {
                return moduleReleases[version];
            }
            return null;
        };
        
        PuppetForgeService.getModuleReleases = async (moduleName: string) => {
            const moduleReleases = mockReleases[moduleName];
            if (moduleReleases) {
                return Object.values(moduleReleases);
            }
            return [];
        };
    });
    
    teardown(() => {
        // Restore original methods
        PuppetForgeService.getReleaseForVersion = originalGetReleaseForVersion;
        PuppetForgeService.getModuleReleases = originalGetModuleReleases;
    });
    
    test('should detect compatible version when no conflicts exist', async () => {
        const targetModule: PuppetModule = {
            name: 'puppetlabs/stdlib',
            source: 'forge',
            version: '8.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'puppetlabs/concat',
                source: 'forge',
                version: '7.0.0',
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '8.5.0',
            allModules
        );
        
        assert.strictEqual(result.version, '8.5.0');
        assert.strictEqual(result.isCompatible, true);
        assert.strictEqual(result.conflicts, undefined);
    });
    
    test('should detect conflicting version when dependency constraint is violated', async () => {
        const targetModule: PuppetModule = {
            name: 'puppetlabs/stdlib',
            source: 'forge',
            version: '8.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'puppetlabs/concat',
                source: 'forge',
                version: '7.0.0',
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '9.0.0',
            allModules
        );
        
        assert.strictEqual(result.version, '9.0.0');
        assert.strictEqual(result.isCompatible, false);
        assert.ok(result.conflicts);
        assert.strictEqual(result.conflicts.length, 1);
        assert.strictEqual(result.conflicts[0].moduleName, 'puppetlabs/concat');
        assert.strictEqual(result.conflicts[0].currentVersion, '7.0.0');
        assert.strictEqual(result.conflicts[0].requirement, '>= 4.13.1 < 9.0.0');
    });
    
    test('should handle modules with no dependencies', async () => {
        const targetModule: PuppetModule = {
            name: 'puppetlabs/stdlib',
            source: 'forge',
            version: '8.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [targetModule];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '9.0.0',
            allModules
        );
        
        assert.strictEqual(result.isCompatible, true);
        assert.strictEqual(result.conflicts, undefined);
    });
    
    test('should handle git modules (skip them)', async () => {
        const targetModule: PuppetModule = {
            name: 'puppetlabs/stdlib',
            source: 'forge',
            version: '8.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'example/git-module',
                source: 'git',
                gitUrl: 'https://github.com/example/git-module.git',
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '9.0.0',
            allModules
        );
        
        assert.strictEqual(result.isCompatible, true);
        assert.strictEqual(result.conflicts, undefined);
    });
    
    test('should normalize module names correctly', async () => {
        // Add a module with slash format to mock data
        mockReleases['puppetlabs/apache'] = {
            '5.0.0': {
                version: '5.0.0',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs-stdlib', version_requirement: '>= 4.0.0 < 9.0.0' }
                    ]
                }
            }
        };
        
        const targetModule: PuppetModule = {
            name: 'puppetlabs/stdlib',
            source: 'forge',
            version: '8.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'puppetlabs/apache',
                source: 'forge',
                version: '5.0.0',
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '9.0.0',
            allModules
        );
        
        assert.strictEqual(result.isCompatible, false);
        assert.ok(result.conflicts);
        assert.strictEqual(result.conflicts.length, 1);
    });
});
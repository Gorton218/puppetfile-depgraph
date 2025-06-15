import { VersionCompatibilityService } from '../versionCompatibilityService';
import { PuppetForgeService } from '../puppetForgeService';
import { GitMetadataService, GitModuleMetadata } from '../gitMetadataService';
import { PuppetModule } from '../puppetfileParser';

describe('VersionCompatibilityService', () => {
    
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
    const originalGetModuleMetadataWithFallback = GitMetadataService.getModuleMetadataWithFallback;
    
    beforeEach(() => {
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
        
        // Mock GitMetadataService
        GitMetadataService.getModuleMetadataWithFallback = async (gitUrl: string, ref?: string): Promise<GitModuleMetadata | null> => {
            // Mock echocat/graphite module metadata
            if (gitUrl.includes('echocat/puppet-graphite')) {
                return {
                    name: 'echocat-graphite',
                    version: '1.0.0',
                    author: 'echocat',
                    summary: 'Puppet module for Graphite',
                    license: 'Apache-2.0',
                    source: 'https://github.com/echocat/puppet-graphite',
                    dependencies: [
                        { name: 'puppetlabs-stdlib', version_requirement: '>= 4.13.1 < 7.0.0' }
                    ]
                };
            }
            return null;
        };
    });
    
    afterEach(() => {
        // Restore original methods
        PuppetForgeService.getReleaseForVersion = originalGetReleaseForVersion;
        PuppetForgeService.getModuleReleases = originalGetModuleReleases;
        GitMetadataService.getModuleMetadataWithFallback = originalGetModuleMetadataWithFallback;
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
        
        expect(result.version).toBe('8.5.0');
        expect(result.isCompatible).toBe(true);
        expect(result.conflicts).toBeUndefined();
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
        
        expect(result.version).toBe('9.0.0');
        expect(result.isCompatible).toBe(false);
        expect(result.conflicts).toBeTruthy();
        expect(result.conflicts!.length).toBe(1);
        expect(result.conflicts![0].moduleName).toBe('puppetlabs/concat');
        expect(result.conflicts![0].currentVersion).toBe('7.0.0');
        expect(result.conflicts![0].requirement).toBe('>= 4.13.1 < 9.0.0');
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
        
        expect(result.isCompatible).toBe(true);
        expect(result.conflicts).toBeUndefined();
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
        
        expect(result.isCompatible).toBe(true);
        expect(result.conflicts).toBeUndefined();
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
        
        expect(result.isCompatible).toBe(false);
        expect(result.conflicts).toBeTruthy();
        expect(result.conflicts!.length).toBe(1);
    });

    test('should handle target module with dependencies', async () => {
        // Add target module with dependencies
        mockReleases['puppetlabs/firewall'] = {
            '3.0.0': {
                version: '3.0.0',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 6.0.0 < 9.0.0' }
                    ]
                }
            }
        };
        
        const targetModule: PuppetModule = {
            name: 'puppetlabs/firewall',
            source: 'forge',
            version: '2.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'puppetlabs/stdlib',
                source: 'forge',
                version: '5.0.0', // This doesn't satisfy >= 6.0.0
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '3.0.0',
            allModules
        );
        
        expect(result.isCompatible).toBe(false);
        expect(result.conflicts).toBeTruthy();
        expect(result.conflicts!.length).toBe(1);
        expect(result.conflicts![0].moduleName).toBe('puppetlabs/stdlib');
        expect(result.conflicts![0].currentVersion).toBe('5.0.0');
        expect(result.conflicts![0].requirement).toBe('>= 6.0.0 < 9.0.0');
    });

    test('should handle modules without specified version (latest)', async () => {
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
                // No version specified - should use latest
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '9.0.0',
            allModules
        );
        
        expect(result.isCompatible).toBe(false);
        expect(result.conflicts).toBeTruthy();
        expect(result.conflicts!.length).toBe(1);
        expect(result.conflicts![0].currentVersion).toBe('latest');
    });

    test('should handle modules with no dependencies returned from API', async () => {
        // Mock a module that returns null from getReleaseForVersion
        const targetModule: PuppetModule = {
            name: 'example/unknown',
            source: 'forge',
            version: '1.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'puppetlabs/stdlib',
                source: 'forge',
                version: '8.0.0',
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '2.0.0',
            allModules
        );
        
        expect(result.isCompatible).toBe(true);
        expect(result.conflicts).toBeUndefined();
    });

    test('should handle module without metadata.dependencies', async () => {
        // Add a module with no dependencies metadata
        mockReleases['example/nodeps'] = {
            '1.0.0': {
                version: '1.0.0',
                metadata: {}
            }
        };
        
        const targetModule: PuppetModule = {
            name: 'example/nodeps',
            source: 'forge',
            version: '1.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'puppetlabs/stdlib',
                source: 'forge',
                version: '8.0.0',
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '1.0.0',
            allModules
        );
        
        expect(result.isCompatible).toBe(true);
        expect(result.conflicts).toBeUndefined();
    });

    test('should handle complex version requirements', async () => {
        // Add module with complex version requirements
        mockReleases['example/complex'] = {
            '2.0.0': {
                version: '2.0.0',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 7.0.0 <= 8.0.0' }
                    ]
                }
            }
        };
        
        const targetModule: PuppetModule = {
            name: 'example/complex',
            source: 'forge',
            version: '1.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'puppetlabs/stdlib',
                source: 'forge',
                version: '8.5.0', // This doesn't satisfy <= 8.0.0
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '2.0.0',
            allModules
        );
        
        expect(result.isCompatible).toBe(false);
        expect(result.conflicts).toBeTruthy();
        expect(result.conflicts!.length).toBe(1);
        expect(result.conflicts![0].requirement).toBe('>= 7.0.0 <= 8.0.0');
    });

    test('should handle module name normalization edge cases', async () => {
        // Test module with dash format that needs conversion
        const dashFormatName = 'puppetlabs-stdlib';
        const slashFormatName = 'puppetlabs/stdlib';
        
        mockReleases['example/dash-module'] = {
            '1.0.0': {
                version: '1.0.0',
                metadata: {
                    dependencies: [
                        { name: dashFormatName, version_requirement: '>= 8.0.0' }
                    ]
                }
            }
        };
        
        const targetModule: PuppetModule = {
            name: 'example/dash-module',
            source: 'forge',
            version: '1.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: slashFormatName,
                source: 'forge',
                version: '7.0.0', // This doesn't satisfy >= 8.0.0
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '1.0.0',
            allModules
        );
        
        expect(result.isCompatible).toBe(false);
        expect(result.conflicts).toBeTruthy();
        expect(result.conflicts!.length).toBe(1);
    });

    test('should handle modules that depend on the target module', async () => {
        // Create a scenario where another module depends on the target
        mockReleases['example/dependent'] = {
            '1.0.0': {
                version: '1.0.0',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '< 8.0.0' }
                    ]
                }
            }
        };
        
        const targetModule: PuppetModule = {
            name: 'puppetlabs/stdlib',
            source: 'forge',
            version: '7.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'example/dependent',
                source: 'forge',
                version: '1.0.0',
                line: 2
            }
        ];
        
        // Try to upgrade stdlib to 8.0.0, which violates the < 8.0.0 requirement
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '8.0.0',
            allModules
        );
        
        expect(result.isCompatible).toBe(false);
        expect(result.conflicts).toBeTruthy();
        expect(result.conflicts!.length).toBe(1);
        expect(result.conflicts![0].moduleName).toBe('example/dependent');
        expect(result.conflicts![0].requirement).toBe('< 8.0.0');
    });

    test('should handle empty releases array', async () => {
        // Mock a module that returns empty releases array
        mockReleases['example/empty'] = {};
        
        const targetModule: PuppetModule = {
            name: 'puppetlabs/stdlib',
            source: 'forge',
            version: '8.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'example/empty',
                source: 'forge',
                // No version, will try to get latest
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '9.0.0',
            allModules
        );
        
        expect(result.isCompatible).toBe(true);
        expect(result.conflicts).toBeUndefined();
    });

    test('should detect conflicts from git module dependencies', async () => {
        // Test case for the specific issue: git modules should be considered in conflict analysis
        const targetModule: PuppetModule = {
            name: 'puppetlabs/stdlib',
            source: 'forge',
            version: '9.4.1',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'echocat/graphite',
                source: 'git',
                gitUrl: 'https://github.com/echocat/puppet-graphite.git',
                gitRef: 'master',
                line: 2
            }
        ];
        
        // Try to upgrade stdlib to 9.0.0, which violates git module's requirement (< 7.0.0)
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '9.0.0',
            allModules
        );
        
        expect(result.isCompatible).toBe(false);
        expect(result.conflicts).toBeTruthy();
        expect(result.conflicts!.length).toBe(1);
        expect(result.conflicts![0].moduleName).toBe('echocat/graphite');
        expect(result.conflicts![0].currentVersion).toBe('master');
        expect(result.conflicts![0].requirement).toBe('>= 4.13.1 < 7.0.0');
    });

    test('should handle git modules with no dependencies', async () => {
        const targetModule: PuppetModule = {
            name: 'puppetlabs/stdlib',
            source: 'forge',
            version: '8.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'example/git-module-no-deps',
                source: 'git',
                gitUrl: 'https://github.com/example/git-module-no-deps.git',
                gitRef: 'main',
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '9.0.0',
            allModules
        );
        
        expect(result.isCompatible).toBe(true);
        expect(result.conflicts).toBeUndefined();
    });

    test('should handle git modules without metadata', async () => {
        const targetModule: PuppetModule = {
            name: 'puppetlabs/stdlib',
            source: 'forge',
            version: '8.0.0',
            line: 1
        };
        
        const allModules: PuppetModule[] = [
            targetModule,
            {
                name: 'example/git-module-no-metadata',
                source: 'git',
                gitUrl: 'https://github.com/example/git-module-no-metadata.git',
                gitRef: 'main',
                line: 2
            }
        ];
        
        const result = await VersionCompatibilityService.checkVersionCompatibility(
            targetModule,
            '9.0.0',
            allModules
        );
        
        expect(result.isCompatible).toBe(true);
        expect(result.conflicts).toBeUndefined();
    });
});
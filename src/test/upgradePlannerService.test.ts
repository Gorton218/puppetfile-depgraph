import { UpgradePlannerService, UpgradeCandidate } from '../services/upgradePlannerService';
import { PuppetModule } from '../puppetfileParser';
import { PuppetForgeService } from '../puppetForgeService';
import { VersionCompatibilityService } from '../versionCompatibilityService';

// Mock the dependencies
jest.mock('../puppetForgeService');
jest.mock('../versionCompatibilityService');

const mockPuppetForgeService = PuppetForgeService as jest.Mocked<typeof PuppetForgeService>;
const mockVersionCompatibilityService = VersionCompatibilityService as jest.Mocked<typeof VersionCompatibilityService>;

describe('UpgradePlannerService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createUpgradePlan', () => {
        test('should create upgrade plan with upgradeable modules', async () => {
            const modules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 },
                { name: 'puppetlabs/apache', version: '5.0.0', source: 'forge', line: 2 }
            ];

            // Mock Forge service responses
            mockPuppetForgeService.getModule.mockImplementation(async (name) => {
                if (name === 'puppetlabs/stdlib') {
                    return {
                        name: 'puppetlabs-stdlib',
                        slug: 'puppetlabs-stdlib',
                        owner: { username: 'puppetlabs', slug: 'puppetlabs' },
                        downloads: 1000,
                        feedback_score: 5,
                        releases: [
                            { 
                                version: '9.0.0', 
                                created_at: '2023-01-01',
                                updated_at: '2023-01-01',
                                downloads: 100,
                                file_size: 1000,
                                file_md5: 'abc123',
                                file_uri: 'http://example.com',
                                metadata: {} 
                            },
                            { 
                                version: '8.5.0', 
                                created_at: '2023-01-01',
                                updated_at: '2023-01-01',
                                downloads: 100,
                                file_size: 1000,
                                file_md5: 'abc123',
                                file_uri: 'http://example.com',
                                metadata: {} 
                            },
                            { 
                                version: '8.0.0', 
                                created_at: '2023-01-01',
                                updated_at: '2023-01-01',
                                downloads: 100,
                                file_size: 1000,
                                file_md5: 'abc123',
                                file_uri: 'http://example.com',
                                metadata: {} 
                            }
                        ]
                    };
                }
                if (name === 'puppetlabs/apache') {
                    return {
                        name: 'puppetlabs-apache',
                        slug: 'puppetlabs-apache',
                        owner: { username: 'puppetlabs', slug: 'puppetlabs' },
                        downloads: 1000,
                        feedback_score: 5,
                        releases: [
                            { 
                                version: '6.0.0', 
                                created_at: '2023-01-01',
                                updated_at: '2023-01-01',
                                downloads: 100,
                                file_size: 1000,
                                file_md5: 'abc123',
                                file_uri: 'http://example.com',
                                metadata: {} 
                            },
                            { 
                                version: '5.5.0', 
                                created_at: '2023-01-01',
                                updated_at: '2023-01-01',
                                downloads: 100,
                                file_size: 1000,
                                file_md5: 'abc123',
                                file_uri: 'http://example.com',
                                metadata: {} 
                            },
                            { 
                                version: '5.0.0', 
                                created_at: '2023-01-01',
                                updated_at: '2023-01-01',
                                downloads: 100,
                                file_size: 1000,
                                file_md5: 'abc123',
                                file_uri: 'http://example.com',
                                metadata: {} 
                            }
                        ]
                    };
                }
                return null;
            });

            // Mock compatibility checks
            mockVersionCompatibilityService.checkVersionCompatibility.mockResolvedValue({
                version: '9.0.0',
                isCompatible: true
            });

            const upgradePlan = await UpgradePlannerService.createUpgradePlan(modules);

            expect(upgradePlan.totalModules).toBe(2);
            expect(upgradePlan.totalUpgradeable).toBe(2);
            expect(upgradePlan.hasConflicts).toBe(false);
            expect(upgradePlan.candidates).toHaveLength(2);
            
            // Check stdlib upgrade
            const stdlibCandidate = upgradePlan.candidates.find(c => c.module.name === 'puppetlabs/stdlib');
            expect(stdlibCandidate).toBeDefined();
            expect(stdlibCandidate!.currentVersion).toBe('8.0.0');
            expect(stdlibCandidate!.maxSafeVersion).toBe('9.0.0');
            expect(stdlibCandidate!.isUpgradeable).toBe(true);
        });

        test('should handle blocked modules with conflicts', async () => {
            const modules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', version: '7.0.0', source: 'forge', line: 1 }
            ];

            mockPuppetForgeService.getModule.mockResolvedValue({
                name: 'puppetlabs-stdlib',
                slug: 'puppetlabs-stdlib',
                owner: { username: 'puppetlabs', slug: 'puppetlabs' },
                downloads: 1000,
                feedback_score: 5,
                releases: [
                    { 
                        version: '9.0.0', 
                        created_at: '2023-01-01',
                        updated_at: '2023-01-01',
                        downloads: 100,
                        file_size: 1000,
                        file_md5: 'abc123',
                        file_uri: 'http://example.com',
                        metadata: {} 
                    },
                    { 
                        version: '8.0.0', 
                        created_at: '2023-01-01',
                        updated_at: '2023-01-01',
                        downloads: 100,
                        file_size: 1000,
                        file_md5: 'abc123',
                        file_uri: 'http://example.com',
                        metadata: {} 
                    },
                    { 
                        version: '7.0.0', 
                        created_at: '2023-01-01',
                        updated_at: '2023-01-01',
                        downloads: 100,
                        file_size: 1000,
                        file_md5: 'abc123',
                        file_uri: 'http://example.com',
                        metadata: {} 
                    }
                ]
            });

            // Mock compatibility checks - none are compatible
            mockVersionCompatibilityService.checkVersionCompatibility.mockResolvedValue({
                version: '9.0.0',
                isCompatible: false,
                conflicts: [
                    {
                        moduleName: 'puppetlabs/apache',
                        currentVersion: '5.0.0',
                        requirement: '>= 8.0.0'
                    }
                ]
            });

            const upgradePlan = await UpgradePlannerService.createUpgradePlan(modules);

            expect(upgradePlan.totalUpgradeable).toBe(0);
            expect(upgradePlan.hasConflicts).toBe(true);
            
            const candidate = upgradePlan.candidates[0];
            expect(candidate.isUpgradeable).toBe(false);
            expect(candidate.blockedBy).toEqual(['puppetlabs/apache']);
            expect(candidate.conflicts).toBeDefined();
        });

        test('should handle modules without versions', async () => {
            const modules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', source: 'forge', line: 1 } // No version
            ];

            // Mock Forge service to return available versions
            mockPuppetForgeService.getModule.mockResolvedValue({
                name: 'puppetlabs-stdlib',
                slug: 'puppetlabs-stdlib',
                owner: { username: 'puppetlabs', slug: 'puppetlabs' },
                downloads: 1000,
                feedback_score: 5,
                releases: [
                    { 
                        version: '9.0.0', 
                        created_at: '2023-01-01',
                        updated_at: '2023-01-01',
                        downloads: 100,
                        file_size: 1000,
                        file_md5: 'abc123',
                        file_uri: 'http://example.com',
                        metadata: {} 
                    }
                ]
            });

            // Mock version compatibility to always return compatible
            mockVersionCompatibilityService.checkVersionCompatibility.mockResolvedValue({
                version: '9.0.0',
                isCompatible: true,
                conflicts: []
            });

            const upgradePlan = await UpgradePlannerService.createUpgradePlan(modules);

            expect(upgradePlan.totalModules).toBe(1); // Now included in analysis
            expect(upgradePlan.candidates).toHaveLength(1);
            expect(upgradePlan.candidates[0].currentVersion).toBe('unversioned');
            expect(upgradePlan.candidates[0].isUpgradeable).toBe(true); // Can be upgraded to a specific version
            expect(upgradePlan.candidates[0].maxSafeVersion).toBe('9.0.0');
        });

        test('should skip git modules', async () => {
            const modules: PuppetModule[] = [
                { name: 'custom/module', source: 'git', line: 1, gitUrl: 'https://github.com/example/module.git' }
            ];

            const upgradePlan = await UpgradePlannerService.createUpgradePlan(modules);

            expect(upgradePlan.totalModules).toBe(0);
            expect(upgradePlan.candidates).toHaveLength(0);
        });
    });

    describe('generateUpgradeSummary', () => {
        test('should generate summary with upgradeable and blocked modules', () => {
            const upgradePlan = {
                candidates: [
                    {
                        module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 } as PuppetModule,
                        currentVersion: '8.0.0',
                        maxSafeVersion: '9.0.0',
                        availableVersions: ['9.0.0', '8.5.0', '8.0.0'],
                        isUpgradeable: true
                    },
                    {
                        module: { name: 'puppetlabs/apache', version: '5.0.0', source: 'forge', line: 2 } as PuppetModule,
                        currentVersion: '5.0.0',
                        maxSafeVersion: '5.0.0',
                        availableVersions: ['6.0.0', '5.5.0', '5.0.0'],
                        isUpgradeable: false,
                        blockedBy: ['puppetlabs/concat'],
                        conflicts: [{
                            moduleName: 'puppetlabs/concat',
                            currentVersion: '6.0.0',
                            requirement: '>= 7.0.0'
                        }]
                    }
                ] as UpgradeCandidate[],
                totalUpgradeable: 1,
                totalModules: 2,
                totalGitModules: 0,
                hasConflicts: true,
                gitModules: []
            };

            const summary = UpgradePlannerService.generateUpgradeSummary(upgradePlan);

            expect(summary).toContain('# Upgrade Plan Summary');
            expect(summary).toContain('**Total Forge Modules:** 2');
            expect(summary).toContain('**Upgradeable:** 1');
            expect(summary).toContain('**Blocked:** 1');
            expect(summary).toContain('**Has Conflicts:** Yes');
            expect(summary).toContain('✅ Upgradeable Modules (1)');
            expect(summary).toContain('⚠️ Blocked Modules (1)');
            expect(summary).toContain('- **puppetlabs/stdlib**: 8.0.0 → 9.0.0');
            expect(summary).toContain('- **puppetlabs/apache**: 5.0.0 (blocked by: puppetlabs/concat)');
        });

        test('should handle empty upgrade plan', () => {
            const upgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 0,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            const summary = UpgradePlannerService.generateUpgradeSummary(upgradePlan);

            expect(summary).toContain('**Total Forge Modules:** 0');
            expect(summary).toContain('**Upgradeable:** 0');
        });
        
        test('should include git modules in summary', () => {
            const gitModule: PuppetModule = {
                name: 'mycompany/custom',
                source: 'git',
                gitUrl: 'https://github.com/mycompany/custom.git',
                gitRef: 'v1.0.0',
                line: 1
            };
            
            const upgradePlan = {
                candidates: [],
                totalUpgradeable: 0,
                totalModules: 0,
                totalGitModules: 1,
                hasConflicts: false,
                gitModules: [gitModule]
            };

            const summary = UpgradePlannerService.generateUpgradeSummary(upgradePlan);

            expect(summary).toContain('**Git Modules:** 1');
            expect(summary).toContain('📎 Git Modules (1)');
            expect(summary).toContain('- **mycompany/custom** @ v1.0.0');
            expect(summary).toContain('💡 **Note:** Git modules must be manually updated');
            expect(summary).toContain('https://github.com/mycompany/custom.git');
            expect(summary).toContain('**Has Conflicts:** No');
        });
    });

    describe('applyUpgradesToContent', () => {
        test('should apply upgrades to Puppetfile content', () => {
            const originalContent = `forge 'https://forgeapi.puppet.com'

mod 'puppetlabs/stdlib', '8.0.0'
mod 'puppetlabs/apache', '5.0.0'
mod 'puppetlabs/concat', '6.0.0'`;

            const upgradePlan = {
                candidates: [
                    {
                        module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 3 } as PuppetModule,
                        currentVersion: '8.0.0',
                        maxSafeVersion: '9.0.0',
                        availableVersions: [],
                        isUpgradeable: true
                    },
                    {
                        module: { name: 'puppetlabs/apache', version: '5.0.0', source: 'forge', line: 4 } as PuppetModule,
                        currentVersion: '5.0.0',
                        maxSafeVersion: '5.5.0',
                        availableVersions: [],
                        isUpgradeable: true
                    },
                    {
                        module: { name: 'puppetlabs/concat', version: '6.0.0', source: 'forge', line: 5 } as PuppetModule,
                        currentVersion: '6.0.0',
                        maxSafeVersion: '6.0.0',
                        availableVersions: [],
                        isUpgradeable: false
                    }
                ] as UpgradeCandidate[],
                totalUpgradeable: 2,
                totalModules: 3,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            const modifiedContent = UpgradePlannerService.applyUpgradesToContent(originalContent, upgradePlan);

            expect(modifiedContent).toContain("mod 'puppetlabs/stdlib', '9.0.0'");
            expect(modifiedContent).toContain("mod 'puppetlabs/apache', '5.5.0'");
            expect(modifiedContent).toContain("mod 'puppetlabs/concat', '6.0.0'"); // Unchanged
        });

        test('should handle content with no upgrades', () => {
            const originalContent = `forge 'https://forgeapi.puppet.com'
mod 'puppetlabs/stdlib', '8.0.0'`;

            const upgradePlan = {
                candidates: [{
                    module: { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 2 } as PuppetModule,
                    currentVersion: '8.0.0',
                    maxSafeVersion: '8.0.0',
                    availableVersions: [],
                    isUpgradeable: false
                }] as UpgradeCandidate[],
                totalUpgradeable: 0,
                totalModules: 1,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            const modifiedContent = UpgradePlannerService.applyUpgradesToContent(originalContent, upgradePlan);

            expect(modifiedContent).toBe(originalContent); // No changes
        });
    });

    describe('version comparison utilities', () => {
        test('should correctly compare versions', () => {
            // These are private methods, so we'll test them indirectly through the public API
            const modules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge', line: 1 }
            ];

            mockPuppetForgeService.getModule.mockResolvedValue({
                name: 'puppetlabs-stdlib',
                slug: 'puppetlabs-stdlib',
                owner: { username: 'puppetlabs', slug: 'puppetlabs' },
                downloads: 1000,
                feedback_score: 5,
                releases: [
                    { 
                        version: '9.0.0', 
                        created_at: '2023-01-01',
                        updated_at: '2023-01-01',
                        downloads: 100,
                        file_size: 1000,
                        file_md5: 'abc123',
                        file_uri: 'http://example.com',
                        metadata: {} 
                    },
                    { 
                        version: '8.5.0', 
                        created_at: '2023-01-01',
                        updated_at: '2023-01-01',
                        downloads: 100,
                        file_size: 1000,
                        file_md5: 'abc123',
                        file_uri: 'http://example.com',
                        metadata: {} 
                    },
                    { 
                        version: '8.0.0', 
                        created_at: '2023-01-01',
                        updated_at: '2023-01-01',
                        downloads: 100,
                        file_size: 1000,
                        file_md5: 'abc123',
                        file_uri: 'http://example.com',
                        metadata: {} 
                    },
                    { 
                        version: '7.5.0', 
                        created_at: '2023-01-01',
                        updated_at: '2023-01-01',
                        downloads: 100,
                        file_size: 1000,
                        file_md5: 'abc123',
                        file_uri: 'http://example.com',
                        metadata: {} 
                    }
                ]
            });

            mockVersionCompatibilityService.checkVersionCompatibility.mockImplementation(async (module, version) => {
                // Only 8.5.0 is compatible, 9.0.0 has conflicts
                return {
                    version,
                    isCompatible: version === '8.5.0'
                };
            });

            return UpgradePlannerService.createUpgradePlan(modules).then(plan => {
                const candidate = plan.candidates[0];
                expect(candidate.maxSafeVersion).toBe('8.5.0'); // Should find highest compatible version
                expect(candidate.isUpgradeable).toBe(true); // 8.5.0 > 8.0.0
            });
        });
    });
});
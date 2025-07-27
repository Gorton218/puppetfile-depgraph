import { ForgeModule, ForgeVersion } from '../../src/services/puppetForgeService';

describe('ForgeModule Class', () => {
    
    beforeEach(() => {
        // Clear cache before each test
        ForgeModule.clearCache();
    });
    
    afterEach(() => {
        // Clean up after each test
        ForgeModule.clearCache();
    });
    
    describe('Factory Method and Caching', () => {
        test('should create new ForgeModule instances', () => {
            const module = ForgeModule.create('puppetlabs/stdlib', {
                current_release: {
                    version: '8.5.0',
                    created_at: '2023-01-01',
                    metadata: { dependencies: [] }
                },
                releases: [],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            expect(module).toBeInstanceOf(ForgeModule);
            expect(module.originalName).toBe('puppetlabs/stdlib');
            expect(module.normalizedName).toBe('puppetlabs-stdlib');
            expect(module.authorName).toBe('puppetlabs');
            expect(module.moduleName).toBe('stdlib');
        });
        
        test('should return cached instance for equivalent names', () => {
            const module1 = ForgeModule.create('puppetlabs/stdlib', {
                releases: [],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            const module2 = ForgeModule.create('puppetlabs-stdlib', {
                releases: [],
                downloads: 2000, // Different data
                feedback_score: 5.0
            });
            
            // Should be the same instance
            expect(module1).toBe(module2);
            
            // Should update data
            expect(module1.downloads).toBe(2000);
            expect(module1.feedback_score).toBe(5.0);
        });
        
        test('should cache under all variants', () => {
            const module = ForgeModule.create('puppetlabs/puppet-nginx', {
                releases: [],
                downloads: 500,
                feedback_score: 4.0
            });
            
            // Should find via different name variants
            expect(ForgeModule.getCached('puppet/nginx')).toBe(module);
            expect(ForgeModule.getCached('puppet-nginx')).toBe(module);
            expect(ForgeModule.getCached('puppetlabs-puppet-nginx')).toBe(module);
        });
        
        test('should check cache status correctly', () => {
            expect(ForgeModule.isCached('puppetlabs/stdlib')).toBe(false);
            
            ForgeModule.create('puppetlabs/stdlib', {
                releases: [],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            expect(ForgeModule.isCached('puppetlabs/stdlib')).toBe(true);
            expect(ForgeModule.isCached('puppetlabs-stdlib')).toBe(true);
        });
        
        test('should clear cache properly', () => {
            ForgeModule.create('puppetlabs/stdlib', {
                releases: [],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            expect(ForgeModule.isCached('puppetlabs/stdlib')).toBe(true);
            
            ForgeModule.clearCache();
            
            expect(ForgeModule.isCached('puppetlabs/stdlib')).toBe(false);
        });
    });
    
    describe('Module Name Normalization', () => {
        test('should normalize slash format correctly', () => {
            const module = ForgeModule.create('puppetlabs/stdlib', {
                releases: [],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            expect(module.slashFormat).toBe('puppetlabs/stdlib');
            expect(module.dashFormat).toBe('puppetlabs-stdlib');
            expect(module.normalizedName).toBe('puppetlabs-stdlib');
            expect(module.name).toBe('puppetlabs/stdlib'); // API name
            expect(module.slug).toBe('puppetlabs-stdlib'); // API slug
        });
        
        test('should normalize dash format correctly', () => {
            const module = ForgeModule.create('puppetlabs-stdlib', {
                releases: [],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            expect(module.slashFormat).toBe('puppetlabs/stdlib');
            expect(module.dashFormat).toBe('puppetlabs-stdlib');
            expect(module.normalizedName).toBe('puppetlabs-stdlib');
        });
        
        test('should handle complex module names', () => {
            const module = ForgeModule.create('puppetlabs/puppet-nginx', {
                releases: [],
                downloads: 500,
                feedback_score: 4.0
            });
            
            expect(module.authorName).toBe('puppetlabs');
            expect(module.moduleName).toBe('puppet-nginx');
            expect(module.slashFormat).toBe('puppetlabs/puppet-nginx');
            expect(module.dashFormat).toBe('puppetlabs-puppet-nginx');
        });
        
        test('should generate correct variants', () => {
            const module = ForgeModule.create('puppetlabs/puppet-nginx', {
                releases: [],
                downloads: 500,
                feedback_score: 4.0
            });
            
            expect(module.variants).toContain('puppetlabs/puppet-nginx');
            expect(module.variants).toContain('puppetlabs-puppet-nginx');
            expect(module.variants).toContain('puppet/nginx');
            expect(module.variants).toContain('puppet-nginx');
        });
    });
    
    describe('Version Management', () => {
        const mockReleases: ForgeVersion[] = [
            {
                version: '2.0.0',
                created_at: '2023-02-01',
                updated_at: '2023-02-01',
                downloads: 200,
                file_size: 2000,
                file_md5: 'def',
                file_uri: '',
                metadata: { dependencies: [] }
            },
            {
                version: '1.5.0',
                created_at: '2023-01-15',
                updated_at: '2023-01-15',
                downloads: 150,
                file_size: 1500,
                file_md5: 'ghi',
                file_uri: '',
                metadata: { dependencies: [] }
            },
            {
                version: '1.0.0',
                created_at: '2023-01-01',
                updated_at: '2023-01-01',
                downloads: 100,
                file_size: 1000,
                file_md5: 'abc',
                file_uri: '',
                metadata: { dependencies: [] }
            },
            {
                version: '2.1.0-beta1',
                created_at: '2023-02-15',
                updated_at: '2023-02-15',
                downloads: 50,
                file_size: 2100,
                file_md5: 'jkl',
                file_uri: '',
                metadata: { dependencies: [] }
            }
        ];
        
        test('should get latest version correctly', () => {
            const module = ForgeModule.create('puppetlabs/stdlib', {
                current_release: {
                    version: '2.0.0',
                    created_at: '2023-02-01',
                    metadata: { dependencies: [] }
                },
                releases: mockReleases,
                downloads: 1000,
                feedback_score: 4.5
            });
            
            expect(module.getLatestVersion()).toBe('2.0.0');
        });
        
        test('should get all versions sorted correctly', () => {
            const module = ForgeModule.create('puppetlabs/stdlib', {
                releases: mockReleases,
                downloads: 1000,
                feedback_score: 4.5
            });
            
            const versions = module.getVersions();
            expect(versions[0]).toBe('2.1.0-beta1'); // Latest (including pre-release)
            expect(versions[1]).toBe('2.0.0');
            expect(versions[2]).toBe('1.5.0');
            expect(versions[3]).toBe('1.0.0');
        });
        
        test('should get latest safe version excluding pre-releases', () => {
            const module = ForgeModule.create('puppetlabs/stdlib', {
                releases: mockReleases,
                downloads: 1000,
                feedback_score: 4.5
            });
            
            expect(module.getLatestSafeVersion()).toBe('2.0.0'); // Excludes beta1
        });
        
        test('should handle module without releases', () => {
            const module = ForgeModule.create('puppetlabs/stdlib', {
                current_release: {
                    version: '1.0.0',
                    created_at: '2023-01-01',
                    metadata: { dependencies: [] }
                },
                downloads: 1000,
                feedback_score: 4.5
            });
            
            expect(module.getVersions()).toEqual([]);
            expect(module.getLatestSafeVersion()).toBe('1.0.0'); // Falls back to current_release
        });
    });
    
    describe('Equivalence Testing', () => {
        test('should correctly identify equivalent names', () => {
            const module = ForgeModule.create('puppetlabs/stdlib', {
                releases: [],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            expect(module.isEquivalentTo('puppetlabs-stdlib')).toBe(true);
            expect(module.isEquivalentTo('Puppetlabs/StdLib')).toBe(true);
            expect(module.isEquivalentTo('puppetlabs/concat')).toBe(false);
        });
        
        test('should identify variant equivalence', () => {
            const module = ForgeModule.create('puppetlabs/puppet-nginx', {
                releases: [],
                downloads: 500,
                feedback_score: 4.0
            });
            
            expect(module.isEquivalentTo('puppet/nginx')).toBe(true);
            expect(module.isEquivalentTo('puppet-nginx')).toBe(true);
            expect(module.isEquivalentTo('apache/nginx')).toBe(false);
        });
        
        test('should compare with other ForgeModule instances', () => {
            const module1 = ForgeModule.create('puppetlabs/stdlib', {
                releases: [],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            const module2 = ForgeModule.create('puppetlabs-stdlib', {
                releases: [],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            expect(module1.isEquivalentTo(module2)).toBe(true);
        });
    });
    
    describe('Legacy Compatibility', () => {
        test('should convert to legacy format correctly', () => {
            const module = ForgeModule.create('puppetlabs/stdlib', {
                current_release: {
                    version: '8.5.0',
                    created_at: '2023-01-01',
                    metadata: { dependencies: [] }
                },
                releases: [],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            const legacy = module.toLegacyFormat();
            
            expect(legacy.name).toBe('puppetlabs/stdlib');
            expect(legacy.slug).toBe('puppetlabs-stdlib');
            expect(legacy.owner.username).toBe('puppetlabs');
            expect(legacy.downloads).toBe(1000);
            expect(legacy.feedback_score).toBe(4.5);
        });
    });
    
    describe('Cache Management', () => {
        test('should return all cached modules', () => {
            ForgeModule.create('puppetlabs/stdlib', {
                releases: [],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            ForgeModule.create('puppetlabs/concat', {
                releases: [],
                downloads: 500,
                feedback_score: 4.0
            });
            
            const cached = ForgeModule.getAllCached();
            expect(cached).toHaveLength(2);
            expect(cached.some(m => m.normalizedName === 'puppetlabs-stdlib')).toBe(true);
            expect(cached.some(m => m.normalizedName === 'puppetlabs-concat')).toBe(true);
        });
        
        test('should not duplicate modules in getAllCached', () => {
            const module = ForgeModule.create('puppetlabs/puppet-nginx', {
                releases: [],
                downloads: 500,
                feedback_score: 4.0
            });
            
            // This should not create a new module since variants are cached
            ForgeModule.getCached('puppet/nginx');
            
            const cached = ForgeModule.getAllCached();
            expect(cached).toHaveLength(1);
            expect(cached[0]).toBe(module);
        });
    });
    
    describe('String and JSON Representation', () => {
        test('should provide correct string representation', () => {
            const module = ForgeModule.create('puppetlabs/stdlib', {
                releases: [],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            expect(module.toString()).toBe('puppetlabs-stdlib');
        });
        
        test('should provide useful JSON representation', () => {
            const module = ForgeModule.create('puppetlabs/stdlib', {
                current_release: {
                    version: '8.5.0',
                    created_at: '2023-01-01',
                    metadata: { dependencies: [] }
                },
                releases: [
                    {
                        version: '8.5.0',
                        created_at: '2023-01-01',
                        updated_at: '2023-01-01',
                        downloads: 100,
                        file_size: 1000,
                        file_md5: 'abc',
                        file_uri: '',
                        metadata: { dependencies: [] }
                    }
                ],
                downloads: 1000,
                feedback_score: 4.5
            });
            
            const json = module.toJSON();
            expect(json).toEqual({
                original: 'puppetlabs/stdlib',
                normalized: 'puppetlabs-stdlib',
                author: 'puppetlabs',
                module: 'stdlib',
                slug: 'puppetlabs-stdlib',
                latestVersion: '8.5.0',
                releaseCount: 1,
                downloads: 1000,
                variants: expect.arrayContaining(['puppetlabs/stdlib', 'puppetlabs-stdlib'])
            });
        });
    });
});
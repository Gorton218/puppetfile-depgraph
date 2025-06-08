import * as assert from 'assert';
import { PuppetfileHoverProvider } from '../puppetfileHoverProvider';
import { PuppetForgeService, ForgeModule } from '../puppetForgeService';

suite('PuppetfileHoverProvider Test Suite', () => {
    test('Should create hover provider instance', () => {
        const provider = new PuppetfileHoverProvider();
        assert.ok(provider);
        assert.ok(typeof provider.provideHover === 'function');
    });

    test('isPuppetfile should detect Puppetfile by filename', () => {
        const provider = new PuppetfileHoverProvider();
        
        // Use type assertion to access private method for testing
        const isPuppetfile = (provider as any).isPuppetfile;
        
        const mockDocument = {
            fileName: '/path/to/Puppetfile',
            languageId: 'plaintext'
        };
        
        assert.strictEqual(isPuppetfile.call(provider, mockDocument), true);
    });

    test('isPuppetfile should detect Puppetfile by language', () => {
        const provider = new PuppetfileHoverProvider();
        
        // Use type assertion to access private method for testing
        const isPuppetfile = (provider as any).isPuppetfile;
        
        const mockDocument = {
            fileName: '/path/to/somefile',
            languageId: 'puppetfile'
        };
        
        assert.strictEqual(isPuppetfile.call(provider, mockDocument), true);
    });

    test('isPuppetfile should reject non-Puppetfile files', () => {
        const provider = new PuppetfileHoverProvider();
        
        // Use type assertion to access private method for testing
        const isPuppetfile = (provider as any).isPuppetfile;
        
        const mockDocument = {
            fileName: '/path/to/somefile.txt',
            languageId: 'plaintext'
        };
        
        assert.strictEqual(isPuppetfile.call(provider, mockDocument), false);
    });

    test('getModuleInfo should not include Owner, Downloads, or Quality Score fields', async () => {
        const provider = new PuppetfileHoverProvider();
        
        // Mock the PuppetForgeService.getModule method
        const originalGetModule = PuppetForgeService.getModule;
        const originalCheckForUpdate = PuppetForgeService.checkForUpdate;
        const originalGetReleases = PuppetForgeService.getModuleReleases;
        
        const mockForgeModule: ForgeModule = {
            name: 'puppetlabs/stdlib',
            slug: 'puppetlabs-stdlib',
            owner: {
                username: 'puppetlabs',
                slug: 'puppetlabs'
            },
            current_release: {
                version: '8.5.0',
                created_at: '2023-01-01',
                metadata: {
                    dependencies: [
                        {
                            name: 'puppetlabs/concat',
                            version_requirement: '>= 1.0.0'
                        }
                    ]
                }
            },
            downloads: 12345678,
            feedback_score: 4.5
        };

        const mockUpdateInfo = {
            latestVersion: '8.5.0',
            hasUpdate: false
        };

        PuppetForgeService.getModule = async () => mockForgeModule;
        PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
        PuppetForgeService.getModuleReleases = async () => [
            {
                version: '8.5.0',
                created_at: '2023-01-01',
                updated_at: '2023-01-02',
                downloads: 100,
                file_size: 1,
                file_md5: '',
                file_uri: '',
                metadata: {
                    dependencies: [
                        {
                            name: 'puppetlabs/concat',
                            version_requirement: '>= 1.0.0'
                        }
                    ]
                }
            }
        ];

        try {
            const mockModule = {
                name: 'puppetlabs/stdlib',
                version: '8.5.0',
                source: 'forge' as const
            };

            // Access private method for testing
            const getModuleInfo = (provider as any).getModuleInfo;
            const result = await getModuleInfo.call(provider, mockModule);

            const markdownText = result.value;
            
            // Verify these fields are NOT present
            assert.ok(!markdownText.includes('**Owner:**'), 'Owner field should not be present');
            assert.ok(!markdownText.includes('**Downloads:**'), 'Downloads field should not be present');
            assert.ok(!markdownText.includes('**Quality Score:**'), 'Quality Score field should not be present');
            
            // Verify other important fields are still present
            assert.ok(markdownText.includes('**Current Version:**'), 'Current Version field should be present');
            assert.ok(markdownText.includes('**Latest Version:**'), 'Latest Version field should be present');
            assert.ok(markdownText.includes('**Dependencies:**'), 'Dependencies field should be present');
            
        } finally {
            // Restore original methods
            PuppetForgeService.getModule = originalGetModule;
            PuppetForgeService.checkForUpdate = originalCheckForUpdate;
            PuppetForgeService.getModuleReleases = originalGetReleases;
        }
    });

    test('getModuleInfo should show clickable version links for updates', async () => {
        const provider = new PuppetfileHoverProvider();

        const originalGetModule = PuppetForgeService.getModule;
        const originalCheckForUpdate = PuppetForgeService.checkForUpdate;
        const originalGetReleases = PuppetForgeService.getModuleReleases;

        const mockForgeModule: ForgeModule = {
            name: 'puppetlabs/stdlib',
            slug: 'puppetlabs-stdlib',
            owner: { username: 'puppetlabs', slug: 'puppetlabs' },
            current_release: { version: '1.0.0', created_at: '2023-01-01', metadata: { dependencies: [] } },
            downloads: 123,
            feedback_score: 4.5,
        };

        const mockUpdateInfo = { latestVersion: '1.2.0', hasUpdate: true };

        PuppetForgeService.getModule = async () => mockForgeModule;
        PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
        PuppetForgeService.getModuleReleases = async () => [
            { version: '1.1.0', created_at: '2023-01-10', updated_at: '2023-01-11', downloads: 10, file_size: 1, file_md5: '', file_uri: '', metadata: { dependencies: [] } },
            { version: '1.2.0', created_at: '2023-02-10', updated_at: '2023-02-11', downloads: 20, file_size: 1, file_md5: '', file_uri: '', metadata: { dependencies: [] } },
        ];

        try {
            const mockModule = { name: 'puppetlabs/stdlib', version: '1.0.0', source: 'forge' as const, line: 10 };
            const getModuleInfo = (provider as any).getModuleInfo;
            const result = await getModuleInfo.call(provider, mockModule);
            const markdownText = result.value;

            const link1 = `command:puppetfile-depgraph.updateModuleVersion?${encodeURIComponent(JSON.stringify({ line: 10, version: '1.1.0' }))}`;
            const link2 = `command:puppetfile-depgraph.updateModuleVersion?${encodeURIComponent(JSON.stringify({ line: 10, version: '1.2.0' }))}`;

            assert.ok(markdownText.includes('**Available Versions:**'), 'Should show available versions');
            assert.ok(markdownText.includes(link1), 'Should include link for 1.1.0');
            assert.ok(markdownText.includes(link2), 'Should include link for 1.2.0');
        } finally {
            PuppetForgeService.getModule = originalGetModule;
            PuppetForgeService.checkForUpdate = originalCheckForUpdate;
            PuppetForgeService.getModuleReleases = originalGetReleases;
        }
    });

    test('getModuleInfo should show dependencies from current_release when specific version has no dependencies', async () => {
        const provider = new PuppetfileHoverProvider();

        const originalGetModule = PuppetForgeService.getModule;
        const originalCheckForUpdate = PuppetForgeService.checkForUpdate;
        const originalGetReleases = PuppetForgeService.getModuleReleases;

        const mockForgeModule: ForgeModule = {
            name: 'puppetlabs/stdlib',
            slug: 'puppetlabs-stdlib',
            owner: { username: 'puppetlabs', slug: 'puppetlabs' },
            current_release: { 
                version: '8.5.0', 
                created_at: '2023-01-01', 
                metadata: { 
                    dependencies: [
                        {
                            name: 'puppetlabs/concat',
                            version_requirement: '>= 1.0.0'
                        }
                    ] 
                } 
            },
            downloads: 123,
            feedback_score: 4.5,
        };

        const mockUpdateInfo = { latestVersion: '8.5.0', hasUpdate: false };

        // Mock releases without dependencies metadata
        const mockReleases = [
            { 
                version: '8.5.0', 
                created_at: '2023-01-01', 
                updated_at: '2023-01-02', 
                downloads: 10, 
                file_size: 1, 
                file_md5: '', 
                file_uri: '', 
                metadata: {} // No dependencies in this release
            }
        ];

        PuppetForgeService.getModule = async () => mockForgeModule;
        PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
        PuppetForgeService.getModuleReleases = async () => mockReleases;

        try {
            const mockModule = { name: 'puppetlabs/stdlib', version: '8.5.0', source: 'forge' as const };
            const getModuleInfo = (provider as any).getModuleInfo;
            const result = await getModuleInfo.call(provider, mockModule);
            const markdownText = result.value;

            // Should show dependencies from current_release since specific version has no dependencies
            assert.ok(markdownText.includes('**Dependencies:**'), 'Dependencies field should be present');
            assert.ok(markdownText.includes('puppetlabs/concat'), 'Specific dependency should be shown');
            assert.ok(markdownText.includes('>= 1.0.0'), 'Version requirement should be shown');
        } finally {
            PuppetForgeService.getModule = originalGetModule;
            PuppetForgeService.checkForUpdate = originalCheckForUpdate;
            PuppetForgeService.getModuleReleases = originalGetReleases;
        }
    });

    test('getModuleInfo should show dependencies when they exist', async () => {
        const provider = new PuppetfileHoverProvider();

        const originalGetModule = PuppetForgeService.getModule;
        const originalCheckForUpdate = PuppetForgeService.checkForUpdate;
        const originalGetReleases = PuppetForgeService.getModuleReleases;

        const mockForgeModule: ForgeModule = {
            name: 'puppetlabs/apache',
            slug: 'puppetlabs-apache',
            owner: { username: 'puppetlabs', slug: 'puppetlabs' },
            current_release: { 
                version: '8.5.0', 
                created_at: '2023-01-01', 
                metadata: { 
                    dependencies: [
                        {
                            name: 'puppetlabs/stdlib',
                            version_requirement: '>= 4.13.1 < 9.0.0'
                        },
                        {
                            name: 'puppetlabs/concat',
                            version_requirement: '>= 1.1.1 < 8.0.0'
                        }
                    ] 
                } 
            },
            downloads: 123,
            feedback_score: 4.5,
        };

        const mockUpdateInfo = { latestVersion: '8.5.0', hasUpdate: false };

        PuppetForgeService.getModule = async () => mockForgeModule;
        PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
        PuppetForgeService.getModuleReleases = async () => [
            {
                version: '8.5.0',
                created_at: '2023-01-01',
                updated_at: '2023-01-02',
                downloads: 100,
                file_size: 1,
                file_md5: '',
                file_uri: '',
                metadata: {
                    dependencies: [
                        {
                            name: 'puppetlabs/stdlib',
                            version_requirement: '>= 4.13.1 < 9.0.0'
                        },
                        {
                            name: 'puppetlabs/concat',
                            version_requirement: '>= 1.1.1 < 8.0.0'
                        }
                    ]
                }
            }
        ];

        try {
            const mockModule = { name: 'puppetlabs/apache', version: '8.5.0', source: 'forge' as const };
            const getModuleInfo = (provider as any).getModuleInfo;
            const result = await getModuleInfo.call(provider, mockModule);
            const markdownText = result.value;

            // Debug output
            console.log('Generated markdown:', markdownText);

            // Should show dependencies
            assert.ok(markdownText.includes('**Dependencies:**'), 'Dependencies section should be present');
            assert.ok(markdownText.includes('puppetlabs/stdlib'), 'stdlib dependency should be shown');
            assert.ok(markdownText.includes('puppetlabs/concat'), 'concat dependency should be shown');
            assert.ok(markdownText.includes('>= 4.13.1 < 9.0.0'), 'stdlib version requirement should be shown');
            assert.ok(markdownText.includes('>= 1.1.1 < 8.0.0'), 'concat version requirement should be shown');
        } finally {
            PuppetForgeService.getModule = originalGetModule;
            PuppetForgeService.checkForUpdate = originalCheckForUpdate;
            PuppetForgeService.getModuleReleases = originalGetReleases;
        }
    });
});
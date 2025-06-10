import * as assert from 'assert';
import { PuppetfileHoverProvider } from '../puppetfileHoverProvider';
import { PuppetForgeService, ForgeModule } from '../puppetForgeService';

suite('PuppetfileHoverProvider Test Suite', () => {
    // Test utilities and factories
    const createProvider = () => new PuppetfileHoverProvider();
    
    const createMockDocument = (fileName: string, languageId: string) => ({
        fileName,
        languageId
    });

    const createBasicForgeModule = (name: string, version: string = '8.5.0'): ForgeModule => ({
        name,
        slug: name.replace('/', '-'),
        owner: { 
            username: name.split('/')[0], 
            slug: name.split('/')[0] 
        },
        current_release: { 
            version, 
            created_at: '2023-01-01', 
            metadata: { dependencies: [] } 
        },
        downloads: 123,
        feedback_score: 4.5,
    });

    const createForgeModuleWithDeps = (name: string, version: string, dependencies: Array<{name: string; version_requirement: string}>): ForgeModule => ({
        ...createBasicForgeModule(name, version),
        current_release: {
            version,
            created_at: '2023-01-01',
            metadata: { dependencies }
        }
    });

    const createMockRelease = (version: string, dependencies: Array<{name: string; version_requirement: string}> = []) => ({
        version,
        created_at: '2023-01-01',
        updated_at: '2023-01-02',
        downloads: 100,
        file_size: 1,
        file_md5: '',
        file_uri: '',
        metadata: { dependencies }
    });

    const withServiceMocks = async (testFn: (restore: () => void) => Promise<void>) => {
        const originalGetModule = PuppetForgeService.getModule;
        const originalCheckForUpdate = PuppetForgeService.checkForUpdate;
        const originalGetReleases = PuppetForgeService.getModuleReleases;
        
        const restore = () => {
            PuppetForgeService.getModule = originalGetModule;
            PuppetForgeService.checkForUpdate = originalCheckForUpdate;
            PuppetForgeService.getModuleReleases = originalGetReleases;
        };
        
        try {
            await testFn(restore);
        } finally {
            restore();
        }
    };

    const callGetModuleInfo = async (provider: PuppetfileHoverProvider, module: any) => {
        const getModuleInfo = (provider as any).getModuleInfo;
        return await getModuleInfo.call(provider, module);
    };
    test('Should create hover provider instance', () => {
        const provider = createProvider();
        assert.ok(provider);
        assert.ok(typeof provider.provideHover === 'function');
    });

    test('isPuppetfile should detect Puppetfile by filename', () => {
        const provider = createProvider();
        const isPuppetfile = (provider as any).isPuppetfile;
        const mockDocument = createMockDocument('/path/to/Puppetfile', 'plaintext');
        
        assert.strictEqual(isPuppetfile.call(provider, mockDocument), true);
    });

    test('isPuppetfile should detect Puppetfile by language', () => {
        const provider = createProvider();
        const isPuppetfile = (provider as any).isPuppetfile;
        const mockDocument = createMockDocument('/path/to/somefile', 'puppetfile');
        
        assert.strictEqual(isPuppetfile.call(provider, mockDocument), true);
    });

    test('isPuppetfile should reject non-Puppetfile files', () => {
        const provider = createProvider();
        const isPuppetfile = (provider as any).isPuppetfile;
        const mockDocument = createMockDocument('/path/to/somefile.txt', 'plaintext');
        
        assert.strictEqual(isPuppetfile.call(provider, mockDocument), false);
    });

    test('getModuleInfo should not include Owner, Downloads, or Quality Score fields', async () => {
        await withServiceMocks(async () => {
            const provider = createProvider();
            const deps = [{ name: 'puppetlabs/concat', version_requirement: '>= 1.0.0' }];
            const mockForgeModule = createForgeModuleWithDeps('puppetlabs/stdlib', '8.5.0', deps);
            const mockUpdateInfo = { latestVersion: '8.5.0', hasUpdate: false };
            const mockReleases = [createMockRelease('8.5.0', deps)];

            PuppetForgeService.getModule = async () => mockForgeModule;
            PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
            PuppetForgeService.getModuleReleases = async () => mockReleases;

            const mockModule = { name: 'puppetlabs/stdlib', version: '8.5.0', source: 'forge' as const };
            const result = await callGetModuleInfo(provider, mockModule);
            const markdownText = result.value;
            
            // Verify these fields are NOT present
            assert.ok(!markdownText.includes('**Owner:**'), 'Owner field should not be present');
            assert.ok(!markdownText.includes('**Downloads:**'), 'Downloads field should not be present');
            assert.ok(!markdownText.includes('**Quality Score:**'), 'Quality Score field should not be present');
            
            // Verify other important fields are still present
            assert.ok(markdownText.includes('**Current Version:**'), 'Current Version field should be present');
            assert.ok(markdownText.includes('**Latest Version:**'), 'Latest Version field should be present');
            assert.ok(markdownText.includes('**Dependencies:**'), 'Dependencies field should be present');
        });
    });

    test('getModuleInfo should show clickable version links for updates', async () => {
        await withServiceMocks(async () => {
            const provider = createProvider();
            const mockForgeModule = createBasicForgeModule('puppetlabs/stdlib', '1.0.0');
            const mockUpdateInfo = { latestVersion: '1.2.0', hasUpdate: true };
            const mockReleases = [
                createMockRelease('1.2.0'),
                createMockRelease('1.1.0'),
                createMockRelease('1.0.0'),
            ];

            PuppetForgeService.getModule = async () => mockForgeModule;
            PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
            PuppetForgeService.getModuleReleases = async () => mockReleases;

            const mockModule = { name: 'puppetlabs/stdlib', version: '1.0.0', source: 'forge' as const, line: 10 };
            const result = await callGetModuleInfo(provider, mockModule);
            const markdownText = result.value;

            const link1 = `command:puppetfile-depgraph.updateModuleVersion?${encodeURIComponent(JSON.stringify([{ line: 10, version: '1.1.0' }]))}`;
            const link2 = `command:puppetfile-depgraph.updateModuleVersion?${encodeURIComponent(JSON.stringify([{ line: 10, version: '1.2.0' }]))}`;
            const tooltip1 = 'Update to 1.1.0';
            const tooltip2 = 'Update to 1.2.0';

            assert.ok(markdownText.includes('**Available Updates:**'), 'Should show available updates');
            assert.ok(markdownText.includes(link1), 'Should include link for 1.1.0');
            assert.ok(markdownText.includes(link2), 'Should include link for 1.2.0');
            assert.ok(markdownText.includes(tooltip1), 'Should include tooltip for 1.1.0');
            assert.ok(markdownText.includes(tooltip2), 'Should include tooltip for 1.2.0');
            assert.ok(!markdownText.includes('**`1.0.0`**'), 'Current version should not appear in updates list');
            assert.ok(!markdownText.includes(' • '), 'Versions should not be separated by bullets');
        });
    });

    test('getModuleInfo should NOT show dependencies when specific version has no dependencies', async () => {
        await withServiceMocks(async () => {
            const provider = createProvider();
            const currentReleaseDeps = [{ name: 'puppetlabs/concat', version_requirement: '>= 1.0.0' }];
            const mockForgeModule = createForgeModuleWithDeps('puppetlabs/stdlib', '8.5.0', currentReleaseDeps);
            const mockUpdateInfo = { latestVersion: '8.5.0', hasUpdate: false };
            
            // Mock releases with empty dependencies metadata
            const mockReleases = [{
                version: '8.5.0',
                created_at: '2023-01-01',
                updated_at: '2023-01-02',
                downloads: 10,
                file_size: 1,
                file_md5: '',
                file_uri: '',
                metadata: {} // No dependencies in this release
            }];

            PuppetForgeService.getModule = async () => mockForgeModule;
            PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
            PuppetForgeService.getModuleReleases = async () => mockReleases;

            const mockModule = { name: 'puppetlabs/stdlib', version: '8.5.0', source: 'forge' as const };
            const result = await callGetModuleInfo(provider, mockModule);
            const markdownText = result.value;

            // Should NOT show dependencies since the specific version has no dependencies
            assert.ok(!markdownText.includes('**Dependencies:**'), 'Dependencies field should NOT be present when version has no dependencies');
            assert.ok(!markdownText.includes('puppetlabs/concat'), 'Dependencies from current_release should NOT be shown');
        });
    });

    test('getModuleInfo should show dependencies when they exist', async () => {
        await withServiceMocks(async () => {
            const provider = createProvider();
            const deps = [
                { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.1 < 9.0.0' },
                { name: 'puppetlabs/concat', version_requirement: '>= 1.1.1 < 8.0.0' }
            ];
            const mockForgeModule = createForgeModuleWithDeps('puppetlabs/apache', '8.5.0', deps);
            const mockUpdateInfo = { latestVersion: '8.5.0', hasUpdate: false };
            const mockReleases = [createMockRelease('8.5.0', deps)];

            PuppetForgeService.getModule = async () => mockForgeModule;
            PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
            PuppetForgeService.getModuleReleases = async () => mockReleases;

            const mockModule = { name: 'puppetlabs/apache', version: '8.5.0', source: 'forge' as const };
            const result = await callGetModuleInfo(provider, mockModule);
            const markdownText = result.value;

            // Should show dependencies
            assert.ok(markdownText.includes('**Dependencies:**'), 'Dependencies section should be present');
            assert.ok(markdownText.includes('puppetlabs/stdlib'), 'stdlib dependency should be shown');
            assert.ok(markdownText.includes('puppetlabs/concat'), 'concat dependency should be shown');
            assert.ok(markdownText.includes('>= 4.13.1 < 9.0.0'), 'stdlib version requirement should be shown');
            assert.ok(markdownText.includes('>= 1.1.1 < 8.0.0'), 'concat version requirement should be shown');
        });
    });

    test('getModuleInfo should fallback to current_release when version not found in releases', async () => {
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

        const mockUpdateInfo = { latestVersion: '8.5.0', hasUpdate: true };

        // Mock releases that don't include the version we're looking for
        const mockReleases = [
            { 
                version: '8.5.0', 
                created_at: '2023-01-01', 
                updated_at: '2023-01-02', 
                downloads: 10, 
                file_size: 1, 
                file_md5: '', 
                file_uri: '', 
                metadata: { dependencies: [] }
            }
        ];

        PuppetForgeService.getModule = async () => mockForgeModule;
        PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
        PuppetForgeService.getModuleReleases = async () => mockReleases;

        try {
            // Using a version that's not in the releases list
            const mockModule = { name: 'puppetlabs/stdlib', version: '7.0.0', source: 'forge' as const };
            const getModuleInfo = (provider as any).getModuleInfo;
            const result = await getModuleInfo.call(provider, mockModule);
            const markdownText = result.value;

            // Should show dependencies from current_release as fallback
            assert.ok(markdownText.includes('**Dependencies:**'), 'Dependencies field should be present');
            assert.ok(markdownText.includes('puppetlabs/concat'), 'Fallback dependency should be shown');
            assert.ok(markdownText.includes('>= 1.0.0'), 'Version requirement should be shown');
        } finally {
            PuppetForgeService.getModule = originalGetModule;
            PuppetForgeService.checkForUpdate = originalCheckForUpdate;
            PuppetForgeService.getModuleReleases = originalGetReleases;
        }
    });

    test('getModuleInfo should show dependencies for specific version when different from latest', async () => {
        const provider = new PuppetfileHoverProvider();

        const originalGetModule = PuppetForgeService.getModule;
        const originalCheckForUpdate = PuppetForgeService.checkForUpdate;
        const originalGetReleases = PuppetForgeService.getModuleReleases;

        // Mock module where current_release (latest) has different dependencies than older version
        const mockForgeModule: ForgeModule = {
            name: 'puppetlabs/apache',
            slug: 'puppetlabs-apache',
            owner: { username: 'puppetlabs', slug: 'puppetlabs' },
            current_release: { 
                version: '11.1.0', 
                created_at: '2023-06-01', 
                metadata: { 
                    dependencies: [
                        {
                            name: 'puppetlabs/stdlib',
                            version_requirement: '>= 9.0.0 < 10.0.0'
                        },
                        {
                            name: 'puppetlabs/systemd',
                            version_requirement: '>= 5.0.0 < 6.0.0'
                        }
                    ] 
                } 
            },
            downloads: 123,
            feedback_score: 4.5,
        };

        const mockUpdateInfo = { latestVersion: '11.1.0', hasUpdate: true };

        // Mock releases with different dependencies for older version
        const mockReleases = [
            {
                version: '11.1.0',
                created_at: '2023-06-01',
                updated_at: '2023-06-02',
                downloads: 100,
                file_size: 1,
                file_md5: '',
                file_uri: '',
                metadata: {
                    dependencies: [
                        {
                            name: 'puppetlabs/stdlib',
                            version_requirement: '>= 9.0.0 < 10.0.0'
                        },
                        {
                            name: 'puppetlabs/systemd',
                            version_requirement: '>= 5.0.0 < 6.0.0'
                        }
                    ]
                }
            },
            {
                version: '10.0.0',
                created_at: '2023-01-01',
                updated_at: '2023-01-02',
                downloads: 50,
                file_size: 1,
                file_md5: '',
                file_uri: '',
                metadata: {
                    dependencies: [
                        {
                            name: 'puppetlabs/stdlib',
                            version_requirement: '>= 8.0.0 < 9.0.0'
                        },
                        {
                            name: 'puppetlabs/concat',
                            version_requirement: '>= 6.0.0 < 7.0.0'
                        }
                    ]
                }
            }
        ];

        PuppetForgeService.getModule = async () => mockForgeModule;
        PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
        PuppetForgeService.getModuleReleases = async () => mockReleases;

        try {
            // Test with older version that has different dependencies
            const mockModule = { name: 'puppetlabs/apache', version: '10.0.0', source: 'forge' as const };
            const getModuleInfo = (provider as any).getModuleInfo;
            const result = await getModuleInfo.call(provider, mockModule);
            const markdownText = result.value;

            // Should show dependencies from version 10.0.0, NOT from latest (11.1.0)
            assert.ok(markdownText.includes('**Dependencies:**'), 'Dependencies section should be present');
            assert.ok(markdownText.includes('puppetlabs/stdlib'), 'stdlib dependency should be shown');
            assert.ok(markdownText.includes('puppetlabs/concat'), 'concat dependency should be shown from v10.0.0');
            assert.ok(markdownText.includes('>= 8.0.0 < 9.0.0'), 'stdlib version requirement from v10.0.0 should be shown');
            assert.ok(markdownText.includes('>= 6.0.0 < 7.0.0'), 'concat version requirement from v10.0.0 should be shown');
            
            // Should NOT show dependencies from latest version (11.1.0)
            assert.ok(!markdownText.includes('puppetlabs/systemd'), 'systemd dependency from latest should NOT be shown');
            assert.ok(!markdownText.includes('>= 9.0.0 < 10.0.0'), 'latest stdlib version requirement should NOT be shown');
            assert.ok(!markdownText.includes('>= 5.0.0 < 6.0.0'), 'latest systemd version requirement should NOT be shown');

        } finally {
            PuppetForgeService.getModule = originalGetModule;
            PuppetForgeService.checkForUpdate = originalCheckForUpdate;
            PuppetForgeService.getModuleReleases = originalGetReleases;
        }
    });

    test('getModuleInfo should display versions in rows of 5', async () => {
        const provider = new PuppetfileHoverProvider();

        const originalGetModule = PuppetForgeService.getModule;
        const originalCheckForUpdate = PuppetForgeService.checkForUpdate;
        const originalGetReleases = PuppetForgeService.getModuleReleases;

        const mockForgeModule: ForgeModule = {
            name: 'test/module',
            slug: 'test-module',
            owner: { username: 'test', slug: 'test' },
            current_release: { version: '7.0.0', created_at: '2023-07-01', metadata: { dependencies: [] } },
            downloads: 123,
            feedback_score: 4.5,
        };

        const mockUpdateInfo = { latestVersion: '7.0.0', hasUpdate: true };

        // Create many versions to test row splitting
        const mockReleases: any[] = [];
        for (let i = 7; i >= 1; i--) {
            for (let j = 0; j < 3; j++) {
                mockReleases.push({
                    version: `${i}.${j}.0`,
                    created_at: `2023-0${i}-01`,
                    updated_at: `2023-0${i}-02`,
                    downloads: 10 * i,
                    file_size: 1,
                    file_md5: '',
                    file_uri: '',
                    metadata: { dependencies: [] }
                });
            }
        }

        PuppetForgeService.getModule = async () => mockForgeModule;
        PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
        PuppetForgeService.getModuleReleases = async () => mockReleases;

        try {
            const mockModule = { name: 'test/module', version: '3.0.0', source: 'forge' as const, line: 10 };
            const getModuleInfo = (provider as any).getModuleInfo;
            const result = await getModuleInfo.call(provider, mockModule);
            const markdownText = result.value;

            // Check that updates are displayed (only newer versions than 3.0.0)
            assert.ok(markdownText.includes('**Available Updates:**'), 'Should show available updates');
            
            // Check that current version (3.0.0) is not shown in updates
            assert.ok(!markdownText.includes('**`3.0.0`**'), 'Current version should not appear in updates');
            
            // Check that versions are not separated by bullets
            assert.ok(!markdownText.includes(' • '), 'Versions should not be separated by bullets');
            
            // Check that multiple rows exist (should have newlines between rows)
            const versionSection = markdownText.substring(
                markdownText.indexOf('**Available Updates:**'),
                markdownText.indexOf('**Dependencies:**') || markdownText.indexOf('[View on Puppet Forge]')
            );
            const lines = versionSection.split('\n').filter((line: string) => line.includes('`'));
            assert.ok(lines.length > 1, 'Should have multiple rows of versions');
            
            // Check that first row has 5 versions max
            const firstRow = lines[0];
            const versionCount = (firstRow.match(/`[^`]+`/g) || []).length;
            assert.ok(versionCount <= 5, 'First row should have max 5 versions');
        } finally {
            PuppetForgeService.getModule = originalGetModule;
            PuppetForgeService.checkForUpdate = originalCheckForUpdate;
            PuppetForgeService.getModuleReleases = originalGetReleases;
        }
    });

    test('parseModuleFromPosition should parse modules correctly', () => {
        const provider = createProvider();
        const parseModuleFromPosition = (provider as any).parseModuleFromPosition;
        const testLine = "mod 'puppetlabs/stdlib', '8.5.0'";
        
        // Create a mock document and position
        const mockDocument = {
            lineAt: (line: number) => ({ text: testLine }),
            getText: () => testLine
        };
        const mockPosition = { line: 0, character: 10 };
        
        const result = parseModuleFromPosition.call(provider, mockDocument, mockPosition);
        
        assert.ok(result, 'Should parse module successfully');
        assert.strictEqual(result.name, 'puppetlabs/stdlib', 'Should parse module name correctly');
        assert.strictEqual(result.version, '8.5.0', 'Should parse module version correctly');
        assert.strictEqual(result.line, 1, 'Should have correct line number');
    });
});
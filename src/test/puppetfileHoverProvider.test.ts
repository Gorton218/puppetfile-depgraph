import * as assert from 'assert';
import * as sinon from 'sinon';
import { PuppetfileHoverProvider } from '../puppetfileHoverProvider';
import { PuppetForgeService, ForgeModule } from '../puppetForgeService';

suite('PuppetfileHoverProvider Test Suite', () => {
    // Test utilities and factories
    const createProvider = () => new PuppetfileHoverProvider();
    
    const createMockDocument = (fileName: string, languageId: string) => ({
        fileName,
        languageId
    });

    const createForgeModule = (name: string, version: string = '8.5.0', dependencies: Array<{name: string; version_requirement: string}> = []): ForgeModule => ({
        name,
        slug: name.replace('/', '-'),
        owner: { 
            username: name.split('/')[0], 
            slug: name.split('/')[0] 
        },
        current_release: { 
            version, 
            created_at: '2023-01-01', 
            metadata: { dependencies } 
        },
        downloads: 123,
        feedback_score: 4.5,
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
            const mockForgeModule = createForgeModule('puppetlabs/stdlib', '8.5.0', deps);
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
            const mockForgeModule = createForgeModule('puppetlabs/stdlib', '1.0.0');
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
            const mockForgeModule = createForgeModule('puppetlabs/stdlib', '8.5.0', currentReleaseDeps);
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
            const mockForgeModule = createForgeModule('puppetlabs/apache', '8.5.0', deps);
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
        await withServiceMocks(async () => {
            const provider = createProvider();
            const deps = [{ name: 'puppetlabs/concat', version_requirement: '>= 1.0.0' }];
            const mockForgeModule = createForgeModule('puppetlabs/stdlib', '8.5.0', deps);
            const mockUpdateInfo = { latestVersion: '8.5.0', hasUpdate: true };
            const mockReleases = [createMockRelease('8.5.0', [])];

            PuppetForgeService.getModule = async () => mockForgeModule;
            PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
            PuppetForgeService.getModuleReleases = async () => mockReleases;

            // Using a version that's not in the releases list
            const mockModule = { name: 'puppetlabs/stdlib', version: '7.0.0', source: 'forge' as const };
            const result = await callGetModuleInfo(provider, mockModule);
            const markdownText = result.value;

            // Should show dependencies from current_release as fallback
            assert.ok(markdownText.includes('**Dependencies:**'), 'Dependencies field should be present');
            assert.ok(markdownText.includes('puppetlabs/concat'), 'Fallback dependency should be shown');
            assert.ok(markdownText.includes('>= 1.0.0'), 'Version requirement should be shown');
        });
    });

    test('getModuleInfo should show dependencies for specific version when different from latest', async () => {
        await withServiceMocks(async () => {
            const provider = createProvider();
            const latestDeps = [
                { name: 'puppetlabs/stdlib', version_requirement: '>= 9.0.0 < 10.0.0' },
                { name: 'puppetlabs/systemd', version_requirement: '>= 5.0.0 < 6.0.0' }
            ];
            const olderDeps = [
                { name: 'puppetlabs/stdlib', version_requirement: '>= 8.0.0 < 9.0.0' },
                { name: 'puppetlabs/concat', version_requirement: '>= 6.0.0 < 7.0.0' }
            ];
            const mockForgeModule = createForgeModule('puppetlabs/apache', '11.1.0', latestDeps);
            const mockUpdateInfo = { latestVersion: '11.1.0', hasUpdate: true };
            const mockReleases = [
                createMockRelease('11.1.0', latestDeps),
                createMockRelease('10.0.0', olderDeps)
            ];

            PuppetForgeService.getModule = async () => mockForgeModule;
            PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
            PuppetForgeService.getModuleReleases = async () => mockReleases;

            // Test with older version that has different dependencies
            const mockModule = { name: 'puppetlabs/apache', version: '10.0.0', source: 'forge' as const };
            const result = await callGetModuleInfo(provider, mockModule);
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
        });
    });

    test('getModuleInfo should display versions in rows of 5', async () => {
        await withServiceMocks(async () => {
            const provider = createProvider();
            const mockForgeModule = createForgeModule('test/module', '7.0.0');
            const mockUpdateInfo = { latestVersion: '7.0.0', hasUpdate: true };

            // Create many versions to test row splitting
            const mockReleases: any[] = [];
            for (let i = 7; i >= 1; i--) {
                for (let j = 0; j < 3; j++) {
                    mockReleases.push(createMockRelease(`${i}.${j}.0`));
                }
            }

            PuppetForgeService.getModule = async () => mockForgeModule;
            PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
            PuppetForgeService.getModuleReleases = async () => mockReleases;

            const mockModule = { name: 'test/module', version: '3.0.0', source: 'forge' as const, line: 10 };
            const result = await callGetModuleInfo(provider, mockModule);
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
        });
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

    test('hasModuleCached should correctly check cache status', () => {
        // Clear cache first
        PuppetForgeService.clearCache();
        
        // Should return false for uncached module
        assert.strictEqual(PuppetForgeService.hasModuleCached('puppetlabs/stdlib'), false);
        
        // Mock cache by calling internal cache set
        const moduleVersionCache = (PuppetForgeService as any).moduleVersionCache;
        const versionMap = new Map();
        versionMap.set('8.5.0', { version: '8.5.0', metadata: {} });
        moduleVersionCache.set('puppetlabs/stdlib', versionMap);
        
        // Should return true for cached module
        assert.strictEqual(PuppetForgeService.hasModuleCached('puppetlabs/stdlib'), true);
        
        // Clear cache
        PuppetForgeService.clearCache();
    });

    test('version compatibility indicators should be shown correctly', async () => {
        const provider = createProvider();
        
        // Mock the parseActiveEditor to return test modules
        const { PuppetfileParser } = await import('../puppetfileParser.js');
        const originalParseActiveEditor = PuppetfileParser.parseActiveEditor;
        PuppetfileParser.parseActiveEditor = () => ({
            modules: [
                { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge' as const, line: 1 },
                { name: 'puppetlabs/concat', version: '7.0.0', source: 'forge' as const, line: 2 }
            ],
            errors: []
        });

        // Override hasModuleCached to return true (simulate cached data)
        const originalHasModuleCached = PuppetForgeService.hasModuleCached;
        PuppetForgeService.hasModuleCached = () => true;

        try {
            await withServiceMocks(async (restore) => {
                const mockReleases = [
                    createMockRelease('8.5.0'),  // Compatible version
                    createMockRelease('9.0.0'),  // Incompatible version
                    createMockRelease('8.0.0')   // Current version
                ];

                // Mock concat's dependency on stdlib
                const originalGetReleaseForVersion = PuppetForgeService.getReleaseForVersion;
                PuppetForgeService.getReleaseForVersion = async (moduleName: string, version: string) => {
                    if (moduleName === 'puppetlabs/concat' && version === '7.0.0') {
                        return {
                            version: '7.0.0',
                            metadata: {
                                dependencies: [
                                    { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.1 < 9.0.0' }
                                ]
                            }
                        } as any;
                    }
                    return mockReleases.find(r => r.version === version) as any;
                };

                PuppetForgeService.getModule = async () => createForgeModule('puppetlabs/stdlib', '8.0.0');
                PuppetForgeService.checkForUpdate = async () => ({ latestVersion: '9.0.0', hasUpdate: true });
                PuppetForgeService.getModuleReleases = async () => mockReleases;

                const mockModule = { name: 'puppetlabs/stdlib', version: '8.0.0', source: 'forge' as const, line: 1 };
                const result = await callGetModuleInfo(provider, mockModule);
                const markdownText = result.value;

                // Should contain green indicator for compatible version
                assert.ok(markdownText.includes('🟢'), 'Should show green indicator for compatible versions');
                assert.ok(markdownText.includes('🟢 [`8.5.0`]'), 'Version 8.5.0 should have green indicator');

                // Should contain yellow indicator for incompatible version
                assert.ok(markdownText.includes('🟡'), 'Should show yellow indicator for incompatible versions');
                assert.ok(markdownText.includes('🟡 [`9.0.0`]'), 'Version 9.0.0 should have yellow indicator');

                // Should show conflict details in tooltip
                assert.ok(markdownText.includes('Conflicts:'), 'Should show conflict details');
                assert.ok(markdownText.includes('puppetlabs/concat requires >= 4.13.1 < 9.0.0'), 'Should show specific conflict requirement');

                PuppetForgeService.getReleaseForVersion = originalGetReleaseForVersion;
            });
        } finally {
            PuppetfileParser.parseActiveEditor = originalParseActiveEditor;
            PuppetForgeService.hasModuleCached = originalHasModuleCached;
        }
    });

    // Test for non-Puppetfile documents
    test('should return null for non-Puppetfile documents', async () => {
        await withServiceMocks(async (restore) => {
            const provider = createProvider();
            const document = createMockDocument('test.txt', 'plaintext');
            const position = { line: 0, character: 5 } as any;
            
            const result = await provider.provideHover(document as any, position, {} as any);
            
            assert.strictEqual(result, null);
            restore();
        });
    });

    // Test for no word range at cursor position
    test('should return null when no word range at cursor position', async () => {
        await withServiceMocks(async (restore) => {
            const provider = createProvider();
            const document = {
                fileName: 'Puppetfile',
                languageId: 'puppetfile',
                getWordRangeAtPosition: () => undefined
            };
            const position = { line: 0, character: 5 } as any;
            
            const result = await provider.provideHover(document as any, position, {} as any);
            
            assert.strictEqual(result, null);
            restore();
        });
    });

    // Test for cursor outside module name
    test('should return null when cursor is outside module name', async () => {
        await withServiceMocks(async (restore) => {
            const provider = createProvider();
            const document = {
                fileName: 'Puppetfile',
                languageId: 'puppetfile',
                getWordRangeAtPosition: () => ({ start: { line: 0, character: 0 }, end: { line: 0, character: 5 } }),
                lineAt: () => ({ text: "mod 'puppetlabs/stdlib', '8.5.0'" })
            };
            const position = { line: 0, character: 50 } as any; // Position outside the line
            
            const result = await provider.provideHover(document as any, position, {} as any);
            
            assert.strictEqual(result, null);
            restore();
        });
    });

    // Test for module info timeout (simplified test without actual timeout)
    test('should handle timeout when fetching module info', async () => {
        await withServiceMocks(async (restore) => {
            // Mock a response that simulates timeout behavior by returning quickly
            // but we test the timeout path by mocking the internal timeout logic
            PuppetForgeService.getModule = async () => {
                // Return a promise that simulates what happens after timeout
                throw new Error('Request timeout');
            };
            
            const provider = createProvider();
            const document = {
                fileName: 'Puppetfile',
                languageId: 'puppetfile',
                getWordRangeAtPosition: () => ({ start: { line: 0, character: 4 }, end: { line: 0, character: 20 } }),
                lineAt: () => ({ text: "mod 'puppetlabs/stdlib', '8.5.0'" })
            };
            const position = { line: 0, character: 10 } as any;
            
            const result = await provider.provideHover(document as any, position, {} as any);
            
            // Should still return hover info even when service throws error (fallback)
            assert.notStrictEqual(result, null);
            restore();
        });
    });

    // Test extractCompleteModuleDefinition with multi-line modules
    test('should extract complete multi-line module definition', async () => {
        await withServiceMocks(async (restore) => {
            const provider = createProvider();
            const document = {
                fileName: 'Puppetfile',
                languageId: 'puppetfile',
                lineCount: 5,
                lineAt: (lineNumber: number) => {
                    const lines = [
                        "mod 'puppetlabs/stdlib',",
                        "  :git => 'https://github.com/puppetlabs/puppetlabs-stdlib.git',",
                        "  :ref => 'main',",
                        "  :tag => 'v8.5.0'",
                        ""
                    ];
                    return { text: lines[lineNumber] || '' };
                }
            };
            
            const result = (provider as any).extractCompleteModuleDefinition(document, 0);
            
            assert.ok(result.includes('puppetlabs/stdlib'));
            assert.ok(result.includes(':git'));
            assert.ok(result.includes(':ref'));
            assert.ok(result.includes(':tag'));
            restore();
        });
    });

    // Test cache initialization
    test('should handle cache initialization', async () => {
        await withServiceMocks(async (restore) => {
            const provider = createProvider();
            
            // Test checkAndInitializeCache method
            await (provider as any).checkAndInitializeCache();
            
            // Should complete without throwing
            assert.ok(true);
            restore();
        });
    });

    // Test version compatibility error handling
    test('should handle version compatibility check errors', async () => {
        await withServiceMocks(async (restore) => {
            // Stub console.error to suppress error output during test
            const consoleErrorStub = sinon.stub(console, 'error');
            
            PuppetForgeService.getModuleReleases = async () => {
                throw new Error('Network error');
            };
            
            const provider = createProvider();
            const releases = [createMockRelease('8.5.0'), createMockRelease('8.4.0')];
            const mockModule = { name: 'puppetlabs/stdlib', version: '8.5.0', source: 'forge' as const, line: 1 };
            const allModules = [mockModule];
            
            // Test the internal method that handles version compatibility with correct parameters
            const result = await (provider as any).checkVersionCompatibilities(
                mockModule,
                releases,
                allModules
            );
            
            // Should handle error gracefully and return a Map
            assert.ok(result instanceof Map);
            
            consoleErrorStub.restore();
            restore();
        });
    });

});
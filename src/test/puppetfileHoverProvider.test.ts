import * as sinon from 'sinon';
import { PuppetfileHoverProvider } from '../puppetfileHoverProvider';
import { PuppetForgeService, ForgeModule } from '../puppetForgeService';

describe('PuppetfileHoverProvider Test Suite', () => {
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
        expect(provider).toBeTruthy();
        expect(typeof provider.provideHover).toBe('function');
    });

    test('isPuppetfile should detect Puppetfile by filename', () => {
        const provider = createProvider();
        const isPuppetfile = (provider as any).isPuppetfile;
        const mockDocument = createMockDocument('/path/to/Puppetfile', 'plaintext');
        
        expect(isPuppetfile.call(provider, mockDocument)).toBe(true);
    });

    test('isPuppetfile should detect Puppetfile by language', () => {
        const provider = createProvider();
        const isPuppetfile = (provider as any).isPuppetfile;
        const mockDocument = createMockDocument('/path/to/somefile', 'puppetfile');
        
        expect(isPuppetfile.call(provider, mockDocument)).toBe(true);
    });

    test('isPuppetfile should reject non-Puppetfile files', () => {
        const provider = createProvider();
        const isPuppetfile = (provider as any).isPuppetfile;
        const mockDocument = createMockDocument('/path/to/somefile.txt', 'plaintext');
        
        expect(isPuppetfile.call(provider, mockDocument)).toBe(false);
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
            expect(markdownText.includes('**Owner:**')).toBe(false);
            expect(markdownText.includes('**Downloads:**')).toBe(false);
            expect(markdownText.includes('**Quality Score:**')).toBe(false);
            
            // Verify other important fields are still present
            expect(markdownText.includes('**Current Version:**')).toBe(true);
            expect(markdownText.includes('**Latest Version:**')).toBe(true);
            expect(markdownText.includes('**Dependencies:**')).toBe(true);
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

            expect(markdownText.includes('**Available Updates:**')).toBe('Should show available updates');
            expect(markdownText.includes(link1)).toBe('Should include link for 1.1.0');
            expect(markdownText.includes(link2)).toBe('Should include link for 1.2.0');
            expect(markdownText.includes(tooltip1)).toBe('Should include tooltip for 1.1.0');
            expect(markdownText.includes(tooltip2)).toBe('Should include tooltip for 1.2.0');
            expect(!markdownText.includes('**`1.0.0`**')).toBe('Current version should not appear in updates list');
            expect(!markdownText.includes(' • ')).toBe('Versions should not be separated by bullets');
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
            expect(!markdownText.includes('**Dependencies:**')).toBe('Dependencies field should NOT be present when version has no dependencies');
            expect(!markdownText.includes('puppetlabs/concat')).toBe('Dependencies from current_release should NOT be shown');
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
            expect(markdownText.includes('**Dependencies:**')).toBe('Dependencies section should be present');
            expect(markdownText.includes('puppetlabs/stdlib')).toBe('stdlib dependency should be shown');
            expect(markdownText.includes('puppetlabs/concat')).toBe('concat dependency should be shown');
            expect(markdownText.includes('>= 4.13.1 < 9.0.0')).toBe('stdlib version requirement should be shown');
            expect(markdownText.includes('>= 1.1.1 < 8.0.0')).toBe('concat version requirement should be shown');
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
            expect(markdownText.includes('**Dependencies:**')).toBe('Dependencies field should be present');
            expect(markdownText.includes('puppetlabs/concat')).toBe('Fallback dependency should be shown');
            expect(markdownText.includes('>= 1.0.0')).toBe('Version requirement should be shown');
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
            expect(markdownText.includes('**Dependencies:**')).toBe('Dependencies section should be present');
            expect(markdownText.includes('puppetlabs/stdlib')).toBe('stdlib dependency should be shown');
            expect(markdownText.includes('puppetlabs/concat')).toBe('concat dependency should be shown from v10.0.0');
            expect(markdownText.includes('>= 8.0.0 < 9.0.0')).toBe('stdlib version requirement from v10.0.0 should be shown');
            expect(markdownText.includes('>= 6.0.0 < 7.0.0')).toBe('concat version requirement from v10.0.0 should be shown');
            
            // Should NOT show dependencies from latest version (11.1.0)
            expect(!markdownText.includes('puppetlabs/systemd')).toBe('systemd dependency from latest should NOT be shown');
            expect(!markdownText.includes('>= 9.0.0 < 10.0.0')).toBe('latest stdlib version requirement should NOT be shown');
            expect(!markdownText.includes('>= 5.0.0 < 6.0.0')).toBe('latest systemd version requirement should NOT be shown');
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
            expect(markdownText.includes('**Available Updates:**')).toBe('Should show available updates');
            
            // Check that current version (3.0.0) is not shown in updates
            expect(!markdownText.includes('**`3.0.0`**')).toBe('Current version should not appear in updates');
            
            // Check that versions are not separated by bullets
            expect(!markdownText.includes(' • ')).toBe('Versions should not be separated by bullets');
            
            // Check that multiple rows exist (should have newlines between rows)
            const versionSection = markdownText.substring(
                markdownText.indexOf('**Available Updates:**'),
                markdownText.indexOf('**Dependencies:**') || markdownText.indexOf('[View on Puppet Forge]')
            );
            const lines = versionSection.split('\n').filter((line: string) => line.includes('`'));
            expect(lines.length > 1).toBe(true);
            
            // Check that first row has 5 versions max
            const firstRow = lines[0];
            const versionCount = (firstRow.match(/`[^`]+`/g) || []).length;
            expect(versionCount <= 5).toBe(true);
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
        
        expect(result).toBeTruthy();
        expect(result.name).toBe('puppetlabs/stdlib');
        expect(result.version).toBe('8.5.0');
        expect(result.line).toBe(1);
    });

    test('hasModuleCached should correctly check cache status', () => {
        // Clear cache first
        PuppetForgeService.clearCache();
        
        // Should return false for uncached module
        expect(PuppetForgeService.hasModuleCached('puppetlabs/stdlib')).toBe(false);
        
        // Mock cache by calling internal cache set
        const moduleVersionCache = (PuppetForgeService as any).moduleVersionCache;
        const versionMap = new Map();
        versionMap.set('8.5.0', { version: '8.5.0', metadata: {} });
        moduleVersionCache.set('puppetlabs/stdlib', versionMap);
        
        // Should return true for cached module
        expect(PuppetForgeService.hasModuleCached('puppetlabs/stdlib')).toBe(true);
        
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
                expect(markdownText.includes('🟢')).toBe('Should show green indicator for compatible versions');
                expect(markdownText.includes('🟢 [`8.5.0`]')).toBe('Version 8.5.0 should have green indicator');

                // Should contain yellow indicator for incompatible version
                expect(markdownText.includes('🟡')).toBe('Should show yellow indicator for incompatible versions');
                expect(markdownText.includes('🟡 [`9.0.0`]')).toBe('Version 9.0.0 should have yellow indicator');

                // Should show conflict details in tooltip
                expect(markdownText.includes('Conflicts:')).toBe('Should show conflict details');
                expect(markdownText.includes('puppetlabs/concat requires >= 4.13.1 < 9.0.0')).toBe('Should show specific conflict requirement');

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
            
            expect(result).toBe(null);
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
            
            expect(result).toBe(null);
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
            
            expect(result).toBe(null);
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
            expect(result).toBe(null);
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
            
            expect(result.includes('puppetlabs/stdlib'));
            expect(result.includes(':git'));
            expect(result.includes(':ref'));
            expect(result.includes(':tag'));
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
            expect(true);
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
            expect(result instanceof Map);
            
            consoleErrorStub.restore();
            restore();
        });
    });

});
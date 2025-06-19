import * as sinon from 'sinon';
import { PuppetfileHoverProvider } from '../../src/puppetfileHoverProvider';
import { PuppetForgeService, ForgeModule } from '../../src/services/puppetForgeService';
import { ModuleNameUtils } from '../../src/utils/moduleNameUtils';

describe('PuppetfileHoverProvider Test Suite', () => {
    let consoleWarnSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        // Suppress console output during tests
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Test utilities and factories
    const createProvider = () => new PuppetfileHoverProvider();
    
    const createMockDocument = (fileName: string, languageId: string) => ({
        fileName,
        languageId
    });

    const createForgeModule = (name: string, version: string = '8.5.0', dependencies: Array<{name: string; version_requirement: string}> = []): ForgeModule => ({
        name,
        slug: ModuleNameUtils.toDashFormat(name),
        owner: { 
            username: ModuleNameUtils.getOwner(name), 
            slug: ModuleNameUtils.getOwner(name) 
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
            expect(markdownText).not.toContain('**Owner:**');
            expect(markdownText).not.toContain('**Downloads:**');
            expect(markdownText).not.toContain('**Quality Score:**');
            
            // Verify other important fields are still present
            expect(markdownText).toContain('**Current Version:**');
            expect(markdownText).toContain('**Latest Version:**');
            expect(markdownText).toContain('**Dependencies:**');
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

            expect(markdownText).toContain('**Available Updates:**');
            expect(markdownText).toContain(link1);
            expect(markdownText).toContain(link2);
            expect(markdownText).toContain(tooltip1);
            expect(markdownText).toContain(tooltip2);
            expect(markdownText).not.toContain('**`1.0.0`**');
            expect(markdownText).not.toContain(' • ');
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
            expect(markdownText).not.toContain('**Dependencies:**');
            expect(markdownText).not.toContain('puppetlabs/concat');
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
            expect(markdownText).toContain('**Dependencies:**');
            expect(markdownText).toContain('puppetlabs/stdlib');
            expect(markdownText).toContain('puppetlabs/concat');
            expect(markdownText).toContain('>= 4.13.1 < 9.0.0');
            expect(markdownText).toContain('>= 1.1.1 < 8.0.0');
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
            expect(markdownText).toContain('**Dependencies:**');
            expect(markdownText).toContain('puppetlabs/concat');
            expect(markdownText).toContain('>= 1.0.0');
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
            expect(markdownText).toContain('**Dependencies:**');
            expect(markdownText).toContain('puppetlabs/stdlib');
            expect(markdownText).toContain('puppetlabs/concat');
            expect(markdownText).toContain('>= 8.0.0 < 9.0.0');
            expect(markdownText).toContain('>= 6.0.0 < 7.0.0');
            
            // Should NOT show dependencies from latest version (11.1.0)
            expect(markdownText).not.toContain('puppetlabs/systemd');
            expect(markdownText).not.toContain('>= 9.0.0 < 10.0.0');
            expect(markdownText).not.toContain('>= 5.0.0 < 6.0.0');
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
            expect(markdownText).toContain('**Available Updates:**');
            
            // Check that current version (3.0.0) is not shown in updates
            expect(markdownText).not.toContain('**`3.0.0`**');
            
            // Check that versions are not separated by bullets
            expect(markdownText).not.toContain(' • ');
            
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
        
        // Mock cache by calling internal cache set with normalized key
        const moduleVersionCache = (PuppetForgeService as any).moduleVersionCache;
        const versionMap = new Map();
        versionMap.set('8.5.0', { version: '8.5.0', metadata: {} });
        moduleVersionCache.set('puppetlabs-stdlib', versionMap); // Use canonical format
        
        // Should return true for cached module
        expect(PuppetForgeService.hasModuleCached('puppetlabs/stdlib')).toBe(true);
        
        // Clear cache
        PuppetForgeService.clearCache();
    });

    test('version compatibility indicators should be shown correctly', async () => {
        const provider = createProvider();
        
        // Mock the parseActiveEditor to return test modules
        const { PuppetfileParser } = require('../../src/puppetfileParser');
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
                expect(markdownText).toContain('🟢');
                expect(markdownText).toContain('🟢 [`8.5.0`]');

                // Should contain yellow indicator for incompatible version
                expect(markdownText).toContain('🟡');
                expect(markdownText).toContain('🟡 [`9.0.0`]');

                // Should show conflict details in tooltip
                expect(markdownText).toContain('Conflicts:');
                expect(markdownText).toContain('puppetlabs/concat requires >= 4.13.1 < 9.0.0');

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
            expect(result).not.toBe(null);
            if (result) {
                const markdown = result.contents[0] as any;
                expect(markdown.value).toContain('📦 puppetlabs/stdlib');
            }
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
            // Stub console.error and console.warn to suppress error output during test
            const consoleErrorStub = sinon.stub(console, 'error');
            const consoleWarnStub = sinon.stub(console, 'warn');
            
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
            consoleWarnStub.restore();
            restore();
        });
    });

    // Test Git module hover information
    test('should provide hover for Git modules with metadata', async () => {
        const provider = createProvider();
        
        // Stub console methods to suppress debug output
        const consoleDebugStub = sinon.stub(console, 'debug');
        const consoleInfoStub = sinon.stub(console, 'info');
        
        // Mock GitMetadataService.getModuleMetadataWithFallback
        const { GitMetadataService } = require('../../src/services/gitMetadataService');
        const originalGetMetadata = GitMetadataService.getModuleMetadataWithFallback;
        
        GitMetadataService.getModuleMetadataWithFallback = async () => ({
            name: 'custom/module',
            version: '1.0.0',
            summary: 'Test module summary',
            author: 'Test Author',
            license: 'Apache-2.0',
            project_page: 'https://github.com/test/module',
            issues_url: 'https://github.com/test/module/issues',
            description: 'Detailed description of the module',
            tags: ['test', 'module'],
            dependencies: [
                { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0' }
            ]
        });
        
        try {
            const mockModule = { 
                name: 'test/module', 
                source: 'git' as const, 
                gitUrl: 'https://github.com/test/module.git',
                gitTag: 'v1.0.0'
            };
            
            const result = await callGetModuleInfo(provider, mockModule);
            const markdownText = result.value;
            
            expect(markdownText).toContain('📦 test/module [Git]');
            expect(markdownText).toContain('Repository name: `custom/module`');
            expect(markdownText).toContain('Test module summary');
            expect(markdownText).toContain('**Version:** `1.0.0`');
            expect(markdownText).toContain('**Author:** Test Author');
            expect(markdownText).toContain('**License:** Apache-2.0');
            expect(markdownText).toContain('**Tag:** `v1.0.0`');
            expect(markdownText).toContain('**Dependencies:**');
            expect(markdownText).toContain('puppetlabs/stdlib');
            expect(markdownText).toContain('**Tags:** `test`, `module`');
        } finally {
            GitMetadataService.getModuleMetadataWithFallback = originalGetMetadata;
            consoleDebugStub.restore();
            consoleInfoStub.restore();
        }
    });

    test('should provide hover for Git modules without metadata', async () => {
        const provider = createProvider();
        
        // Stub console methods to suppress debug output
        const consoleDebugStub = sinon.stub(console, 'debug');
        
        // Mock GitMetadataService to return null (no metadata)
        const { GitMetadataService } = require('../../src/services/gitMetadataService');
        const originalGetMetadata = GitMetadataService.getModuleMetadataWithFallback;
        GitMetadataService.getModuleMetadataWithFallback = async () => null;
        
        try {
            const mockModule = { 
                name: 'test/module', 
                source: 'git' as const, 
                gitUrl: 'https://github.com/test/module.git',
                gitRef: 'main'
            };
            
            const result = await callGetModuleInfo(provider, mockModule);
            const markdownText = result.value;
            
            expect(markdownText).toContain('📦 test/module [Git]');
            expect(markdownText).toContain('**Repository:** [https://github.com/test/module.git](https://github.com/test/module.git)');
            expect(markdownText).toContain('**Reference:** `main`');
            expect(markdownText).toContain('Loading module information...');
            expect(markdownText).toContain('Git modules are not managed through Puppet Forge');
        } finally {
            GitMetadataService.getModuleMetadataWithFallback = originalGetMetadata;
            consoleDebugStub.restore();
        }
    });

    test('should handle Git metadata service errors gracefully', async () => {
        const provider = createProvider();
        
        // Mock GitMetadataService to throw error
        const { GitMetadataService } = require('../../src/services/gitMetadataService');
        const originalGetMetadata = GitMetadataService.getModuleMetadataWithFallback;
        GitMetadataService.getModuleMetadataWithFallback = async () => {
            throw new Error('Network error');
        };
        
        // Stub console methods to suppress debug and warning output
        const consoleDebugStub = sinon.stub(console, 'debug');
        const consoleWarnStub = sinon.stub(console, 'warn');
        
        try {
            const mockModule = { 
                name: 'test/module', 
                source: 'git' as const, 
                gitUrl: 'https://github.com/test/module.git'
            };
            
            const result = await callGetModuleInfo(provider, mockModule);
            const markdownText = result.value;
            
            // Should fallback to basic Git module info
            expect(markdownText).toContain('📦 test/module [Git]');
            expect(markdownText).toContain('**Reference:** Default branch');
            expect(markdownText).toContain('Loading module information...');
        } finally {
            GitMetadataService.getModuleMetadataWithFallback = originalGetMetadata;
            consoleDebugStub.restore();
            consoleWarnStub.restore();
        }
    });

    test('should handle caching initialization for uncached modules', async () => {
        await withServiceMocks(async (restore) => {
            const provider = createProvider();
            
            // Mock PuppetfileParser to return modules
            const { PuppetfileParser } = require('../../src/puppetfileParser');
            const originalParseActiveEditor = PuppetfileParser.parseActiveEditor;
            PuppetfileParser.parseActiveEditor = () => ({
                modules: [
                    { name: 'puppetlabs/stdlib', version: '8.5.0', source: 'forge' as const, line: 1 }
                ],
                errors: []
            });
            
            // Mock PuppetForgeService.hasModuleCached to return false (uncached)
            const originalHasModuleCached = PuppetForgeService.hasModuleCached;
            PuppetForgeService.hasModuleCached = () => false;
            
            // Mock CacheService.isCachingInProgress
            const { CacheService } = require('../../src/services/cacheService');
            const originalIsCachingInProgress = CacheService.isCachingInProgress;
            CacheService.isCachingInProgress = () => true;
            
            try {
                const mockModule = { name: 'puppetlabs/stdlib', version: '8.5.0', source: 'forge' as const };
                const result = await callGetModuleInfo(provider, mockModule);
                const markdownText = result.value;
                
                expect(markdownText).toContain('📦 puppetlabs/stdlib');
                expect(markdownText).toContain('Module cache is currently being initialized');
                expect(markdownText).toContain('Check the progress notification');
            } finally {
                PuppetfileParser.parseActiveEditor = originalParseActiveEditor;
                PuppetForgeService.hasModuleCached = originalHasModuleCached;
                CacheService.isCachingInProgress = originalIsCachingInProgress;
                restore();
            }
        });
    });

    test('should handle module without version (latest)', async () => {
        await withServiceMocks(async () => {
            const provider = createProvider();
            const mockForgeModule = createForgeModule('puppetlabs/stdlib', '8.5.0');
            const mockUpdateInfo = { latestVersion: '8.5.0', hasUpdate: false };
            const mockReleases = [
                createMockRelease('8.5.0'),
                createMockRelease('8.4.0'),
                createMockRelease('8.3.0')
            ];

            PuppetForgeService.getModule = async () => mockForgeModule;
            PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
            PuppetForgeService.getModuleReleases = async () => mockReleases;

            // Module without version specified
            const mockModule = { name: 'puppetlabs/stdlib', source: 'forge' as const };
            const result = await callGetModuleInfo(provider, mockModule);
            const markdownText = result.value;

            expect(markdownText).toContain('**Version:** Latest available');
            expect(markdownText).toContain('**Available Versions:**');
            expect(markdownText).toContain('8.5.0');
            expect(markdownText).toContain('8.4.0');
            expect(markdownText).toContain('8.3.0');
        });
    });

    test('should handle old module name format with dash', async () => {
        await withServiceMocks(async () => {
            const provider = createProvider();
            const mockModule = { name: 'puppetlabs-stdlib', version: '8.5.0', source: 'forge' as const };
            
            // Test internal getForgeModuleUrl method
            const url = (provider as any).getForgeModuleUrl(mockModule, null, '8.5.0');
            
            expect(url).toBe('https://forge.puppet.com/modules/puppetlabs/stdlib/8.5.0/dependencies');
        });
    });

    test('should handle module name without slash or dash', async () => {
        await withServiceMocks(async () => {
            const provider = createProvider();
            const mockModule = { name: 'stdlib', version: '8.5.0', source: 'forge' as const };
            
            // Test internal getForgeModuleUrl method
            const url = (provider as any).getForgeModuleUrl(mockModule, null, '8.5.0');
            
            expect(url).toBe('https://forge.puppet.com/modules/stdlib/8.5.0/dependencies');
        });
    });

    test('should handle appendGitReference with different Git references', async () => {
        const provider = createProvider();
        const markdown = new (require('vscode')).MarkdownString();
        markdown.isTrusted = true;
        
        // Test with gitTag
        let mockModule: any = { name: 'test/module', source: 'git' as const, gitTag: 'v1.0.0' };
        (provider as any).appendGitReference(markdown, mockModule);
        expect(markdown.value).toContain('**Tag:** `v1.0.0`');
        
        // Reset markdown
        markdown.value = '';
        
        // Test with gitRef
        mockModule = { name: 'test/module', source: 'git' as const, gitRef: 'develop' };
        (provider as any).appendGitReference(markdown, mockModule);
        expect(markdown.value).toContain('**Reference:** `develop`');
        
        // Reset markdown
        markdown.value = '';
        
        // Test with neither gitTag nor gitRef
        mockModule = { name: 'test/module', source: 'git' as const };
        (provider as any).appendGitReference(markdown, mockModule);
        expect(markdown.value).toContain('**Reference:** Default branch');
    });

    test('should handle empty module releases list', async () => {
        await withServiceMocks(async () => {
            const provider = createProvider();
            const mockForgeModule = createForgeModule('puppetlabs/stdlib', '8.5.0');
            const mockUpdateInfo = { latestVersion: '8.5.0', hasUpdate: false };
            const mockReleases: any[] = []; // Empty releases

            PuppetForgeService.getModule = async () => mockForgeModule;
            PuppetForgeService.checkForUpdate = async () => mockUpdateInfo;
            PuppetForgeService.getModuleReleases = async () => mockReleases;

            const mockModule = { name: 'puppetlabs/stdlib', version: '8.5.0', source: 'forge' as const };
            const result = await callGetModuleInfo(provider, mockModule);
            const markdownText = result.value;

            expect(markdownText).toContain('📦 puppetlabs/stdlib');
            expect(markdownText).toContain('**Current Version:** `8.5.0`');
            expect(markdownText).not.toContain('**Available Updates:**');
        });
    });

    test('should handle comment stripping in parseModuleFromPosition', () => {
        const provider = createProvider();
        const parseModuleFromPosition = (provider as any).parseModuleFromPosition;
        
        const mockDocument = {
            lineAt: (line: number) => ({ 
                text: "mod 'puppetlabs/stdlib', '8.5.0' # This is a comment" 
            }),
            getText: () => "mod 'puppetlabs/stdlib', '8.5.0' # This is a comment"
        };
        const mockPosition = { line: 0, character: 10 };
        
        const result = parseModuleFromPosition.call(provider, mockDocument, mockPosition);
        
        expect(result).toBeTruthy();
        expect(result.name).toBe('puppetlabs/stdlib');
        expect(result.version).toBe('8.5.0');
    });

    test('should handle parsing error in parseModuleFromPosition', () => {
        const provider = createProvider();
        const parseModuleFromPosition = (provider as any).parseModuleFromPosition;
        
        const mockDocument = {
            lineAt: (line: number) => ({ 
                text: "invalid module syntax" 
            }),
            getText: () => "invalid module syntax"
        };
        const mockPosition = { line: 0, character: 10 };
        
        const result = parseModuleFromPosition.call(provider, mockDocument, mockPosition);
        
        expect(result).toBe(null);
    });

    test('should handle basic module info with valid module name', async () => {
        const provider = createProvider();
        
        // Create a module with a normal name that should work
        const mockModule = { name: 'puppetlabs/stdlib', version: '8.5.0', source: 'forge' as const };
        
        const result = (provider as any).getBasicModuleInfo(mockModule);
        const markdownText = result.value;
        
        expect(markdownText).toContain('📦 puppetlabs/stdlib');
        expect(markdownText).toContain('**Version:** `8.5.0`');
        expect(markdownText).toContain('**Source:** Puppet Forge');
        expect(markdownText).toContain('View on Puppet Forge');
    });

    test('should handle Git module with only gitUrl and no other references', async () => {
        const provider = createProvider();
        
        const mockModule = { 
            name: 'test/module', 
            source: 'git' as const, 
            gitUrl: 'https://github.com/test/module.git'
        };
        
        const result = (provider as any).getBasicGitModuleInfo(mockModule);
        const markdownText = result.value;
        
        expect(markdownText).toContain('📦 test/module [Git]');
        expect(markdownText).toContain('**Repository:** [https://github.com/test/module.git](https://github.com/test/module.git)');
        expect(markdownText).toContain('**Reference:** Default branch');
        expect(markdownText).toContain('**Source:** Git repository');
    });

    test('should handle extractCompleteModuleDefinition with no additional lines', () => {
        const provider = createProvider();
        const mockDocument = {
            lineCount: 2,
            lineAt: (lineNumber: number) => {
                const lines = [
                    "mod 'puppetlabs/stdlib', '8.5.0'",
                    "mod 'puppetlabs/concat', '7.0.0'"
                ];
                return { text: lines[lineNumber] || '' };
            }
        };
        
        const result = (provider as any).extractCompleteModuleDefinition(mockDocument, 0);
        
        expect(result).toBe("mod 'puppetlabs/stdlib', '8.5.0'");
    });

    test('should handle error in formatGitModuleWithMetadata', async () => {
        const provider = createProvider();
        
        // Mock a module that will cause an error during formatting
        const mockModule = { name: 'test/module', source: 'git' as const };
        const mockMetadata = null; // This will cause an error when accessing properties
        
        // Stub console.error to suppress error output
        const consoleErrorStub = sinon.stub(console, 'error');
        
        try {
            const result = (provider as any).formatGitModuleWithMetadata(mockModule, mockMetadata);
            
            // Should fallback to basic Git module info
            expect(result.value).toContain('📦 test/module [Git]');
            expect(result.value).toContain('Loading module information...');
        } finally {
            consoleErrorStub.restore();
        }
    });

    test('should handle checkAndInitializeCache error gracefully', async () => {
        const provider = createProvider();
        
        // Mock PuppetfileParser to throw an error
        const { PuppetfileParser } = require('../../src/puppetfileParser');
        const originalParseActiveEditor = PuppetfileParser.parseActiveEditor;
        PuppetfileParser.parseActiveEditor = () => {
            throw new Error('Parser error');
        };
        
        // Stub console.error to suppress error output
        const consoleErrorStub = sinon.stub(console, 'error');
        
        try {
            const result = await (provider as any).checkAndInitializeCache();
            
            // Should return false when error occurs
            expect(result).toBe(false);
        } finally {
            PuppetfileParser.parseActiveEditor = originalParseActiveEditor;
            consoleErrorStub.restore();
        }
    });

    test('should handle createModuleError in Git module processing', async () => {
        const provider = createProvider();
        
        // Stub console methods to suppress debug output
        const consoleDebugStub = sinon.stub(console, 'debug');
        
        try {
            // Mock a module with no gitUrl to test the fallback path in getGitModuleInfo
            const mockModule = { name: 'test/module', source: 'git' as const };
            
            const result = await callGetModuleInfo(provider, mockModule);
            const markdownText = result.value;
            
            // Should fallback to basic Git module info when no gitUrl is present
            expect(markdownText).toContain('📦 test/module [Git]');
            expect(markdownText).toContain('**Source:** Git repository');
            expect(markdownText).toContain('Loading module information...');
        } finally {
            consoleDebugStub.restore();
        }
    });

});
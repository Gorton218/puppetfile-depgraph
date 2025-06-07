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
        }
    });
});
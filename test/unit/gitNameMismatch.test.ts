import { PuppetfileHoverProvider } from '../../src/puppetfileHoverProvider';

describe('Git Module Name Mismatch Test Suite', () => {
    
    test('should handle Git module name mismatch gracefully', async () => {
        const hoverProvider = new PuppetfileHoverProvider();
        
        // Mock module with Puppetfile name different from metadata.json name
        const module = {
            name: 'echocat/graphite',  // Name as declared in Puppetfile
            source: 'git' as const,
            gitUrl: 'https://github.com/echocat/puppet-graphite.git',
            gitRef: 'master',
            line: 1
        };
        
        // Mock metadata with different name (as would come from metadata.json)
        const mockMetadata = {
            name: 'dwerder-graphite',  // Different name in metadata.json
            version: '1.0.0',
            author: 'Test Author',
            summary: 'Test module',
            license: 'Apache-2.0',
            source: 'https://github.com/echocat/puppet-graphite.git'
        };
        
        // Test the formatGitModuleWithMetadata method
        const result = (hoverProvider as any).formatGitModuleWithMetadata(module, mockMetadata);
        
        // The result should be a MarkdownString
        expect(typeof result).toBe('object');
        expect(typeof result.appendMarkdown).toBe('function');
        
        // Convert to string to check content
        const markdownValue = result.value || '';
        
        // Should display the Puppetfile name in the header
        expect(markdownValue).toContain('echocat/graphite'); // Should display Puppetfile declared name in header
        
        // Should show the metadata name as repository name
        expect(markdownValue).toContain('Repository name: `dwerder-graphite`'); // Should show metadata name as repository name when different
        
        // Should include other metadata
        expect(markdownValue).toContain('Test Author'); // Should include author
        expect(markdownValue).toContain('Test module'); // Should include summary
    });
    
    test('should not show repository name when names match', async () => {
        const hoverProvider = new PuppetfileHoverProvider();
        
        // Mock module with matching names
        const module = {
            name: 'puppetlabs/apache',
            source: 'git' as const,
            gitUrl: 'https://github.com/puppetlabs/puppetlabs-apache.git',
            gitTag: 'v5.10.0',
            line: 1
        };
        
        // Mock metadata with same name
        const mockMetadata = {
            name: 'puppetlabs/apache',  // Same name
            version: '5.10.0',
            author: 'Puppet Labs',
            summary: 'Apache module',
            license: 'Apache-2.0',
            source: 'https://github.com/puppetlabs/puppetlabs-apache.git'
        };
        
        // Test the formatGitModuleWithMetadata method
        const result = (hoverProvider as any).formatGitModuleWithMetadata(module, mockMetadata);
        
        // Convert to string to check content
        const markdownValue = result.value || '';
        
        // Should display the name in the header
        expect(markdownValue).toContain('puppetlabs/apache'); // Should display module name in header
        
        // Should NOT show repository name since they match
        expect(markdownValue).not.toContain('Repository name:'); // Should not show repository name when names match
    });
    
    test('should handle errors in formatGitModuleWithMetadata gracefully', async () => {
        const hoverProvider = new PuppetfileHoverProvider();
        
        const module = {
            name: 'test/module',
            source: 'git' as const,
            gitUrl: 'https://github.com/test/module.git',
            line: 1
        };
        
        // Mock metadata that might cause issues
        const problematicMetadata = {
            name: null as any,  // Null name that might cause issues
            version: undefined as any,
            author: '',
            summary: '',
            license: '',
            source: ''
        };
        
        // Should not throw, should return fallback
        let result;
        expect(() => {
            result = (hoverProvider as any).formatGitModuleWithMetadata(module, problematicMetadata);
        }).not.toThrow();
        
        // Should return some kind of markdown
        expect(typeof result).toBe('object');
    });
});
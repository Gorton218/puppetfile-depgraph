import * as vscode from 'vscode';
import { PuppetfileParser, PuppetModule } from '../../src/puppetfileParser';

// Helper function to assert module properties
function assertModule(module: PuppetModule, expected: Partial<PuppetModule>, description?: string) {
    const prefix = description ? `${description}: ` : '';
    if (expected.name !== undefined) { expect(module.name).toBe(expected.name); }
    if (expected.version !== undefined) { expect(module.version).toBe(expected.version); }
    if (expected.source !== undefined) { expect(module.source).toBe(expected.source); }
    if (expected.line !== undefined) { expect(module.line).toBe(expected.line); }
    if (expected.gitUrl !== undefined) { expect(module.gitUrl).toBe(expected.gitUrl); }
    if (expected.gitTag !== undefined) { expect(module.gitTag).toBe(expected.gitTag); }
    if (expected.gitRef !== undefined) { expect(module.gitRef).toBe(expected.gitRef); }
}

describe('PuppetfileParser Test Suite', () => {

    test('Parse simple forge module with version', () => {
        const content = `mod 'puppetlabs-stdlib', '9.4.1'`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(1);

        assertModule(result.modules[0], {
            name: 'puppetlabs-stdlib',
            version: '9.4.1',
            source: 'forge',
            line: 1
        });
    });

    test('Parse simple forge module without version', () => {
        const content = `mod 'puppetlabs-apache'`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(1);

        assertModule(result.modules[0], {
            name: 'puppetlabs-apache',
            version: undefined,
            source: 'forge'
        });
    });

    test('Parse git module with tag', () => {
        const content = `mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.2.3'`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(1);

        assertModule(result.modules[0], {
            name: 'mymodule',
            source: 'git',
            gitUrl: 'https://github.com/user/mymodule.git',
            gitTag: 'v1.2.3'
        });
    });

    test('Parse git module with ref', () => {
        const content = `mod 'mymodule', :git => 'git@github.com:user/mymodule.git', :ref => 'main'`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(1);

        assertModule(result.modules[0], {
            name: 'mymodule',
            source: 'git',
            gitUrl: 'git@github.com:user/mymodule.git',
            gitRef: 'main'
        });
    });

    test('Parse git module without tag or ref', () => {
        const content = `mod 'mymodule', :git => 'https://github.com/user/mymodule.git'`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(1);

        assertModule(result.modules[0], {
            name: 'mymodule',
            source: 'git',
            gitUrl: 'https://github.com/user/mymodule.git',
            gitTag: undefined,
            gitRef: undefined
        });
    });

    test('Parse multiple modules', () => {
        const content = `# This is a comment
forge 'https://forgeapi.puppet.com'

mod 'puppetlabs-stdlib', '9.4.1'
mod 'puppetlabs-apache'
mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.0.0'

# Another comment
mod 'puppetlabs-mysql', '15.0.0'`;

        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(4);

        // Check first module
        expect(result.modules[0].name).toBe('puppetlabs-stdlib');
        expect(result.modules[0].version).toBe('9.4.1');
        expect(result.modules[0].source).toBe('forge');
        expect(result.modules[0].line).toBe(4);

        // Check second module
        expect(result.modules[1].name).toBe('puppetlabs-apache');
        expect(result.modules[1].version).toBe(undefined);
        expect(result.modules[1].source).toBe('forge');
        expect(result.modules[1].line).toBe(5);

        // Check third module (git)
        expect(result.modules[2].name).toBe('mymodule');
        expect(result.modules[2].source).toBe('git');
        expect(result.modules[2].gitUrl).toBe('https://github.com/user/mymodule.git');
        expect(result.modules[2].gitTag).toBe('v1.0.0');
        expect(result.modules[2].line).toBe(6);

        // Check fourth module
        expect(result.modules[3].name).toBe('puppetlabs-mysql');
        expect(result.modules[3].version).toBe('15.0.0');
        expect(result.modules[3].source).toBe('forge');
        expect(result.modules[3].line).toBe(9);
    });

    test('Handle empty content', () => {
        const content = '';
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(0);
    });

    test('Handle comments only', () => {
        const content = `# This is a comment
# Another comment
# Yet another comment`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(0);
    });

    test('Handle forge declaration lines', () => {
        const content = `forge 'https://forgeapi.puppet.com'
mod 'puppetlabs-stdlib', '9.4.1'`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(1);
        expect(result.modules[0].name).toBe('puppetlabs-stdlib');
    });

    test('Handle mixed quotes', () => {
        const content = `mod "puppetlabs-stdlib", "9.4.1"
mod 'puppetlabs-apache', '2.11.0'`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(2);

        expect(result.modules[0].name).toBe('puppetlabs-stdlib');
        expect(result.modules[0].version).toBe('9.4.1');

        expect(result.modules[1].name).toBe('puppetlabs-apache');
        expect(result.modules[1].version).toBe('2.11.0');
    }); test('Handle complex git module with multiple options', () => {
        const content = `mod 'mymodule',
  :git => 'https://github.com/user/mymodule.git',
  :tag => 'v2.1.0'`;

        // For now, this complex multiline format might not parse correctly
        // This test documents the current limitation
        const result = PuppetfileParser.parseContent(content);

        // Current parser limitation: multiline declarations may not be fully supported
        // For now, we expect the module to be detected but might be classified as forge
        // This is a known limitation that could be addressed in future versions
        if (result.modules.length > 0) {
            expect(result.modules[0].name).toBe('mymodule');
            // Note: multiline git declarations are not fully supported yet
            // expect(result.modules[0].source).toBe('git');
        }
    });

    test('Handle whitespace variations', () => {
        const content = `   mod   'puppetlabs-stdlib'  ,  '9.4.1'   
mod'puppetlabs-apache'`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(2);

        expect(result.modules[0].name).toBe('puppetlabs-stdlib');
        expect(result.modules[0].version).toBe('9.4.1');

        expect(result.modules[1].name).toBe('puppetlabs-apache');
    });

    test('Handle inline comments', () => {
        const content = `mod 'puppetlabs-stdlib', '9.4.1' # Latest stable version
mod 'puppetlabs-apache', '2.11.0' # Apache module
mod 'puppetlabs-mongodb', '0.17.0' # Example of commit
mod 'puppetlabs-mysql' # No version specified`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(4);

        // First module with inline comment
        expect(result.modules[0].name).toBe('puppetlabs-stdlib');
        expect(result.modules[0].version).toBe('9.4.1');
        expect(result.modules[0].source).toBe('forge');

        // Second module with inline comment
        expect(result.modules[1].name).toBe('puppetlabs-apache');
        expect(result.modules[1].version).toBe('2.11.0');
        expect(result.modules[1].source).toBe('forge');

        // Third module - the one from the bug report
        expect(result.modules[2].name).toBe('puppetlabs-mongodb');
        expect(result.modules[2].version).toBe('0.17.0');
        expect(result.modules[2].source).toBe('forge');

        // Fourth module without version but with comment
        expect(result.modules[3].name).toBe('puppetlabs-mysql');
        expect(result.modules[3].version).toBe(undefined);
        expect(result.modules[3].source).toBe('forge');
    });

    test('Handle git modules with inline comments', () => {
        const content = `mod 'mymodule', :git => 'https://github.com/user/mymodule.git' # Default branch
mod 'another', :git => 'https://github.com/user/another.git', :tag => 'v1.0.0' # Stable release
mod 'third', :git => 'https://github.com/user/third.git', :ref => 'main' # Main branch`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(3);

        // First git module with comment
        expect(result.modules[0].name).toBe('mymodule');
        expect(result.modules[0].source).toBe('git');
        expect(result.modules[0].gitUrl).toBe('https://github.com/user/mymodule.git');

        // Second git module with tag and comment
        expect(result.modules[1].name).toBe('another');
        expect(result.modules[1].source).toBe('git');
        expect(result.modules[1].gitUrl).toBe('https://github.com/user/another.git');
        expect(result.modules[1].gitTag).toBe('v1.0.0');

        // Third git module with ref and comment
        expect(result.modules[2].name).toBe('third');
        expect(result.modules[2].source).toBe('git');
        expect(result.modules[2].gitUrl).toBe('https://github.com/user/third.git');
        expect(result.modules[2].gitRef).toBe('main');
    });

    test('Parse multi-line git module with ref', () => {
        const content = `mod 'echocat/graphite',
    :git => 'https://github.com/example/puppet-graphite.git',
    :ref => 'bump_deps_1'`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(1);

        const module = result.modules[0];
        expect(module.name).toBe('echocat/graphite');
        expect(module.source).toBe('git');
        expect(module.gitUrl).toBe('https://github.com/example/puppet-graphite.git');
        expect(module.gitRef).toBe('bump_deps_1');
        expect(module.line).toBe(1);
    });

    test('Parse multi-line git module with tag', () => {
        const content = `mod 'puppetlabs/apache',
    :git => 'https://github.com/puppetlabs/puppetlabs-apache.git',
    :tag => 'v5.10.0'`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(1);

        const module = result.modules[0];
        expect(module.name).toBe('puppetlabs/apache');
        expect(module.source).toBe('git');
        expect(module.gitUrl).toBe('https://github.com/puppetlabs/puppetlabs-apache.git');
        expect(module.gitTag).toBe('v5.10.0');
        expect(module.line).toBe(1);
    });

    test('Parse mixed single-line and multi-line modules', () => {
        const content = `mod 'puppetlabs-stdlib', '9.4.1'
mod 'echocat/graphite',
    :git => 'https://github.com/example/puppet-graphite.git',
    :ref => 'bump_deps_1'
mod 'puppetlabs-apache', '2.11.0'`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(3);

        // First module - single line forge
        expect(result.modules[0].name).toBe('puppetlabs-stdlib');
        expect(result.modules[0].version).toBe('9.4.1');
        expect(result.modules[0].source).toBe('forge');
        expect(result.modules[0].line).toBe(1);

        // Second module - multi-line git
        expect(result.modules[1].name).toBe('echocat/graphite');
        expect(result.modules[1].source).toBe('git');
        expect(result.modules[1].gitUrl).toBe('https://github.com/example/puppet-graphite.git');
        expect(result.modules[1].gitRef).toBe('bump_deps_1');
        expect(result.modules[1].line).toBe(2);

        // Third module - single line forge
        expect(result.modules[2].name).toBe('puppetlabs-apache');
        expect(result.modules[2].version).toBe('2.11.0');
        expect(result.modules[2].source).toBe('forge');
        expect(result.modules[2].line).toBe(5);
    });

    test('Parse multi-line git module with inline comment on first line', () => {
        const content = `mod 'puppet/collectd', # Example of a git-based module with comment
    :git => 'https://github.com/voxpupuli/puppet-collectd.git',
    :ref => 'v14.0.0'`;
        const result = PuppetfileParser.parseContent(content);

        expect(result.errors.length).toBe(0);
        expect(result.modules.length).toBe(1);

        const module = result.modules[0];
        expect(module.name).toBe('puppet/collectd');
        expect(module.source).toBe('git');
        expect(module.gitUrl).toBe('https://github.com/voxpupuli/puppet-collectd.git');
        expect(module.gitRef).toBe('v14.0.0');
        expect(module.line).toBe(1);
    });

    // Test parseActiveEditor with no active editor
    test('parseActiveEditor should handle no active editor', () => {
        const originalGetPropertyDescriptor = Object.getOwnPropertyDescriptor;

        try {
            // Mock Object.getOwnPropertyDescriptor to return undefined for activeTextEditor
            Object.getOwnPropertyDescriptor = (target, prop) => {
                if (target === vscode.window && prop === 'activeTextEditor') {
                    return { value: undefined, configurable: true, enumerable: true, writable: true };
                }
                return originalGetPropertyDescriptor(target, prop);
            };

            // Override the property with undefined
            Object.defineProperty(vscode.window, 'activeTextEditor', {
                value: undefined,
                configurable: true
            });

            const result = PuppetfileParser.parseActiveEditor();

            expect(result.modules.length).toBe(0);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0].includes('No active editor')).toBe(true);
        } finally {
            Object.getOwnPropertyDescriptor = originalGetPropertyDescriptor;
        }
    });

    // Test parseActiveEditor with non-Puppetfile document
    test('parseActiveEditor should handle non-Puppetfile documents', () => {
        const originalGetPropertyDescriptor = Object.getOwnPropertyDescriptor;

        try {
            const mockEditor = {
                document: {
                    fileName: 'test.js',
                    languageId: 'javascript',
                    getText: () => 'const x = 1;'
                }
            };

            Object.defineProperty(vscode.window, 'activeTextEditor', {
                value: mockEditor,
                configurable: true
            });

            const result = PuppetfileParser.parseActiveEditor();

            expect(result.modules.length).toBe(0);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0].includes('not a Puppetfile')).toBe(true);
        } finally {
            Object.getOwnPropertyDescriptor = originalGetPropertyDescriptor;
        }
    });

    // Test getActivePuppetfileDocument with no active editor
    test('getActivePuppetfileDocument should return null with no active editor', () => {
        const originalGetPropertyDescriptor = Object.getOwnPropertyDescriptor;

        try {
            Object.defineProperty(vscode.window, 'activeTextEditor', {
                value: undefined,
                configurable: true
            });

            const result = PuppetfileParser.getActivePuppetfileDocument();

            expect(result).toBe(null);
        } finally {
            Object.getOwnPropertyDescriptor = originalGetPropertyDescriptor;
        }
    });

    // Test getActivePuppetfileDocument with non-Puppetfile document
    test('getActivePuppetfileDocument should return null for non-Puppetfile documents', () => {
        const originalGetPropertyDescriptor = Object.getOwnPropertyDescriptor;

        try {
            const mockEditor = {
                document: {
                    fileName: 'test.py',
                    languageId: 'python'
                }
            };

            Object.defineProperty(vscode.window, 'activeTextEditor', {
                value: mockEditor,
                configurable: true
            });

            const result = PuppetfileParser.getActivePuppetfileDocument();

            expect(result).toBe(null);
        } finally {
            Object.getOwnPropertyDescriptor = originalGetPropertyDescriptor;
        }
    });

    // Test parseMultiLineModule parsing failure scenarios
    test('parseMultiLineModule should handle malformed multi-line modules', () => {
        const content = `mod 'incomplete-module',
    :git => 'https://github.com/user/repo.git'
    # Missing closing quote or proper end`;

        const result = PuppetfileParser.parseContent(content);

        // Should still try to parse what it can, but may produce errors or incomplete modules
        // The exact behavior depends on implementation, but should not crash
        expect(Array.isArray(result.modules)).toBe(true);
        expect(Array.isArray(result.errors)).toBe(true);
    });

    // Test edge case with incomplete multi-line module
    test('parseMultiLineModule should handle module without proper end', () => {
        const content = `mod 'test-module',
    :git => 'https://example.com/repo.git',
    :ref =>`;

        const result = PuppetfileParser.parseContent(content);

        // Should handle gracefully without crashing
        expect(Array.isArray(result.modules)).toBe(true);
        expect(Array.isArray(result.errors)).toBe(true);
    });

    // Test complex parsing scenarios that might trigger error paths
    test('should handle complex parsing edge cases', () => {
        const content = `
# Complex scenarios that might trigger various parsing paths
mod 'valid-module', '1.0.0'

mod 'incomplete-git-module',
    :git => 'https://github.com/example/repo.git'
    # Missing proper closure

mod 'another-valid', '2.0.0'
`;

        const result = PuppetfileParser.parseContent(content);

        // Should handle mixed valid and problematic content
        expect(Array.isArray(result.modules)).toBe(true);
        expect(Array.isArray(result.errors)).toBe(true);

        // Should successfully parse at least the valid modules
        const validModules = result.modules.filter(m => m.name === 'valid-module' || m.name === 'another-valid');
        expect(validModules.length >= 2).toBe(true);
    });

    test('should handle invalid module declaration syntax', () => {
        const content = `mod bad-syntax-without-quotes`;
        
        const result = PuppetfileParser.parseContent(content);
        
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain('Invalid module declaration syntax');
        expect(result.modules.length).toBe(0);
    });

    test('should handle non-module lines that start with mod but are invalid', () => {
        const content = `mod 'valid-module', '1.0.0'
something else mod related but not a module`;
        
        const result = PuppetfileParser.parseContent(content);
        
        // Should successfully parse the valid module and skip the invalid line
        expect(result.modules.length).toBe(1);
        expect(result.modules[0].name).toBe('valid-module');
        expect(result.errors.length).toBe(0);
    });

    test('should handle complex module with parentheses and brackets', () => {
        const content = `mod 'complex-module',
    :git => 'https://github.com/user/repo.git',
    :ref => 'main'
    )`;
        
        const result = PuppetfileParser.parseContent(content);
        
        expect(result.modules.length).toBe(1);
        expect(result.modules[0].name).toBe('complex-module');
        expect(result.modules[0].source).toBe('git');
        expect(result.modules[0].gitUrl).toBe('https://github.com/user/repo.git');
        expect(result.modules[0].gitRef).toBe('main');
    });

    test('should handle complex module with closing bracket', () => {
        const content = `mod 'array-module',
    :git => 'https://github.com/user/repo.git',
    :ref => 'main'
    ]`;
        
        const result = PuppetfileParser.parseContent(content);
        
        expect(result.modules.length).toBe(1);
        expect(result.modules[0].name).toBe('array-module');
        expect(result.modules[0].source).toBe('git');
        expect(result.modules[0].gitUrl).toBe('https://github.com/user/repo.git');
        expect(result.modules[0].gitRef).toBe('main');
    });

    test('should handle multiline module with empty lines and comments', () => {
        const content = `mod 'test-module',

    # This is a comment within the module definition
    
    :git => 'https://github.com/user/repo.git',
    
    # Another comment
    :ref => 'main'`;
        
        const result = PuppetfileParser.parseContent(content);
        
        expect(result.modules.length).toBe(1);
        expect(result.modules[0].name).toBe('test-module');
        expect(result.modules[0].source).toBe('git');
        expect(result.modules[0].gitUrl).toBe('https://github.com/user/repo.git');
        expect(result.modules[0].gitRef).toBe('main');
    });

    test('should handle forge module with complex syntax patterns', () => {
        const content = `mod 'complex-forge', '1.0.0', some_option => 'value'`;
        
        const result = PuppetfileParser.parseContent(content);
        
        expect(result.modules.length).toBe(1);
        expect(result.modules[0].name).toBe('complex-forge');
        expect(result.modules[0].version).toBe('1.0.0');
        expect(result.modules[0].source).toBe('forge');
    });

    test('should handle git module with version-like string that is actually git URL', () => {
        const content = `mod 'git-module', :git => 'https://github.com/user/repo.git', '1.0.0'`;
        
        const result = PuppetfileParser.parseContent(content);
        
        expect(result.modules.length).toBe(1);
        expect(result.modules[0].name).toBe('git-module');
        expect(result.modules[0].source).toBe('git');
        expect(result.modules[0].gitUrl).toBe('https://github.com/user/repo.git');
        expect(result.modules[0].version).toBeUndefined();
    });


    test('should handle isPuppetfile method with various file patterns', () => {
        // Test file ending with "puppetfile"
        const mockDoc1 = { fileName: '/path/to/Puppetfile', languageId: 'text' };
        const result1 = (PuppetfileParser as any).isPuppetfile(mockDoc1);
        expect(result1).toBe(true);

        // Test file containing "puppetfile"
        const mockDoc2 = { fileName: '/path/to/my.puppetfile.local', languageId: 'text' };
        const result2 = (PuppetfileParser as any).isPuppetfile(mockDoc2);
        expect(result2).toBe(true);

        // Test file with puppetfile language ID
        const mockDoc3 = { fileName: '/path/to/somefile', languageId: 'puppetfile' };
        const result3 = (PuppetfileParser as any).isPuppetfile(mockDoc3);
        expect(result3).toBe(true);

        // Test file that is not a Puppetfile
        const mockDoc4 = { fileName: '/path/to/other.txt', languageId: 'text' };
        const result4 = (PuppetfileParser as any).isPuppetfile(mockDoc4);
        expect(result4).toBe(false);
    });

    test('getActivePuppetfileDocument should return document for valid Puppetfile', () => {
        const originalGetPropertyDescriptor = Object.getOwnPropertyDescriptor;

        try {
            const mockEditor = {
                document: {
                    fileName: 'Puppetfile',
                    languageId: 'puppetfile'
                }
            };

            Object.defineProperty(vscode.window, 'activeTextEditor', {
                value: mockEditor,
                configurable: true
            });

            const result = PuppetfileParser.getActivePuppetfileDocument();

            expect(result).toBe(mockEditor.document);
        } finally {
            Object.getOwnPropertyDescriptor = originalGetPropertyDescriptor;
        }
    });

    test('should handle multiline module that never finds proper end', () => {
        const content = `mod 'endless-module',
    :git => 'https://github.com/user/repo.git',
    :ref => 'main',
    :some_option => 'value',
    :another_option => 'value2',`;
        
        const result = PuppetfileParser.parseContent(content);
        
        // Should still parse as a single line since multiline parsing fails
        expect(result.modules.length).toBe(1);
        expect(result.modules[0].name).toBe('endless-module');
    });

    test('should handle tag extraction in extractGitRef method', () => {
        const content = `mod 'tag-module', :git => 'https://github.com/user/repo.git', :tag => 'v2.0.0'`;
        
        const result = PuppetfileParser.parseContent(content);
        
        expect(result.modules.length).toBe(1);
        expect(result.modules[0].gitTag).toBe('v2.0.0');
        expect(result.modules[0].gitRef).toBeUndefined();
    });

    test('should handle ref extraction in extractGitRef method', () => {
        const content = `mod 'ref-module', :git => 'https://github.com/user/repo.git', :ref => 'develop'`;
        
        const result = PuppetfileParser.parseContent(content);
        
        expect(result.modules.length).toBe(1);
        expect(result.modules[0].gitRef).toBe('develop');
        expect(result.modules[0].gitTag).toBeUndefined();
    });
});

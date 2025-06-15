import { PuppetfileParser } from './puppetfileParser';

describe('PuppetfileParser', () => {
  describe('parseContent', () => {
    test('should parse simple forge module with version', () => {
      const content = "mod 'puppetlabs/stdlib', '8.5.0'";
      const result = PuppetfileParser.parseContent(content);
      
      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]).toEqual({
        name: 'puppetlabs/stdlib',
        version: '8.5.0',
        source: 'forge',
        line: 1
      });
      expect(result.errors).toHaveLength(0);
    });

    test('should parse simple forge module without version', () => {
      const content = "mod 'puppetlabs/stdlib'";
      const result = PuppetfileParser.parseContent(content);
      
      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]).toEqual({
        name: 'puppetlabs/stdlib',
        version: undefined,
        source: 'forge',
        line: 1
      });
      expect(result.errors).toHaveLength(0);
    });

    test('should parse git module with tag', () => {
      const content = "mod 'stdlib', :git => 'https://github.com/puppetlabs/puppetlabs-stdlib.git', :tag => 'v8.5.0'";
      const result = PuppetfileParser.parseContent(content);
      
      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]).toEqual({
        name: 'stdlib',
        gitTag: 'v8.5.0',
        source: 'git',
        gitUrl: 'https://github.com/puppetlabs/puppetlabs-stdlib.git',
        line: 1
      });
      expect(result.errors).toHaveLength(0);
    });

    test('should parse git module with ref', () => {
      const content = "mod 'stdlib', :git => 'https://github.com/puppetlabs/puppetlabs-stdlib.git', :ref => 'main'";
      const result = PuppetfileParser.parseContent(content);
      
      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]).toEqual({
        name: 'stdlib',
        gitRef: 'main',
        source: 'git',
        gitUrl: 'https://github.com/puppetlabs/puppetlabs-stdlib.git',
        line: 1
      });
      expect(result.errors).toHaveLength(0);
    });

    test('should parse multiple modules', () => {
      const content = `mod 'puppetlabs/stdlib', '8.5.0'
mod 'puppetlabs/concat', '7.3.0'`;
      const result = PuppetfileParser.parseContent(content);
      
      expect(result.modules).toHaveLength(2);
      expect(result.modules[0].name).toBe('puppetlabs/stdlib');
      expect(result.modules[1].name).toBe('puppetlabs/concat');
      expect(result.errors).toHaveLength(0);
    });

    test('should handle empty content', () => {
      const content = '';
      const result = PuppetfileParser.parseContent(content);
      
      expect(result.modules).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle comments only', () => {
      const content = '# This is a comment\n// Another comment';
      const result = PuppetfileParser.parseContent(content);
      
      expect(result.modules).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('parseActiveEditor', () => {
    test('should handle no active editor', () => {
      const result = PuppetfileParser.parseActiveEditor();
      
      expect(result.modules).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('No active editor found');
    });
  });
});
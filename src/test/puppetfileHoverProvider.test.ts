import * as assert from 'assert';
import { PuppetfileHoverProvider } from '../puppetfileHoverProvider';

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
});
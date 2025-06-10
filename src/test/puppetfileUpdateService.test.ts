import * as assert from 'assert';
import { PuppetfileUpdateService } from '../puppetfileUpdateService';

suite('PuppetfileUpdateService Test Suite', () => {
    
    test('updateVersionInLine should update forge module version', () => {
        const line = "mod 'puppetlabs-stdlib', '9.4.1'";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, '9.5.0');
        assert.strictEqual(result, "mod 'puppetlabs-stdlib', '9.5.0'");
    });
    
    test('updateVersionInLine should update forge module version with inline comment', () => {
        const line = "mod 'puppetlabs-mongodb', '0.17.0' # Example of commit";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, '0.18.0');
        assert.strictEqual(result, "mod 'puppetlabs-mongodb', '0.18.0' # Example of commit");
    });
    
    test('updateVersionInLine should add version to forge module without version', () => {
        const line = "mod 'puppetlabs-apache'";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, '2.11.0');
        assert.strictEqual(result, "mod 'puppetlabs-apache', '2.11.0'");
    });
    
    test('updateVersionInLine should add version to forge module without version but with comment', () => {
        const line = "mod 'puppetlabs-mysql' # No version specified";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, '16.2.0');
        assert.strictEqual(result, "mod 'puppetlabs-mysql', '16.2.0' # No version specified");
    });
    
    test('updateVersionInLine should update git module tag', () => {
        const line = "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.0.0'";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, 'v1.1.0');
        assert.strictEqual(result, "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.1.0'");
    });
    
    test('updateVersionInLine should update git module tag with inline comment', () => {
        const line = "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.0.0' # Stable release";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, 'v1.1.0');
        assert.strictEqual(result, "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.1.0' # Stable release");
    });
    
    test('updateVersionInLine should update git module ref', () => {
        const line = "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'main'";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, 'develop');
        assert.strictEqual(result, "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'develop'");
    });
    
    test('updateVersionInLine should update git module ref with inline comment', () => {
        const line = "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'main' # Main branch";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, 'develop');
        assert.strictEqual(result, "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'develop' # Main branch");
    });
    
    test('updateVersionInLine should handle double quotes', () => {
        const line = 'mod "puppetlabs-stdlib", "9.4.1" # With double quotes';
        const result = PuppetfileUpdateService['updateVersionInLine'](line, '9.5.0');
        assert.strictEqual(result, 'mod "puppetlabs-stdlib", \'9.5.0\' # With double quotes');
    });
    
    test('updateVersionInLine should handle mixed quotes', () => {
        const line = "mod \"puppetlabs-stdlib\", '9.4.1' # Mixed quotes";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, '9.5.0');
        assert.strictEqual(result, "mod \"puppetlabs-stdlib\", '9.5.0' # Mixed quotes");
    });
    
    test('updateVersionInLine should preserve whitespace around comments', () => {
        const line = "mod 'puppetlabs-stdlib', '9.4.1'    # Lots of spaces";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, '9.5.0');
        assert.strictEqual(result, "mod 'puppetlabs-stdlib', '9.5.0'    # Lots of spaces");
    });
    
    test('updateVersionInLine should handle comment without spaces', () => {
        const line = "mod 'puppetlabs-stdlib', '9.4.1'#NoSpaces";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, '9.5.0');
        assert.strictEqual(result, "mod 'puppetlabs-stdlib', '9.5.0'#NoSpaces");
    });
    
    test('updateVersionInLine should not modify non-module lines', () => {
        const line = "forge 'https://forgeapi.puppet.com' # Comment";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, '9.5.0');
        assert.strictEqual(result, line);
    });
    
    test('updateVersionInLine should not modify comment-only lines', () => {
        const line = "# This is just a comment";
        const result = PuppetfileUpdateService['updateVersionInLine'](line, '9.5.0');
        assert.strictEqual(result, line);
    });
});
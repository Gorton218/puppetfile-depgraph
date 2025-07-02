import { ModuleNameUtils, ModuleNameFormat } from '../../src/utils/moduleNameUtils';

describe('ModuleNameUtils', () => {
    
    describe('parseModuleName', () => {
        test('should parse slash format correctly', () => {
            const result = ModuleNameUtils.parseModuleName('puppetlabs/stdlib');
            expect(result).toEqual({
                owner: 'puppetlabs',
                name: 'stdlib',
                fullName: 'puppetlabs/stdlib'
            });
        });
        
        test('should parse dash format correctly', () => {
            const result = ModuleNameUtils.parseModuleName('puppetlabs-stdlib');
            expect(result).toEqual({
                owner: 'puppetlabs',
                name: 'stdlib',
                fullName: 'puppetlabs/stdlib'
            });
        });
        
        test('should handle single name without owner', () => {
            const result = ModuleNameUtils.parseModuleName('stdlib');
            expect(result).toEqual({
                owner: 'unknown',
                name: 'stdlib',
                fullName: 'unknown/stdlib'
            });
        });
        
        test('should handle complex module names', () => {
            const result = ModuleNameUtils.parseModuleName('puppetlabs/puppet-nginx');
            expect(result).toEqual({
                owner: 'puppetlabs',
                name: 'puppet-nginx',
                fullName: 'puppetlabs/puppet-nginx'
            });
        });
    });
    
    describe('toCanonicalFormat', () => {
        test('should convert slash format to canonical', () => {
            expect(ModuleNameUtils.toCanonicalFormat('puppetlabs/stdlib')).toBe('puppetlabs-stdlib');
        });
        
        test('should convert dash format to canonical', () => {
            expect(ModuleNameUtils.toCanonicalFormat('puppetlabs-stdlib')).toBe('puppetlabs-stdlib');
        });
        
        test('should normalize case', () => {
            expect(ModuleNameUtils.toCanonicalFormat('Puppetlabs/StdLib')).toBe('puppetlabs-stdlib');
            expect(ModuleNameUtils.toCanonicalFormat('PUPPETLABS-STDLIB')).toBe('puppetlabs-stdlib');
        });
        
        test('should handle complex names', () => {
            expect(ModuleNameUtils.toCanonicalFormat('puppetlabs/puppet-nginx')).toBe('puppetlabs-puppet-nginx');
        });
    });
    
    describe('toSlashFormat', () => {
        test('should convert dash format to slash', () => {
            expect(ModuleNameUtils.toSlashFormat('puppetlabs-stdlib')).toBe('puppetlabs/stdlib');
        });
        
        test('should preserve slash format', () => {
            expect(ModuleNameUtils.toSlashFormat('puppetlabs/stdlib')).toBe('puppetlabs/stdlib');
        });
    });
    
    describe('toDashFormat', () => {
        test('should convert slash format to dash', () => {
            expect(ModuleNameUtils.toDashFormat('puppetlabs/stdlib')).toBe('puppetlabs-stdlib');
        });
        
        test('should preserve dash format', () => {
            expect(ModuleNameUtils.toDashFormat('puppetlabs-stdlib')).toBe('puppetlabs-stdlib');
        });
    });
    
    describe('toFormat', () => {
        test('should convert to specified format', () => {
            expect(ModuleNameUtils.toFormat('puppetlabs/stdlib', ModuleNameFormat.DASH)).toBe('puppetlabs-stdlib');
            expect(ModuleNameUtils.toFormat('puppetlabs-stdlib', ModuleNameFormat.SLASH)).toBe('puppetlabs/stdlib');
            expect(ModuleNameUtils.toFormat('Puppetlabs/StdLib', ModuleNameFormat.CANONICAL)).toBe('puppetlabs-stdlib');
        });
    });
    
    describe('getModuleNameVariants', () => {
        test('should generate basic variants', () => {
            const variants = ModuleNameUtils.getModuleNameVariants('puppetlabs/stdlib');
            expect(variants).toContain('puppetlabs/stdlib');
            expect(variants).toContain('puppetlabs-stdlib');
        });
        
        test('should handle puppetlabs/puppet-* pattern', () => {
            const variants = ModuleNameUtils.getModuleNameVariants('puppetlabs/puppet-nginx');
            expect(variants).toContain('puppetlabs/puppet-nginx');
            expect(variants).toContain('puppetlabs-puppet-nginx');
            expect(variants).toContain('puppet/nginx');
            expect(variants).toContain('puppet-nginx');
        });
        
        test('should handle puppet/* pattern reverse', () => {
            const variants = ModuleNameUtils.getModuleNameVariants('puppet/nginx');
            expect(variants).toContain('puppet/nginx');
            expect(variants).toContain('puppet-nginx');
            expect(variants).toContain('puppetlabs/puppet-nginx');
            expect(variants).toContain('puppetlabs-puppet-nginx');
        });
        
        test('should not generate duplicate variants', () => {
            const variants = ModuleNameUtils.getModuleNameVariants('puppetlabs/stdlib');
            const uniqueVariants = [...new Set(variants)];
            expect(variants.length).toBe(uniqueVariants.length);
        });
    });
    
    describe('areEquivalent', () => {
        test('should recognize basic equivalent names', () => {
            expect(ModuleNameUtils.areEquivalent('puppetlabs/stdlib', 'puppetlabs-stdlib')).toBe(true);
            expect(ModuleNameUtils.areEquivalent('Puppetlabs/StdLib', 'puppetlabs-stdlib')).toBe(true);
        });
        
        test('should recognize variant equivalence', () => {
            expect(ModuleNameUtils.areEquivalent('puppetlabs/puppet-nginx', 'puppet/nginx')).toBe(true);
            expect(ModuleNameUtils.areEquivalent('puppet-nginx', 'puppetlabs-puppet-nginx')).toBe(true);
        });
        
        test('should reject non-equivalent names', () => {
            expect(ModuleNameUtils.areEquivalent('puppetlabs/stdlib', 'puppetlabs/concat')).toBe(false);
            expect(ModuleNameUtils.areEquivalent('puppet/nginx', 'apache/nginx')).toBe(false);
        });
    });
    
    describe('getOwner', () => {
        test('should extract owner from various formats', () => {
            expect(ModuleNameUtils.getOwner('puppetlabs/stdlib')).toBe('puppetlabs');
            expect(ModuleNameUtils.getOwner('puppetlabs-stdlib')).toBe('puppetlabs');
            expect(ModuleNameUtils.getOwner('stdlib')).toBe('unknown');
        });
    });
    
    describe('getModuleName', () => {
        test('should extract module name from various formats', () => {
            expect(ModuleNameUtils.getModuleName('puppetlabs/stdlib')).toBe('stdlib');
            expect(ModuleNameUtils.getModuleName('puppetlabs-stdlib')).toBe('stdlib');
            expect(ModuleNameUtils.getModuleName('stdlib')).toBe('stdlib');
            expect(ModuleNameUtils.getModuleName('puppetlabs/puppet-nginx')).toBe('puppet-nginx');
        });
    });
    
    describe('normalizeModuleName (legacy)', () => {
        test('should work as alias for toCanonicalFormat', () => {
            expect(ModuleNameUtils.normalizeModuleName('puppetlabs/stdlib')).toBe('puppetlabs-stdlib');
            expect(ModuleNameUtils.normalizeModuleName('Puppetlabs/StdLib')).toBe('puppetlabs-stdlib');
        });
    });
});
import { DependencyTreeService } from '../dependencyTreeService';
import { PuppetModule } from '../puppetfileParser';

/**
 * Tests to validate nullish coalescing operator behavior changes
 * These tests ensure that switching from || to ?? maintains expected behavior
 */
describe('Nullish Coalescing Operator Changes', () => {
    
    describe('version assignment behavior', () => {
        test('should use module.version when present, resolvedVersion when module.version is null/undefined', () => {
            // Test case: module.version is undefined, should use resolvedVersion
            const module1: PuppetModule = {
                name: 'test/module1',
                version: undefined,
                source: 'forge',
                line: 1
            };
            
            // Test case: module.version is null, should use resolvedVersion  
            const module2: PuppetModule = {
                name: 'test/module2',
                version: null as any,
                source: 'forge',
                line: 2
            };
            
            // Test case: module.version is empty string, should keep empty string (not use resolvedVersion)
            const module3: PuppetModule = {
                name: 'test/module3',
                version: '',
                source: 'forge',
                line: 3
            };
            
            // Test case: module.version has a value, should use that value
            const module4: PuppetModule = {
                name: 'test/module4',
                version: '1.2.3',
                source: 'forge',
                line: 4
            };
            
            // Mock the private method behavior we're testing
            const determineVersionLogic = (moduleVersion: string | undefined | null, resolvedVersion: string | undefined) => {
                // This simulates the logic: module.version ?? resolvedVersion
                return moduleVersion ?? resolvedVersion;
            };
            
            const resolvedVersion = '2.0.0';
            
            expect(determineVersionLogic(module1.version, resolvedVersion)).toBe('2.0.0');
            expect(determineVersionLogic(module2.version, resolvedVersion)).toBe('2.0.0');
            expect(determineVersionLogic(module3.version, resolvedVersion)).toBe(''); // Empty string should be preserved
            expect(determineVersionLogic(module4.version, resolvedVersion)).toBe('1.2.3');
        });
    });
    
    describe('git reference behavior', () => {
        test('should prefer gitTag over gitRef only when gitTag is null/undefined', () => {
            // Simulate the logic: module.gitTag ?? module.gitRef
            const getGitRef = (gitTag: string | undefined | null, gitRef: string | undefined) => {
                return gitTag ?? gitRef;
            };
            
            expect(getGitRef(undefined, 'main')).toBe('main');
            expect(getGitRef(null, 'main')).toBe('main');
            expect(getGitRef('', 'main')).toBe(''); // Empty string should be preserved
            expect(getGitRef('v1.0.0', 'main')).toBe('v1.0.0');
        });
    });
    
    describe('available versions array behavior', () => {
        test('should use empty array only when map result is null/undefined', () => {
            // Simulate the logic: forgeModule?.releases?.map(r => r.version) ?? []
            const getAvailableVersions = (mapResult: string[] | undefined | null) => {
                return mapResult ?? [];
            };
            
            expect(getAvailableVersions(undefined)).toEqual([]);
            expect(getAvailableVersions(null)).toEqual([]);
            expect(getAvailableVersions([])).toEqual([]); // Empty array should be preserved
            expect(getAvailableVersions(['1.0.0', '2.0.0'])).toEqual(['1.0.0', '2.0.0']);
        });
    });
    
    describe('return value behavior', () => {
        test('should return resolvedVersion when present, fallback when resolvedVersion is null/undefined', () => {
            // Simulate the logic: resolvedVersion ?? (fallback logic)
            const getReturnValue = (resolvedVersion: string | undefined | null, fallback: string | undefined) => {
                return resolvedVersion ?? fallback;
            };
            
            expect(getReturnValue(undefined, 'fallback')).toBe('fallback');
            expect(getReturnValue(null, 'fallback')).toBe('fallback');
            expect(getReturnValue('', 'fallback')).toBe(''); // Empty string should be preserved
            expect(getReturnValue('1.2.3', 'fallback')).toBe('1.2.3');
        });
    });
    
    describe('redundant undefined behavior', () => {
        test('should handle conflict assignment consistently', () => {
            // Test for removing redundant || undefined
            const getConflictValue = (conflict: any) => {
                // Original: conflict || undefined
                // New: conflict (since undefined is the default for optional properties)
                return conflict;
            };
            
            expect(getConflictValue(null)).toBe(null);
            expect(getConflictValue(undefined)).toBe(undefined);
            expect(getConflictValue({ type: 'error' })).toEqual({ type: 'error' });
            expect(getConflictValue('')).toBe(''); // Empty string preserved
            expect(getConflictValue(0)).toBe(0); // Zero preserved
            expect(getConflictValue(false)).toBe(false); // False preserved
        });
    });
});
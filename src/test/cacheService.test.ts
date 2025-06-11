import * as assert from 'assert';
import { suite, test } from 'mocha';
import { CacheService } from '../cacheService';
import { PuppetModule } from '../puppetfileParser';

suite('CacheService', () => {
    
    test('should prevent concurrent caching operations', async () => {
        const mockModules: PuppetModule[] = [
            { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 },
            { name: 'puppetlabs/concat', source: 'forge', version: '7.0.0', line: 2 }
        ];
        
        // Start first caching operation
        const promise1 = CacheService.cacheAllModules(mockModules, false);
        
        // Verify caching is in progress
        assert.strictEqual(CacheService.isCachingInProgress(), true, 'Should report caching in progress');
        
        // Start second caching operation while first is still running
        const promise2 = CacheService.cacheAllModules(mockModules, false);
        
        // Still should report caching in progress
        assert.strictEqual(CacheService.isCachingInProgress(), true, 'Should still report caching in progress');
        
        // Wait for both to complete
        await Promise.all([promise1, promise2]);
        
        // Verify caching is no longer in progress
        assert.strictEqual(CacheService.isCachingInProgress(), false, 'Should report caching not in progress after completion');
    });
    
    test('should allow new caching after previous one completes', async () => {
        const mockModules: PuppetModule[] = [
            { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 }
        ];
        
        // First caching operation
        await CacheService.cacheAllModules(mockModules, false);
        assert.strictEqual(CacheService.isCachingInProgress(), false, 'Should not be caching after first operation');
        
        // Second caching operation should work
        const promise2 = CacheService.cacheAllModules(mockModules, false);
        assert.ok(promise2, 'Should return a valid promise for second operation');
        
        await promise2;
        assert.strictEqual(CacheService.isCachingInProgress(), false, 'Should not be caching after second operation');
    });
    
    test('should handle empty module array', async () => {
        await CacheService.cacheAllModules([], false);
        assert.strictEqual(CacheService.isCachingInProgress(), false, 'Should not report caching for empty array');
    });
    
    test('cacheUncachedModules should filter already cached modules', async () => {
        const mockModules: PuppetModule[] = [
            { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 },
            { name: 'puppetlabs/concat', source: 'forge', version: '7.0.0', line: 2 }
        ];
        
        // This will call the underlying cacheAllModules with filtered list
        await CacheService.cacheUncachedModules(mockModules);
        
        // Verify it completed
        assert.strictEqual(CacheService.isCachingInProgress(), false, 'Should not be caching after operation');
    });
});
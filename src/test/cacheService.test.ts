import { CacheService } from '../cacheService';
import { PuppetModule } from '../puppetfileParser';
import { PuppetForgeService } from '../puppetForgeService';
import * as vscode from 'vscode';

jest.mock('../puppetForgeService');
jest.mock('vscode', () => ({
    window: {
        withProgress: jest.fn(),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn()
    },
    ProgressLocation: {
        Notification: 15
    }
}));

describe('CacheService', () => {
    let mockProgress: any;
    let mockToken: any;
    let mockGetModuleReleases: jest.Mock;
    let mockHasModuleCached: jest.Mock;
    let mockWithProgress: jest.Mock;
    let mockShowInformationMessage: jest.Mock;
    let mockShowErrorMessage: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockProgress = {
            report: jest.fn()
        };
        
        mockToken = {
            isCancellationRequested: false
        };
        
        mockGetModuleReleases = PuppetForgeService.getModuleReleases as jest.Mock;
        mockHasModuleCached = PuppetForgeService.hasModuleCached as jest.Mock;
        mockWithProgress = vscode.window.withProgress as jest.Mock;
        mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;
        mockShowErrorMessage = vscode.window.showErrorMessage as jest.Mock;
        
        // Default mock implementations
        mockGetModuleReleases.mockResolvedValue([]);
        mockHasModuleCached.mockReturnValue(false);
        mockWithProgress.mockImplementation(async (options, callback) => {
            return await callback(mockProgress, mockToken);
        });
    });
    
    test('should prevent concurrent caching operations', async () => {
        const mockModules: PuppetModule[] = [
            { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 },
            { name: 'puppetlabs/concat', source: 'forge', version: '7.0.0', line: 2 }
        ];
        
        // Start first caching operation
        const promise1 = CacheService.cacheAllModules(mockModules, false);
        
        // Verify caching is in progress
        expect(CacheService.isCachingInProgress()).toBe(true); // Should report caching in progress
        
        // Start second caching operation while first is still running
        const promise2 = CacheService.cacheAllModules(mockModules, false);
        
        // Still should report caching in progress
        expect(CacheService.isCachingInProgress()).toBe(true); // Should still report caching in progress
        
        // Wait for both to complete
        await Promise.all([promise1, promise2]);
        
        // Verify caching is no longer in progress
        expect(CacheService.isCachingInProgress()).toBe(false); // Should report caching not in progress after completion
    });
    
    test('should allow new caching after previous one completes', async () => {
        const mockModules: PuppetModule[] = [
            { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 }
        ];
        
        // First caching operation
        await CacheService.cacheAllModules(mockModules, false);
        expect(CacheService.isCachingInProgress()).toBe(false); // Should not be caching after first operation
        
        // Second caching operation should work
        const promise2 = CacheService.cacheAllModules(mockModules, false);
        expect(promise2).toBeTruthy(); // Should return a valid promise for second operation
        
        await promise2;
        expect(CacheService.isCachingInProgress()).toBe(false); // Should not be caching after second operation
    });
    
    test('should handle empty module array', async () => {
        await CacheService.cacheAllModules([], false);
        expect(CacheService.isCachingInProgress()).toBe(false); // Should not report caching for empty array
    });
    
    test('cacheUncachedModules should filter already cached modules', async () => {
        const mockModules: PuppetModule[] = [
            { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 },
            { name: 'puppetlabs/concat', source: 'forge', version: '7.0.0', line: 2 }
        ];
        
        // Mock that stdlib is already cached but concat is not
        mockHasModuleCached.mockImplementation((name: string) => name === 'puppetlabs/stdlib');
        
        await CacheService.cacheUncachedModules(mockModules);
        
        // Should only attempt to cache concat
        expect(mockGetModuleReleases).toHaveBeenCalledWith('puppetlabs/concat');
        expect(mockGetModuleReleases).not.toHaveBeenCalledWith('puppetlabs/stdlib');
        expect(CacheService.isCachingInProgress()).toBe(false);
    });

    test('cacheUncachedModules should handle all modules already cached', async () => {
        const mockModules: PuppetModule[] = [
            { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 }
        ];
        
        // Mock that all modules are already cached
        mockHasModuleCached.mockReturnValue(true);
        
        await CacheService.cacheUncachedModules(mockModules);
        
        // Should not attempt to cache any modules
        expect(mockGetModuleReleases).not.toHaveBeenCalled();
        expect(mockWithProgress).not.toHaveBeenCalled();
    });

    describe('Progress and notifications', () => {
        test('should report progress correctly', async () => {
            const mockModules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 },
                { name: 'puppetlabs/concat', source: 'forge', version: '7.0.0', line: 2 }
            ];

            await CacheService.cacheAllModules(mockModules, true);

            // Should call withProgress with correct options
            expect(mockWithProgress).toHaveBeenCalledWith({
                location: vscode.ProgressLocation.Notification,
                title: "Caching module information",
                cancellable: true
            }, expect.any(Function));

            // Should report initial progress
            expect(mockProgress.report).toHaveBeenCalledWith({
                increment: 0,
                message: 'Processing 2 modules...'
            });

            // Should report completion
            expect(mockProgress.report).toHaveBeenCalledWith({
                increment: 100,
                message: 'Caching complete!'
            });

            // Should show success message
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Successfully cached information for 2 modules');
        });

        test('should not show success message when disabled', async () => {
            const mockModules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 }
            ];

            await CacheService.cacheAllModules(mockModules, false);

            expect(mockShowInformationMessage).not.toHaveBeenCalled();
        });

        test('should handle cancellation correctly', async () => {
            const mockModules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 },
                { name: 'puppetlabs/concat', source: 'forge', version: '7.0.0', line: 2 }
            ];

            // Mock cancellation during processing
            mockWithProgress.mockImplementation(async (options, callback) => {
                const cancellableToken = {
                    isCancellationRequested: false
                };
                
                // Simulate cancellation after some processing
                setTimeout(() => {
                    cancellableToken.isCancellationRequested = true;
                }, 1);
                
                return await callback(mockProgress, cancellableToken);
            });

            await CacheService.cacheAllModules(mockModules, true);

            // The test just verifies the method completes without errors during cancellation
            expect(CacheService.isCachingInProgress()).toBe(false);
        });
    });

    describe('Error handling', () => {
        test('should handle individual module errors gracefully', async () => {
            const mockModules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 },
                { name: 'puppetlabs/concat', source: 'forge', version: '7.0.0', line: 2 }
            ];

            // Mock error for first module, success for second
            mockGetModuleReleases.mockImplementation((name: string) => {
                if (name === 'puppetlabs/stdlib') {
                    return Promise.reject(new Error('Network error'));
                }
                return Promise.resolve([]);
            });

            await CacheService.cacheAllModules(mockModules, true);

            // Should still complete successfully
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Successfully cached information for 2 modules');
            
            // Should report error for failed module
            expect(mockProgress.report).toHaveBeenCalledWith({
                increment: 50,
                message: 'Skipped puppetlabs/stdlib (error) (1/2)'
            });
        });

        test('should complete caching despite module errors', async () => {
            const mockModules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 }
            ];

            // Mock all modules to fail
            mockGetModuleReleases.mockRejectedValue(new Error('Network error'));

            await CacheService.cacheAllModules(mockModules, false);

            // Should not be caching after completion
            expect(CacheService.isCachingInProgress()).toBe(false);
        });

        test('should handle errors with different types', async () => {
            const mockModules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 }
            ];

            // Mock module to throw non-Error object
            mockGetModuleReleases.mockRejectedValue('String error');

            await CacheService.cacheAllModules(mockModules, false);

            // Should still complete
            expect(CacheService.isCachingInProgress()).toBe(false);
        });
    });

    describe('Concurrency and chunking', () => {
        test('should process modules in chunks', async () => {
            // Create 12 modules to test chunking (concurrency limit is 5)
            const mockModules: PuppetModule[] = Array.from({ length: 12 }, (_, i) => ({
                name: `module${i}`,
                source: 'forge' as const,
                version: '1.0.0',
                line: i + 1
            }));

            await CacheService.cacheAllModules(mockModules, false);

            // Should have called getModuleReleases for all modules
            expect(mockGetModuleReleases).toHaveBeenCalledTimes(12);
        });

        test('should reset caching state after completion', async () => {
            const mockModules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 }
            ];

            await CacheService.cacheAllModules(mockModules, false);

            // Should not be caching after completion
            expect(CacheService.isCachingInProgress()).toBe(false);
        });

        test('should handle concurrent calls returning same promise', async () => {
            const mockModules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 }
            ];

            // Start multiple concurrent calls
            const promise1 = CacheService.cacheAllModules(mockModules, false);
            const promise2 = CacheService.cacheAllModules(mockModules, false);
            const promise3 = CacheService.cacheAllModules(mockModules, false);

            await Promise.all([promise1, promise2, promise3]);

            // Should only have processed modules once (concurrent calls should reuse same promise)
            expect(mockWithProgress).toHaveBeenCalledTimes(1);
        });
    });

    describe('Edge cases', () => {
        test('should handle module names with special characters', async () => {
            const mockModules: PuppetModule[] = [
                { name: 'user/module-with-dashes', source: 'forge', version: '1.0.0', line: 1 },
                { name: 'user/module_with_underscores', source: 'forge', version: '1.0.0', line: 2 }
            ];

            await CacheService.cacheAllModules(mockModules, false);

            expect(mockGetModuleReleases).toHaveBeenCalledWith('user/module-with-dashes');
            expect(mockGetModuleReleases).toHaveBeenCalledWith('user/module_with_underscores');
        });

        test('should handle very large module arrays', async () => {
            // Create 100 modules
            const mockModules: PuppetModule[] = Array.from({ length: 100 }, (_, i) => ({
                name: `module${i}`,
                source: 'forge' as const,
                version: '1.0.0',
                line: i + 1
            }));

            await CacheService.cacheAllModules(mockModules, false);

            expect(mockGetModuleReleases).toHaveBeenCalledTimes(100);
            expect(mockProgress.report).toHaveBeenCalledWith({
                increment: 0,
                message: 'Processing 100 modules...'
            });
        });

        test('should handle single module', async () => {
            const mockModules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', source: 'forge', version: '8.0.0', line: 1 }
            ];

            await CacheService.cacheAllModules(mockModules, true);

            expect(mockGetModuleReleases).toHaveBeenCalledTimes(1);
            expect(mockProgress.report).toHaveBeenCalledWith({
                increment: 100,
                message: 'Cached puppetlabs/stdlib (1/1)'
            });
        });
    });
});
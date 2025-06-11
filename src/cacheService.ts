import * as vscode from 'vscode';
import { PuppetForgeService } from './puppetForgeService';
import { PuppetModule } from './puppetfileParser';

export class CacheService {
    private static cachingPromise: Promise<void> | null = null;
    private static isCaching: boolean = false;
    /**
     * Cache all forge modules with progress indicator
     * @param forgeModules Array of forge modules to cache
     * @param showSuccessMessage Whether to show success message at the end
     * @returns Promise that resolves when caching is complete
     */
    public static async cacheAllModules(
        forgeModules: PuppetModule[], 
        showSuccessMessage: boolean = true
    ): Promise<void> {
        if (forgeModules.length === 0) {
            return;
        }

        // If caching is already in progress, return the existing promise
        if (this.isCaching && this.cachingPromise) {
            return this.cachingPromise;
        }

        // Mark as caching and store the promise
        this.isCaching = true;
        this.cachingPromise = this.performCaching(forgeModules, showSuccessMessage);
        
        try {
            await this.cachingPromise;
        } finally {
            this.isCaching = false;
            this.cachingPromise = null;
        }
    }

    /**
     * Internal method that performs the actual caching
     * @param forgeModules Array of forge modules to cache
     * @param showSuccessMessage Whether to show success message at the end
     * @returns Promise that resolves when caching is complete
     */
    private static async performCaching(
        forgeModules: PuppetModule[], 
        showSuccessMessage: boolean
    ): Promise<void> {
        // Show progress indicator with cancellation support
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Caching module information",
            cancellable: true
        }, async (progress, token) => {
            try {
                progress.report({ increment: 0, message: `Processing ${forgeModules.length} modules...` });
                
                let completed = 0;
                const incrementPerModule = 100 / forgeModules.length;
                
                // Process modules in parallel but with limited concurrency to avoid rate limiting
                const concurrencyLimit = 5;
                const moduleChunks: typeof forgeModules[] = [];
                
                for (let i = 0; i < forgeModules.length; i += concurrencyLimit) {
                    moduleChunks.push(forgeModules.slice(i, i + concurrencyLimit));
                }
                
                for (const chunk of moduleChunks) {
                    // Check for cancellation
                    if (token.isCancellationRequested) {
                        return;
                    }
                    
                    // Process chunk in parallel
                    const chunkPromises = chunk.map(async (module) => {
                        if (token.isCancellationRequested) {
                            return;
                        }
                        
                        try {
                            // Cache module releases (this will populate the cache)
                            await PuppetForgeService.getModuleReleases(module.name);
                            completed++;
                            
                            if (!token.isCancellationRequested) {
                                progress.report({ 
                                    increment: incrementPerModule, 
                                    message: `Cached ${module.name} (${completed}/${forgeModules.length})` 
                                });
                            }
                        } catch (error) {
                            console.warn(`Failed to cache module ${module.name}:`, error);
                            completed++;
                            
                            if (!token.isCancellationRequested) {
                                progress.report({ 
                                    increment: incrementPerModule, 
                                    message: `Skipped ${module.name} (error) (${completed}/${forgeModules.length})` 
                                });
                            }
                        }
                    });
                    
                    await Promise.all(chunkPromises);
                    
                    // Small delay between chunks to be respectful to the API
                    if (!token.isCancellationRequested && moduleChunks.indexOf(chunk) < moduleChunks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
                
                if (!token.isCancellationRequested) {
                    progress.report({ increment: 100, message: "Caching complete!" });
                    if (showSuccessMessage) {
                        vscode.window.showInformationMessage(`Successfully cached information for ${completed} modules`);
                    }
                } else if (showSuccessMessage) {
                    vscode.window.showInformationMessage(`Caching cancelled. Cached ${completed} of ${forgeModules.length} modules`);
                }
            } catch (error) {
                console.error('Error during module caching:', error);
                vscode.window.showErrorMessage(`Caching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    
    /**
     * Cache only uncached modules with progress indicator
     * @param forgeModules Array of all forge modules
     * @returns Promise that resolves when caching is complete
     */
    public static async cacheUncachedModules(forgeModules: PuppetModule[]): Promise<void> {
        // Filter to only uncached modules
        const uncachedModules = forgeModules.filter(m => !PuppetForgeService.hasModuleCached(m.name));
        
        if (uncachedModules.length === 0) {
            return;
        }
        
        // Use the same caching logic but don't show success message
        await this.cacheAllModules(uncachedModules, false);
    }
    
    /**
     * Check if caching is currently in progress
     * @returns True if caching is in progress
     */
    public static isCachingInProgress(): boolean {
        return this.isCaching;
    }
}
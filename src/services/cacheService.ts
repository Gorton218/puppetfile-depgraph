import * as vscode from 'vscode';
import { PuppetForgeService } from './puppetForgeService';
import { PuppetModule } from '../puppetfileParser';

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
     * @param progressCallback Optional callback for detailed progress updates
     * @param cancellationToken Optional cancellation token
     * @returns Promise that resolves when caching is complete
     */
    private static async performCaching(
        forgeModules: PuppetModule[], 
        showSuccessMessage: boolean,
        progressCallback?: (completed: number, total: number) => void,
        cancellationToken?: vscode.CancellationToken
    ): Promise<void> {
        // Use external cancellation token if provided, otherwise use internal one
        const useExternalProgress = progressCallback !== undefined;
        const externalToken = cancellationToken;
        
        if (useExternalProgress && externalToken) {
            // External progress mode: use provided callback and token (for three-phase system)
            await this.performActualCaching(forgeModules, progressCallback, externalToken, showSuccessMessage);
        } else {
            // Internal progress mode: use original behavior for backward compatibility
            await this.performOriginalCaching(forgeModules, showSuccessMessage);
        }
    }
    
    /**
     * Original caching implementation with VS Code progress dialog for backward compatibility
     * @param forgeModules Array of forge modules to cache
     * @param showSuccessMessage Whether to show success message at the end
     * @returns Promise that resolves when caching is complete
     */
    private static async performOriginalCaching(
        forgeModules: PuppetModule[], 
        showSuccessMessage: boolean
    ): Promise<void> {
        // Show progress indicator with cancellation support (original implementation)
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
     * Core caching logic that can be used with different progress mechanisms
     * @param forgeModules Array of forge modules to cache
     * @param progressCallback Callback for progress updates
     * @param cancellationToken Cancellation token
     * @param showSuccessMessage Whether to show success message
     * @returns Promise that resolves when caching is complete
     */
    private static async performActualCaching(
        forgeModules: PuppetModule[],
        progressCallback: (completed: number, total: number) => void,
        cancellationToken: vscode.CancellationToken,
        showSuccessMessage: boolean
    ): Promise<void> {
        let completed = 0;
        const total = forgeModules.length;
        
        // Report initial progress
        progressCallback(completed, total);
        
        // Process modules in parallel but with limited concurrency to avoid rate limiting
        const concurrencyLimit = 5;
        const moduleChunks: typeof forgeModules[] = [];
        
        for (let i = 0; i < forgeModules.length; i += concurrencyLimit) {
            moduleChunks.push(forgeModules.slice(i, i + concurrencyLimit));
        }
        
        for (const chunk of moduleChunks) {
            // Check for cancellation before processing each chunk
            if (cancellationToken.isCancellationRequested) {
                return;
            }
            
            // Process chunk in parallel
            const chunkPromises = chunk.map(async (module) => {
                if (cancellationToken.isCancellationRequested) {
                    return;
                }
                
                try {
                    // Cache module releases (this will populate the cache)
                    await PuppetForgeService.getModuleReleases(module.name);
                    completed++;
                    
                    // Report progress after each module
                    if (!cancellationToken.isCancellationRequested) {
                        progressCallback(completed, total);
                    }
                } catch (error) {
                    console.warn(`Failed to cache module ${module.name}:`, error);
                    completed++;
                    
                    // Report progress even for failed modules
                    if (!cancellationToken.isCancellationRequested) {
                        progressCallback(completed, total);
                    }
                }
            });
            
            await Promise.all(chunkPromises);
            
            // Small delay between chunks to be respectful to the API
            if (!cancellationToken.isCancellationRequested && moduleChunks.indexOf(chunk) < moduleChunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
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
     * Cache only uncached modules with progress indicator and cancellation support
     * @param forgeModules Array of all forge modules
     * @param cancellationToken VS Code cancellation token
     * @returns Promise that resolves when caching is complete or cancelled
     */
    public static async cacheUncachedModulesWithToken(
        forgeModules: PuppetModule[], 
        cancellationToken: vscode.CancellationToken
    ): Promise<void> {
        // Filter to only uncached modules
        const uncachedModules = forgeModules.filter(m => !PuppetForgeService.hasModuleCached(m.name));
        
        if (uncachedModules.length === 0 || cancellationToken.isCancellationRequested) {
            return;
        }
        
        // If caching is already in progress, return the existing promise
        if (this.isCaching && this.cachingPromise) {
            return this.cachingPromise;
        }

        // Mark as caching and store the promise
        this.isCaching = true;
        const noOpProgress = () => {}; // No progress reporting for this simple method
        this.cachingPromise = this.performActualCaching(uncachedModules, noOpProgress, cancellationToken, false);
        
        try {
            await this.cachingPromise;
        } finally {
            this.isCaching = false;
            this.cachingPromise = null;
        }
    }
    
    /**
     * Cache only uncached modules with detailed progressive updates for Phase 1
     * @param forgeModules Array of all forge modules
     * @param cancellationToken VS Code cancellation token
     * @param progressCallback Callback with (completed, total) for incremental progress
     * @returns Promise that resolves when caching is complete or cancelled
     */
    public static async cacheUncachedModulesWithProgressiveUpdates(
        forgeModules: PuppetModule[], 
        cancellationToken: vscode.CancellationToken,
        progressCallback: (completed: number, total: number) => void
    ): Promise<void> {
        // Filter to only uncached modules
        const uncachedModules = forgeModules.filter(m => !PuppetForgeService.hasModuleCached(m.name));
        
        if (uncachedModules.length === 0 || cancellationToken.isCancellationRequested) {
            progressCallback(0, 0);
            return;
        }
        
        // Reuse the existing performCaching method with enhanced progress reporting
        await this.performCaching(uncachedModules, false, progressCallback, cancellationToken);
    }
    
    /**
     * Check if caching is currently in progress
     * @returns True if caching is in progress
     */
    public static isCachingInProgress(): boolean {
        return this.isCaching;
    }
}
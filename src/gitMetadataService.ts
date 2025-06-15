import axios from 'axios';
import * as vscode from 'vscode';

/**
 * Interface for Puppet module metadata from metadata.json
 */
export interface GitModuleMetadata {
    name: string;
    version: string;
    author: string;
    summary: string;
    license: string;
    source: string;
    project_page?: string;
    issues_url?: string;
    dependencies?: Array<{
        name: string;
        version_requirement: string;
    }>;
    description?: string;
    tags?: string[];
}

/**
 * Service for fetching Git repository metadata
 */
export class GitMetadataService {
    private static readonly cache = new Map<string, GitModuleMetadata | null>();
    private static readonly TIMEOUT = 10000; // 10 seconds timeout

    /**
     * Fetch metadata.json from a Git repository
     * @param gitUrl Git repository URL
     * @param ref Optional ref/tag/branch (defaults to 'main' or 'master')
     * @returns Promise with metadata or null if not found
     */
    public static async getGitModuleMetadata(gitUrl: string, ref?: string): Promise<GitModuleMetadata | null> {
        const cacheKey = `${gitUrl}:${ref || 'default'}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            return cached || null;
        }

        try {
            const rawUrl = this.convertToRawUrl(gitUrl, ref);
            if (!rawUrl) {
                this.cache.set(cacheKey, null);
                return null;
            }

            const response = await axios.get(rawUrl, {
                timeout: this.TIMEOUT,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Puppetfile-DepGraph-VSCode-Extension',
                    'Connection': 'close'  // Ensure connections are closed after requests
                },
                validateStatus: (status) => status < 500 // Don't throw on 404s
            });

            if (response.status === 404) {
                this.cache.set(cacheKey, null);
                return null;
            }
            
            const metadata = response.data as GitModuleMetadata;
            this.cache.set(cacheKey, metadata);
            return metadata;
        } catch (error) {
            console.warn(`Failed to fetch Git metadata from ${gitUrl}:`, error);
            this.cache.set(cacheKey, null);
            return null;
        }
    }

    /**
     * Convert Git URL to raw file URL for metadata.json
     * Supports GitHub, GitLab, and Bitbucket
     * @param gitUrl Git repository URL
     * @param ref Optional ref/tag/branch
     * @returns Raw URL for metadata.json or null if unsupported
     */
    private static convertToRawUrl(gitUrl: string, ref?: string): string | null {
        // Clean up the URL
        let cleanUrl = gitUrl.replace(/\.git$/, '');
        
        // Convert SSH URLs to HTTPS
        if (cleanUrl.startsWith('git@')) {
            cleanUrl = cleanUrl.replace(/^git@([^:]+):/, 'https://$1/');
        }

        // Determine the ref to use
        const targetRef = ref || 'main'; // Default to main, will fall back to master if needed
        
        try {
            const url = new URL(cleanUrl);
            const pathname = url.pathname;
            
            if (url.hostname === 'github.com') {
                // GitHub: https://raw.githubusercontent.com/owner/repo/ref/metadata.json
                return `https://raw.githubusercontent.com${pathname}/${targetRef}/metadata.json`;
            } else if (url.hostname === 'gitlab.com') {
                // GitLab: https://gitlab.com/owner/repo/-/raw/ref/metadata.json
                return `${cleanUrl}/-/raw/${targetRef}/metadata.json`;
            } else if (url.hostname.includes('bitbucket')) {
                // Bitbucket: https://bitbucket.org/owner/repo/raw/ref/metadata.json
                return `${cleanUrl}/raw/${targetRef}/metadata.json`;
            }
            
            // For other Git hosting services, try a generic pattern
            return `${cleanUrl}/raw/${targetRef}/metadata.json`;
        } catch (error) {
            console.warn(`Failed to parse Git URL: ${gitUrl}`, error);
            return null;
        }
    }

    /**
     * Try alternative refs if the primary ref fails
     * GitHub repos might use 'master' instead of 'main'
     * @param gitUrl Git repository URL
     * @param originalRef The original ref that failed
     * @returns Promise with metadata or null
     */
    public static async tryAlternativeRefs(gitUrl: string, originalRef?: string): Promise<GitModuleMetadata | null> {
        // If no ref was specified and we failed, try common default branches
        if (!originalRef) {
            const alternatives = ['master', 'develop', 'HEAD'];
            for (const altRef of alternatives) {
                const metadata = await this.getGitModuleMetadata(gitUrl, altRef);
                if (metadata) {
                    return metadata;
                }
            }
        }
        return null;
    }

    /**
     * Get comprehensive Git module metadata with fallback attempts
     * @param gitUrl Git repository URL
     * @param ref Optional ref/tag/branch
     * @returns Promise with metadata or null
     */
    public static async getModuleMetadataWithFallback(gitUrl: string, ref?: string): Promise<GitModuleMetadata | null> {
        try {
            // Try the primary ref first
            let metadata = await this.getGitModuleMetadata(gitUrl, ref);
            
            // If that fails and no ref was specified, try alternatives
            if (!metadata && !ref) {
                metadata = await this.tryAlternativeRefs(gitUrl, ref);
            }
            
            return metadata;
        } catch (error) {
            console.warn(`Failed to get metadata for ${gitUrl}:${ref || 'default'}:`, error);
            return null;
        }
    }

    /**
     * Clear the metadata cache
     */
    public static clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache size for debugging
     */
    public static getCacheSize(): number {
        return this.cache.size;
    }

    /**
     * Check if a specific Git URL is cached
     */
    public static isCached(gitUrl: string, ref?: string): boolean {
        const cacheKey = `${gitUrl}:${ref || 'default'}`;
        return this.cache.has(cacheKey);
    }
}